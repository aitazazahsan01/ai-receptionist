# AI Voice Receptionist

A real-time AI phone agent that answers incoming calls, converses naturally with callers,
books appointments on a real calendar, answers FAQs, and hands off to a human when it's
out of its depth.

Think of it as a tiny call center employee that never sleeps: it picks up the phone,
listens, understands, replies out loud, and takes action (like booking a meeting) — all
within roughly a second of latency per turn.

## What it actually does (end to end)

1. Someone dials your business number.
2. Twilio answers the call and streams the caller's audio to your backend in real time.
3. Your backend forwards that audio into a **voice agent pipeline** that:
   - detects when the caller is speaking (VAD),
   - transcribes speech to text (STT),
   - feeds the text + conversation history to an LLM that decides what to say/do,
   - converts the LLM's reply back to speech (TTS),
   - streams that audio back to the caller through Twilio.
4. If the caller wants to book an appointment, the LLM calls a **tool** your backend
   exposes, which checks Google Calendar availability and creates an event.
5. Every turn of the conversation is transcribed live and pushed to a **Next.js
   dashboard** so a human can watch the call happen in real time.
6. If the caller asks for a human, or the AI gets stuck, the call is **transferred** to
   a real phone number.
7. After the call, it's saved to Postgres for analytics (call volume, duration, topics,
   booking conversion, etc).

## Documentation map
