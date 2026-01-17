# Response Format Comparison

**OpenAPI vs Frontend Format**  
**Side-by-Side Comparison**

---

## Request

**Same for both formats:**
```http
POST /v1/babies/baby_demo_1/analyze
Content-Type: application/json
X-Demo-Key: demo

{
  "window_min": 360,
  "include_questions": true,
  "context": {
    "caregiver_note": "Baby woke up 10 min ago."
  }
}
```

---

## Response Comparison

### OpenAPI Format (Default)

**URL:** `/v1/babies/baby_demo_1/analyze`

```json
{
  "analysis_id": "ana_xyz123abc",
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
        "Long time since last feed (185 minutes)",
        "Continuous cry pattern suggests hunger"
      ]
    },
    {
      "label": "overtired",
      "confidence": 0.30,
      "why": [
        "Short recent sleep (22 minutes)",
        "Extended awake window"
      ]
    }
  ],
  
  "suggestions": [
    {
      "title": "Try feeding",
      "steps": [
        "Offer breast or bottle",
        "Ensure comfortable feeding position",
        "Watch for hunger cues (rooting, sucking)",
        "Burp baby after feeding"
      ],
      "safety_note": "This is non-medical guidance. Consult pediatrician for concerns."
    },
    {
      "title": "Monitor sleep cues",
      "steps": [
        "Watch for yawning or eye rubbing",
        "Prepare calm sleep environment"
      ],
      "safety_note": null
    }
  ],
  
  "next_best_questions": [
    "Has baby eaten in the last 3 hours?",
    "Did baby finish the last feeding?"
  ]
}
```

**Characteristics:**
- ✅ Single object response
- ✅ Multiple hypotheses with full reasoning
- ✅ Structured suggestions with titles
- ✅ Complete audit trail
- ✅ Signals included
- ✅ Follow-up questions

**Use Cases:**
- API consumers
- ML training data
- Analytics dashboards
- Audit trail review
- Debugging

---

### Frontend Format (Query Parameter)

**URL:** `/v1/babies/baby_demo_1/analyze?format=frontend`

```json
[
  {
    "event_id": "67890abcdef12345",
    "likely_reasons": ["hunger", "sleepy"],
    "recommended_checks": [
      "Offer breast or bottle",
      "Ensure comfortable feeding position",
      "Watch for hunger cues (rooting, sucking)",
      "Burp baby after feeding",
      "Watch for yawning or eye rubbing",
      "Prepare calm sleep environment"
    ],
    "confidence": 0.62,
    "explanation": "Long time since last feed (185 minutes)"
  }
]
```

**Characteristics:**
- ✅ Array response (one item per cry event)
- ✅ Mapped labels (overtired → sleepy)
- ✅ Flattened action steps
- ✅ Single confidence score
- ✅ Single explanation string
- ✅ Linked to event_id

**Use Cases:**
- Retool dashboard
- Mobile app
- Simple UI displays
- Quick insights

---

## Field Mapping

### Top-Level Fields

| OpenAPI | Frontend | Transformation |
|---------|----------|----------------|
| `analysis_id` | (not included) | Removed |
| `baby_id` | (not included) | Removed |
| `ts` | (not included) | Removed |
| `signals` | (not included) | Removed |
| (none) | `event_id` | Added from most recent cry |
| `hypotheses[].label` | `likely_reasons[]` | Mapped array |
| `suggestions[].steps[]` | `recommended_checks[]` | Flattened |
| `hypotheses[0].confidence` | `confidence` | Top hypothesis only |
| `hypotheses[0].why[0]` | `explanation` | First reason only |

---

### Label Mapping

| OpenAPI Label | Frontend Label | Notes |
|---------------|----------------|-------|
| `hunger` | `hunger` | ✅ Direct match |
| `overtired` | `sleepy` | 🔄 Mapped |
| `discomfort` | `discomfort` | ✅ Direct match |
| `needs_burp_or_gas` | `discomfort` | 🔄 Merged |
| `overstimulated` | `overstimulated` | ✅ Direct match |
| `wants_contact` | `needs_soothing` | 🔄 Mapped |
| `unknown` | `unknown` | ✅ Direct match |
| (inferred) | `dirty_diaper` | ➕ Added when conditions met |

---

## Transformation Logic

### Step 1: Extract Top Hypotheses

```javascript
// OpenAPI: Multiple hypotheses
const hypotheses = [
  { label: "hunger", confidence: 0.62 },
  { label: "overtired", confidence: 0.30 }
];

// Frontend: Map to likely_reasons
const likely_reasons = hypotheses
  .slice(0, 3)  // Top 3
  .map(h => labelMap[h.label]);  // Map labels

// Result: ["hunger", "sleepy"]
```

---

### Step 2: Flatten Suggestions

```javascript
// OpenAPI: Structured suggestions
const suggestions = [
  {
    title: "Try feeding",
    steps: ["Offer breast or bottle", "Ensure comfortable position"]
  },
  {
    title: "Monitor sleep cues",
    steps: ["Watch for yawning", "Prepare calm environment"]
  }
];

// Frontend: Flat array
const recommended_checks = suggestions.flatMap(s => s.steps);

// Result: [
//   "Offer breast or bottle",
//   "Ensure comfortable position",
//   "Watch for yawning",
//   "Prepare calm environment"
// ]
```

---

### Step 3: Extract Confidence & Explanation

```javascript
// OpenAPI: Per-hypothesis confidence
const topHypothesis = hypotheses[0];

// Frontend: Single values
const confidence = topHypothesis.confidence;  // 0.62
const explanation = topHypothesis.why[0];     // "Long time since last feed..."
```

---

### Step 4: Link to Event

```javascript
// Find most recent cry event
const mostRecentCry = events
  .filter(e => e.type === 'cry')
  .sort((a, b) => new Date(b.ts) - new Date(a.ts))[0];

const event_id = mostRecentCry._id.toString();
```

---

### Step 5: Infer dirty_diaper

```javascript
// Check conditions
if (signals.time_since_last_diaper_min > 180 &&
    events.some(e => e.type === 'diaper' && e.diaper_dirty)) {
  likely_reasons.push("dirty_diaper");
}
```

---

## Response Size Comparison

### OpenAPI Format
```
Size: ~1.2 KB
Fields: 8 top-level
Nested: 3 levels deep
Arrays: 3 (hypotheses, suggestions, questions)
```

### Frontend Format
```
Size: ~0.4 KB (67% smaller)
Fields: 5 top-level
Nested: 1 level (array wrapper)
Arrays: 3 (wrapper, likely_reasons, recommended_checks)
```

**Bandwidth Savings:** 67% reduction for frontend format

---

## Use Case Matrix

| Use Case | OpenAPI | Frontend | Reason |
|----------|---------|----------|--------|
| Retool Dashboard | ❌ | ✅ | Needs simple array |
| Mobile App | ❌ | ✅ | Bandwidth sensitive |
| Analytics | ✅ | ❌ | Needs full details |
| ML Training | ✅ | ❌ | Needs reasoning traces |
| Audit Trail | ✅ | ❌ | Needs complete data |
| API Consumers | ✅ | ❌ | Needs structured data |
| Quick Insights | ❌ | ✅ | Needs simplicity |

---

## Implementation Status

### Backend ✅

**File:** `src/services/analysisService.js`

```javascript
function transformToFrontendFormat(analysisResult, events) {
  // Label mapping
  const labelMap = {
    'hunger': 'hunger',
    'overtired': 'sleepy',
    'discomfort': 'discomfort',
    'needs_burp_or_gas': 'discomfort',
    'overstimulated': 'overstimulated',
    'wants_contact': 'needs_soothing',
    'unknown': 'unknown'
  };
  
  // Get most recent cry event
  const mostRecentCry = events
    .filter(e => e.type === 'cry')
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))[0];
  
  // Map hypotheses to likely_reasons
  const likely_reasons = analysisResult.hypotheses
    .map(h => labelMap[h.label]);
  
  // Infer dirty_diaper
  if (analysisResult.signals.time_since_last_diaper_min > 180 &&
      events.some(e => e.type === 'diaper' && e.diaper_dirty)) {
    likely_reasons.push('dirty_diaper');
  }
  
  // Flatten suggestions
  const recommended_checks = analysisResult.suggestions
    .flatMap(s => s.steps);
  
  // Extract top hypothesis
  const topHypothesis = analysisResult.hypotheses[0];
  
  return {
    event_id: mostRecentCry?._id?.toString() || 'unknown',
    likely_reasons,
    recommended_checks,
    confidence: topHypothesis.confidence,
    explanation: topHypothesis.why[0] || 'Analysis complete'
  };
}
```

**Controller:** `src/controllers/analysisController.js`

```javascript
// Check if frontend format is requested
const acceptFrontendFormat = req.query.format === 'frontend' || 
                             req.headers['x-frontend-format'] === 'true';

if (acceptFrontendFormat) {
  const frontendResult = transformToFrontendFormat(analysisResult, events);
  return res.json([frontendResult]);  // Wrap in array
}

// Return OpenAPI format
res.json(analysisResult);
```

---

### Frontend 🔄

**Current (Client-side):**
```javascript
// runAnalysisScript.js
const data = rawCryDataVariable.value;
// ... client-side analysis logic ...
analysisResultsVariable.setValue(results);
```

**New (API call):**
```javascript
// Retool Query: analyzeCryEventsAPI
// Method: POST
// URL: /v1/babies/baby_demo_1/analyze?format=frontend
// Headers: X-Demo-Key: demo
// Body: {"window_min": 360}

// On Success:
analysisResultsVariable.setValue(analyzeCryEventsAPI.data);
```

**Zero transformation needed!** ✅

---

## Testing Examples

### Test 1: Normal Analysis

**Request:**
```bash
curl -X POST "http://localhost:3000/v1/babies/baby_demo_1/analyze?format=frontend" \
  -H "X-Demo-Key: demo" \
  -H "Content-Type: application/json" \
  -d '{"window_min": 360}'
```

**Expected Response:**
```json
[
  {
    "event_id": "67890abcdef",
    "likely_reasons": ["hunger", "sleepy"],
    "recommended_checks": ["Offer breast or bottle", "..."],
    "confidence": 0.62,
    "explanation": "Long time since last feed (185 minutes)"
  }
]
```

---

### Test 2: No Events

**Expected Response:**
```json
[
  {
    "event_id": "unknown",
    "likely_reasons": ["unknown"],
    "recommended_checks": ["Watch for signs of distress", "..."],
    "confidence": 0.1,
    "explanation": "No recent events to analyze"
  }
]
```

---

### Test 3: dirty_diaper Inference

**Conditions:**
- `time_since_last_diaper_min > 180`
- Recent diaper event with `diaper_dirty: true`

**Expected Response:**
```json
[
  {
    "event_id": "67890abcdef",
    "likely_reasons": ["discomfort", "dirty_diaper"],
    "recommended_checks": ["Check diaper", "..."],
    "confidence": 0.75,
    "explanation": "Long time since diaper change"
  }
]
```

---

## Migration Checklist

### Backend ✅
- [x] Transformation function implemented
- [x] Format detection in controller
- [x] Label mapping logic
- [x] dirty_diaper inference
- [x] Array wrapping
- [x] Event linking

### Frontend 🔄
- [ ] Create REST API resource in Retool
- [ ] Set URL with `?format=frontend`
- [ ] Add authentication headers
- [ ] Replace `runAnalysisScript` with API call
- [ ] Test with sample data
- [ ] Verify UI components

### Documentation ✅
- [x] API_CONTRACT_VALIDATION.md
- [x] RESPONSE_FORMAT_COMPARISON.md
- [x] Updated BACKEND_CONTRACT.md
- [x] Updated README_BACKEND.md

---

## Summary

### ✅ Solution: Dual Format Support

**OpenAPI Format (Default):**
- Full hypothesis details
- Structured suggestions
- Complete audit trail
- For API consumers

**Frontend Format (Opt-in):**
- Simplified array response
- Mapped labels
- Flattened fields
- For Retool dashboard

**Activation:**
- Query parameter: `?format=frontend`
- Header: `X-Frontend-Format: true`

**Benefits:**
- ✅ Zero breaking changes
- ✅ Backward compatible
- ✅ Frontend gets exactly what it needs
- ✅ 67% bandwidth reduction
- ✅ Already implemented

**Next Step:**
Update Retool to use `?format=frontend` parameter!
