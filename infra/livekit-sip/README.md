# LiveKit SIP setup (Phase 2)

This is one-time infrastructure configuration, not application code — it wires
Twilio's phone number to LiveKit so an incoming call lands in a LiveKit room and
the `agent/` worker (Phase 3) gets dispatched into it automatically. Do this
after you have a LiveKit Cloud account and a Twilio number.

Why this exists at all: see the note in `apps/backend/src/routes/twilio.ts` —
LiveKit's documented Twilio integration is a SIP redirect, not a raw audio
relay through our own backend, which avoids us hand-rolling audio bridging.

## Prerequisites

- [LiveKit CLI](https://docs.livekit.io/home/cli/cli-setup/) (`lk`) installed
  and authenticated against your LiveKit Cloud project (`lk cloud auth`).
- A Twilio phone number (Phase 2 of `docs/04-IMPLEMENTATION-PLAN.md`).

## 1. Create the inbound SIP trunk

Edit `inbound-trunk.json` in this folder, replacing `+1XXXXXXXXXX` with your
actual Twilio number (E.164 format), then run:

```sh
lk sip inbound create infra/livekit-sip/inbound-trunk.json \
  --auth-user <choose-a-username> \
  --auth-pass <choose-a-strong-password>
```

Pick your own username/password here — these are what Twilio will authenticate
with when it dials into LiveKit. Put the same values in `apps/backend/.env` as
`LIVEKIT_SIP_USERNAME` / `LIVEKIT_SIP_PASSWORD`.

The command's output includes the trunk's SIP URI/host (something like
`<your-project>.sip.livekit.cloud`) — put that in `apps/backend/.env` as
`LIVEKIT_SIP_HOST`.

## 2. Create the dispatch rule

```sh
lk sip dispatch create infra/livekit-sip/dispatch-rule.json
```

This tells LiveKit: for each inbound SIP call, create a fresh room (prefixed
`call-`) and dispatch the registered agent worker into it. No changes needed
per-call — this runs once and applies to every future call through the trunk.

## 3. Point the Twilio number at our backend

In the Twilio console, under the phone number's Voice Configuration, set "A
call comes in" to a webhook pointing at:

```
<PUBLIC_BASE_URL>/twilio/incoming-call
```

(`PUBLIC_BASE_URL` is your backend's public URL — an ngrok tunnel in dev.) This
is deliberately our own webhook rather than a static Twilio TwiML Bin, so we
still get Twilio-signature validation and a `calls` row created per call before
handing off to LiveKit.

## Sanity check

Call the Twilio number. You should hear silence-then-connect (no more `<Say>`
greeting — the agent worker speaks first once dispatched, per
`agent/src/agent.ts`). If nothing happens, check in order: the agent worker is
running (`npm run dev` in `agent/`), the trunk's numbers array matches the
dialed number exactly, and the backend logs show `/twilio/incoming-call` was
hit with a 200 (not a 403 — that means signature validation failed, usually a
`PUBLIC_BASE_URL` mismatch).
