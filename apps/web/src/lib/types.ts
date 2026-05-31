export type CallOutcome = "booked" | "faq_answered" | "transferred" | "abandoned" | "no_action";
export type Speaker = "caller" | "agent";

export type Call = {
  id: string;
  twilioCallSid: string;
  callerNumber: string;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
  outcome: CallOutcome | null;
  transferredTo: string | null;
};

export type TranscriptEntry = {
  id: string;
  callId: string;
  speaker: Speaker;
  text: string;
  spokenAt: string;
  sequence: number;
};

export type Appointment = {
  id: string;
  callId: string | null;
  googleEventId: string | null;
  callerName: string | null;
  callerPhone: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  status: "confirmed" | "cancelled";
  createdAt: string;
};

export type CallDetail = Call & {
  transcriptEntries: TranscriptEntry[];
  appointments: Appointment[];
};

export type Analytics = {
  totalCalls: number;
  bookedAppointments: number;
  avgDurationSec: number | null;
  bookingConversionRate: number;
};

// Mirrors apps/backend/src/events.ts's CallEvent union -- kept in sync by hand
// since the dashboard is a separate package from the backend.
export type CallEvent =
  | { type: "call.started"; callId: string; callerNumber: string; createdAt: string }
  | { type: "call.ended"; callId: string; durationSec: number | null; createdAt: string }
  | { type: "transcript.partial"; callId: string; speaker: Speaker; text: string; createdAt: string }
  | { type: "transcript.final"; callId: string; speaker: Speaker; text: string; createdAt: string }
  | {
      type: "appointment.booked";
      callId: string | null;
      appointmentId: string;
      start: string;
      end: string;
      createdAt: string;
    }
  | { type: "call.transferred"; callId: string; transferredTo: string; createdAt: string };
