# Concepts — everything you'll need to understand before building

This is a glossary-with-context: every term is explained in terms of the problem it
solves *in this project specifically*, not as an abstract definition. Read it once
top-to-bottom before Phase 1; come back to individual sections as you hit them.

---

## 1. Why voice AI is architecturally different from chatbot AI

A text chatbot has one hard requirement: correctness. A voice agent has three, and
they fight each other:

- **Correctness** — same as text.
- **Latency** — humans notice silence after ~300ms and start talking again, or
  assume the call dropped, after ~1-2s. Your full pipeline (hear → understand →
  decide → speak) has to fit in roughly that budget, every single turn.
- **Interruptibility ("barge-in")** — a real receptionist stops talking the instant
  you start talking. If your AI keeps monologuing over the caller, it feels broken
  immediately, even if the words are correct.

Almost every architectural decision below exists to serve the latency and
interruptibility constraints, not the correctness one.

## 2. The four stages of a voice turn

Every exchange in a phone call goes through the same pipeline:

```
Caller speaks
   → [VAD]  detect that speech started/stopped
   → [STT]  Speech-to-Text: audio → words
   → [LLM]  words + context → decision (what to say, or what tool to call)
   → [TTS]  Text-to-Speech: words → audio
   → Caller hears the reply
```

- **VAD (Voice Activity Detection)** — a small, fast model (or even a simple energy
  threshold) that answers "is someone talking right now?" It's what lets the system
  know when to stop listening and start processing, and it's what enables barge-in
  (if VAD fires while the AI is speaking, cut the AI off).
- **STT (Speech-to-Text)**, also called ASR (Automatic Speech Recognition) — converts
  the caller's audio into text. Needs to be *streaming* (returns partial results as
  the person talks) not batch (wait for silence, then transcribe), or your latency
  budget is blown before the LLM even starts.
- **LLM** — the "brain." Takes the transcript + conversation history + a system
  prompt describing the receptionist's job, and produces either a spoken reply or a
  **tool call** (see §5) like "check calendar availability for Tuesday 2pm."
- **TTS (Text-to-Speech)** — converts the LLM's text reply into audio. Also needs to
  be streaming: you want to start playing the first sentence while the LLM is still
  generating the rest, not wait for the whole reply.

There are two ways to implement this pipeline, and it's the single biggest
architecture decision in this project (see §6).

## 3. Telephony: how a phone call becomes data your code can touch

A regular phone call has nothing to do with the internet by default — it rides on
the telephone network (PSTN). To get audio out of a phone call and into your
backend, you need a telephony provider that bridges PSTN ↔ internet. That's what
**Twilio** is.

