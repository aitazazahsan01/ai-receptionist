import { DateTime } from "luxon";
import { google } from "googleapis";

// Service account auth -- no per-user OAuth flow needed since this app only
// ever manages one shared business calendar (see docs/03-FREE-TIER-STACK.md).
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? "primary";
const TIMEZONE = process.env.BUSINESS_TIMEZONE ?? "UTC";
const APPOINTMENT_MINUTES = Number(process.env.APPOINTMENT_DURATION_MINUTES ?? 30);

function getCalendarClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  return google.calendar({ version: "v3", auth });
}

export function slotBounds(date: string, time: string): { start: DateTime; end: DateTime } {
  const start = DateTime.fromISO(`${date}T${time}`, { zone: TIMEZONE });
  if (!start.isValid) {
    throw new Error(`Invalid date/time "${date} ${time}": ${start.invalidReason}`);
  }
  return { start, end: start.plus({ minutes: APPOINTMENT_MINUTES }) };
}
