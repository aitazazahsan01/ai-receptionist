import "dotenv/config";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { pingDb } from "./db";
import { pingRedis } from "./redis";
import { apiRoutes } from "./routes/api";
import { dashboardRoutes } from "./routes/dashboard";
import { toolsRoutes } from "./routes/tools";
import { twilioRoutes } from "./routes/twilio";

async function main() {
  const app = Fastify({ logger: true });

  // Twilio POSTs webhooks as application/x-www-form-urlencoded, not JSON.
  await app.register(formbody);
  await app.register(websocket);
  // Only the dashboard's own origin needs to read /api/* and /dashboard/live --
  // everything else (Twilio, the agent worker) talks to this backend server-to-server.
  await app.register(cors, { origin: process.env.DASHBOARD_ORIGIN ?? "http://localhost:3000" });

  app.get("/health", async () => {
    return { status: "ok", service: "ai-receptionist-backend" };
  });

  // Separate from /health so container orchestration can distinguish
  // "process is up" from "process is up AND its dependencies are up."
  app.get("/health/deps", async (_req, reply) => {
    const [dbOk, redisOk] = await Promise.all([
      pingDb().catch(() => false),
      pingRedis().catch(() => false),
    ]);

    const ok = dbOk && redisOk;
    reply.code(ok ? 200 : 503);
    return { postgres: dbOk, redis: redisOk };
  });

  await app.register(twilioRoutes);
  await app.register(toolsRoutes);
  await app.register(dashboardRoutes);
  await app.register(apiRoutes);

  const port = Number(process.env.PORT ?? 4000);
  await app.listen({ port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
