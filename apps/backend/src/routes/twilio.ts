import type { FastifyInstance, FastifyRequest } from "fastify";
import twilio from "twilio";
import { prisma } from "../db";
import { publishEvent } from "../events";
import { isValidTwilioRequest } from "../twilioSignature";

const { VoiceResponse } = twilio.twiml;

// LiveKit's supported inbound-Twilio pattern: redirect the call over SIP into
// LiveKit, which routes it into a room via a dispatch rule and auto-starts the
// agent worker (agent/). This is why there's no audio-relay code in this repo --
// LiveKit Agents' whole reason for existing is to not hand-roll that ourselves.
// See docs/02-ARCHITECTURE.md and infra/livekit-sip/README.md for the trunk +
// dispatch rule setup this depends on.
function sipUri(toNumber: string): string {
  const sipHost = process.env.LIVEKIT_SIP_HOST ?? "";
  return `sip:${toNumber}@${sipHost};transport=tcp`;
}

export async function twilioRoutes(app: FastifyInstance) {
  // Twilio hits this the instant someone dials the number.
  app.post("/twilio/incoming-call", async (req: FastifyRequest, reply) => {
    if (!isValidTwilioRequest(req)) {
      app.log.warn("Rejected /twilio/incoming-call: invalid or missing Twilio signature");
      reply.code(403);
      return;
    }

    const body = req.body as Record<string, string>;
    const callSid = body.CallSid;
    const from = body.From ?? "unknown";
    const to = body.To ?? "unknown";

    // upsert, not create: Twilio retries webhooks that don't respond fast enough,
    // and a duplicate CallSid would otherwise throw on the unique constraint.
    const call = await prisma.call.upsert({
      where: { twilioCallSid: callSid },
      update: {},
      create: {
        twilioCallSid: callSid,
        callerNumber: from,
        startedAt: new Date(),
      },
    });

