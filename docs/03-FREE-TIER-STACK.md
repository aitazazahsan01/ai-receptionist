# Building this on $0 — free & trial tier guide

Verified via web search, **August 2026**. Free-tier terms change often — treat the
numbers below as "true as of when this was written," and re-check the provider's
pricing page before you rely on a specific limit for something important. Sources
are linked per section.

## The short version

| Need | Provider | What you get free | Card required? |
|---|---|---|---|
| Telephony (phone number + calls) | Twilio | $15.15 trial credit, 1 number, calls only to *verified* numbers | No |
| Real-time audio transport | LiveKit Cloud | 5,000 WebRTC min/mo, 1,000 AI agent min/mo, 1 free US number, forever free | No |
| STT | Deepgram | $200 trial credit, no expiry, ~775 hours of transcription | No |
| LLM | Groq | Free forever, rate-limited (30 req/min, 6k tokens/min, 14.4k req/day per model) | No |
| TTS | ElevenLabs | 10,000 characters/mo (~10-12 min audio), resets monthly, no rollover | No |
| Calendar | Google Calendar API | Free, generous quota, not a real constraint at this scale | No (Google account only) |
| Postgres (if not self-hosting) | Neon | 0.5GB storage, 100 compute-hours/mo, never expires | No |
| Redis (if not self-hosting) | Upstash | 256MB, 500k commands/mo, permanent | No |

Everything in this table can be signed up for with just an email — no credit card
anywhere, which matters because trial offers that *do* require a card sometimes
auto-charge when the trial ends.

## Provider-by-provider detail

### Twilio — telephony
- $15.15 credit on signup, usable for phone numbers, SMS, and voice minutes at
  standard rates (~1,000 minutes of outbound calling, or ~1,400 SMS, at typical
  rates).
- **Trial-mode restriction that actually matters for you:** you can only call/be
  called by phone numbers you've manually verified in the Twilio console. This is
  fine for development — verify your own cell number and test with that — but you
  cannot demo this to a stranger's phone number without upgrading. Budget one
  upgrade decision for later (a few dollars) if you want a real public demo.
  [Twilio trial docs](https://www.twilio.com/docs/usage/trials)
- One phone number per trial account (up to 3 over the account's lifetime); an
  unused number can be reclaimed after 60 days of inactivity, so don't provision it
  until Phase 2 when you're actually wiring up the webhook.
  [Twilio Free Trial Limitations](https://support.twilio.com/hc/en-us/articles/360036052753-Twilio-Free-Trial-Limitations)

### LiveKit Cloud — real-time audio transport
- The "Build" plan is **permanently free**, not a time-limited trial: 5,000 WebRTC
  minutes/month, 50GB egress, 1,000 AI agent minutes/month, $2.50/month of LiveKit
  Inference credit, up to 5 concurrent agent sessions, 100 concurrent connections,
  and **1 free US phone number** (LiveKit has its own Twilio-alternative SIP/telephony
  path if you want to explore it later, though this project's plan uses Twilio).
- Hard cap, not overage billing — once you exceed the monthly allowance, new
  requests fail until it resets. Fine for a solo dev project; just don't leave test
  calls running unattended.
  [LiveKit quotas & limits docs](https://docs.livekit.io/deploy/admin/quotas-and-limits/)
- Alternative: self-host LiveKit's open-source server via Docker for genuinely
  unlimited local usage — no account, no caps, but you then also self-manage TURN
  servers for NAT traversal if you need it reachable outside your network.

### Deepgram — speech-to-text
- $200 trial credit, **no expiry date**, no card required. At Nova-tier pricing this
  is roughly 700+ hours of transcription — effectively unlimited for a personal
  project's dev/test cycle.
  [Deepgram free credit](https://costbench.com/software/ai-transcription-apis/deepgram/free-plan/)
- Has an official LiveKit Agents plugin, so it plugs directly into the pipeline
  from §6 of the architecture doc with minimal glue code.

### Groq — LLM inference
- Free tier requires no card and isn't time-limited — it's rate-limited instead:
  roughly 30 requests/minute, 6,000 tokens/minute, 14,400 requests/day per model
