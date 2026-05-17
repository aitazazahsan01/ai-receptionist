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

    app.log.info({ callId: call.id, twilioCallSid: callSid, from, to }, "call started");

    await publishEvent({
      type: "call.started",
      callId: call.id,
      callerNumber: from,
      createdAt: new Date().toISOString(),
    }).catch((err) => app.log.error(err, "failed to publish call.started"));

    const response = new VoiceResponse();
    const dial = response.dial();
    dial.sip(
      {
        username: process.env.LIVEKIT_SIP_USERNAME ?? "",
        password: process.env.LIVEKIT_SIP_PASSWORD ?? "",
        statusCallback: `${process.env.PUBLIC_BASE_URL}/twilio/call-status`,
        statusCallbackEvent: ["completed"],
        statusCallbackMethod: "POST",
      },
      sipUri(to),
    );

    reply.type("text/xml").send(response.toString());
  });

  // Fired when the SIP leg (the whole call, since it's the only leg we dial)
  // ends -- this is our signal to close out the call record.
  app.post("/twilio/call-status", async (req: FastifyRequest, reply) => {
    if (!isValidTwilioRequest(req)) {
      app.log.warn("Rejected /twilio/call-status: invalid or missing Twilio signature");
      reply.code(403);
      return;
    }

    const body = req.body as Record<string, string>;
    // Twilio's docs are inconsistent about whether a <Sip> leg's status
    // callback reports the original call under CallSid or ParentCallSid --
    // try both rather than assuming.
    const callSid = body.ParentCallSid || body.CallSid;
    const callDuration = body.DialCallDuration ?? body.CallDuration;

    if (callSid) {
      await prisma.call
        .update({
          where: { twilioCallSid: callSid },
          data: {
            endedAt: new Date(),
            durationSec: callDuration ? Number(callDuration) : null,
          },
        })
        .then((call) => {
          app.log.info(
            { callId: call.id, twilioCallSid: callSid, durationSec: call.durationSec },
            "call ended",
          );
          return publishEvent({
            type: "call.ended",
            callId: call.id,
            durationSec: call.durationSec,
            createdAt: new Date().toISOString(),
          });
        })
        .catch((err) => app.log.error(err, "failed to close out call record"));
    }

    reply.code(204).send();
  });
}
