# Setup & running end-to-end

Everything in this repo (Phases 0-8) is code-complete but has never run against real
infrastructure — it was built on a machine with no Docker. This doc is the checklist for
getting it running for the first time, on whatever machine you're on now.

## 1. Prerequisites

- **Git**
- **Node.js 22+** (only needed if you want to run apps individually outside Docker —
  skip if you're only using `docker compose`)
- **Docker Desktop** — this is the whole point of being on this machine
- **[LiveKit CLI](https://docs.livekit.io/home/cli/cli-setup/)** (`lk`) — needed once, to
  create the SIP trunk (step 4)
- Optional: **[ngrok](https://ngrok.com/)** (or any tunnel tool) — needed so Twilio, out on
  the public internet, can reach your backend while it's running locally

## 2. Clone and look around

```sh
git clone <your-repo-url>
cd ai_receptionist
```

Read [docs/04-IMPLEMENTATION-PLAN.md](04-IMPLEMENTATION-PLAN.md) if you want the full
per-phase "what got built and why" — this doc is just the mechanical run steps.

## 3. Sign up for the free-tier accounts

Follow [docs/03-FREE-TIER-STACK.md](03-FREE-TIER-STACK.md) **in the order it lists them** —
some trials are time-limited, so don't sign up for everything on day one if you're not
ready to use it yet. You'll end up with credentials for: Twilio, LiveKit Cloud, Groq,
Deepgram, ElevenLabs, and a Google Cloud service account for Calendar.

## 4. Fill in the `.env` files

Three apps, three env files. Copy each example and fill in the real values you just
collected:

```sh
cp apps/backend/.env.example apps/backend/.env
cp agent/.env.example agent/.env
cp apps/web/.env.example apps/web/.env
```

A few things that must match **across** files, not just within one:
- `INTERNAL_TOOLS_SECRET` — same value in `apps/backend/.env` and `agent/.env` (any long
  random string; `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  generates one).
- `BUSINESS_TIMEZONE` — same IANA timezone in `apps/backend/.env` and `agent/.env`.
- `LIVEKIT_SIP_HOST` / `LIVEKIT_SIP_USERNAME` / `LIVEKIT_SIP_PASSWORD` in
  `apps/backend/.env` — these come from step 5 below, so leave them blank for now.
- `HUMAN_TRANSFER_NUMBER` in `apps/backend/.env` is optional — leave it blank if you don't
  have a second phone number to test transfers with yet; `transfer_to_human` just logs
  instead of transferring when it's unset, nothing breaks.

## 5. Create the LiveKit SIP trunk + dispatch rule

Follow [infra/livekit-sip/README.md](../infra/livekit-sip/README.md) — it's a short,
one-time `lk sip inbound create` / `lk sip dispatch create` walkthrough. It'll hand you the
`LIVEKIT_SIP_HOST` / `LIVEKIT_SIP_USERNAME` / `LIVEKIT_SIP_PASSWORD` values to go back and
fill into `apps/backend/.env`.

## 6. Get a public URL for your backend, point Twilio at it

Twilio needs to reach `POST <your-public-url>/twilio/incoming-call` on the open internet.
In dev, that means a tunnel:

```sh
ngrok http 4000
```

Take the `https://...ngrok-free.app` URL it gives you and set it as `PUBLIC_BASE_URL` in
`apps/backend/.env` (**no trailing slash** — it's also used to verify Twilio's request
signature, so it must exactly match what you configure in the next step).

In the Twilio console, on your phone number's page, set "A call comes in" to a webhook
pointing at `<PUBLIC_BASE_URL>/twilio/incoming-call`.

## 7. Run it

### Option A — Docker Compose (matches how Phase 8 was built, recommended)

```sh
docker compose -f infra/docker-compose.yml up --build
```

This builds and starts Postgres, Redis, the backend, the agent worker, and the dashboard,
all wired together. First run will apply the database migrations automatically
(`prisma migrate deploy` runs as part of the backend container's startup — see the note in
the README's Status section about how those migrations were generated without a live DB;
worth watching this first run's logs to confirm it applies cleanly).

Dashboard: [http://localhost:3000](http://localhost:3000). Backend health check:
[http://localhost:4000/health/deps](http://localhost:4000/health/deps) (should report
`postgres: true, redis: true` once containers are healthy).

### Option B — run everything individually (better for active debugging)

Still use Docker for just the databases:

```sh
docker compose -f infra/docker-compose.yml up postgres redis
```

Then, in separate terminals:

```sh
# Backend
cd apps/backend
npm install
npx prisma migrate deploy   # or `npx prisma migrate dev` the very first time
npm run seed                # seeds a handful of sample FAQs
npm run dev

# Agent worker
cd agent
npm install
npm run dev

# Dashboard
cd apps/web
npm install
npm run dev
```

For this option, `apps/backend/.env`'s `DATABASE_URL`/`REDIS_URL` should point at
`localhost` (already the default in `.env.example`) rather than the Docker service names
Option A uses.

## 8. Sanity-check the pieces before calling

- `curl http://localhost:4000/health/deps` → `{"postgres":true,"redis":true}`
- Seed data present: `curl http://localhost:4000/api/analytics` should return real numbers,
  not a 500.
- Open [http://localhost:3000/live](http://localhost:3000/live) — should show "No active
  calls right now" with a green connected dot, not a red one (red means the dashboard's
  WebSocket to the backend isn't connecting).

## 9. Call it

Dial your Twilio number. Expected flow: it rings, the AI greets you, you can ask it an FAQ
or book an appointment, and the call shows up live on
[http://localhost:3000/live](http://localhost:3000/live) as you talk, then in
[http://localhost:3000/calls](http://localhost:3000/calls) afterward.

If nothing happens when you call, check in order:
1. The agent worker is actually running and logged in without errors.
2. The LiveKit SIP trunk's phone number matches your Twilio number exactly (E.164).
3. Backend logs show `/twilio/incoming-call` was hit with a `200`, not `403` (403 means
   Twilio signature validation failed — almost always a `PUBLIC_BASE_URL` mismatch between
   what's in `.env` and what's configured in the Twilio console).
4. `agent/.env`'s `INTERNAL_TOOLS_SECRET` matches `apps/backend/.env`'s exactly.
