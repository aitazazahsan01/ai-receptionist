import Redis from "ioredis";

export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

export async function pingRedis(): Promise<boolean> {
  if (redis.status !== "ready" && redis.status !== "connecting") {
    await redis.connect();
  }
  const reply = await redis.ping();
  return reply === "PONG";
}
