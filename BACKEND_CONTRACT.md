# CryFlow Backend Contract Specification

**Version:** 0.1.0  
**Last Updated:** 2026-01-16  
**Status:** Ready for Implementation

---

## Section A: Endpoints (Priority Order)

### Priority 1: CRITICAL - Analysis Engine
**`POST /v1/babies/{baby_id}/analyze`**
- **Blocks:** Alert banner, KPIs, charts, results table
- **Current State:** Client-side script ready to be replaced
- **Impact:** 🔴 Frontend completely blocked without this

### Priority 2: ESSENTIAL - Event Timeline
**`GET /v1/babies/{baby_id}/events`**
- **Blocks:** Data source for analysis trigger
- **Current State:** Direct DB query (needs API migration)
- **Impact:** 🟠 No events = no analysis possible

### Priority 3: SUPPORTING - Event Creation
**`POST /v1/babies/{baby_id}/events`**
- **Blocks:** Manual event logging (future)
- **Current State:** Not implemented in frontend
- **Impact:** 🟡 Required for production workflow

### Priority 4: OPERATIONAL
- **`GET /v1/health`** - Health checks
- **`POST /v1/babies/{baby_id}/actions`** - Action logging

### Priority 5: DATA INTEGRATION
**`POST /v1/datasets/senso/import`** - Senso.ai patterns

---

## Section B: Critical Endpoint - `/analyze`

### Request Schema

```json
{
  "window_min": 360,           // INTEGER, optional, default=360, range: 5-1440
  "include_questions": true,   // BOOLEAN, optional, default=true
  "context": {                 // OBJECT, optional
    "caregiver_note": "...",   // STRING, optional, max 2000 chars
    "locale": "en-US"          // STRING, optional, max 32 chars
  }
}
```

**Path Parameter:** `baby_id` (string, 1-128 chars)  
**Required Fields:** NONE (all optional with defaults)

---

### Response Schema (Backend OpenAPI Format)

```json
{
  "analysis_id": "ana_01J3QZ9ABC",
  "baby_id": "baby_demo_1",
  "ts": "2026-01-16T19:22:10Z",
  
  "signals": {
    "time_since_last_feed_min": 185,
    "time_since_last_diaper_min": 95,
    "recent_sleep_min": 22,
    "cry_duration_sec": 140
  },
  
  "hypotheses": [
    {
      "label": "hunger",
      "confidence": 0.62,
      "why": [
        "Long time since last feed suggests hunger",
        "Cry pattern indicates hunger cue"
      ]
    }
  ],
  
  "suggestions": [
    {
      "title": "Try feeding",
      "steps": [
        "Offer breast or bottle",
        "Ensure comfortable position"
      ],
      "safety_note": "This is non-medical guidance. Consult pediatrician for concerns."
    }
  ],
  
  "next_best_questions": [
    "Has baby eaten in the last 3 hours?"
  ]
}
```

---

### Frontend Expected Format (TRANSFORMATION REQUIRED)

⚠️ **CRITICAL:** Backend returns ONE analysis. Frontend expects array of results per cry event.

```json
[
  {
    "event_id": "50",
    "likely_reasons": ["hunger", "sleepy"],
    "recommended_checks": [
      "Offer feeding",
      "Check if hungry",
      "Create calm environment for sleep"
    ],
    "confidence": 0.75,
    "explanation": "Long time since last feed suggests hunger"
  }
]
```

---

## Label Mapping (CRITICAL)

### Backend Hypothesis Labels (OpenAPI Enum)
```
"hunger"
"overtired"
"discomfort"
"needs_burp_or_gas"
"overstimulated"
"wants_contact"
"unknown"
```

### Frontend Reason Labels (STRICT)
```
"hunger"
"dirty_diaper"      ⚠️ NO BACKEND EQUIVALENT
"sleepy"            ⚠️ MAPS FROM "overtired"
"overstimulated"
"discomfort"
"needs_soothing"    ⚠️ MAPS FROM "wants_contact"
"unknown"
```

### Required Mapping Layer

```javascript
const BACKEND_TO_FRONTEND_LABELS = {
  "hunger": "hunger",
  "overtired": "sleepy",
  "discomfort": "discomfort",
  "needs_burp_or_gas": "discomfort",
  "overstimulated": "overstimulated",
  "wants_contact": "needs_soothing",
  "unknown": "unknown"
};

// Special case: Detect dirty diaper from signals
// If time_since_last_diaper_min > 120 AND diaper events show dirty=true pattern
// Add "dirty_diaper" to likely_reasons
```

---

## Section C: Validation Rules & Edge Cases

### Backend Must Guarantee Checklist

#### Data Integrity
- [ ] Event ID linkage to specific cry events
- [ ] Analysis timestamp >= all analyzed event timestamps
- [ ] Signal consistency (feed time → feed event exists)
- [ ] Confidence values strictly in [0.0, 1.0]

#### Business Logic
- [ ] Minimum 1 hypothesis (use "unknown" if needed)
- [ ] Minimum 1 suggestion (generic if needed)
- [ ] Only analyze events within `window_min` lookback
- [ ] Hypotheses sorted by confidence DESC

#### Response Format
- [ ] Unique `analysis_id` (idempotent within cache TTL)
- [ ] ISO 8601 timestamps (`YYYY-MM-DDTHH:MM:SSZ`)
- [ ] Non-empty arrays: `hypotheses[]`, `suggestions[]`, `why[]`, `steps[]`
- [ ] String limits: `title` ≤ 120, `safety_note` ≤ 300, `caregiver_note` ≤ 2000

#### Error Handling
- [ ] No events in window → "unknown" + generic suggestion + questions
- [ ] Invalid baby_id → 404 with error object
- [ ] Missing context → populate `next_best_questions`
- [ ] Malformed request → 400 with specific field error

---

### Edge Cases

#### Case 1: No Recent Cry Events
```json
{
  "hypotheses": [{
    "label": "unknown",
    "confidence": 0.1,
    "why": ["No recent cry events to analyze"]
  }],
  "suggestions": [{
    "title": "Continue monitoring",
    "steps": ["Watch for signs of distress"]
  }],
  "next_best_questions": ["Has baby cried recently?"]
}
```

#### Case 2: Conflicting Signals
- Time since feed = 200 min (hunger) BUT recent diaper + high-pitched cry
- Return multiple hypotheses with balanced confidence scores
- Provide multiple suggestions ordered by confidence

#### Case 3: Incomplete Event Data
- Cry event has null intensity/duration/pattern
- Analyze based on timing signals only
- Lower confidence scores
- Add clarifying questions to `next_best_questions`

#### Case 4: Cold Start (First Event)
- Only 1 cry event, no history
- All `time_since_*` fields = null
- Use Senso baseline patterns if available
- Heavy reliance on `next_best_questions`

#### Case 5: Multiple Cry Events in Window
- Analyze MOST RECENT cry event for `event_id`
- Consider cry frequency/escalation in reasoning
- Document behavior for `signals.cry_duration_sec` (sum vs avg)

---

## Pre-Response Validation Checklist

Before returning ANY response:

✅ `analysis_id` generated and stored for audit trail  
✅ At least 1 hypothesis with valid enum label  
✅ At least 1 suggestion with non-empty `steps[]`  
✅ All confidence values are numbers in [0, 1]  
✅ All timestamps are valid ISO 8601 strings  
✅ `baby_id` in response matches path parameter  
✅ If `include_questions: true`, return questions or `[]`  
✅ Safety note included for physical interaction suggestions  

---

## Frontend Transformation Requirements

The frontend must implement:

✅ Map `hypotheses[].label` → `likely_reasons[]` using mapping table  
✅ Flatten `suggestions[].steps[]` → `recommended_checks[]`  
✅ Extract `hypotheses[0].confidence` → `confidence`  
✅ Extract `hypotheses[0].why[0]` → `explanation`  
✅ Link analysis to specific `event_id` from cry events  
✅ Return array of results (one per analyzed cry event)  

---

## Implementation Priority

1. **Build `/analyze` endpoint** - OpenAPI-compliant response
2. **Add transformation layer** - Backend → Frontend format conversion
3. **Implement label mapping** - Handle enum mismatches
4. **Edge case handling** - All scenarios documented above
5. **Audit trail** - Store `analysis_id` + reasoning in MongoDB

---

## Non-Medical Wording Requirements

### ✅ ALLOWED
- "care suggestions"
- "contextual insights"
- "hunger", "sleepy", "discomfort" (behavioral observations)
- "pattern recognition"
- "caregiver support"

### ❌ FORBIDDEN
- "diagnosis", "treatment"
- "medical assessment"
- "colic", "reflux", "illness", "disease", "condition"
- Any medical terminology

### 🔒 MANDATORY
Every suggestion MUST include:
```
"safety_note": "This is non-medical guidance. Consult pediatrician for concerns."
```

---

## Sample Data Reference

- **Dataset:** `cryflow_events_sample.csv` (112 events)
- **Baby IDs:** `baby_demo_1`, `baby_demo_2`
- **Event Types:** cry, feed, diaper, sleep, note
- **Sources:** manual, device, agent
- **Date Range:** 2026-01-16 (single day)

---

## Next Steps

1. Review this contract with frontend team
2. Confirm label mapping strategy for "dirty_diaper"
3. Decide on transformation layer location (backend vs frontend)
4. Set up MongoDB schema for analysis audit trail
5. Begin implementation with Priority 1 endpoint
