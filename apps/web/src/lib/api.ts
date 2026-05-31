const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export function backendUrl(path: string): string {
  return `${BACKEND_URL}${path}`;
}

export function backendWebSocketUrl(path: string): string {
  return `${BACKEND_URL.replace(/^http/, "ws")}${path}`;
}

// Always no-store: this is a small internal dashboard reading live operational
// data (call history, analytics) -- stale cached results would be actively
// misleading, and the traffic volume never justifies caching them.
export async function fetchBackend<T>(path: string): Promise<T> {
  const res = await fetch(backendUrl(path), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Backend request to ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}
