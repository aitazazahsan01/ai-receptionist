import type { FastifyInstance } from "fastify";
import { prisma } from "../db";

// Read-only endpoints for the Next.js dashboard (Phase 6): call history and
// simple aggregate analytics. No auth yet -- fine for local/dev use behind
// nothing but localhost; Phase 8 adds basic auth before this is ever exposed
// to the internet.
export async function apiRoutes(app: FastifyInstance) {
  app.get("/api/calls", async () => {
    const calls = await prisma.call.findMany({
      orderBy: { startedAt: "desc" },
      take: 50,
    });
    return { calls };
  });

  app.get("/api/calls/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const call = await prisma.call.findUnique({
      where: { id },
      include: {
        transcriptEntries: { orderBy: { sequence: "asc" } },
        appointments: true,
      },
    });

    if (!call) {
      reply.code(404);
      return { error: "not found" };
    }
    return { call };
  });

  app.get("/api/analytics", async () => {
    const [totalCalls, bookedAppointments, avgDuration] = await Promise.all([
      prisma.call.count(),
      prisma.appointment.count({ where: { status: "confirmed" } }),
      prisma.call.aggregate({
        _avg: { durationSec: true },
        where: { durationSec: { not: null } },
      }),
    ]);

    return {
