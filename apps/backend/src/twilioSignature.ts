import type { FastifyRequest } from "fastify";
import twilio from "twilio";

// Twilio signs every webhook request; without this check anyone who finds the
// URL could POST fake call events straight into the system.
export function isValidTwilioRequest(req: FastifyRequest): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
