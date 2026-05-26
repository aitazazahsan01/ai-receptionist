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
