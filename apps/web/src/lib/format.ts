export function formatDuration(sec: number | null | undefined): string {
  if (sec === null || sec === undefined) return "-";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
