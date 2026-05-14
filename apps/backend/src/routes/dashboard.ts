import type { FastifyInstance } from "fastify";
import { EVENTS_CHANNEL } from "../events";
import { redis } from "../redis";

// One Redis subscriber connection per connected dashboard client -- simplest
// correct thing for the handful of concurrent viewers this app will ever have.
// A single shared subscriber fanned out in-process would scale further but
// isn't worth the complexity yet (see docs/02-ARCHITECTURE.md Phase 6 note).
export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard/live", { websocket: true }, (socket) => {
    const subscriber = redis.duplicate();

    subscriber.subscribe(EVENTS_CHANNEL).catch((err) => {
      app.log.error(err, "dashboard websocket: failed to subscribe to call-events");
      socket.close();
    });

    subscriber.on("message", (_channel, message) => {
      socket.send(message);
    });

    socket.on("close", () => {
      subscriber.unsubscribe(EVENTS_CHANNEL).catch(() => {});
      subscriber.quit().catch(() => {});
    });
  });
}
