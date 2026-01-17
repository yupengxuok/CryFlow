# API Contract Validation - OpenAPI vs Frontend

**Analysis Date:** 2026-01-16  
**Status:** Mismatches Identified → Solutions Proposed

---

## Section A: Identified Mismatches

### 🔴 CRITICAL MISMATCHES

#### 1. Response Structure: Single Object vs Array

**OpenAPI Spec:**
```json
{
  "analysis_id": "ana_01J3QZ9ABC",
  "baby_id": "baby_demo_1",
  "hypotheses": [...]
}
```

**Frontend Expects:**
```json
[
  {
    "event_id": "50",
    "likely_reasons": [...]
  }
]
```

**Issue:** OpenAPI returns ONE analysis object. Frontend expects ARRAY of results (one per cry event).

**Impact:** 🔴 BREAKING - Frontend cannot consume response without transformation

---

#### 2. Hypothesis Labels: Enum Mismatch

**OpenAPI Enum:**
```
"hunger" | "overtired" | "discomfort" | "needs_burp_or_gas" | 
"overstimulated" | "wants_contact" | "unknown"
```

**Frontend Enum:**
```
"hunger" | "dirty_diaper" | "sleepy" | "overstimulated" | 
"discomfort" | "needs_soothing" | "unknown"
```

**Mismatches:**
| OpenAPI | Frontend | Status |
|---------|----------|--------|
| `overtired` | `sleepy` | ❌ Different |
| `wants_contact` | `needs_soothing` | ❌ Different |
| `needs_burp_or_gas` | (maps to `discomfort`) | ⚠️ Ambiguous |
| (none) | `dirty_diaper` | ❌ Missing |

**Impact:** 🔴 BREAKING - Frontend hardcoded to expect specific labels

---

#### 3. Field Naming: Snake_case vs camelCase

**OpenAPI:**
```json
{
  "analysis_id": "...",
  "baby_id": "...",
  "next_best_questions": [...]
}
```

**Frontend:**
```json
{
  "event_id": "...",
  "likely_reasons": [...],
  "recommended_checks": [...]
}
```

**Issue:** Inconsistent naming convention

**Impact:** 🟡 MEDIUM - Requires field mapping

---

#### 4. Missing Fields in OpenAPI Response

**Frontend Requires (Not in OpenAPI):**
- `event_id` - Links to specific cry event
- `likely_reasons` - Array of reason labels
- `recommended_checks` - Flattened action steps
- `confidence` - Single confidence score
- `explanation` - Single explanation string

**OpenAPI Provides Instead:**
- `hypotheses[]` - Array of objects with label/confidence/why
- `suggestions[]` - Array of objects with title/steps
- `next_best_questions[]` - Follow-up questions

**Impact:** 🔴 BREAKING - Frontend expects different structure

---

### 🟡 MEDIUM MISMATCHES

#### 5. Confidence Representation

**OpenAPI:**
```json
{
  "hypotheses": [
    {
      "label": "hunger",
      "confidence": 0.62,
      "why": [...]
    },
    {
      "label": "overtired",
      "confidence": 0.30,
      "why": [...]
    }
  ]
}
```

**Frontend:**
```json
{
  "confidence": 0.62,
  "explanation": "Long time since last feed"
}
```

**Issue:** OpenAPI has multiple confidences (one per hypothesis). Frontend expects single confidence + explanation.

**Impact:** 🟡 MEDIUM - Requires selecting top hypothesis

---

#### 6. Suggestions Structure

**OpenAPI:**
```json
{
  "suggestions": [
    {
      "title": "Try feeding",
      "steps": ["Offer breast or bottle", "Ensure comfortable position"],
      "safety_note": "..."
    }
  ]
}
```

**Frontend:**
```json
{
  "recommended_checks": [
    "Offer breast or bottle",
    "Ensure comfortable position"
  ]
}
```

**Issue:** OpenAPI has structured suggestions. Frontend expects flat array of strings.

**Impact:** 🟡 MEDIUM - Requires flattening

---

### 🟢 MINOR MISMATCHES

#### 7. Timestamp Format

**OpenAPI:** `"ts": "2026-01-16T19:22:10Z"` (ISO 8601)  
**Frontend:** Expects ISO 8601 (✅ Compatible)

**Impact:** 🟢 NONE - Already compatible

---

#### 8. Baby ID Field

**OpenAPI:** `"baby_id": "baby_demo_1"`  
**Frontend:** Uses baby_id in URL path (✅ Compatible)

**Impact:** 🟢 NONE - Already compatible

---

## Section B: Proposed Solutions

### Option 1: Backend Transformation Layer (RECOMMENDED)

**Approach:** Backend returns BOTH formats based on query parameter or header.

**Implementation:**
```javascript
// Query parameter: ?format=frontend
// OR Header: X-Frontend-Format: true

if (req.query.format === 'frontend' || req.headers['x-frontend-format'] === 'true') {
  return transformToFrontendFormat(analysisResult, events);
}

// Default: Return OpenAPI format
return analysisResult;
```

**Pros:**
- ✅ Backward compatible (OpenAPI format still available)
- ✅ Frontend gets exactly what it needs
- ✅ No frontend changes required
- ✅ Easy to version (v1 vs v2)

**Cons:**
- ⚠️ Maintains two response formats
- ⚠️ Slight code duplication

---

### Option 2: Unified Response Format (BREAKING CHANGE)

**Approach:** Change OpenAPI spec to match frontend expectations.

**New Response:**
```json
{
  "analysis_id": "ana_01J3QZ9ABC",
  "baby_id": "baby_demo_1",
  "ts": "2026-01-16T19:22:10Z",
  
  "results": [
    {
      "event_id": "evt_50",
      "likely_reasons": ["hunger", "sleepy"],
      "recommended_checks": [
        "Offer breast or bottle",
        "Ensure comfortable position"
      ],
      "confidence": 0.62,
      "explanation": "Long time since last feed suggests hunger"
    }
  ],
  
  "signals": {
    "time_since_last_feed_min": 185,
    "time_since_last_diaper_min": 95,
    "recent_sleep_min": 22,
    "cry_duration_sec": 140
  },
  
  "next_best_questions": [
    "Has baby eaten in the last 3 hours?"
  ]
}
```

**Pros:**
- ✅ Single source of truth
- ✅ Frontend gets array of results
- ✅ Maintains audit trail (signals, questions)

**Cons:**
- ❌ BREAKING CHANGE to OpenAPI spec
- ❌ Loses detailed hypothesis reasoning
- ❌ Loses structured suggestions

---

### Option 3: Frontend Adapter (NOT RECOMMENDED)

**Approach:** Frontend transforms OpenAPI response.

**Cons:**
- ❌ Frontend complexity
- ❌ Duplicate transformation logic
- ❌ Harder to maintain

---

## Section C: Recommended Solution

### ✅ Hybrid Approach: Dual Format Support

**Implementation:**

1. **Default Response (OpenAPI Format):**
   - Full hypothesis details with reasoning
   - Structured suggestions
   - Complete audit trail
   - For API consumers, ML training, analytics

2. **Frontend Format (Query Parameter):**
   - Simplified array response
   - Flattened fields
   - Frontend-compatible labels
   - For Retool dashboard

**Endpoint:**
```
POST /v1/babies/{baby_id}/analyze
POST /v1/babies/{baby_id}/analyze?format=frontend
```

---

## Section D: Updated Response Examples

### Format 1: OpenAPI (Default)

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
        "Long time since last feed (185 minutes)",
        "Continuous cry pattern suggests hunger"
      ]
    },
    {
      "label": "overtired",
      "confidence": 0.30,
      "why": [
        "Short recent sleep (22 minutes)"
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
    }
  ],
  
  "next_best_questions": [
    "Has baby eaten in the last 3 hours?",
    "Did baby finish the last feeding?"
  ]
}
```

---

### Format 2: Frontend (Query Parameter)

**Request:**
```
POST /v1/babies/baby_demo_1/analyze?format=frontend
```

**Response:**
```json
[
  {
    "event_id": "67890abcdef12345",
    "likely_reasons": ["hunger", "sleepy"],
    "recommended_checks": [
      "Offer breast or bottle",
      "Ensure comfortable feeding position",
      "Watch for hunger cues (rooting, sucking)",
      "Burp baby after feeding"
    ],
    "confidence": 0.62,
    "explanation": "Long time since last feed (185 minutes)"
  }
]
```

**Label Mapping Applied:**
```javascript
{
  "hunger": "hunger",           // ✅ Direct match
  "overtired": "sleepy",         // 🔄 Mapped
  "discomfort": "discomfort",    // ✅ Direct match
  "needs_burp_or_gas": "discomfort", // 🔄 Merged
  "overstimulated": "overstimulated", // ✅ Direct match
  "wants_contact": "needs_soothing", // 🔄 Mapped
  "unknown": "unknown"           // ✅ Direct match
}
```

**Special Case - dirty_diaper:**
```javascript
// Inferred when:
if (signals.time_since_last_diaper_min > 180 && 
    recentDiaperEvents.some(e => e.diaper_dirty)) {
  likely_reasons.push("dirty_diaper");
}
```

---

## Section E: Minimal Compatible Changes

### Backend Changes (Already Implemented ✅)

1. **Add transformation function:**
   ```javascript
   function transformToFrontendFormat(analysisResult, events) {
     // Map labels
     // Flatten suggestions
     // Extract top confidence
     // Link to event_id
   }
   ```

2. **Add format detection:**
   ```javascript
   if (req.query.format === 'frontend') {
     return res.json(transformToFrontendFormat(result, events));
   }
   ```

3. **Already implemented in:** `src/services/analysisService.js`

---

### Frontend Changes (Minimal)

**Current (Client-side):**
```javascript
runAnalysisScript.trigger();
```

**New (API call):**
```javascript
analyzeCryEventsAPI.trigger();
```

**Retool Query Configuration:**
```
Method: POST
URL: /v1/babies/baby_demo_1/analyze?format=frontend
Headers: X-Demo-Key: demo
Body: {"window_min": 360}

On Success:
analysisResultsVariable.setValue(analyzeCryEventsAPI.data);
```

**Zero transformation needed!** ✅

---

## Section F: Versioning Strategy

### API Versioning

**Current:** `/v1/babies/{baby_id}/analyze`

**Future Options:**

1. **Query Parameter (Recommended):**
   ```
   /v1/babies/{baby_id}/analyze?format=frontend
   /v1/babies/{baby_id}/analyze?format=openapi (default)
   ```

2. **Header-based:**
   ```
   X-Frontend-Format: true
   Accept: application/vnd.cryflow.frontend+json
   ```

3. **URL Versioning:**
   ```
   /v1/babies/{baby_id}/analyze (OpenAPI)
   /v2/babies/{baby_id}/analyze (Frontend-compatible)
   ```

**Recommendation:** Use query parameter for flexibility without breaking changes.

---

## Section G: Backward Compatibility

### Ensuring No Breaking Changes

✅ **OpenAPI format remains default**
- Existing API consumers unaffected
- Full hypothesis details preserved
- Audit trail maintained

✅ **Frontend format opt-in**
- Requires explicit `?format=frontend`
- Only affects Retool dashboard
- Can be versioned independently

✅ **Both formats supported**
- No deprecation needed
- Gradual migration possible
- A/B testing friendly

---

## Section H: Implementation Checklist

### Already Complete ✅

- [x] Transformation function implemented
- [x] Format detection in controller
- [x] Label mapping logic
- [x] dirty_diaper inference
- [x] Event linking (event_id)
- [x] Confidence extraction
- [x] Explanation extraction
- [x] Array wrapping

### Frontend Integration

- [ ] Update Retool REST API resource
- [ ] Add `?format=frontend` to URL
- [ ] Replace `runAnalysisScript` with API call
- [ ] Test with sample data
- [ ] Verify UI components render correctly

---

## Section I: Testing Matrix

### Test Cases

| Scenario | OpenAPI Format | Frontend Format |
|----------|----------------|-----------------|
| Normal analysis | ✅ Full details | ✅ Simplified array |
| No events | ✅ Unknown hypothesis | ✅ Unknown in array |
| Multiple hypotheses | ✅ All listed | ✅ Top 2-3 mapped |
| dirty_diaper inference | ❌ Not in enum | ✅ Added to array |
| Label mapping | ✅ Original labels | ✅ Mapped labels |
| Confidence | ✅ Per hypothesis | ✅ Top hypothesis only |

---

## Section J: Migration Path

### Phase 1: Dual Format Support (Current)
- ✅ Backend supports both formats
- ✅ OpenAPI format default
- ✅ Frontend format opt-in

### Phase 2: Frontend Migration
- [ ] Update Retool to use `?format=frontend`
- [ ] Test end-to-end flow
- [ ] Monitor for errors

### Phase 3: Analytics & Monitoring
- [ ] Track format usage (OpenAPI vs Frontend)
- [ ] Monitor response times
- [ ] Collect frontend feedback

### Phase 4: Future Optimization (Optional)
- [ ] Consider unified format if OpenAPI not needed
- [ ] Deprecate unused format (if applicable)
- [ ] Version bump to v2 if breaking changes needed

---

## Section K: Documentation Updates

### API Documentation

**Add to OpenAPI spec:**
```yaml
parameters:
  - name: format
    in: query
    description: Response format (openapi or frontend)
    required: false
    schema:
      type: string
      enum: [openapi, frontend]
      default: openapi
```

**Add response examples:**
```yaml
responses:
  '200':
    description: Analysis result
    content:
      application/json:
        schema:
          oneOf:
            - $ref: '#/components/schemas/AnalysisResult'
            - $ref: '#/components/schemas/FrontendAnalysisResult'
```

---

## Section L: Summary

### Mismatches Found: 8

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Response structure (object vs array) | 🔴 Critical | ✅ Solved |
| 2 | Hypothesis label enum mismatch | 🔴 Critical | ✅ Solved |
| 3 | Field naming inconsistency | 🟡 Medium | ✅ Solved |
| 4 | Missing frontend fields | 🔴 Critical | ✅ Solved |
| 5 | Confidence representation | 🟡 Medium | ✅ Solved |
| 6 | Suggestions structure | 🟡 Medium | ✅ Solved |
| 7 | Timestamp format | 🟢 Minor | ✅ Compatible |
| 8 | Baby ID field | 🟢 Minor | ✅ Compatible |

### Solution: Dual Format Support ✅

**Benefits:**
- ✅ Zero breaking changes
- ✅ Frontend gets exactly what it needs
- ✅ OpenAPI spec preserved for other consumers
- ✅ Easy to version and maintain
- ✅ Already implemented in backend

**Next Step:**
Update Retool to call `/v1/babies/{baby_id}/analyze?format=frontend`

---

**Validation Status: COMPLETE** ✅

All mismatches identified and resolved with backward-compatible solution!
