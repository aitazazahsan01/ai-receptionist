import { fetchBackend } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import type { Analytics } from "@/lib/types";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-foreground/10 p-4">
      <p className="text-sm text-foreground/60 mb-1">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default async function AnalyticsPage() {
  const analytics = await fetchBackend<Analytics>("/api/analytics");

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">Analytics</h1>
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Total calls" value={String(analytics.totalCalls)} />
        <StatCard label="Booked appointments" value={String(analytics.bookedAppointments)} />
        <StatCard label="Average call duration" value={formatDuration(analytics.avgDurationSec)} />
        <StatCard
          label="Booking conversion"
          value={`${Math.round(analytics.bookingConversionRate * 100)}%`}
        />
      </div>
    </div>
  );
}
