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
