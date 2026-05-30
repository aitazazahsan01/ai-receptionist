import { tool } from "@livekit/agents";
import { z } from "zod";
import { callBackendTool } from "./backendClient.js";

// A factory, not a static array, because transfer_to_human and book_appointment
// need to tell the backend which call they belong to (see agent.ts, which
// resolves the internal callId once per call via /tools/resolve-call and
// passes it in here).
export function buildReceptionistTools(callId: string | null) {
  return [
    tool({
      name: "lookup_faq",
      description:
        "Look up an answer to a caller's question in the business's FAQ knowledge base. " +
        "Use this whenever the caller asks something factual about the business " +
        "(hours, location, policies, services) before saying you don't know.",
      parameters: z.object({
        query: z.string().describe("The caller's question, or the key topic of it"),
      }),
      execute: async ({ query }) => {
        const result = await callBackendTool<{ found: boolean; answer?: string }>(
          "/tools/lookup-faq",
          { query },
        );
        if (!result.found) {
          return (
            "No matching FAQ was found. Tell the caller you don't have that " +
            "information on hand and offer to have someone follow up."
          );
        }
        return result.answer;
      },
    }),

    tool({
      name: "transfer_to_human",
      description:
        "Transfer the caller to a human. Use this when the caller explicitly asks " +
        "for a person, or after a couple of failed attempts to help them.",
      parameters: z.object({
        reason: z.string().describe("Brief reason for the transfer, for logging"),
      }),
      execute: async ({ reason }) => {
        const result = await callBackendTool<{ status: string }>("/tools/transfer-to-human", {
          reason,
          callId,
        });
        if (result.status !== "transferred") {
          return "The transfer couldn't be completed. Apologize and offer to take a message instead.";
        }
        return "Let the caller know you're transferring them now.";
      },
    }),

    tool({
      name: "check_availability",
      description:
        "Check whether a specific date and time is free on the business calendar " +
        "for a new appointment. Always call this before proposing or confirming a " +
        "time to the caller.",
      parameters: z.object({
        date: z.string().describe("The appointment date in YYYY-MM-DD format"),
        time: z
          .string()
          .describe("The appointment start time in 24-hour HH:mm format, business local time"),
      }),
      execute: async ({ date, time }) => {
        const result = await callBackendTool<{ available?: boolean; error?: string }>(
          "/tools/check-availability",
          { date, time },
        );
        if (result.error) {
          return `Could not check availability: ${result.error}. Ask the caller for a clearer date and time.`;
        }
        return result.available
          ? "That time is available."
          : "That time is not available -- ask the caller for a different time.";
      },
    }),

    tool({
      name: "book_appointment",
      description:
        "Book a confirmed appointment on the business calendar. Only call this " +
        "after the caller has explicitly confirmed the date, time, and given their " +
        "name and callback phone number -- never book without that confirmation.",
      parameters: z.object({
        date: z.string().describe("The appointment date in YYYY-MM-DD format"),
        time: z
          .string()
          .describe("The appointment start time in 24-hour HH:mm format, business local time"),
        callerName: z.string().describe("The caller's full name"),
        callerPhone: z.string().describe("The caller's callback phone number"),
      }),
      execute: async ({ date, time, callerName, callerPhone }) => {
        const result = await callBackendTool<{ booked: boolean; reason?: string; error?: string }>(
          "/tools/book-appointment",
          { date, time, callerName, callerPhone, callId },
        );
        if (result.error) {
          return `Booking failed: ${result.error}. Ask the caller for a different time.`;
        }
        if (!result.booked) {
          return "That slot was just taken -- ask the caller to pick a different time.";
        }
        return "Booked. Confirm the date and time back to the caller.";
      },
    }),
  ];
}
