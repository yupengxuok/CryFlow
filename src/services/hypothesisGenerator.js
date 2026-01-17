/**
 * Hypothesis Generation Service
 * Generates hypotheses based on derived signals using rule-based heuristics
 * 
 * Algorithm: 35 rules across 7 hypotheses with confidence scoring
 * Version: 1.0.0
 */

/**
 * Generate hypotheses from signals
 */
function generateHypotheses(signals, events) {
  const hypotheses = [];
  
  // Evaluate all hypotheses
  hypotheses.push(evaluateHunger(signals, events));
  hypotheses.push(evaluateDirtyDiaper(signals, events));
  hypotheses.push(evaluateSleepy(signals, events));
  hypotheses.push(evaluateOverstimulated(signals, events));
  hypotheses.push(evaluateDiscomfort(signals, events));
  hypotheses.push(evaluateNeedsSoothing(signals, events));
  hypotheses.push(evaluateUnknown(signals, events));
  
  // Calculate total score for unknown boost
  const totalScore = hypotheses.reduce((sum, h) => sum + h.confidence, 0);
  
  // Boost unknown if total confidence is low
  if (totalScore < 0.5) {
    const unknownHyp = hypotheses.find(h => h.label === 'unknown');
    if (unknownHyp) {
      unknownHyp.confidence = Math.max(unknownHyp.confidence, 0.4);
    }
  }
  
  // Sort by confidence, then by rule count, then alphabetically (tie resolution)
  hypotheses.sort((a, b) => {
    const confidenceDiff = b.confidence - a.confidence;
    
    // If confidence difference is < 0.05, it's a tie
    if (Math.abs(confidenceDiff) < 0.05) {
      // Tie resolution: more rules wins
      if (a.ruleCount !== b.ruleCount) {
        return b.ruleCount - a.ruleCount;
      }
      // If same rule count, alphabetical
      return a.label.localeCompare(b.label);
    }
    
    return confidenceDiff;
  });
  
  // Filter out very low confidence hypotheses
  const filtered = hypotheses.filter(h => h.confidence > 0.1);
  
  // Return top 3 hypotheses
  return filtered.slice(0, 3);
}

/**
 * Evaluate hunger hypothesis
 * Base: 0.3, Max: 0.95, Rules: 6
 */
function evaluateHunger(signals, events) {
  const BASE_CONFIDENCE = 0.3;
  const MAX_CONFIDENCE = 0.95;
  const matchedRules = [];
  const why = [];
  
  // Get recent cry and feed events
  const recentCry = events.filter(e => e.type === 'cry').sort((a, b) => 
    new Date(b.ts) - new Date(a.ts)
  )[0];
  
  const lastFeed = events.filter(e => e.type === 'feed').sort((a, b) => 
    new Date(b.ts) - new Date(a.ts)
  )[0];
  
  // H1: time_since_last_feed >= 180
  if (signals.time_since_last_feed_min !== null && signals.time_since_last_feed_min >= 180) {
    matchedRules.push({ id: 'H1', boost: 0.4 });
    why.push(`Time since last feed (${signals.time_since_last_feed_min} min) exceeds typical 3-hour interval`);
  }
  
  // H2: time_since_last_feed >= 240
  if (signals.time_since_last_feed_min !== null && signals.time_since_last_feed_min >= 240) {
    matchedRules.push({ id: 'H2', boost: 0.3 });
    why.push(`Extended time without feeding (${signals.time_since_last_feed_min} min) strongly suggests hunger`);
  }
  
  // H3: continuous cry + intensity >= 0.6
  if (signals.cry_pattern_mode === 'continuous' && recentCry?.cry_intensity >= 0.6) {
    matchedRules.push({ id: 'H3', boost: 0.2 });
    why.push('Continuous cry pattern with moderate-to-high intensity consistent with hunger cue');
  }
  
  // H4: cry_pattern === "escalating"
  if (signals.cry_pattern_mode === 'escalating') {
    matchedRules.push({ id: 'H4', boost: 0.15 });
    why.push('Escalating cry pattern often indicates increasing hunger');
  }
  
  // H5: feed_count_last_6h < 2
  if (signals.feed_count_last_6h !== null && signals.feed_count_last_6h < 2) {
    matchedRules.push({ id: 'H5', boost: 0.2 });
    why.push(`Low feeding frequency (${signals.feed_count_last_6h} feeds in 6 hours) suggests insufficient intake`);
  }
  
  // H6: last_feed_amount < 60ml
  if (lastFeed?.feed_amount_ml && lastFeed.feed_amount_ml < 60) {
    matchedRules.push({ id: 'H6', boost: 0.15 });
    why.push(`Previous feeding amount (${lastFeed.feed_amount_ml}ml) was below typical serving`);
  }
  
  // Calculate confidence with diminishing returns
  const confidence = calculateConfidence(BASE_CONFIDENCE, matchedRules, MAX_CONFIDENCE);
  
  return {
    label: 'hunger',
    confidence,
    ruleCount: matchedRules.length,
    matchedRules: matchedRules.map(r => r.id),
    why: why.length > 0 ? why : ['No strong hunger indicators detected']
  };
}

/**
 * Evaluate dirty diaper hypothesis
 * Base: 0.2, Max: 0.85, Rules: 5
 */
function evaluateDirtyDiaper(signals, events) {
  const BASE_CONFIDENCE = 0.2;
  const MAX_CONFIDENCE = 0.85;
  const matchedRules = [];
  const why = [];
  
  const recentCry = events.filter(e => e.type === 'cry').sort((a, b) => 
    new Date(b.ts) - new Date(a.ts)
  )[0];
  
  // D1: time_since_last_diaper >= 180
  if (signals.time_since_last_diaper_min !== null && signals.time_since_last_diaper_min >= 180) {
    matchedRules.push({ id: 'D1', boost: 0.4 });
    why.push(`Extended time since diaper change (${signals.time_since_last_diaper_min} min) suggests check needed`);
  }
  
  // D2: time_since_last_diaper >= 240
  if (signals.time_since_last_diaper_min !== null && signals.time_since_last_diaper_min >= 240) {
    matchedRules.push({ id: 'D2', boost: 0.3 });
    why.push(`Very long time since diaper change (${signals.time_since_last_diaper_min} min) increases likelihood`);
  }
  
  // D3: intermittent cry + intensity < 0.5
  if (signals.cry_pattern_mode === 'intermittent' && recentCry?.cry_intensity < 0.5) {
    matchedRules.push({ id: 'D3', boost: 0.2 });
    why.push('Intermittent low-intensity crying consistent with diaper discomfort');
  }
  
  // D4: diaper_count_last_6h < 3
  if (signals.diaper_count_last_6h !== null && signals.diaper_count_last_6h < 3) {
    matchedRules.push({ id: 'D4', boost: 0.15 });
    why.push(`Low diaper change frequency (${signals.diaper_count_last_6h} changes in 6h) suggests overdue`);
  }
  
  // D5: time_since_last_feed 60-120 min (bowel movement window)
  if (signals.time_since_last_feed_min !== null && 
      signals.time_since_last_feed_min >= 60 && 
      signals.time_since_last_feed_min <= 120) {
    matchedRules.push({ id: 'D5', boost: 0.15 });
    why.push('Timing (1-2 hours post-feed) aligns with typical bowel movement window');
  }
  
  const confidence = calculateConfidence(BASE_CONFIDENCE, matchedRules, MAX_CONFIDENCE);
  
  return {
    label: 'dirty_diaper',
    confidence,
    ruleCount: matchedRules.length,
    matchedRules: matchedRules.map(r => r.id),
    why: why.length > 0 ? why : ['No strong diaper indicators detected']
  };
}

/**
 * Evaluate sleepy (overtired) hypothesis
 * Base: 0.25, Max: 0.90, Rules: 6
 */
function evaluateSleepy(signals, events) {
  const BASE_CONFIDENCE = 0.25;
  const MAX_CONFIDENCE = 0.90;
  const matchedRules = [];
  const why = [];
  
  const recentCry = events.filter(e => e.type === 'cry').sort((a, b) => 
    new Date(b.ts) - new Date(a.ts)
  )[0];
  
  // S1: awake_window >= 90
  if (signals.awake_window_min !== null && signals.awake_window_min >= 90) {
    matchedRules.push({ id: 'S1', boost: 0.4 });
    why.push(`Awake window (${signals.awake_window_min} min) exceeds age-appropriate threshold`);
  }
  
  // S2: awake_window >= 120
  if (signals.awake_window_min !== null && signals.awake_window_min >= 120) {
    matchedRules.push({ id: 'S2', boost: 0.3 });
    why.push(`Extended awake window (${signals.awake_window_min} min) strongly suggests overtired state`);
  }
  
  // S3: recent_sleep < 30
  if (signals.recent_sleep_min !== null && signals.recent_sleep_min < 30) {
    matchedRules.push({ id: 'S3', boost: 0.25 });
    why.push(`Recent nap was very short (${signals.recent_sleep_min} min), indicating insufficient rest`);
  }
  
  // S4: escalating cry + intensity >= 0.7
  if (signals.cry_pattern_mode === 'escalating' && recentCry?.cry_intensity >= 0.7) {
    matchedRules.push({ id: 'S4', boost: 0.2 });
    why.push('Escalating high-intensity crying typical of overtired baby');
  }
  
  // S5: cry_duration >= 300 sec
  if (signals.cry_duration_sec !== null && signals.cry_duration_sec >= 300) {
    matchedRules.push({ id: 'S5', boost: 0.15 });
    why.push(`Prolonged crying (${signals.cry_duration_sec} sec) consistent with difficulty settling when overtired`);
  }
  
  // S6: time_since_last_sleep_event >= 120 (using awake_window as proxy)
  if (signals.awake_window_min !== null && signals.awake_window_min >= 120) {
    matchedRules.push({ id: 'S6', boost: 0.2 });
    why.push(`Long gap since last sleep event (${signals.awake_window_min} min) suggests sleep need`);
  }
  
  const confidence = calculateConfidence(BASE_CONFIDENCE, matchedRules, MAX_CONFIDENCE);
  
  return {
    label: 'sleepy',
    confidence,
    ruleCount: matchedRules.length,
    matchedRules: matchedRules.map(r => r.id),
    why: why.length > 0 ? why : ['No strong sleepy indicators detected']
  };
}

/**
 * Evaluate overstimulated hypothesis
 * Base: 0.15, Max: 0.80, Rules: 5
 */
function evaluateOverstimulated(signals, events) {
  const BASE_CONFIDENCE = 0.15;
  const MAX_CONFIDENCE = 0.80;
  const matchedRules = [];
  const why = [];
  
  const recentCry = events.filter(e => e.type === 'cry').sort((a, b) => 
    new Date(b.ts) - new Date(a.ts)
  )[0];
  
  // O1: escalating cry + high pitch
  if (signals.cry_pattern_mode === 'escalating' && recentCry?.cry_pitch_hint === 'high') {
    matchedRules.push({ id: 'O1', boost: 0.35 });
    why.push('Escalating high-pitched crying suggests sensory overload');
  }
  
  // O2: awake_window 60-90 min
  if (signals.awake_window_min !== null && 
      signals.awake_window_min >= 60 && 
      signals.awake_window_min < 90) {
    matchedRules.push({ id: 'O2', boost: 0.25 });
    why.push(`Moderate awake window (${signals.awake_window_min} min) in range where overstimulation occurs`);
  }
  
  // O3: intensity >= 0.8 + duration < 180
  if (recentCry?.cry_intensity >= 0.8 && signals.cry_duration_sec !== null && signals.cry_duration_sec < 180) {
    matchedRules.push({ id: 'O3', boost: 0.3 });
    why.push('Intense but brief crying episodes typical of overstimulation response');
  }
  
  // O4: basic needs recently met
  if (signals.time_since_last_feed_min !== null && signals.time_since_last_feed_min < 120 &&
      signals.time_since_last_diaper_min !== null && signals.time_since_last_diaper_min < 120) {
    matchedRules.push({ id: 'O4', boost: 0.2 });
    why.push('Basic needs recently met, suggesting environmental factors');
  }
  
  // O5: cry_count_last_hour >= 3
  if (signals.cry_count_last_hour >= 3) {
    matchedRules.push({ id: 'O5', boost: 0.2 });
    why.push(`Multiple crying episodes (${signals.cry_count_last_hour} in last hour) suggest persistent distress`);
  }
  
  const confidence = calculateConfidence(BASE_CONFIDENCE, matchedRules, MAX_CONFIDENCE);
  
  return {
    label: 'overstimulated',
    confidence,
    ruleCount: matchedRules.length,
    matchedRules: matchedRules.map(r => r.id),
    why: why.length > 0 ? why : ['No strong overstimulation indicators detected']
  };
}

/**
 * Evaluate discomfort (gas/reflux) hypothesis
 * Base: 0.2, Max: 0.85, Rules: 5
 */
function evaluateDiscomfort(signals, events) {
  const BASE_CONFIDENCE = 0.2;
  const MAX_CONFIDENCE = 0.85;
  const matchedRules = [];
  const why = [];
  
  const recentCry = events.filter(e => e.type === 'cry').sort((a, b) => 
    new Date(b.ts) - new Date(a.ts)
  )[0];
  
  const lastFeed = events.filter(e => e.type === 'feed').sort((a, b) => 
    new Date(b.ts) - new Date(a.ts)
  )[0];
  
  // C1: intermittent cry + intensity >= 0.7
  if (signals.cry_pattern_mode === 'intermittent' && recentCry?.cry_intensity >= 0.7) {
    matchedRules.push({ id: 'C1', boost: 0.3 });
    why.push('Intermittent high-intensity crying consistent with physical discomfort');
  }
  
  // C2: high pitch + duration >= 120
  if (recentCry?.cry_pitch_hint === 'high' && signals.cry_duration_sec !== null && signals.cry_duration_sec >= 120) {
    matchedRules.push({ id: 'C2', boost: 0.3 });
    why.push('High-pitched sustained crying often indicates pain or discomfort');
  }
  
  // C3: time_since_last_feed 15-60 min
  if (signals.time_since_last_feed_min !== null && 
      signals.time_since_last_feed_min >= 15 && 
      signals.time_since_last_feed_min <= 60) {
    matchedRules.push({ id: 'C3', boost: 0.25 });
    why.push('Timing (15-60 min post-feed) aligns with gas or reflux discomfort window');
  }
  
  // C4: continuous cry + high pitch
  if (signals.cry_pattern_mode === 'continuous' && recentCry?.cry_pitch_hint === 'high') {
    matchedRules.push({ id: 'C4', boost: 0.25 });
    why.push('Continuous high-pitched crying suggests persistent discomfort');
  }
  
  // C5: last_feed_amount > 120ml
  if (lastFeed?.feed_amount_ml && lastFeed.feed_amount_ml > 120) {
    matchedRules.push({ id: 'C5', boost: 0.15 });
    why.push(`Large feeding volume (${lastFeed.feed_amount_ml}ml) increases likelihood of gas or reflux`);
  }
  
  const confidence = calculateConfidence(BASE_CONFIDENCE, matchedRules, MAX_CONFIDENCE);
  
  return {
    label: 'discomfort',
    confidence,
    ruleCount: matchedRules.length,
    matchedRules: matchedRules.map(r => r.id),
    why: why.length > 0 ? why : ['No strong discomfort indicators detected']
  };
}

/**
 * Evaluate needs soothing (wants contact) hypothesis
 * Base: 0.25, Max: 0.75, Rules: 5
 */
function evaluateNeedsSoothing(signals, events) {
  const BASE_CONFIDENCE = 0.25;
  const MAX_CONFIDENCE = 0.75;
  const matchedRules = [];
  const why = [];
  
  const recentCry = events.filter(e => e.type === 'cry').sort((a, b) => 
    new Date(b.ts) - new Date(a.ts)
  )[0];
  
  // N1: low intensity + intermittent
  if (recentCry?.cry_intensity < 0.5 && signals.cry_pattern_mode === 'intermittent') {
    matchedRules.push({ id: 'N1', boost: 0.3 });
    why.push('Low-intensity intermittent crying suggests need for comfort rather than urgent need');
  }
  
  // N2: basic needs recently met
  if (signals.time_since_last_feed_min !== null && signals.time_since_last_feed_min < 90 &&
      signals.time_since_last_diaper_min !== null && signals.time_since_last_diaper_min < 90) {
    matchedRules.push({ id: 'N2', boost: 0.3 });
    why.push('Basic needs recently addressed, suggesting emotional need for contact');
  }
  
  // N3: brief moderate crying
  if (signals.cry_duration_sec !== null && signals.cry_duration_sec < 120 && 
      recentCry?.cry_intensity < 0.6) {
    matchedRules.push({ id: 'N3', boost: 0.25 });
    why.push('Brief, moderate crying typical of seeking caregiver attention');
  }
  
  // N4: awake_window 30-60 min
  if (signals.awake_window_min !== null && 
      signals.awake_window_min >= 30 && 
      signals.awake_window_min < 60) {
    matchedRules.push({ id: 'N4', boost: 0.15 });
    why.push('Mid-range awake window when babies often seek social interaction');
  }
  
  // N5: escalating low intensity
  if (signals.cry_pattern_mode === 'escalating' && recentCry?.cry_intensity < 0.5) {
    matchedRules.push({ id: 'N5', boost: 0.2 });
    why.push('Gradually escalating low-intensity cry suggests building need for comfort');
  }
  
  const confidence = calculateConfidence(BASE_CONFIDENCE, matchedRules, MAX_CONFIDENCE);
  
  return {
    label: 'needs_soothing',
    confidence,
    ruleCount: matchedRules.length,
    matchedRules: matchedRules.map(r => r.id),
    why: why.length > 0 ? why : ['No strong contact-seeking indicators detected']
  };
}

/**
 * Evaluate unknown (fallback) hypothesis
 * Base: 0.1, Max: 0.50, Rules: 3
 */
function evaluateUnknown(signals, events) {
  const BASE_CONFIDENCE = 0.1;
  const MAX_CONFIDENCE = 0.50;
  const matchedRules = [];
  const why = [];
  
  // U1: missing feed or diaper data
  if (signals.time_since_last_feed_min === null || signals.time_since_last_diaper_min === null) {
    matchedRules.push({ id: 'U1', boost: 0.4 });
    why.push('Insufficient event history to determine likely cause');
  }
  
  // U2: unknown cry patterns
  if (signals.cry_pattern_mode === 'unknown' || signals.cry_pattern_mode === null) {
    matchedRules.push({ id: 'U2', boost: 0.3 });
    why.push('Limited cry characteristics available for analysis');
  }
  
  // U3: missing critical cry data
  if (signals.cry_duration_sec === null || signals.cry_duration_sec === undefined) {
    matchedRules.push({ id: 'U3', boost: 0.25 });
    why.push('Missing critical cry event data');
  }
  
  const confidence = calculateConfidence(BASE_CONFIDENCE, matchedRules, MAX_CONFIDENCE);
  
  return {
    label: 'unknown',
    confidence,
    ruleCount: matchedRules.length,
    matchedRules: matchedRules.map(r => r.id),
    why: why.length > 0 ? why : ['Unable to determine likely cause']
  };
}

/**
 * Calculate confidence with diminishing returns
 * Formula:
 * 1. raw_score = base + sum(boosts)
 * 2. if (rules > 3): apply diminishing returns
 * 3. cap at max_confidence
 * 4. round to 2 decimals
 */
function calculateConfidence(baseConfidence, matchedRules, maxConfidence) {
  // Step 1: Calculate raw score
  let rawScore = baseConfidence;
  matchedRules.forEach(rule => {
    rawScore += rule.boost;
  });
  
  // Step 2: Apply diminishing returns if > 3 rules
  if (matchedRules.length > 3) {
    const diminishingFactor = 1 - ((matchedRules.length - 3) * 0.1);
    rawScore = rawScore * Math.max(diminishingFactor, 0.7);
  }
  
  // Step 3: Apply cap
  rawScore = Math.min(rawScore, maxConfidence);
  rawScore = Math.max(rawScore, 0);
  
  // Step 4: Round to 2 decimals
  return Math.round(rawScore * 100) / 100;
}

module.exports = {
  generateHypotheses
};
