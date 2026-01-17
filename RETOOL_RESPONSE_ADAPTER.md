# Retool Response Adapter

**Version:** 1.0.0  
**Date:** 2026-01-16  
**Purpose:** Generate exact JSON format expected by Retool frontend

---

## Frontend Requirements

The Retool frontend expects `analysisResultsVariable` to contain an **array** of `AnalysisResult` objects:

```typescript
interface AnalysisResult {
  event_id: string;           // Required: links to cry event
  likely_reasons: string[];   // Required: array of reason labels
  recommended_checks: string[]; // Required: array of caregiver actions
  confidence: number;         // Required: 0.0 to 1.0
  explanation: string;        // Required: short sentence explaining reasoning
}
```

### Allowed Reason Labels (Exact Values Required)

```javascript
const ALLOWED_REASONS = [
  "hunger",
  "dirty_diaper", 
  "sleepy",
  "overstimulated",
  "discomfort",
  "needs_soothing",
  "unknown"
];
```

---

## Current Backend Output

Our backend returns a single analysis object:

```javascript
{
  analysis_id: "ana_abc123",
  baby_id: "baby_demo_1", 
  ts: "2026-01-16T10:00:00.000Z",
  hypotheses: [
    {
      label: "hunger",
      confidence: 0.85,
      why: ["Time since last feed (210 min) exceeds typical 3-hour interval"]
    },
    {
      label: "sleepy", 
      confidence: 0.30,
      why: ["Extended awake window suggests overtired state"]
    }
  ],
  suggestions: [
    {
      title: "Try feeding",
      steps: ["Offer breast or bottle", "Watch for feeding cues"]
    }
  ]
}
```

---

## Required Transformation

### Problem: Single Object → Array Required

**Backend returns:** Single analysis object  
**Frontend expects:** Array of AnalysisResult objects (one per cry event)

### Solution: Map Each Cry Event to Analysis Result

Create one `AnalysisResult` per cry event in the analyzed window, all using the same analysis.

---

## Enhanced Response Adapter

### Updated `transformToFrontendFormat` Function

```javascript
/**
 * Transform backend response to Retool frontend format
 * Returns ARRAY of AnalysisResult objects (one per cry event)
 */
function transformToFrontendFormat(analysisResult, events) {
  // Label mapping from backend to frontend
  const LABEL_MAP = {
    'hunger': 'hunger',
    'overtired': 'sleepy',
    'sleepy': 'sleepy',
    'discomfort': 'discomfort',
    'needs_burp_or_gas': 'discomfort',
    'overstimulated': 'overstimulated',
    'wants_contact': 'needs_soothing',
    'needs_soothing': 'needs_soothing',
    'unknown': 'unknown'
  };
  
  // Get all cry events from the analyzed window
  const cryEvents = events
    .filter(e => e.type === 'cry')
    .sort((a, b) => new Date(b.ts) - new Date(a.ts)); // Most recent first
  
  // If no cry events, create a single result with unknown event_id
  if (cryEvents.length === 0) {
    return [{
      event_id: "no_cry_events",
      likely_reasons: ["unknown"],
      recommended_checks: analysisResult.suggestions.flatMap(s => s.steps),
      confidence: 0.1,
      explanation: "No cry events found in analysis window"
    }];
  }
  
  // Map hypotheses to likely_reasons with label mapping
  const likely_reasons = analysisResult.hypotheses
    .map(h => LABEL_MAP[h.label] || h.label)
    .filter(label => label); // Remove any undefined mappings
  
  // Add dirty_diaper if conditions are met
  const shouldAddDirtyDiaper = 
    analysisResult.signals.time_since_last_diaper_min > 180;
  
  if (shouldAddDirtyDiaper && !likely_reasons.includes('dirty_diaper')) {
    likely_reasons.push('dirty_diaper');
  }
  
  // Flatten suggestions to recommended_checks
  const recommended_checks = analysisResult.suggestions.flatMap(s => s.steps);
  
  // Get top hypothesis for confidence and explanation
  const topHypothesis = analysisResult.hypotheses[0];
  const confidence = topHypothesis ? topHypothesis.confidence : 0.1;
  const explanation = topHypothesis ? topHypothesis.why[0] : 'Analysis complete';
  
  // Create AnalysisResult for each cry event
  return cryEvents.map(cryEvent => ({
    event_id: cryEvent._id.toString(),
    likely_reasons: [...likely_reasons], // Copy array for each event
    recommended_checks: [...recommended_checks], // Copy array for each event
    confidence: confidence,
    explanation: explanation
  }));
}
```

---

## Example Output

### Input: Backend Analysis Result

```javascript
{
  analysis_id: "ana_abc123",
  baby_id: "baby_demo_1",
  ts: "2026-01-16T10:00:00.000Z",
  signals: {
    time_since_last_feed_min: 210,
    time_since_last_diaper_min: 95,
    recent_sleep_min: 22,
    cry_duration_sec: 140
  },
  hypotheses: [
    {
      label: "hunger",
      confidence: 0.85,
      why: ["Time since last feed (210 min) exceeds typical 3-hour interval"]
    },
    {
      label: "sleepy",
      confidence: 0.30, 
      why: ["Extended awake window suggests overtired state"]
    }
  ],
  suggestions: [
    {
      title: "Try feeding",
      steps: ["Offer breast or bottle", "Watch for feeding cues", "Burp after feeding"]
    },
    {
      title: "Create calm environment",
      steps: ["Dim lights", "Reduce noise", "Gentle rocking"]
    }
  ]
}
```

### Input: Cry Events in Window

```javascript
[
  {
    _id: "507f1f77bcf86cd799439011",
    type: "cry",
    ts: "2026-01-16T09:55:00.000Z",
    cry_intensity: 0.75,
    cry_pattern: "continuous"
  },
  {
    _id: "507f1f77bcf86cd799439012", 
    type: "cry",
    ts: "2026-01-16T09:30:00.000Z",
    cry_intensity: 0.60,
    cry_pattern: "intermittent"
  }
]
```

### Output: Retool-Ready Array

```json
[
  {
    "event_id": "507f1f77bcf86cd799439011",
    "likely_reasons": ["hunger", "sleepy"],
    "recommended_checks": [
      "Offer breast or bottle",
      "Watch for feeding cues", 
      "Burp after feeding",
      "Dim lights",
      "Reduce noise",
      "Gentle rocking"
    ],
    "confidence": 0.85,
    "explanation": "Time since last feed (210 min) exceeds typical 3-hour interval"
  },
  {
    "event_id": "507f1f77bcf86cd799439012",
    "likely_reasons": ["hunger", "sleepy"],
    "recommended_checks": [
      "Offer breast or bottle",
      "Watch for feeding cues",
      "Burp after feeding", 
      "Dim lights",
      "Reduce noise",
      "Gentle rocking"
    ],
    "confidence": 0.85,
    "explanation": "Time since last feed (210 min) exceeds typical 3-hour interval"
  }
]
```

---

## Mapping Rules

### 1. Label Mapping

| Backend Label | Frontend Label | Notes |
|---------------|----------------|-------|
| `hunger` | `hunger` | Direct mapping |
| `overtired` | `sleepy` | Label transformation |
| `sleepy` | `sleepy` | Direct mapping |
| `discomfort` | `discomfort` | Direct mapping |
| `needs_burp_or_gas` | `discomfort` | Consolidate to discomfort |
| `overstimulated` | `overstimulated` | Direct mapping |
| `wants_contact` | `needs_soothing` | Label transformation |
| `needs_soothing` | `needs_soothing` | Direct mapping |
| `unknown` | `unknown` | Direct mapping |

### 2. Special Cases

#### Dirty Diaper Inference
```javascript
// Add dirty_diaper if time since last diaper change > 3 hours
if (analysisResult.signals.time_since_last_diaper_min > 180) {
  likely_reasons.push('dirty_diaper');
}
```

#### No Cry Events
```javascript
// If no cry events in window, return single result
if (cryEvents.length === 0) {
  return [{
    event_id: "no_cry_events",
    likely_reasons: ["unknown"],
    recommended_checks: [...],
    confidence: 0.1,
    explanation: "No cry events found in analysis window"
  }];
}
```

### 3. Array Generation

- **One AnalysisResult per cry event** in the analyzed window
- **Same analysis applied** to all cry events (shared hypotheses/suggestions)
- **Most recent cry events first** (sorted by timestamp desc)
- **Unique event_id** for each result (MongoDB ObjectId as string)

---

## Controller Integration

### Updated Analysis Controller

```javascript
// src/controllers/analysisController.js
async function analyzeBaby(req, res) {
  try {
    const { baby_id } = req.params;
    const { format = 'openapi' } = req.query;
    
    // Run analysis
    const result = await analysisService.analyzeBaby(baby_id, req.body);
    
    // Get events for transformation
    const events = await Event.find({ 
      baby_id,
      ts: { 
        $gte: new Date(Date.now() - 360 * 60 * 1000),
        $lte: new Date()
      }
    }).lean();
    
    // Transform for frontend if requested
    if (format === 'frontend') {
      const frontendResult = analysisService.transformToFrontendFormat(result, events);
      return res.json(frontendResult); // Returns array directly
    }
    
    // Return standard format
    res.json(result);
    
  } catch (error) {
    console.error('Analysis failed:', error);
    res.status(500).json({
      error: 'ANALYSIS_FAILED',
      message: 'Internal server error during analysis'
    });
  }
}
```

---

## API Usage

### Request

```bash
POST /v1/babies/baby_demo_1/analyze?format=frontend
Content-Type: application/json

{
  "window_min": 360,
  "include_questions": true
}
```

### Response (Retool-Ready)

```json
[
  {
    "event_id": "507f1f77bcf86cd799439011",
    "likely_reasons": ["hunger", "sleepy"],
    "recommended_checks": [
      "Offer breast or bottle",
      "Watch for feeding cues",
      "Burp after feeding"
    ],
    "confidence": 0.85,
    "explanation": "Time since last feed (210 min) exceeds typical 3-hour interval"
  }
]
```

---

## Retool Integration

### API Query Setup

```javascript
// analyzeCryEventsAPI query in Retool
// Method: POST
// URL: {{baseUrl}}/v1/babies/baby_demo_1/analyze?format=frontend

// Request Body:
{
  "window_min": 360,
  "include_questions": true,
  "context": {
    "caregiver_note": "",
    "locale": "en-US"
  }
}

// Transform Response: (none needed - already in correct format)
return data; // data is already the array of AnalysisResult objects

// On Success:
analysisResultsVariable.setValue(analyzeCryEventsAPI.data);
```

### Frontend Variable Binding

```javascript
// analysisResultsVariable will contain:
[
  {
    event_id: "507f1f77bcf86cd799439011",
    likely_reasons: ["hunger", "sleepy"],
    recommended_checks: ["Offer breast or bottle", "..."],
    confidence: 0.85,
    explanation: "Time since last feed (210 min) exceeds typical 3-hour interval"
  },
  // ... more results for other cry events
]

// Alert Banner (topReasonsTransformer)
const reasonCounts = {};
analysisResultsVariable.value.forEach(result => {
  result.likely_reasons.forEach(reason => {
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  });
});

// Chart Data (reasonDistributionTransformer)  
const total = analysisResultsVariable.value.length;
return Object.entries(reasonCounts).map(([reason, count]) => ({
  reason,
  count,
  percentage: Math.round((count / total) * 100)
}));
```

---

## Validation

### Response Validation Schema

```javascript
const AnalysisResultSchema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['event_id', 'likely_reasons', 'recommended_checks', 'confidence', 'explanation'],
    properties: {
      event_id: { type: 'string' },
      likely_reasons: { 
        type: 'array',
        items: { 
          type: 'string',
          enum: ['hunger', 'dirty_diaper', 'sleepy', 'overstimulated', 'discomfort', 'needs_soothing', 'unknown']
        }
      },
      recommended_checks: {
        type: 'array', 
        items: { type: 'string' }
      },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      explanation: { type: 'string' }
    }
  }
};
```

---

## Summary

### Key Changes Made

1. **Array Output:** `transformToFrontendFormat` now returns array instead of single object
2. **Per-Event Results:** One `AnalysisResult` per cry event in analysis window
3. **Label Mapping:** Proper mapping from backend labels to frontend labels
4. **Dirty Diaper Inference:** Automatic addition based on timing
5. **No Events Handling:** Graceful handling when no cry events exist

### Frontend Integration

- ✅ **Direct compatibility** with `analysisResultsVariable`
- ✅ **No frontend changes** required
- ✅ **Exact format match** with TypeScript interface
- ✅ **Allowed reason labels** only
- ✅ **Array structure** as expected

### API Endpoint

```
POST /v1/babies/{baby_id}/analyze?format=frontend
```

Returns array of `AnalysisResult` objects ready for Retool consumption.

---

**Status:** Ready for Implementation  
**Version:** 1.0.0  
**Date:** 2026-01-16