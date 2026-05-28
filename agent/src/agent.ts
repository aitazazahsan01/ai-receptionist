import "dotenv/config";
import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  cli,
  defineAgent,
  voice,
} from "@livekit/agents";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as elevenlabs from "@livekit/agents-plugin-elevenlabs";
import * as openai from "@livekit/agents-plugin-openai";
import * as silero from "@livekit/agents-plugin-silero";
import { fileURLToPath } from "node:url";
import { callBackendTool } from "./backendClient.js";
import { buildReceptionistTools } from "./tools.js";

// Built fresh per call (not module-level) so "today" is always accurate --
// callers give relative dates ("tomorrow", "Tuesday afternoon") and the model
// needs the current business-local date/time to resolve those itself.
function buildInstructions(): string {
  const timezone = process.env.BUSINESS_TIMEZONE ?? "UTC";
  const now = new Date().toLocaleString("en-US", {
    timeZone: timezone,
    dateStyle: "full",
    timeStyle: "short",
  });

  return `
You are the AI receptionist for a small business, answering an incoming phone call.
Your interface with the caller is voice only, so:
- Keep responses short and conversational -- a sentence or two per turn, not paragraphs.
- Never use text-only formatting (no bullet points, asterisks, or emojis) since it will be spoken aloud.
- Use the lookup_faq tool for factual questions about the business (hours, location,
  policies, services) instead of guessing.
- If you don't know something even after checking, say so plainly rather than guessing.

For appointment booking:
- Right now it is ${now} (business timezone: ${timezone}). Use this to resolve
  relative dates the caller gives you (e.g. "tomorrow", "Tuesday afternoon") into
  an exact date (YYYY-MM-DD) and 24-hour time (HH:mm) before calling any tool.
- Call check_availability once you have a specific date and time in mind, before
  promising it to the caller.
- Only call book_appointment after the caller has explicitly confirmed the date,
  time, and given you their name and a callback phone number.
- If a slot isn't available, offer to check a nearby time instead of giving up.

If the caller asks for a human, or you're not able to help after a couple of tries,
use the transfer_to_human tool -- don't just keep trying indefinitely.
`.trim();
}

function buildAgent(callId: string | null) {
  return voice.Agent.create({
    instructions: buildInstructions(),
    tools: buildReceptionistTools(callId),
  });
}

// Pushes every finalized conversation turn to the backend for persistence +
// live dashboard broadcast (Phase 6). Partial caller transcripts go out too,
// for live-scrolling captions, but only finalized turns get written to
// Postgres (see /tools/log-transcript on the backend).
function wireTranscriptLogging(session: voice.AgentSession, callId: string | null) {
  const logTranscript = (body: {
    speaker: "caller" | "agent";
    text: string;
    isFinal: boolean;
  }) => {
    callBackendTool("/tools/log-transcript", { callId, ...body }).catch((err) =>
      console.error("Failed to log transcript entry", err),
    );
  };

  session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (ev) => {
    if (ev.isFinal) return; // finalized turns are logged via conversation_item_added below
    logTranscript({ speaker: "caller", text: ev.transcript, isFinal: false });
  });

  session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev) => {
    if (ev.item.type !== "message") return; // skip agent-handoff items, not used here
    const text = ev.item.textContent;
    if (!text) return;
    logTranscript({
      speaker: ev.item.role === "assistant" ? "agent" : "caller",
      text,
      isFinal: true,
    });
  });
}

// Without this, a transient STT/TTS/LLM provider error (timeout, rate limit --
// a real risk on the free tiers this project runs on, see
// docs/03-FREE-TIER-STACK.md) fails silently: the session just stops
// responding with nothing in the logs to explain why. `callId` (or the raw
// room name as a fallback) makes the log line greppable back to one call.
function wireErrorLogging(
  session: voice.AgentSession,
  callId: string | null,
  roomName: string | undefined,
) {
  const correlation = callId ?? `room:${roomName}`;
  session.on(voice.AgentSessionEventTypes.Error, (ev) => {
    console.error(`[${correlation}] agent session error:`, ev.error);
  });
}

function buildLlm() {
  // Groq's free tier, via its OpenAI-compatible endpoint -- see
  // docs/03-FREE-TIER-STACK.md. Swap for a hosted OpenAI/Anthropic model later
  // by dropping baseURL/apiKey once there's paid budget; nothing else changes.
  return new openai.LLM({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
    model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
  });
}

export default defineAgent({
  // Runs once per worker process, not per call -- loading the VAD model here
  // instead of in `entry` avoids paying that cost on every incoming call.
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },

  // Runs once per call, when the agent is dispatched into a room.
  entry: async (ctx: JobContext) => {
    const vad = ctx.proc.userData.vad as silero.VAD;

    // Connect before reading participant info -- the SIP participant (the
    // caller) doesn't exist in the room until the agent has joined it.
    await ctx.connect();

    // LiveKit's Twilio SIP integration surfaces the originating call's Twilio
    // CallSid as a participant attribute -- but it's the CallSid of the
    // <Dial><Sip> CHILD leg Twilio created to reach LiveKit, not the original
    // inbound call the backend recorded from the incoming-call webhook. Ask
    // the backend to resolve the real parent and hand back our internal
    // `calls.id`, once per call, so every tool call below can just pass that
    // instead of re-resolving it every time. Absent outside real Twilio calls
    // (e.g. local `lk agent console` testing) or if resolution fails, in
    // which case it's simply null -- tool calls still work, just without a
    // linked call row.
    const participant = await ctx.waitForParticipant();
    const twilioCallSid = participant.attributes["sip.twilio.callSid"];
    const { callId } = await callBackendTool<{ callId: string | null }>("/tools/resolve-call", {
      twilioCallSid,
    }).catch(() => ({ callId: null }));

    const session = new voice.AgentSession({
      vad,
      stt: new deepgram.STT(),
      llm: buildLlm(),
      tts: new elevenlabs.TTS(),
    });

    wireTranscriptLogging(session, callId);
    wireErrorLogging(session, callId, ctx.room.name);

    await session.start({
      agent: buildAgent(callId),
      room: ctx.room,
    });

    session.generateReply({
      instructions: "Greet the caller as the business's receptionist and ask how you can help.",
    });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: "ai-receptionist",
  }),
);
