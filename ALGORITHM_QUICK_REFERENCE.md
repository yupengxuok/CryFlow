# Algorithm Quick Reference

**Quick guide for developers working with the CryFlow analysis algorithm**

---

## 🚀 Quick Start

### Run Tests
```bash
npm test                                    # All tests
npm test -- hypothesisGenerator.test.js    # Algorithm tests only
npm test -- integration.test.js            # Integration tests only
```

### Use the Algorithm
```javascript
const { computeDerivedSignals } = require('./utils/signalComputer');
const { generateHypotheses } = require('./services/hypothesisGenerator');
const { generateSuggestions } = require('./services/suggestionGenerator');

// 1. Compute signals from events
const signals = computeDerivedSignals(events, currentTime, 360);

// 2. Generate hypotheses
const hypotheses = generateHypotheses(signals, events);

// 3. Generate suggestions
const suggestions = generateSuggestions(hypotheses);
```

---

## 📋 Rule Reference

### Hunger (H1-H6)
- **H1:** time_since_last_feed >= 180 min (+0.4)
- **H2:** time_since_last_feed >= 240 min (+0.3)
- **H3:** continuous cry + intensity >= 0.6 (+0.2)
- **H4:** escalating cry pattern (+0.15)
- **H5:** feed_count_last_6h < 2 (+0.2)
- **H6:** last_feed_amount < 60ml (+0.15)

### Dirty Diaper (D1-D5)
- **D1:** time_since_last_diaper >= 180 min (+0.4)
- **D2:** time_since_last_diaper >= 240 min (+0.3)
- **D3:** intermittent cry + intensity < 0.5 (+0.2)
- **D4:** diaper_count_last_6h < 3 (+0.15)
- **D5:** time_since_last_feed 60-120 min (+0.15)

### Sleepy (S1-S6)
- **S1:** awake_window >= 90 min (+0.4)
- **S2:** awake_window >= 120 min (+0.3)
- **S3:** recent_sleep < 30 min (+0.25)
- **S4:** escalating cry + intensity >= 0.7 (+0.2)
- **S5:** cry_duration >= 300 sec (+0.15)
- **S6:** awake_window >= 120 min (+0.2)

### Overstimulated (O1-O5)
- **O1:** escalating cry + high pitch (+0.35)
- **O2:** awake_window 60-90 min (+0.25)
- **O3:** intensity >= 0.8 + duration < 180 sec (+0.3)
- **O4:** basic needs recently met (+0.2)
- **O5:** cry_count_last_hour >= 3 (+0.2)

### Discomfort (C1-C5)
- **C1:** intermittent cry + intensity >= 0.7 (+0.3)
- **C2:** high pitch + duration >= 120 sec (+0.3)
- **C3:** time_since_last_feed 15-60 min (+0.25)
- **C4:** continuous cry + high pitch (+0.25)
- **C5:** last_feed_amount > 120ml (+0.15)

### Needs Soothing (N1-N5)
- **N1:** low intensity + intermittent (+0.3)
- **N2:** basic needs recently met (+0.3)
- **N3:** brief moderate crying (+0.25)
- **N4:** awake_window 30-60 min (+0.15)
- **N5:** escalating low intensity (+0.2)

### Unknown (U1-U3)
- **U1:** missing feed or diaper data (+0.4)
- **U2:** unknown cry patterns (+0.3)
- **U3:** missing critical cry data (+0.25)

---

## 🧮 Confidence Calculation

```javascript
// Step 1: Raw score
raw_score = base_confidence + sum(matched_rule_boosts)

// Step 2: Diminishing returns (if > 3 rules)
if (matched_rules > 3) {
  factor = 1 - ((matched_rules - 3) * 0.1)
  raw_score *= max(factor, 0.7)
}

// Step 3: Cap and round
confidence = round(min(raw_score, max_confidence), 2)
```

---

## 🎯 Hypothesis Output Format

```javascript
{
  label: 'hunger',                    // Hypothesis type
  confidence: 0.85,                   // 0.0 - 1.0
  ruleCount: 3,                       // Number of matched rules
  matchedRules: ['H1', 'H3', 'H5'],  // Rule IDs
  why: [                              // Human-readable explanations
    'Time since last feed (210 min) exceeds typical 3-hour interval',
    'Continuous cry pattern with moderate-to-high intensity',
    'Low feeding frequency (1 feeds in 6 hours)'
  ]
}
```

---

## 📊 Signal Types

### Temporal Gaps
- `time_since_last_feed_min` - Minutes since last feed
- `time_since_last_diaper_min` - Minutes since last diaper change
- `recent_sleep_min` - Duration of most recent sleep
- `awake_window_min` - Minutes since last wake up
- `cry_duration_sec` - Duration of most recent cry

### Frequency Metrics
- `cry_count_last_hour` - Number of cry events in last hour
- `feed_count_last_6h` - Number of feeds in last 6 hours
- `diaper_count_last_6h` - Number of diaper changes in last 6 hours

### Pattern Analysis
- `cry_pattern_mode` - Most common cry pattern (continuous, intermittent, escalating)
- `avg_feed_interval_min` - Average time between feeds
- `cry_escalation` - Cry trend (escalating, worsening, stable)

---

## 🔍 Debugging Tips

### Check Rule Matching
```javascript
const hypotheses = generateHypotheses(signals, events);
console.log(hypotheses[0].matchedRules);  // ['H1', 'H3', 'H5']
console.log(hypotheses[0].ruleCount);     // 3
```

### Validate Signals
```javascript
const signals = computeDerivedSignals(events, currentTime, 360);
console.log(signals);
// {
//   time_since_last_feed_min: 210,
//   cry_pattern_mode: 'continuous',
//   ...
// }
```

### Test Specific Scenario
```javascript
// Create test events
const events = [
  { type: 'feed', ts: new Date('2026-01-16T06:30:00Z'), feed_amount_ml: 90 },
  { type: 'cry', ts: new Date('2026-01-16T10:00:00Z'), cry_intensity: 0.75 }
];

// Run analysis
const signals = computeDerivedSignals(events, new Date('2026-01-16T10:00:00Z'), 360);
const hypotheses = generateHypotheses(signals, events);
```

---

## ⚠️ Common Issues

### Issue: No hypotheses returned
**Cause:** All confidences below 0.1 threshold  
**Fix:** Check if events array is empty or signals are null

### Issue: Unknown hypothesis always wins
**Cause:** Missing critical data (feed/diaper times)  
**Fix:** Ensure events include feed and diaper events

### Issue: Confidence seems too low
**Cause:** Diminishing returns applied (> 3 rules)  
**Fix:** This is expected behavior to prevent over-confidence

### Issue: Different results for same input
**Cause:** Events not sorted by timestamp  
**Fix:** Algorithm sorts internally, but check event timestamps

---

## 📈 Performance Tips

### Optimize Event Window
```javascript
// Use smaller window for faster processing
const signals = computeDerivedSignals(events, currentTime, 180);  // 3 hours instead of 6
```

### Cache Signals
```javascript
// Cache computed signals if analyzing multiple times
const signalsCache = new Map();
const cacheKey = `${babyId}-${currentTime.getTime()}`;
if (!signalsCache.has(cacheKey)) {
  signalsCache.set(cacheKey, computeDerivedSignals(events, currentTime, 360));
}
```

### Limit Event History
```javascript
// Only pass recent events to reduce processing
const recentEvents = events.filter(e => 
  new Date(e.ts) > new Date(currentTime.getTime() - 6 * 60 * 60 * 1000)
);
```

---

## 🧪 Testing Patterns

### Test Individual Rule
```javascript
test('H1: time_since_last_feed >= 180', () => {
  const signals = { time_since_last_feed_min: 200 };
  const result = generateHypotheses(signals, []);
  const hunger = result.find(h => h.label === 'hunger');
  expect(hunger.matchedRules).toContain('H1');
});
```

### Test Scenario
```javascript
test('Hunger scenario', () => {
  const events = [/* hunger scenario events */];
  const signals = computeDerivedSignals(events, currentTime, 360);
  const hypotheses = generateHypotheses(signals, events);
  expect(hypotheses[0].label).toBe('hunger');
  expect(hypotheses[0].confidence).toBeGreaterThan(0.7);
});
```

### Test Determinism
```javascript
test('Same input = same output', () => {
  const result1 = generateHypotheses(signals, events);
  const result2 = generateHypotheses(signals, events);
  expect(result1).toEqual(result2);
});
```

---

## 📚 Related Files

- **Implementation:** `src/services/hypothesisGenerator.js`
- **Tests:** `src/__tests__/hypothesisGenerator.test.js`
- **Integration:** `src/__tests__/integration.test.js`
- **Signals:** `src/utils/signalComputer.js`
- **Suggestions:** `src/services/suggestionGenerator.js`

---

## 🔗 Documentation

- **Full Specification:** `ALGORITHM_DESIGN.md`
- **Implementation Details:** `ALGORITHM_IMPLEMENTATION_COMPLETE.md`
- **Status Summary:** `STEP6_ALGORITHM_COMPLETE.md`
- **Final Report:** `FINAL_STATUS.md`

---

**Quick Reference Version:** 1.0.0  
**Last Updated:** 2026-01-16
