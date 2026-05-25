const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export async function callBackendTool<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
