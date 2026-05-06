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

- **Twilio Voice** — you rent a phone number from Twilio. When someone calls it,
  Twilio hits a **webhook** (an HTTP URL you configure) on your backend saying
  "call incoming, what do you want me to do?" You reply with **TwiML** (an XML
  response format) telling Twilio what to do — e.g. "connect this call to a
  WebSocket media stream."
- **Twilio Media Streams** — the mechanism that turns the call's audio into a raw
  WebSocket stream of audio chunks (base64-encoded, in near-real-time) sent to a
  URL you control. This is the bridge between "phone call" and "code."
- **SIP (Session Initiation Protocol)** — the standard protocol that sets up and
  tears down voice calls, both on the classic telephone network side and in modern
  VoIP systems. You mostly won't touch SIP directly — Twilio abstracts it — but
  you'll see the term because **LiveKit** can also accept calls via a **SIP
  trunk**, which is an alternative to Twilio Media Streams for getting phone audio
  into your system (see §6 and §7).

## 4. WebRTC and why LiveKit exists

**WebRTC** (Web Real-Time Communication) is the browser/app standard for
peer-to-peer-style audio/video streaming with very low latency — it's what powers
Zoom-in-browser, Google Meet, Discord voice, etc. It handles the hard, unglamorous
problems of real-time audio: jitter buffers, packet loss recovery, echo
cancellation, adaptive bitrate, NAT traversal. None of that is specific to voice
*AI* — it's just "how do you move sound between two endpoints over the open
internet without it sounding terrible."

**LiveKit** is an open-source WebRTC infrastructure layer (you can self-host it, or
use LiveKit Cloud). Instead of you implementing WebRTC yourself, LiveKit gives you
**rooms** that participants (a human caller, an AI agent, a dashboard viewer) join,
and handles all the audio transport underneath.

**LiveKit Agents** is a Python/Node framework built on top of that: you write an
"agent" that joins a LiveKit room and gets clean audio in, clean audio out — LiveKit
Agents handles wiring VAD → STT → LLM → TTS together, handles interruption/barge-in,
and lets you swap any of those four components independently (e.g. Deepgram for
STT, Groq for LLM, ElevenLabs for TTS) without rewriting your pipeline. This is
what "modular" means in §6.

Why not just use Twilio Media Streams directly and skip LiveKit? You can (that's
the "direct" approach in §6) — LiveKit adds a moving part, but it saves you from
hand-rolling VAD, interruption handling, and audio buffering yourself, which is
genuinely fiddly to get right.

## 5. Function calling / tool use (how the AI actually books a meeting)

An LLM can't literally reach into Google Calendar. **Function calling** (also
called "tool use") is the mechanism where you describe a set of functions to the
LLM (name, description, parameters as a JSON schema) — e.g.
`check_availability(date, time)` and `book_appointment(date, time, name, phone)` —
and the LLM, instead of replying in plain text, replies with "call
