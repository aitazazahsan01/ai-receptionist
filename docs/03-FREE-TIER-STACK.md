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
