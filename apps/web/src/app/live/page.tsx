"use client";

import { useEffect, useState } from "react";
import { backendWebSocketUrl } from "@/lib/api";
import type { CallEvent, Speaker } from "@/lib/types";

type TranscriptLine = { key: string; speaker: Speaker; text: string; pending: boolean };

type LiveCall = {
  callId: string;
  callerNumber: string;
  startedAt: string;
  endedAt: string | null;
  transferredTo: string | null;
  lines: TranscriptLine[];
};

// A partial line (still being spoken/transcribed) is replaced in place by the
// next partial or by the final for the same speaker, rather than appended --
// that's what makes the caller's line look like it's "typing" live.
function applyEvent(calls: Record<string, LiveCall>, event: CallEvent): Record<string, LiveCall> {
  switch (event.type) {
    case "call.started":
      return {
        ...calls,
        [event.callId]: {
          callId: event.callId,
          callerNumber: event.callerNumber,
          startedAt: event.createdAt,
          endedAt: null,
          transferredTo: null,
          lines: [],
        },
      };
    case "call.ended": {
      const existing = calls[event.callId];
      if (!existing) return calls;
      return { ...calls, [event.callId]: { ...existing, endedAt: event.createdAt } };
    }
    case "transcript.partial": {
      const existing = calls[event.callId];
      if (!existing) return calls;
      const lines = existing.lines.filter((l) => !(l.pending && l.speaker === event.speaker));
      lines.push({
        key: `pending-${event.speaker}`,
        speaker: event.speaker,
        text: event.text,
        pending: true,
      });
      return { ...calls, [event.callId]: { ...existing, lines } };
    }
    case "transcript.final": {
      const existing = calls[event.callId];
      if (!existing) return calls;
      const lines = existing.lines.filter((l) => !(l.pending && l.speaker === event.speaker));
      lines.push({
        key: `${event.createdAt}-${lines.length}`,
        speaker: event.speaker,
