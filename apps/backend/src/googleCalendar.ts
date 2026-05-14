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

export async function isSlotFree(start: DateTime, end: DateTime): Promise<boolean> {
  const calendar = getCalendarClient();
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: start.toISO() ?? undefined,
      timeMax: end.toISO() ?? undefined,
      items: [{ id: CALENDAR_ID }],
    },
  });
  const busy = res.data.calendars?.[CALENDAR_ID]?.busy ?? [];
  return busy.length === 0;
}

export async function createCalendarEvent(opts: {
  start: DateTime;
  end: DateTime;
  callerName: string;
  callerPhone: string;
}): Promise<string> {
  const calendar = getCalendarClient();
  const res = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: `Appointment: ${opts.callerName}`,
      description: `Booked via AI receptionist. Caller phone: ${opts.callerPhone}`,
      start: { dateTime: opts.start.toISO() ?? undefined, timeZone: TIMEZONE },
      end: { dateTime: opts.end.toISO() ?? undefined, timeZone: TIMEZONE },
    },
  });
  const eventId = res.data.id;
  if (!eventId) {
    throw new Error("Google Calendar did not return an event id");
  }
  return eventId;
}
