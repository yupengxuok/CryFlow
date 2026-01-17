# CryFlow Event-Driven Architecture

**Version:** 1.0.0  
**Date:** 2026-01-16  
**Status:** Design Specification (Demo-Ready)

---

## Overview

Simple event-driven flow for CryFlow backend to support agentic, asynchronous processing of baby events and analysis requests.

**Key Principles:**
- ✅ Simple and easy to understand
- ✅ Idempotent event processing
- ✅ Automatic retry on failure
- ✅ Clear failure handling

---

## Event Types

### 1. baby_event.created

Triggered when a new event is recorded (cry, feed, diaper, sleep, note).

```json
{
  "event_id": "evt_2026011610001234",
  "event_type": "baby_event.created",
  "timestamp": "2026-01-16T10:00:00.000Z",
  "idempotency_key": "baby_demo_1:cry:2026-01-16T10:00:00.000Z",
  "payload": {
    "baby_id": "baby_demo_1",
    "type": "cry",
    "ts": "2026-01-16T10:00:00.000Z",
    "cry_pattern": "continuous",
    "cry_intensity": 0.75,
    "cry_duration_sec": 180,
    "cry_pitch_hint": "low"
  },
  "metadata": {
    "source": "retool_dashboard",
    "user_id": "user_123",
    "request_id": "req_abc123"
  }
}
```

**Idempotency Key:** `{baby_id}:{event_type}:{timestamp}`

---

### 2. baby_analysis.requested

Triggered when analysis is requested for a baby.

```json
{
  "event_id": "evt_2026011610001235",
  "event_type": "baby_analysis.requested",
  "timestamp": "2026-01-16T10:00:05.000Z",
  "idempotency_key": "baby_demo_1:analysis:2026-01-16T10:00:05.000Z",
  "payload": {
    "baby_id": "baby_demo_1",
    "trigger": "manual",
    "options": {
      "window_minutes": 360,
      "format": "frontend"
    }
  },
  "metadata": {
    "source": "api_endpoint",
    "user_id": "user_123",
    "request_id": "req_abc124"
  }
}
```

**Idempotency Key:** `{baby_id}:analysis:{timestamp}`

---

### 3. baby_analysis.completed

Triggered when analysis is successfully completed.

```json
{
  "event_id": "evt_2026011610001236",
  "event_type": "baby_analysis.completed",
  "timestamp": "2026-01-16T10:00:06.000Z",
  "idempotency_key": "baby_demo_1:analysis:2026-01-16T10:00:05.000Z:result",
  "payload": {
    "baby_id": "baby_demo_1",
    "analysis_id": "ana_xyz789",
    "hypotheses": [
      {
        "label": "hunger",
        "confidence": 0.85,
        "why": ["Time since last feed (210 min) exceeds typical 3-hour interval"]
      }
    ],
    "suggestions": [
      {
        "title": "Try feeding",
        "steps": ["Offer breast or bottle", "Watch for feeding cues"]
      }
    ],
    "execution_time_ms": 45
  },
  "metadata": {
    "source": "analysis_service",
    "request_id": "req_abc124",
    "original_event_id": "evt_2026011610001235"
  }
}
```

**Idempotency Key:** `{baby_id}:analysis:{original_timestamp}:result`

---

## Event Flow Diagram

```
┌─────────────────┐
│  API Request    │
│  POST /events   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  1. baby_event.created  │
│  - Store in DB          │
│  - Emit event           │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Event Consumer         │
│  - Validate event       │
│  - Check idempotency    │
└────────┬────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  2. baby_analysis.requested  │
│  - Triggered by cry event    │
│  - Or manual request         │
└────────┬─────────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Analysis Consumer      │
│  - Fetch events         │
│  - Compute signals      │
│  - Generate hypotheses  │
│  - Generate suggestions │
└────────┬────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  3. baby_analysis.completed  │
│  - Store result in DB        │
│  - Notify frontend           │
│  - Emit event                │
└──────────────────────────────┘
```

---

## Consumer Responsibilities

### Event Consumer (baby_event.created)

**Responsibilities:**
1. Validate event schema
2. Check idempotency (skip if duplicate)
3. Store event in database
4. Trigger analysis if event type is "cry"

**Pseudocode:**
```javascript
async function handleBabyEventCreated(event) {
  // 1. Check idempotency
  if (await isDuplicate(event.idempotency_key)) {
    return { status: 'skipped', reason: 'duplicate' };
  }
  
  // 2. Validate event
  const validationResult = validateEvent(event.payload);
  if (!validationResult.valid) {
    throw new Error(`Invalid event: ${validationResult.errors}`);
  }
  
  // 3. Store event
  await Event.create(event.payload);
  
  // 4. Mark as processed
  await markProcessed(event.idempotency_key);
  
  // 5. Trigger analysis if cry event
  if (event.payload.type === 'cry') {
    await emitEvent('baby_analysis.requested', {
      baby_id: event.payload.baby_id,
      trigger: 'auto_cry'
    });
  }
  
  return { status: 'processed' };
}
```

---

### Analysis Consumer (baby_analysis.requested)

**Responsibilities:**
1. Check idempotency (skip if duplicate)
2. Fetch recent events for baby
3. Run analysis pipeline
4. Store analysis result
5. Emit completion event

**Pseudocode:**
```javascript
async function handleAnalysisRequested(event) {
  // 1. Check idempotency
  if (await isDuplicate(event.idempotency_key)) {
    return { status: 'skipped', reason: 'duplicate' };
  }
  
  // 2. Fetch events
  const events = await Event.find({
    baby_id: event.payload.baby_id
  }).sort({ ts: -1 }).limit(100);
  
  // 3. Run analysis
  const startTime = Date.now();
  const signals = computeDerivedSignals(events, new Date(), 360);
  const hypotheses = generateHypotheses(signals, events);
  const suggestions = generateSuggestions(hypotheses);
  const executionTime = Date.now() - startTime;
  
  // 4. Store result
  const analysis = await Analysis.create({
    baby_id: event.payload.baby_id,
    hypotheses,
    suggestions,
    execution_time_ms: executionTime
  });
  
  // 5. Mark as processed
  await markProcessed(event.idempotency_key);
  
  // 6. Emit completion event
  await emitEvent('baby_analysis.completed', {
    baby_id: event.payload.baby_id,
    analysis_id: analysis._id,
    hypotheses,
    suggestions,
    execution_time_ms: executionTime
  });
  
  return { status: 'processed', analysis_id: analysis._id };
}
```

---

## Idempotency Strategy

### Idempotency Keys

**Format:** `{resource}:{action}:{timestamp}[:suffix]`

**Examples:**
- `baby_demo_1:cry:2026-01-16T10:00:00.000Z` - Event creation
- `baby_demo_1:analysis:2026-01-16T10:00:05.000Z` - Analysis request
- `baby_demo_1:analysis:2026-01-16T10:00:05.000Z:result` - Analysis result

### Deduplication Logic

```javascript
async function isDuplicate(idempotencyKey) {
  const exists = await ProcessedEvents.findOne({
    idempotency_key: idempotencyKey
  });
  
  return exists !== null;
}

async function markProcessed(idempotencyKey) {
  await ProcessedEvents.create({
    idempotency_key: idempotencyKey,
    processed_at: new Date(),
    ttl: 24 * 60 * 60  // 24 hours
  });
}
```

### TTL (Time-To-Live)

- Processed events expire after **24 hours**
- Prevents infinite storage growth
- Allows reprocessing after 24h if needed

---

## Retry Strategy

### Retry Configuration

```javascript
const RETRY_CONFIG = {
  maxRetries: 3,
  backoffMultiplier: 2,
  initialDelayMs: 1000,
  maxDelayMs: 30000
};
```

### Retry Logic

```javascript
async function processWithRetry(event, handler) {
  let attempt = 0;
  let delay = RETRY_CONFIG.initialDelayMs;
  
  while (attempt < RETRY_CONFIG.maxRetries) {
    try {
      return await handler(event);
    } catch (error) {
      attempt++;
      
      if (attempt >= RETRY_CONFIG.maxRetries) {
        // Move to dead letter queue
        await moveToDeadLetterQueue(event, error);
        throw error;
      }
      
      // Exponential backoff
      await sleep(delay);
      delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
    }
  }
}
```

### Retry Schedule

| Attempt | Delay | Total Time |
|---------|-------|------------|
| 1 | 0ms | 0s |
| 2 | 1000ms | 1s |
| 3 | 2000ms | 3s |
| 4 | 4000ms | 7s |
| Failed | → DLQ | - |

---

## Failure Handling

### Failure Modes

#### 1. Validation Failure

**Cause:** Invalid event schema or data  
**Action:** Reject immediately, no retry  
**Response:** 400 Bad Request

```json
{
  "error": "validation_failed",
  "message": "Invalid event: cry_intensity must be between 0 and 1",
  "event_id": "evt_2026011610001234"
}
```

#### 2. Transient Failure

**Cause:** Database timeout, network error  
**Action:** Retry with exponential backoff  
**Max Retries:** 3

```json
{
  "error": "transient_failure",
  "message": "Database connection timeout",
  "event_id": "evt_2026011610001234",
  "retry_attempt": 2
}
```

#### 3. Permanent Failure

**Cause:** Analysis algorithm error, missing data  
**Action:** Move to dead letter queue  
**Response:** Log error, notify monitoring

```json
{
  "error": "permanent_failure",
  "message": "Analysis failed: insufficient event history",
  "event_id": "evt_2026011610001235",
  "moved_to_dlq": true
}
```

### Dead Letter Queue (DLQ)

**Purpose:** Store failed events for manual review

**Schema:**
```json
{
  "dlq_id": "dlq_001",
  "original_event": { /* full event */ },
  "failure_reason": "Analysis failed after 3 retries",
  "error_details": "TypeError: Cannot read property 'ts' of undefined",
  "failed_at": "2026-01-16T10:00:10.000Z",
  "retry_count": 3
}
```

**Actions:**
- Manual review and reprocessing
- Alert monitoring system
- Log for debugging

---

## Event Schema Validation

### baby_event.created

```javascript
const babyEventSchema = {
  event_id: { type: 'string', required: true },
  event_type: { type: 'string', enum: ['baby_event.created'], required: true },
  timestamp: { type: 'date', required: true },
  idempotency_key: { type: 'string', required: true },
  payload: {
    baby_id: { type: 'string', required: true },
    type: { type: 'string', enum: ['cry', 'feed', 'diaper', 'sleep', 'note'], required: true },
    ts: { type: 'date', required: true }
    // ... type-specific fields
  }
};
```

### baby_analysis.requested

```javascript
const analysisRequestSchema = {
  event_id: { type: 'string', required: true },
  event_type: { type: 'string', enum: ['baby_analysis.requested'], required: true },
  timestamp: { type: 'date', required: true },
  idempotency_key: { type: 'string', required: true },
  payload: {
    baby_id: { type: 'string', required: true },
    trigger: { type: 'string', enum: ['manual', 'auto_cry'], required: true }
  }
};
```

---

## Implementation Notes

### Simple In-Memory Queue (Demo)

For demo purposes, use simple in-memory event queue:

```javascript
class SimpleEventQueue {
  constructor() {
    this.queue = [];
    this.consumers = {};
  }
  
  emit(eventType, payload) {
    const event = {
      event_id: generateId(),
      event_type: eventType,
      timestamp: new Date().toISOString(),
      payload
    };
    
    this.queue.push(event);
    this.processNext();
  }
  
  on(eventType, handler) {
    this.consumers[eventType] = handler;
  }
  
  async processNext() {
    if (this.queue.length === 0) return;
    
    const event = this.queue.shift();
    const handler = this.consumers[event.event_type];
    
    if (handler) {
      try {
        await handler(event);
      } catch (error) {
        console.error('Event processing failed:', error);
      }
    }
  }
}
```

### Production: Use Real Message Queue

For production, replace with:
- **AWS SQS** - Simple, managed queue
- **RabbitMQ** - Feature-rich message broker
- **Kafka** - High-throughput event streaming

---

## Benefits

### 1. Decoupling
- API endpoints don't wait for analysis
- Services can scale independently

### 2. Reliability
- Automatic retries on failure
- Idempotency prevents duplicates
- Dead letter queue for manual review

### 3. Observability
- Every event has unique ID
- Request tracing via request_id
- Clear audit trail

### 4. Scalability
- Multiple consumers can process events
- Easy to add new event types
- Horizontal scaling support

---

## Example Flow

### Scenario: Baby cries, analysis triggered

```
1. POST /v1/babies/baby_demo_1/events
   Body: { type: "cry", cry_intensity: 0.75, ... }
   
2. Emit: baby_event.created
   Idempotency: baby_demo_1:cry:2026-01-16T10:00:00.000Z
   
3. Consumer: Store event in DB
   
4. Emit: baby_analysis.requested (auto-triggered by cry)
   Idempotency: baby_demo_1:analysis:2026-01-16T10:00:01.000Z
   
5. Consumer: Run analysis pipeline
   - Fetch events
   - Compute signals
   - Generate hypotheses
   - Generate suggestions
   
6. Emit: baby_analysis.completed
   Idempotency: baby_demo_1:analysis:2026-01-16T10:00:01.000Z:result
   
7. Consumer: Notify frontend (WebSocket/SSE)
   
8. Frontend: Display analysis results
```

---

## Summary

Simple, demo-ready event-driven architecture for CryFlow:

- ✅ **3 event types** (created, requested, completed)
- ✅ **Idempotency** via unique keys + TTL
- ✅ **Retry strategy** with exponential backoff
- ✅ **Failure handling** with DLQ
- ✅ **Clear responsibilities** for each consumer
- ✅ **Easy to implement** for demo
- ✅ **Production-ready** with real message queue

**Status:** Design Complete - Ready for Demo Implementation

---

**Version:** 1.0.0  
**Date:** 2026-01-16
