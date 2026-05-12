import twilio from "twilio";

// The REST client (account-level API calls: fetching/updating live calls) is
// distinct from the `twilio.twiml.VoiceResponse` builder used in routes/twilio.ts
// for generating webhook responses -- this one needs real account credentials.
export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
