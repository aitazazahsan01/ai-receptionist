# Implementation plan

Each phase has a goal, concrete deliverables, and a "concepts in play" pointer back
to [01-CONCEPTS.md](01-CONCEPTS.md). Phases are ordered so that **every phase ends
with something runnable/testable** — no 3-week stretch of code that doesn't do
anything yet. Do not start a phase's signups until you reach it (see the signup
order in [03-FREE-TIER-STACK.md](03-FREE-TIER-STACK.md)).

---

### Phase 0 — Environment & scaffold
**Goal:** empty-but-structured repo, everything installs and runs.

- Initialize git repo, the folder structure from `02-ARCHITECTURE.md` §6.
- Install Docker Desktop; write `infra/docker-compose.yml` with just Postgres +
  Redis for now.
- Scaffold `apps/web` (Next.js, TypeScript), `apps/backend` (Node.js, TypeScript,
  Fastify or Express), `agent/` (empty, language TBD by Phase 3 choice).
- `.env.example` files per app; real `.env` gitignored.

**Done when:** `docker compose up` starts Postgres + Redis, `apps/backend` boots
and connects to both, `apps/web` shows the default Next.js page.

---

### Phase 1 — Data layer
**Goal:** the schema from `02-ARCHITECTURE.md` §4 exists and is reachable from the
backend.

- Pick a migration tool (Prisma or Drizzle both work well with Node+Postgres;
  Prisma has gentler learning curve, Drizzle is closer to raw SQL if you want to
  understand exactly what's happening).
- Write migrations for `calls`, `transcript_entries`, `appointments`, `faqs`.
- Seed `faqs` with 5-10 fake Q&A pairs for testing.
- Basic backend module: `db.ts` (connection) + one repository function per table
  (`createCall`, `appendTranscriptEntry`, etc).

**Done when:** a small seed script inserts and reads back a fake call + transcript.

**Concepts in play:** none new — this is standard backend work, intentionally, so
Phase 2 onward can focus on the genuinely new (voice/telephony) concepts.

---

### Phase 2 — Telephony: bridge a real call into LiveKit
**Goal:** dial your Twilio number and have the call land in a LiveKit room, with
it logged in Postgres. (Code for this phase is already written — see below —
what's left is the account signups and infra config to actually run it.)

- Sign up for Twilio (see `03-FREE-TIER-STACK.md`), verify your own cell number,
  provision the trial phone number. Sign up for LiveKit Cloud too (needed now,
  not just Phase 3, since the SIP bridge lives on LiveKit's side).
- `apps/backend/src/routes/twilio.ts` — already implemented:
  - `POST /twilio/incoming-call`: validates Twilio's signature, creates the
    `calls` row, and returns TwiML that redirects the call over SIP into
    LiveKit (`<Dial><Sip>...</Sip></Dial>`).
  - `POST /twilio/call-status`: closes out the `calls` row when the call ends.
- Follow `infra/livekit-sip/README.md` to create the LiveKit inbound SIP trunk
  and dispatch rule, and point the Twilio number's webhook at your backend
  (`ngrok` or similar to tunnel it in dev).

**Why no Media Streams / WebSocket relay:** LiveKit's actual documented Twilio
integration is a SIP redirect, not a raw-audio relay through a custom backend —
using it means we never hand-roll audio bridging, which is the whole reason
Phase 3 picks LiveKit Agents in the first place. See the comment at the top of
`twilio.ts` and `docs/02-ARCHITECTURE.md` §1-2 for the corrected design (the
Media Streams approach described in earlier drafts of this doc was replaced).

**Done when:** calling the Twilio number connects (silence, since no agent is
dispatched yet without Phase 3's worker running) and a `calls` row appears in
Postgres with a `startedAt`; hanging up populates `endedAt`/`durationSec` via
the call-status webhook.

**Concepts in play:** telephony/PSTN, TwiML, SIP, webhooks (§3 of concepts doc).

---

### Phase 3 — Voice pipeline: hold a real (dumb) conversation
**Goal:** replace silence with a live VAD→STT→LLM→TTS loop — the AI can now hear
you and reply, even if the reply is unintelligent. (Code for this is also
already written — `agent/src/agent.ts` — pending real API keys to run it.)

- Sign up for Deepgram and Groq (ElevenLabs optional here — use Piper locally to
  preserve ElevenLabs quota for later polish, per `03-FREE-TIER-STACK.md`; swap
  it in by replacing `new elevenlabs.TTS()` in `agent.ts`).
- `agent/src/agent.ts` — already implemented using **LiveKit Agents**: Silero
  VAD (prewarmed once per worker process), Deepgram STT, Groq LLM (via its
  OpenAI-compatible endpoint), ElevenLabs TTS, wired together with
  `voice.AgentSession`. LiveKit's dispatch rule (Phase 2) auto-starts this
  worker into the room the instant a SIP call arrives — nothing calls it
  directly.
- Fill in `agent/.env` from `agent/.env.example` (LiveKit project credentials +
  the three provider API keys) and run `npm run dev` in `agent/` alongside the
  backend.
- System prompt is a minimal receptionist persona, no tools yet — just "answer
  naturally and briefly."

**Done when:** you can call the number, say something, and get a relevant spoken
reply within ~1-2 seconds, and can interrupt the AI mid-reply (barge-in) and have
it stop talking.

**Concepts in play:** the full pipeline model, WebRTC/LiveKit, streaming APIs,
barge-in (§§2, 4, 8 of concepts doc). This is the hardest phase — budget the most
time here, and don't move on until barge-in actually works, since it's core to the
"feels real" bar.

---

### Phase 4 — Conversation intelligence: FAQs and tool calling
**Goal:** the AI can answer FAQs from the database and knows when a request is
outside its scope.

- Implement `lookup_faq(topic)` as a backend-exposed tool; wire it into the agent's
  LLM call via function calling.
- Expand the system prompt: receptionist persona, what it can/can't do, tone.
- Add `transfer_to_human(reason)` as a tool stub (just logs for now — real
  transfer logic comes in Phase 7).

**Done when:** asking a question matching a seeded FAQ gets the right answer;
asking something clearly out of scope triggers the transfer-intent tool (logged,
not yet executed).

**Concepts in play:** function/tool calling (§5 of concepts doc).

---

### Phase 5 — Calendar integration: real appointment booking
**Goal:** the AI can check real availability and create a real calendar event.
(Code for this phase is already written — see below — what's left is the Google
Cloud signup and service account setup to actually run it.)

- Google Cloud project, enable Calendar API, service account with access to one
  shared calendar (simplest auth path for a single-business use case — no user
  OAuth flow needed). See `docs/03-FREE-TIER-STACK.md` for the exact steps.
- `apps/backend/src/googleCalendar.ts` — already implemented: service-account
  auth via `googleapis`, `slotBounds()` (turns a date/time + `BUSINESS_TIMEZONE`
  into start/end instants using `luxon`), `isSlotFree()` (FreeBusy query),
  `createCalendarEvent()`.
- `apps/backend/src/routes/tools.ts` — already implemented:
  `POST /tools/check-availability` and `POST /tools/book-appointment` (the
  latter re-checks the slot, creates the calendar event, and writes the
  `appointments` row in one go, returning `{ booked: false, reason: "slot_taken" }`
  instead of double-booking if it lost the race).
- `agent/src/tools.ts` — already implemented: `check_availability` and
  `book_appointment` tools wired into the agent. `agent/src/agent.ts`'s system
  prompt is rebuilt fresh per call with the current business-local date/time (via
  `BUSINESS_TIMEZONE`) so the model can resolve relative dates like "Tuesday
  afternoon" itself, and is instructed to confirm details before booking.
- Fill in `apps/backend/.env`'s `GOOGLE_SERVICE_ACCOUNT_KEY_FILE`,
  `GOOGLE_CALENDAR_ID`, `BUSINESS_TIMEZONE` and `agent/.env`'s matching
  `BUSINESS_TIMEZONE` to actually run it.

**Done when:** a full call — "I'd like to book an appointment Tuesday afternoon" →
AI checks availability, proposes a time, confirms, books — produces a real event on
the test Google Calendar and an `appointments` row.

**Concepts in play:** function calling in a multi-turn flow (state across several
tool calls within one conversation).

---

### Phase 6 — Live transcription & analytics pipeline
**Goal:** the Next.js dashboard shows a call happening in real time, and call
history/analytics after the fact. (Code for this phase is already written —
see below — what's left is running it against real infra to see it work
end-to-end.)

- `apps/backend/src/events.ts` — already implemented: `publishEvent()` publishes
  typed events (`call.started`, `call.ended`, `transcript.partial`,
  `transcript.final`, `appointment.booked`) to a single Redis pub/sub channel.
  Wired into `routes/twilio.ts` (call lifecycle) and `routes/tools.ts`
  (transcript logging, appointment booking).
- `agent/src/agent.ts` — already implemented: reads the LiveKit SIP
  participant's `sip.twilio.callSid` attribute (`ctx.waitForParticipant()`,
  called after `ctx.connect()`) -- but that's the CallSid of the `<Dial><Sip>`
  **child** leg Twilio created to reach LiveKit, not the original inbound call
  `/twilio/incoming-call` recorded. The agent calls a new
  `POST /tools/resolve-call` endpoint once per call, which uses the Twilio
  REST API to look up that child call's `parentCallSid` and resolve it to our
  internal `calls.id`; every later tool call and transcript entry just passes
  that resolved `callId` along. `wireTranscriptLogging()` listens for
  `AgentSessionEventTypes.UserInputTranscribed` (live partial captions) and
  `ConversationItemAdded` (finalized turns, both caller and agent) and pushes
  them to a new, non-LLM-callable `POST /tools/log-transcript` endpoint.
- `apps/backend/src/routes/dashboard.ts` — already implemented:
  `GET /dashboard/live` (a `@fastify/websocket` route) opens a dedicated Redis
  subscriber per connected browser and forwards every published event as-is.
- `apps/backend/src/routes/api.ts` — already implemented: `GET /api/calls`
  (history list), `GET /api/calls/:id` (transcript + appointments for one
  call), `GET /api/analytics` (call count, average duration, booking
  conversion rate). CORS-gated to `DASHBOARD_ORIGIN`.
- `apps/web/src/app/{live,calls,analytics}` — already implemented: `/live` is a
  Client Component that opens the dashboard WebSocket and renders each active
  call's transcript scrolling in live (partial captions shown dimmed until
  finalized); `/calls` and `/calls/[id]` are Server Components reading
  `/api/calls*`; `/analytics` reads `/api/analytics`.
- Fill in `apps/backend/.env`'s `DASHBOARD_ORIGIN` (defaults to
  `http://localhost:3000`, so only needed if the dashboard runs elsewhere) and
  `apps/web/.env`'s `NEXT_PUBLIC_BACKEND_URL` to actually run it.

**Done when:** you can call the number from your phone and watch the transcript
appear live in a browser tab, and see the call show up in history afterward.

**Concepts in play:** event-driven architecture, Redis pub/sub, WebSockets end-to-end
(§7 of concepts doc).

---

### Phase 7 — Human handoff
**Goal:** `transfer_to_human` (stubbed in Phase 4) actually transfers the call.
(Code for this phase is already written — see below.)

- `apps/backend/src/twilioClient.ts` — already implemented: a shared Twilio
  REST client (account-level API calls), distinct from the
  `twilio.twiml.VoiceResponse` builder `routes/twilio.ts` uses for webhook
  responses.
- `POST /tools/transfer-to-human` — already implemented for real: looks up the
  call's original `twilioCallSid` (the parent leg, exactly what
  `/twilio/incoming-call` recorded — no further resolution needed there),
  builds TwiML (`<Say>` an acknowledgment, then `<Dial>` to
  `HUMAN_TRANSFER_NUMBER`), and calls `twilioClient.calls(sid).update({twiml})`
  to redirect the *live* call. The `<Say>` matters: the redirect can land
  mid-sentence from the agent's own spoken reply, so it's the caller's only
  reliable acknowledgment that a transfer is happening. Updates
  `calls.outcome`/`transferred_to` and publishes a `call.transferred` event
  (dashboard's live view shows it).
- Trigger conditions implemented: explicit caller request, or repeated AI
  misunderstanding, per the system prompt in `agent/src/agent.ts` (the model
  decides when to call the tool). A manual "take over" button on the
  dashboard's live view was **not** built — it would need its own
  authenticated endpoint and isn't needed for the "AI handles it, falls back
  to a human when it can't" flow this project targets; add it later if a
  human operator needs to preempt the AI proactively, not just receive its
  handoffs.
- Fill in `apps/backend/.env`'s `HUMAN_TRANSFER_NUMBER` (a real phone number
  you control, E.164 format) to actually run it. If unset, the tool logs the
  request but doesn't transfer, so nothing breaks with it left blank.

**Done when:** saying "I want to speak to a human" mid-call actually rings your
second phone number and connects it to the live call.

**Concepts in play:** Twilio call control beyond the initial webhook (mid-call
modification).

---

### Phase 8 — Hardening & full containerization
**Goal:** the whole system runs with one command, and survives obvious failure
modes. (Code for this phase is already written — see below — what's left is
actually running `docker compose up` on a machine that has Docker, which this
one doesn't.)

- `infra/docker-compose.yml` — already implemented: `backend`, `agent`, and
  `web` services added alongside the existing `postgres`/`redis`, each with
  its own multi-stage `Dockerfile` (`apps/backend/Dockerfile`,
  `agent/Dockerfile`, `apps/web/Dockerfile`). Build context is the repo root
  for all three (so a shared root `.dockerignore` applies); each `env_file`s
  its own app's `.env`, with in-network hostnames (`postgres`, `redis`,
  `backend`) overriding whatever that `.env` has for local non-Docker dev.
  `apps/web/next.config.ts` sets `output: "standalone"` for a minimal
  production image. The backend's `Dockerfile` runs `prisma migrate deploy`
  on every container start (a no-op once nothing's pending) and has a
  `HEALTHCHECK` other services key off via `depends_on: condition:
  service_healthy`.
- `apps/backend/prisma/migrations/` — already implemented: since this
  machine never had a live Postgres to run `prisma migrate dev` against, the
  initial migration SQL was instead generated schema-to-schema via `npx prisma
  migrate diff --from-empty --to-schema=prisma/schema.prisma --script`, which
  needs no database connection. It's the same SQL `migrate dev` would have
  produced. Worth a sanity check the first time `docker compose up` actually
  runs it against a real Postgres.
- Error handling for the failure modes that will actually occur:
  - Twilio webhook retries — already handled since Phase 2 (`upsert` on
    `twilio_call_sid`, `.catch()` on the call-status update).
  - Google Calendar API errors — already handled since Phase 5 (try/catch in
    `googleCalendar.ts` callers, surfaced as a clean 422 with a message the
    agent can relay to the caller).
  - STT/TTS/LLM provider timeouts or rate-limit errors (a real risk on the
    free tiers this project runs on — see `03-FREE-TIER-STACK.md`) — now
    logged instead of vanishing silently: `agent.ts`'s `wireErrorLogging()`
    listens for `AgentSessionEventTypes.Error` and logs it tagged with the
    call's correlation id.
  - A call that hangs up mid-tool-call — no special handling added; a
    dropped connection just means the in-flight backend request's result
    never reaches an agent that's no longer there, which is harmless (worst
    case, an orphaned calendar event with no caller to confirm it to).
- Structured logging per call — `routes/twilio.ts` and `routes/tools.ts` now
  log key lifecycle events (`call started`, `call ended`, `appointment
  booked`, `transferred call`) with `callId`/`twilioCallSid` attached, and
  `agent.ts`'s error logging is tagged the same way, so a call's whole story
  is greppable by one id across both processes' logs.
- Basic security review: webhook signature validation (done since Phase 2),
  secrets in env vars only (done throughout), dashboard behind basic auth --
  **deliberately not built**. The plan's own wording makes this conditional
  ("if it'll ever be reachable from the internet"), and building it properly
  runs into a real constraint worth knowing about before attempting it: the
  browser's native `WebSocket` API can't attach an `Authorization` header, so
  HTTP Basic Auth on `/dashboard/live` wouldn't actually be reachable from the
  `/live` page as written -- it would need a token-in-query-param scheme (or
  swapping Basic Auth for something else) instead, sized to whatever the
  actual deployment target turns out to be. Revisit this once there's a real
  answer to "where does the dashboard get deployed."

**Done when:** `docker compose up` from a clean checkout gets a fully working
system (given `.env` filled in), and killing/restarting any one container mid-call
fails gracefully rather than corrupting data.

---

### Phase 9 (stretch) — Production path
Not required to call the project "done," but the natural next steps once Phases
0-8 work and you're ready to spend real money or go live:

- Swap the free-tier providers for paid equivalents where free-tier limits actually
  bit you (most likely: ElevenLabs character quota, or Groq rate limits under
  concurrent calls).
- Optionally implement the OpenAI Realtime API as an alternative `agent/`
  implementation (see `03-FREE-TIER-STACK.md`'s "upgrade path" note) and compare it
  against the modular pipeline on latency and cost.
- Multi-tenant support if this needs to serve more than one business (auth,
  per-tenant phone numbers/calendars).
- Move Postgres/Redis off Docker Compose onto managed hosting (Neon/Upstash or
  equivalent) and deploy the backend/agent/dashboard somewhere reachable
  (Fly.io, Railway, Render all have reasonable free/hobby tiers as of 2026 — verify
  current terms the way `03-FREE-TIER-STACK.md` does before relying on them).

---

## How to actually work through this with me

Tell me which phase you want to start on (Phase 0 is the natural start), and we'll
build it step by step — I'll write the actual code with you, explain each new
concept as it shows up in real code rather than in the abstract, and we'll test each
phase's "done when" criteria together before moving on.
