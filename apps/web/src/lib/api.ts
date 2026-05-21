const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export function backendUrl(path: string): string {
  return `${BACKEND_URL}${path}`;
}

export function backendWebSocketUrl(path: string): string {
  return `${BACKEND_URL.replace(/^http/, "ws")}${path}`;
