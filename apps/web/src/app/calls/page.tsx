import Link from "next/link";
import { fetchBackend } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import type { Call } from "@/lib/types";

export default async function CallsPage() {
  const { calls } = await fetchBackend<{ calls: Call[] }>("/api/calls");

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">Call history</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-foreground/10 text-sm text-foreground/60">
              <th className="py-2 pr-4">Caller</th>
              <th className="py-2 pr-4">Started</th>
              <th className="py-2 pr-4">Duration</th>
