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
