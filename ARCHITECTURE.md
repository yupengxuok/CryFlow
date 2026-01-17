# CryFlow System Architecture

**Version:** 0.1.0  
**Last Updated:** 2026-01-16

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CRYFLOW SYSTEM                          │
│                                                                 │
│  Event-Driven AI Caregiver Support System                      │
│  Non-Medical Pattern Recognition & Contextual Insights         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

```
┌──────────────────┐
│  Retool Frontend │  (Priority: Immediate Integration)
│  Dashboard       │
└────────┬─────────┘
         │
         │ REST API (JSON)
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                    BACKEND API LAYER                         │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  POST /v1/babies/{baby_id}/analyze  [PRIORITY 1]      │  │
│  │  GET  /v1/babies/{baby_id}/events   [PRIORITY 2]      │  │
│  │  POST /v1/babies/{baby_id}/events   [PRIORITY 3]      │  │
│  │  GET  /v1/health                    [PRIORITY 4]      │  │
│  │  POST /v1/babies/{baby_id}/actions  [PRIORITY 4]      │  │
│  │  POST /v1/datasets/senso/import     [PRIORITY 5]      │  │
│  └────────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                   ANALYSIS ENGINE CORE                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Event      │  │   Signal     │  │  Hypothesis  │      │
│  │  Validator   │→ │  Computer    │→ │  Generator   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         ▼                  ▼                  ▼              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Enum Check   │  │ Temporal     │  │ Confidence   │      │
│  │ Range Check  │  │ Gaps         │  │ Scoring      │      │
│  │ Type Rules   │  │ Frequencies  │  │ Reasoning    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Suggestion Engine                          │  │
│  │  - Action steps generation                           │  │
│  │  - Safety notes (non-medical compliance)             │  │
│  │  - Next best questions                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Transformation Layer                         │  │
│  │  - Backend format → Frontend format                  │  │
│  │  - Label mapping (overtired → sleepy)                │  │
│  │  - Array flattening (hypotheses → likely_reasons)    │  │
│  └──────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │   MongoDB      │  │     Redis      │  │  PostgreSQL  │  │
│  │  (Events)      │  │   (Cache)      │  │  (Optional)  │  │
│  └────────────────┘  └────────────────┘  └──────────────┘  │
│                                                              │
│  Collections/Tables:                                         │
│  - events (baby_id, ts, type, payload)                      │
│  - analyses (analysis_id, baby_id, hypotheses, suggestions) │
│  - babies (baby_id, birth_date, metadata) [v2]              │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                  EXTERNAL INTEGRATIONS                       │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │   Senso.ai     │  │  TinyFish Web  │  │  AWS Kiro    │  │
│  │  (Synthetic    │  │    Agent       │  │  (Reasoning) │  │
│  │   Patterns)    │  │ (Conversational│  │              │  │
│  └────────────────┘  └────────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Analysis Request

```
1. USER ACTION
   └─> Retool: Click "Analyze" or auto-trigger on data load

2. FRONTEND REQUEST
   └─> POST /v1/babies/baby_demo_1/analyze
       {
         "window_min": 360,
         "include_questions": true,
         "context": { "caregiver_note": "..." }
       }

3. BACKEND PROCESSING
   ├─> Validate request (window_min range, context length)
   ├─> Query events from database (last 360 minutes)
   ├─> Validate events (enum, ranges, types)
   ├─> Compute derived signals
   │   ├─> time_since_last_feed_min
   │   ├─> time_since_last_diaper_min
   │   ├─> recent_sleep_min
   │   ├─> cry_duration_sec
   │   └─> cry_escalation pattern
   ├─> Generate hypotheses
   │   ├─> Hunger (confidence: 0.62)
   │   │   └─> why: ["Long time since feed", "Cry pattern"]
   │   └─> Overtired (confidence: 0.30)
   │       └─> why: ["Short recent sleep"]
   ├─> Generate suggestions
   │   ├─> "Try feeding" → steps + safety_note
   │   └─> "Create calm environment" → steps
   ├─> Generate next_best_questions
   │   └─> ["Has baby eaten in last 3 hours?"]
   └─> Store analysis (analysis_id, audit trail)

4. TRANSFORMATION LAYER
   ├─> Map labels: "overtired" → "sleepy"
   ├─> Flatten: hypotheses[].label → likely_reasons[]
   ├─> Flatten: suggestions[].steps[] → recommended_checks[]
   ├─> Extract: hypotheses[0].confidence → confidence
   ├─> Extract: hypotheses[0].why[0] → explanation
   └─> Link: analysis → event_id (most recent cry)

5. BACKEND RESPONSE
   └─> Return transformed array:
       [
         {
           "event_id": "50",
           "likely_reasons": ["hunger", "sleepy"],
           "recommended_checks": ["Offer feeding", "..."],
           "confidence": 0.62,
           "explanation": "Long time since last feed"
         }
       ]

6. FRONTEND RENDERING
   ├─> analysisResultsVariable.setValue(response)
   ├─> Alert banner: Top 3 reasons with percentages
   ├─> KPI cards: Total events, avg confidence, analyzed count
   ├─> Chart: Reason distribution (horizontal bar)
   └─> Tables: Raw events + analysis results
```

---

## Event Processing Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    EVENT INGESTION                          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  VALIDATION STAGE                                           │
│  ├─> Enum validation (source, type, patterns)              │
│  ├─> Timestamp validation (ISO 8601, no future)            │
│  ├─> Type-specific validation (cry needs duration)         │
│  └─> Numeric range validation (intensity 0-1)              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  NORMALIZATION STAGE                                        │
│  ├─> Empty strings → null                                  │
│  ├─> Timezone → UTC                                        │
│  ├─> Trim whitespace                                       │
│  └─> Apply defaults (cry_intensity = 0.5)                  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  ENRICHMENT STAGE                                           │
│  ├─> Add created_at server timestamp                       │
│  ├─> Tag analysis_eligible (cry events only)               │
│  └─> Calculate age_at_event (if birth_date available)      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STORAGE STAGE                                              │
│  ├─> Insert into events collection                         │
│  ├─> Index: baby_id, ts, type                              │
│  └─> Partition by baby_id (multi-tenant)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Signal Computation Flow

```
INPUT: Event Timeline (last 360 minutes)
  ├─> cry events: 3
  ├─> feed events: 2
  ├─> diaper events: 1
  └─> sleep events: 4

TEMPORAL GAP SIGNALS
  ├─> time_since_last_feed_min
  │   └─> Find most recent feed event
  │   └─> Calculate: now - feed.ts (in minutes)
  │
  ├─> time_since_last_diaper_min
  │   └─> Find most recent diaper event
  │   └─> Calculate: now - diaper.ts (in minutes)
  │
  ├─> recent_sleep_min
  │   └─> Find most recent asleep → woke_up pair
  │   └─> Calculate: woke_up.ts - asleep.ts (in minutes)
  │
  └─> awake_window_min
      └─> Find most recent woke_up event
      └─> Calculate: now - woke_up.ts (in minutes)

FREQUENCY SIGNALS
  ├─> cry_count_last_hour
  │   └─> Count cry events in last 60 minutes
  │
  ├─> feed_count_last_6h
  │   └─> Count feed events in last 360 minutes
  │
  └─> diaper_count_last_6h
      └─> Count diaper events in last 360 minutes

PATTERN SIGNALS
  ├─> cry_pattern_mode
  │   └─> Most common cry_pattern value
  │
  ├─> avg_feed_interval_min
  │   └─> Average time between consecutive feeds
  │
  └─> cry_escalation
      └─> Analyze last 3 cry events
      └─> Check if intensity/duration increasing
      └─> Return: "stable", "worsening", "escalating"

OUTPUT: Derived Signals Object
  {
    "time_since_last_feed_min": 185,
    "time_since_last_diaper_min": 95,
    "recent_sleep_min": 22,
    "awake_window_min": 45,
    "cry_duration_sec": 140,
    "cry_count_last_hour": 3,
    "cry_escalation": "escalating"
  }
```

---

## Hypothesis Generation Logic

```
INPUT: Derived Signals + Event Context

RULE ENGINE
  ├─> HUNGER HYPOTHESIS
  │   ├─> IF time_since_last_feed_min > 180
  │   │   └─> confidence += 0.4
  │   ├─> IF cry_pattern == "continuous"
  │   │   └─> confidence += 0.2
  │   ├─> IF cry_pitch_hint == "low"
  │   │   └─> confidence += 0.1
  │   └─> Generate "why" array with reasoning
  │
  ├─> OVERTIRED HYPOTHESIS
  │   ├─> IF awake_window_min > 90
  │   │   └─> confidence += 0.4
  │   ├─> IF recent_sleep_min < 30
  │   │   └─> confidence += 0.3
  │   ├─> IF cry_escalation == "escalating"
  │   │   └─> confidence += 0.2
  │   └─> Generate "why" array
  │
  ├─> DISCOMFORT HYPOTHESIS
  │   ├─> IF time_since_last_diaper_min > 180
  │   │   └─> confidence += 0.3
  │   ├─> IF cry_pitch_hint == "high"
  │   │   └─> confidence += 0.3
  │   ├─> IF cry_intensity > 0.7
  │   │   └─> confidence += 0.2
  │   └─> Generate "why" array
  │
  └─> OVERSTIMULATED HYPOTHESIS
      ├─> IF cry_count_last_hour > 3
      │   └─> confidence += 0.3
      ├─> IF awake_window_min > 120
      │   └─> confidence += 0.2
      └─> Generate "why" array

NORMALIZATION
  └─> Ensure all confidence values sum to ≤ 1.0
  └─> Sort hypotheses by confidence DESC
  └─> Keep top 3 hypotheses

OUTPUT: Hypotheses Array
  [
    {
      "label": "hunger",
      "confidence": 0.62,
      "why": ["Long time since last feed", "Cry pattern indicates hunger"]
    },
    {
      "label": "overtired",
      "confidence": 0.30,
      "why": ["Extended awake window", "Short recent sleep"]
    }
  ]
```

---

## Technology Stack Options

### Option A: Node.js Stack (Recommended for Speed)
```
- Runtime: Node.js 18+
- Framework: Express.js
- Database: MongoDB
- Cache: Redis
- Validation: Joi / Zod
- Testing: Jest
- Deployment: Vercel / Railway / AWS Lambda
```

### Option B: Python Stack (Recommended for ML)
```
- Runtime: Python 3.11+
- Framework: FastAPI
- Database: PostgreSQL
- Cache: Redis
- Validation: Pydantic
- Testing: Pytest
- Deployment: AWS ECS / Google Cloud Run
```

---

## Security & Compliance

### Authentication
```
┌─────────────────────────────────────────┐
│  Auth0 JWT (Production)                 │
│  OR                                      │
│  X-Demo-Key: demo (Hackathon/Testing)   │
└─────────────────────────────────────────┘
```

### Non-Medical Compliance
```
✅ ALLOWED
  - "care suggestions"
  - "contextual insights"
  - "hunger", "sleepy", "discomfort"

❌ FORBIDDEN
  - "diagnosis", "treatment"
  - "colic", "reflux", "illness"

🔒 MANDATORY
  - Every suggestion includes safety_note
  - "This is non-medical guidance. Consult pediatrician."
```

### Data Privacy
```
- Baby data encrypted at rest
- PII handling per GDPR/CCPA
- Audit trail for all analyses
- TTL policy: Archive after 90 days
```

---

## Monitoring & Observability

### Key Metrics
```
- API latency (p50, p95, p99)
- Analysis accuracy (user feedback)
- Event ingestion rate
- Data quality scores
- Error rates by endpoint
```

### Logging
```
- Request/response logs
- Analysis reasoning traces
- Validation errors
- Signal computation results
```

### Alerts
```
- High error rate (> 5%)
- Slow response time (> 2s)
- Data quality degradation
- Database connection issues
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      PRODUCTION                             │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │   Retool     │───▶│  API Gateway │───▶│   Backend    │ │
│  │  Dashboard   │    │   (HTTPS)    │    │   Service    │ │
│  └──────────────┘    └──────────────┘    └──────┬───────┘ │
│                                                   │         │
│                                          ┌────────▼───────┐ │
│                                          │   MongoDB      │ │
│                                          │   Cluster      │ │
│                                          └────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Monitoring: DataDog / New Relic / CloudWatch       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Choose Stack:** Node.js or Python
2. **Set Up Project:** Initialize repo, dependencies
3. **Implement Priority 1:** `/analyze` endpoint
4. **Test with Sample Data:** 112 events from CSV
5. **Deploy Demo:** Connect frontend to backend
6. **Iterate:** Add features, improve accuracy

---

**Architecture Ready for Implementation!** 🏗️
