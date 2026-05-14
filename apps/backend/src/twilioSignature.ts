import type { FastifyRequest } from "fastify";
import twilio from "twilio";

// Twilio signs every webhook request; without this check anyone who finds the
// URL could POST fake call events straight into the system.
export function isValidTwilioRequest(req: FastifyRequest): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = req.headers["x-twilio-signature"];
  const publicBaseUrl = process.env.PUBLIC_BASE_URL;

  if (!authToken || !publicBaseUrl || typeof signature !== "string") {
    return false;
  }

  const url = `${publicBaseUrl}${req.url}`;
  const params = (req.body ?? {}) as Record<string, string>;

  return twilio.validateRequest(authToken, signature, url, params);
}
