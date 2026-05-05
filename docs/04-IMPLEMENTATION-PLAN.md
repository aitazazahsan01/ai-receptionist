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
