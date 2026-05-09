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
