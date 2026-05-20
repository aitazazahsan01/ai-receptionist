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
