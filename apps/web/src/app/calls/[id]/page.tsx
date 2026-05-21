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
