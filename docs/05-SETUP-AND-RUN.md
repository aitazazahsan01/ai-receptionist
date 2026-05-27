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
