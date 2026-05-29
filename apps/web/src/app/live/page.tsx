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
        text: event.text,
        pending: false,
      });
      return { ...calls, [event.callId]: { ...existing, lines } };
    }
    case "call.transferred": {
      const existing = calls[event.callId];
      if (!existing) return calls;
      return {
        ...calls,
        [event.callId]: { ...existing, transferredTo: event.transferredTo },
      };
    }
    case "appointment.booked":
      return calls;
    default:
      return calls;
  }
}

export default function LivePage() {
  const [calls, setCalls] = useState<Record<string, LiveCall>>({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = new WebSocket(backendWebSocketUrl("/dashboard/live"));

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data as string) as CallEvent;
        setCalls((prev) => applyEvent(prev, event));
      } catch (err) {
        console.error("Failed to parse live event", err);
      }
    };

    return () => socket.close();
  }, []);

  const activeCalls = Object.values(calls)
    .filter((call) => !call.endedAt)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));

  return (
    <div className="p-8">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-semibold">Live calls</h1>
        <span
          className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
          title={connected ? "Connected" : "Disconnected"}
        />
      </div>

      {activeCalls.length === 0 && <p className="text-foreground/50">No active calls right now.</p>}

      <div className="flex flex-col gap-6">
        {activeCalls.map((call) => (
          <div key={call.callId} className="rounded-lg border border-foreground/10 p-4">
            <p className="font-semibold mb-2">
              {call.callerNumber}
              {call.transferredTo && (
                <span className="ml-2 text-xs font-normal text-foreground/60">
                  transferred to {call.transferredTo}
                </span>
              )}
            </p>
            <div className="flex flex-col gap-2">
              {call.lines.map((line) => (
                <div key={line.key} className={line.speaker === "agent" ? "text-right" : ""}>
                  <span
                    className={`inline-block rounded-lg px-3 py-2 text-sm max-w-md ${
                      line.pending ? "opacity-50 italic" : ""
                    } ${line.speaker === "agent" ? "bg-foreground text-background" : "bg-foreground/10"}`}
                  >
                    {line.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
