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
