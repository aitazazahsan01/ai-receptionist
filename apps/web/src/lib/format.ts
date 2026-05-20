export function formatDuration(sec: number | null | undefined): string {
  if (sec === null || sec === undefined) return "-";
