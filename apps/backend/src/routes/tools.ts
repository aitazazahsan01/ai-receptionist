import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import twilio from "twilio";
import { prisma } from "../db";
import { publishEvent } from "../events";
import { createCalendarEvent, isSlotFree, slotBounds } from "../googleCalendar";
import { twilioClient } from "../twilioClient";

const { VoiceResponse } = twilio.twiml;

// These endpoints are only ever called by the agent worker, never a browser or
// the public internet -- a shared secret is enough (see agent/.env.example,
// which must set the same value as INTERNAL_TOOLS_SECRET here).
async function requireInternalSecret(req: FastifyRequest, reply: FastifyReply) {
  const expected = process.env.INTERNAL_TOOLS_SECRET;
  const header = req.headers.authorization;
  if (!expected || header !== `Bearer ${expected}`) {
    reply.code(401).send({ error: "unauthorized" });
  }
}

export async function toolsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireInternalSecret);

  app.post("/tools/lookup-faq", async (req) => {
    const { query } = req.body as { query?: string };
    if (!query) {
      return { found: false };
    }

    // Naive substring match -- fine for a handful of seeded FAQs. Revisit with
    // full-text search or embeddings if the FAQ table grows past this working.
    const match = await prisma.faq.findFirst({
      where: {
        OR: [
          { question: { contains: query, mode: "insensitive" } },
          { topic: { contains: query, mode: "insensitive" } },
        ],
      },
    });

    if (!match) {
      return { found: false };
    }
    return { found: true, answer: match.answer };
  });

  // Called once per call, right after the agent joins the room (see
  // agent/src/agent.ts's entry()). The LiveKit SIP participant's
  // `sip.twilio.callSid` attribute is the CallSid of the <Dial><Sip> CHILD
  // leg Twilio created to reach LiveKit -- NOT the original inbound call
  // that /twilio/incoming-call recorded in `calls.twilio_call_sid`. Resolve
  // the true parent via Twilio's REST API once here, so every later tool
  // call can just pass the already-resolved internal callId instead of
  // repeating this lookup (and its Twilio API round trip) every time.
  app.post("/tools/resolve-call", async (req) => {
    const { twilioCallSid } = req.body as { twilioCallSid?: string };
    if (!twilioCallSid) {
      return { callId: null };
    }

    try {
      const childCall = await twilioClient.calls(twilioCallSid).fetch();
      const rootCallSid = childCall.parentCallSid || twilioCallSid;
      const call = await prisma.call.findUnique({ where: { twilioCallSid: rootCallSid } });
      return { callId: call?.id ?? null };
    } catch (err) {
      // Expected outside a real Twilio call (e.g. local `lk agent console`
      // testing, where there's no such CallSid to look up) -- degrade to
      // "not linked to a call row" rather than failing the agent's session.
      app.log.error(err, "resolve-call failed");
      return { callId: null };
    }
  });

  app.post("/tools/transfer-to-human", async (req, reply) => {
    const { reason, callId } = req.body as { reason?: string; callId?: string };
    const humanNumber = process.env.HUMAN_TRANSFER_NUMBER;

    if (!callId || !humanNumber) {
      app.log.warn(
        { reason, callId, configured: Boolean(humanNumber) },
        "transfer_to_human: missing callId or HUMAN_TRANSFER_NUMBER, not transferring",
      );
      reply.code(202);
      return { status: "not_transferred" };
    }

    try {
      const call = await prisma.call.findUnique({ where: { id: callId } });
      if (!call) {
        reply.code(404);
        return { status: "not_transferred", error: "call not found" };
      }

      // Redirecting the ORIGINAL inbound call (not the SIP child leg) is what
