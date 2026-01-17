# CryFlow Data Schema & Quality Rules

**Version:** 0.1.0  
**Last Updated:** 2026-01-16  
**Dataset:** `cryflow_events_sample.csv` (112 events)

---

## Column Schema

| Column | Type | Category | Meaning | Validation |
|--------|------|----------|---------|------------|
| `id` | integer | Metadata | Unique event ID | Primary key, auto-increment |
| `ts` | timestamptz | Metadata | Event timestamp | ISO 8601, UTC, required |
| `baby_id` | text | Metadata | Baby identifier | 1-128 chars, e.g. "baby_demo_1" |
| `source` | text | Metadata | Event origin | Enum: "manual", "device", "agent" |
| `type` | text | Metadata | Event category | Enum: "cry", "feed", "diaper", "sleep", "note" |
| **Cry Fields** |
| `cry_pattern` | text | Signal | Cry behavior | Enum: "continuous", "intermittent", "escalating", null |
| `cry_pitch_hint` | text | Signal | Cry frequency | Enum: "high", "low", null |
| `cry_intensity` | real | Signal | Urgency level | Range: 0.0-1.0, nullable |
| `cry_duration_sec` | integer | Signal | Episode length | Range: 1-7200, nullable |
| **Feed Fields** |
| `feed_method` | text | Context | Feeding type | Enum: "bottle", "breast", null |
| `feed_amount_ml` | integer | Context | Volume consumed | Range: 0-500, nullable |
| `feed_notes` | text | Context | Observations | Max 500 chars, nullable |
| **Diaper Fields** |
| `diaper_wet` | boolean | Signal | Urination flag | true/false/null |
| `diaper_dirty` | boolean | Signal | Bowel movement | true/false/null |
| `diaper_notes` | text | Context | Change details | Max 500 chars, nullable |
| **Sleep Fields** |
| `sleep_state` | text | Signal | Sleep transition | Enum: "asleep", "woke_up", "nap_end", null |
| `sleep_notes` | text | Context | Quality notes | Max 500 chars, nullable |
| **Note Fields** |
| `note_text` | text | Context | General log | Max 2000 chars, nullable |

---

## Signal Classification

### Primary Signals (Drive Hypothesis Confidence)

**Cry Characteristics:**
- `cry_pattern` - Pattern matching for rules
- `cry_pitch_hint` - Pain (high) vs hunger (low)
- `cry_intensity` - Urgency weighting
- `cry_duration_sec` - Persistence indicator

**Diaper Status:**
- `diaper_wet` - Hydration/discomfort
- `diaper_dirty` - Digestive cycle

**Sleep Transitions:**
- `sleep_state` - Wake window calculations

### Derived Signals (Computed by Backend)

```javascript
{
  // Temporal gaps
  "time_since_last_feed_min": 185,      // Minutes since last feed event
  "time_since_last_diaper_min": 95,     // Minutes since last diaper event
  "recent_sleep_min": 22,               // Duration of last sleep (asleep→woke_up)
  "awake_window_min": 45,               // Time since last woke_up
  "cry_duration_sec": 140,              // Current cry event duration
  
  // Frequency metrics
  "cry_count_last_hour": 3,             // Cry events in last 60 min
  "feed_count_last_6h": 4,              // Feed events in last 360 min
  "diaper_count_last_6h": 3,            // Diaper events in last 360 min
  
  // Pattern analysis
  "cry_pattern_mode": "continuous",     // Most common cry pattern
  "avg_feed_interval_min": 180,         // Average time between feeds
  "cry_escalation": "escalating"        // Trend: "stable", "worsening", "escalating"
}
```

---

## Data Quality Rules

### 1. Null Handling

```javascript
// Cry events - duration REQUIRED
if (type === "cry") {
  assert(cry_duration_sec !== null, "Cry duration required");
  cry_pattern = cry_pattern || "unknown";
  cry_pitch_hint = cry_pitch_hint || "unknown";
  cry_intensity = cry_intensity ?? 0.5;  // Default medium
}

// Feed events - all fields optional
if (type === "feed") {
  feed_method = feed_method || "unknown";
  // feed_amount_ml stays null if not measured
}

// Diaper events - at least one flag
if (type === "diaper") {
  if (!diaper_wet && !diaper_dirty) {
    warn("No flags set - assuming wet=true");
    diaper_wet = true;
  }
}

// Sleep events - state REQUIRED
if (type === "sleep") {
  assert(sleep_state !== null && sleep_state !== "", "Sleep state required");
}

// Note events - text REQUIRED
if (type === "note") {
  assert(note_text && note_text.trim() !== "", "Note text required");
}
```

### 2. Empty String Normalization

Convert empty strings to `null`:

```sql
UPDATE cryflow_events_sample SET
  cry_pattern = NULLIF(cry_pattern, ''),
  cry_pitch_hint = NULLIF(cry_pitch_hint, ''),
  feed_method = NULLIF(feed_method, ''),
  sleep_state = NULLIF(sleep_state, '');
```

### 3. Timestamp Validation

```javascript
function validateTimestamp(ts, id) {
  const eventTime = new Date(ts);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  
  if (isNaN(eventTime.getTime())) {
    throw new Error(`Event ${id}: Invalid timestamp format`);
  }
  if (eventTime > fiveMinutesFromNow) {
    throw new Error(`Event ${id}: Future timestamp not allowed`);
  }
  if (eventTime < oneYearAgo) {
    console.warn(`Event ${id}: Timestamp older than 1 year`);
  }
  
  return eventTime;
}
```

### 4. Enum Validation

```javascript
const VALID_ENUMS = {
  source: ["manual", "device", "agent"],
  type: ["cry", "feed", "diaper", "sleep", "note"],
  cry_pattern: ["continuous", "intermittent", "escalating", "unknown", null],
  cry_pitch_hint: ["high", "low", "unknown", null],
  feed_method: ["bottle", "breast", "unknown", null],
  sleep_state: ["asleep", "woke_up", "nap_end", null]
};

function validateEnum(field, value) {
  if (!VALID_ENUMS[field].includes(value)) {
    throw new Error(`Invalid ${field}: "${value}"`);
  }
}
```

### 5. Numeric Range Validation

```javascript
// Cry intensity: 0.0 - 1.0
if (cry_intensity !== null && (cry_intensity < 0 || cry_intensity > 1)) {
  throw new Error(`Invalid cry_intensity: ${cry_intensity}`);
}

// Cry duration: 1 - 7200 seconds (2 hours max)
if (cry_duration_sec !== null && (cry_duration_sec < 1 || cry_duration_sec > 7200)) {
  throw new Error(`Invalid cry_duration_sec: ${cry_duration_sec}`);
}

// Feed amount: 0 - 500 ml
if (feed_amount_ml !== null && (feed_amount_ml < 0 || feed_amount_ml > 500)) {
  console.warn(`Unusual feed_amount_ml: ${feed_amount_ml}`);
}
```

### 6. Type-Specific Field Constraints

Only populate fields relevant to event type:

```javascript
function enforceTypeConstraints(event) {
  const base = {
    id: event.id,
    ts: event.ts,
    baby_id: event.baby_id,
    source: event.source,
    type: event.type
  };
  
  switch(event.type) {
    case "cry":
      return { ...base, cry_pattern, cry_pitch_hint, cry_intensity, cry_duration_sec };
    case "feed":
      return { ...base, feed_method, feed_amount_ml, feed_notes };
    case "diaper":
      return { ...base, diaper_wet, diaper_dirty, diaper_notes };
    case "sleep":
      return { ...base, sleep_state, sleep_notes };
    case "note":
      return { ...base, note_text };
  }
}
```

---

## Derived Signal Computation

### Temporal Gap Signals

```javascript
function computeDerivedSignals(events, currentTime, windowMinutes) {
  const windowStart = new Date(currentTime.getTime() - windowMinutes * 60 * 1000);
  const eventsInWindow = events.filter(e => new Date(e.ts) >= windowStart);
  
  return {
    time_since_last_feed_min: getTimeSinceLastEvent(eventsInWindow, "feed", currentTime),
    time_since_last_diaper_min: getTimeSinceLastEvent(eventsInWindow, "diaper", currentTime),
    recent_sleep_min: getLastSleepDuration(eventsInWindow),
    awake_window_min: getTimeSinceLastWakeUp(eventsInWindow, currentTime),
    cry_duration_sec: getCurrentCryEvent(eventsInWindow)?.cry_duration_sec,
    cry_count_last_hour: countEventsInWindow(eventsInWindow, "cry", 60),
    cry_escalation: detectCryEscalation(eventsInWindow)
  };
}

function getTimeSinceLastEvent(events, type, currentTime) {
  const lastEvent = events
    .filter(e => e.type === type)
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))[0];
  
  if (!lastEvent) return null;
  
  const diffMs = currentTime - new Date(lastEvent.ts);
  return Math.floor(diffMs / 60000);  // Convert to minutes
}

function getLastSleepDuration(events) {
  const sleepEvents = events
    .filter(e => e.type === "sleep")
    .sort((a, b) => new Date(a.ts) - new Date(b.ts));
  
  // Find most recent asleep → woke_up pair
  for (let i = sleepEvents.length - 1; i >= 1; i--) {
    if (sleepEvents[i].sleep_state === "woke_up" && 
        sleepEvents[i-1].sleep_state === "asleep") {
      const diffMs = new Date(sleepEvents[i].ts) - new Date(sleepEvents[i-1].ts);
      return Math.floor(diffMs / 60000);
    }
  }
  
  return null;
}

function detectCryEscalation(events) {
  const cryEvents = events
    .filter(e => e.type === "cry")
    .sort((a, b) => new Date(a.ts) - new Date(b.ts))
    .slice(-3);  // Last 3 cry events
  
  if (cryEvents.length < 2) return "insufficient_data";
  
  const intensities = cryEvents.map(e => e.cry_intensity || 0.5);
  const durations = cryEvents.map(e => e.cry_duration_sec || 0);
  
  const intensityIncreasing = intensities.every((val, i, arr) => 
    i === 0 || val >= arr[i-1]
  );
  const durationIncreasing = durations.every((val, i, arr) => 
    i === 0 || val >= arr[i-1]
  );
  
  if (intensityIncreasing && durationIncreasing) return "escalating";
  if (intensityIncreasing || durationIncreasing) return "worsening";
  return "stable";
}
```

---

## Missing Fields (Future Enhancements)

| Field | Why Needed | Workaround |
|-------|------------|------------|
| `baby.birth_date` | Age-based hypothesis adjustments | Hardcode age assumptions |
| `baby.weight_kg` | Feed adequacy calculations | Use population averages |
| `event.created_at` | Distinguish log time from event time | Use `ts` for now |
| `feed.duration_sec` | Rushed feed detection | Use single timestamp |
| `sleep.duration_sec` | Need paired events to calculate | Compute from asleep→woke_up |
| `analysis_context.timezone` | Circadian rhythm analysis | Assume UTC |

---

## Data Quality Monitoring

### Metrics to Track

```javascript
const dataQualityMetrics = {
  // Completeness
  cry_events_with_intensity: count(cry_intensity !== null) / count(type="cry"),
  cry_events_with_pattern: count(cry_pattern !== "unknown") / count(type="cry"),
  feed_events_with_amount: count(feed_amount_ml !== null) / count(type="feed"),
  
  // Consistency
  orphaned_woke_up_events: count(sleep_state="woke_up" without prior "asleep"),
  events_with_future_timestamps: count(ts > now()),
  
  // Timeliness
  avg_ingestion_delay_sec: avg(created_at - ts),
  
  // Source quality
  manual_vs_device_ratio: count(source="manual") / count(source="device")
};
```

---

## Pre-Processing Pipeline

### 1. Ingestion Stage
- Validate enum fields
- Parse timestamps (ISO 8601)
- Enforce type-specific constraints
- Validate numeric ranges

### 2. Normalization Stage
- Convert empty strings to null
- Standardize timezone to UTC
- Trim whitespace from text fields
- Lowercase enum values

### 3. Enrichment Stage
- Add `created_at` server timestamp
- Calculate `age_at_event` if birth_date available
- Tag `analysis_eligible` flag (cry events only)

### 4. Storage Stage
- Index on: `baby_id`, `ts`, `type`
- Partition by `baby_id` for multi-tenant performance
- TTL policy: Archive events older than 90 days

---

## Implementation Checklist

- [ ] CSV→JSON parser with schema validation
- [ ] Enum validation middleware
- [ ] Temporal signal computation functions
- [ ] Data cleaning SQL scripts
- [ ] Data quality monitoring endpoints
- [ ] Sleep event pairing logic (asleep→woke_up)
- [ ] Unit tests for edge cases (nulls, empty strings)
- [ ] Documentation for missing baby metadata assumptions

---

## Sample Data Stats

**Dataset:** `cryflow_events_sample.csv`
- **Total Events:** 112
- **Baby IDs:** 2 (baby_demo_1, baby_demo_2)
- **Date Range:** 2026-01-16 (single day)
- **Event Distribution:**
  - Cry: ~25 events
  - Feed: ~30 events
  - Diaper: ~20 events
  - Sleep: ~35 events
  - Note: ~2 events
- **Sources:** manual (majority), device, agent
