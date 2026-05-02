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
