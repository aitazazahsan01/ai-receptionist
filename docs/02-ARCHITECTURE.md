# Architecture

Read [01-CONCEPTS.md](01-CONCEPTS.md) first if terms like VAD, LiveKit, or
event-driven architecture are unfamiliar — this doc assumes that vocabulary.

## 1. System diagram

```mermaid
flowchart LR
    Caller((Caller's phone))
    Twilio[Twilio<br/>Voice: webhook + SIP redirect]
    Backend[Node.js Backend<br/>webhooks, tools, API]
    LiveKitSIP[LiveKit SIP trunk<br/>+ dispatch rule]
    Agent[Voice Agent Worker<br/>VAD → STT → LLM → TTS<br/>LiveKit Agents]
    Redis[(Redis<br/>session state + pub/sub)]
    Postgres[(PostgreSQL<br/>calls, transcripts,<br/>appointments, FAQs)]
    Calendar[Google Calendar API]
    Dashboard[Next.js Dashboard]
    Human((Human agent's phone))

    Caller <--> |PSTN call| Twilio
    Twilio -. webhook: log call,<br/>get TwiML .-> Backend
    Twilio <==> |SIP| LiveKitSIP
    LiveKitSIP --> |dispatches into room| Agent
    Agent --> |tool calls, REST| Backend
    Backend --> |check/book| Calendar
    Backend <--> Redis
    Backend --> |persist after call| Postgres
    Redis --> |pub/sub events| Dashboard
    Postgres --> |call history, analytics| Dashboard
    Twilio -. call-status webhook .-> Backend
    Backend --> |REST: add human leg| Twilio
    Twilio --> |connect| Human
```

