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
