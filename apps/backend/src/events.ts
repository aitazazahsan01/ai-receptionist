import { redis } from "./redis";

// Single channel carrying every call-lifecycle event as JSON. The dashboard's
// WebSocket layer (Phase 6) subscribes to this and fans it out to browser
// clients, filtering by callId client-side for the live single-call view.
export const EVENTS_CHANNEL = "call-events";

export type CallEvent =
  | { type: "call.started"; callId: string; callerNumber: string; createdAt: string }
  | { type: "call.ended"; callId: string; durationSec: number | null; createdAt: string }
  | {
      type: "transcript.partial";
      callId: string;
      speaker: "caller" | "agent";
      text: string;
      createdAt: string;
    }
  | {
      type: "transcript.final";
      callId: string;
      speaker: "caller" | "agent";
      text: string;
      createdAt: string;
    }
  | {
      type: "appointment.booked";
      callId: string | null;
      appointmentId: string;
      start: string;
      end: string;
      createdAt: string;
    }
  | { type: "call.transferred"; callId: string; transferredTo: string; createdAt: string };

export async function publishEvent(event: CallEvent): Promise<void> {
  await redis.publish(EVENTS_CHANNEL, JSON.stringify(event));
}
