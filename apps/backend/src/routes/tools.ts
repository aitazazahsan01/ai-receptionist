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
      // actually moves the caller -- this interrupts its in-progress
      // <Dial><Sip> and replaces it with new TwiML. The redirect can land
      // mid-sentence from the agent's perspective (its own spoken reply may
      // not make it out before the SIP leg drops), so <Say> here is the
      // caller's only *reliable* acknowledgment that a transfer is happening.
      const response = new VoiceResponse();
      response.say("Transferring you to a team member now.");
      response.dial(humanNumber);
      await twilioClient.calls(call.twilioCallSid).update({ twiml: response.toString() });

      await prisma.call.update({
        where: { id: callId },
        data: { outcome: "transferred", transferredTo: humanNumber },
      });

      await publishEvent({
        type: "call.transferred",
        callId,
        transferredTo: humanNumber,
        createdAt: new Date().toISOString(),
      }).catch((err) => app.log.error(err, "failed to publish call.transferred"));

      app.log.info({ reason, callId }, "transferred call to human");
      return { status: "transferred" };
    } catch (err) {
      app.log.error(err, "transfer-to-human failed");
      reply.code(500);
      return {
        status: "not_transferred",
        error: err instanceof Error ? err.message : "unknown error",
      };
    }
  });

  // Not an LLM-callable tool -- the agent pushes every finalized conversation
  // turn here (see agent/src/agent.ts's wireTranscriptLogging) so it can be
  // persisted and broadcast to the live dashboard. Partial (isFinal: false)
  // entries are published for live captions but never written to Postgres.
  app.post("/tools/log-transcript", async (req, reply) => {
    const { callId, speaker, text, isFinal } = req.body as {
      callId?: string;
      speaker?: "caller" | "agent";
      text?: string;
      isFinal?: boolean;
    };
    if (!speaker || !text) {
      reply.code(400);
      return { error: "speaker and text are required" };
    }

    const createdAt = new Date().toISOString();

    if (isFinal && callId) {
      const sequence = await prisma.transcriptEntry.count({ where: { callId } });
      await prisma.transcriptEntry.create({
        data: { callId, speaker, text, spokenAt: new Date(), sequence },
      });
    }

    if (callId) {
      await publishEvent({
        type: isFinal ? "transcript.final" : "transcript.partial",
        callId,
        speaker,
        text,
        createdAt,
      }).catch((err) => app.log.error(err, "failed to publish transcript event"));
    }

    return { ok: true, persisted: Boolean(isFinal && callId) };
  });

  app.post("/tools/check-availability", async (req, reply) => {
    const { date, time } = req.body as { date?: string; time?: string };
    if (!date || !time) {
      reply.code(400);
      return { error: "date and time are required" };
    }

    try {
      const { start, end } = slotBounds(date, time);
      const available = await isSlotFree(start, end);
      return { available, start: start.toISO(), end: end.toISO() };
    } catch (err) {
      app.log.error(err, "check-availability failed");
      reply.code(422);
      return { error: err instanceof Error ? err.message : "invalid request" };
    }
  });

  app.post("/tools/book-appointment", async (req, reply) => {
    const { date, time, callerName, callerPhone, callId } = req.body as {
      date?: string;
      time?: string;
      callerName?: string;
      callerPhone?: string;
      callId?: string;
    };
    if (!date || !time || !callerName || !callerPhone) {
      reply.code(400);
      return { error: "date, time, callerName, and callerPhone are required" };
    }

    try {
      const { start, end } = slotBounds(date, time);
      const available = await isSlotFree(start, end);
      if (!available) {
        return { booked: false, reason: "slot_taken" };
      }

      const googleEventId = await createCalendarEvent({ start, end, callerName, callerPhone });
      const appointment = await prisma.appointment.create({
        data: {
          callId: callId ?? null,
          googleEventId,
          callerName,
          callerPhone,
          scheduledStart: start.toJSDate(),
          scheduledEnd: end.toJSDate(),
        },
      });

      app.log.info(
        { callId, appointmentId: appointment.id, start: start.toISO() },
        "appointment booked",
      );

      await publishEvent({
        type: "appointment.booked",
        callId: callId ?? null,
        appointmentId: appointment.id,
        start: start.toISO() ?? start.toString(),
        end: end.toISO() ?? end.toString(),
        createdAt: new Date().toISOString(),
      }).catch((err) => app.log.error(err, "failed to publish appointment.booked"));

      return { booked: true, appointmentId: appointment.id, start: start.toISO(), end: end.toISO() };
    } catch (err) {
      app.log.error(err, "book-appointment failed");
      reply.code(422);
      return { booked: false, error: err instanceof Error ? err.message : "invalid request" };
    }
  });
}
