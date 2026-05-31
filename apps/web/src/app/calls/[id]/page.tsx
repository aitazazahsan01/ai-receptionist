import Link from "next/link";
import { notFound } from "next/navigation";
import { backendUrl } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import type { CallDetail } from "@/lib/types";

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const res = await fetch(backendUrl(`/api/calls/${id}`), { cache: "no-store" });
  if (res.status === 404) {
    notFound();
  }
  if (!res.ok) {
    throw new Error(`Failed to load call ${id}: ${res.status}`);
  }
  const { call } = (await res.json()) as { call: CallDetail };

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/calls" className="text-sm text-foreground/60 hover:underline">
        &larr; Call history
      </Link>

      <h1 className="text-2xl font-semibold mt-2 mb-1">{call.callerNumber}</h1>
      <p className="text-sm text-foreground/60 mb-6">
        {new Date(call.startedAt).toLocaleString()} &middot; {formatDuration(call.durationSec)}{" "}
        &middot; {call.outcome ?? "no outcome recorded"}
      </p>

      {call.appointments.length > 0 && (
        <div className="mb-6 rounded-lg border border-foreground/10 p-4">
          <h2 className="font-semibold mb-2">Appointments</h2>
          {call.appointments.map((appt) => (
            <p key={appt.id} className="text-sm">
              {appt.callerName ?? "Unknown"} &middot;{" "}
              {new Date(appt.scheduledStart).toLocaleString()} &middot; {appt.status}
            </p>
          ))}
        </div>
      )}

      <h2 className="font-semibold mb-2">Transcript</h2>
      <div className="flex flex-col gap-2">
        {call.transcriptEntries.map((entry) => (
          <div key={entry.id} className={entry.speaker === "agent" ? "text-right" : ""}>
            <span
              className={`inline-block rounded-lg px-3 py-2 text-sm max-w-md ${
                entry.speaker === "agent"
                  ? "bg-foreground text-background"
                  : "bg-foreground/10"
              }`}
            >
              {entry.text}
            </span>
          </div>
        ))}
        {call.transcriptEntries.length === 0 && (
          <p className="text-sm text-foreground/50">No transcript recorded for this call.</p>
        )}
      </div>
    </div>
  );
}
