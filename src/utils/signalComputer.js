/**
 * CryFlow Signal Computation Utility
 * Computes derived signals from event timeline
 */

/**
 * Compute all derived signals for analysis
 */
function computeDerivedSignals(events, currentTime, windowMinutes = 360) {
  const windowStart = new Date(currentTime.getTime() - windowMinutes * 60 * 1000);
  const eventsInWindow = events
    .filter(e => new Date(e.ts) >= windowStart)
    .sort((a, b) => new Date(a.ts) - new Date(b.ts));
  
  return {
    // Temporal gaps
    time_since_last_feed_min: getTimeSinceLastEvent(eventsInWindow, "feed", currentTime),
    time_since_last_diaper_min: getTimeSinceLastEvent(eventsInWindow, "diaper", currentTime),
    recent_sleep_min: getLastSleepDuration(eventsInWindow),
    awake_window_min: getTimeSinceLastWakeUp(eventsInWindow, currentTime),
    cry_duration_sec: getMostRecentCryDuration(eventsInWindow),
    
    // Frequency metrics
    cry_count_last_hour: countEventsInWindow(eventsInWindow, "cry", 60, currentTime),
    feed_count_last_6h: countEventsInWindow(eventsInWindow, "feed", 360, currentTime),
    diaper_count_last_6h: countEventsInWindow(eventsInWindow, "diaper", 360, currentTime),
    
    // Pattern analysis
    cry_pattern_mode: getMostCommonCryPattern(eventsInWindow),
    avg_feed_interval_min: getAverageFeedInterval(eventsInWindow),
    cry_escalation: detectCryEscalation(eventsInWindow)
  };
}

/**
 * Get time since last event of specific type
 */
function getTimeSinceLastEvent(events, type, currentTime) {
  const lastEvent = events
    .filter(e => e.type === type)
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))[0];
  
  if (!lastEvent) return null;
  
  const diffMs = currentTime - new Date(lastEvent.ts);
  return Math.floor(diffMs / 60000);  // Convert to minutes
}

/**
 * Get duration of most recent sleep (asleep → woke_up pair)
 */
function getLastSleepDuration(events) {
  const sleepEvents = events
    .filter(e => e.type === "sleep")
    .sort((a, b) => new Date(a.ts) - new Date(b.ts));
  
  // Find most recent asleep → woke_up pair
  for (let i = sleepEvents.length - 1; i >= 1; i--) {
    const current = sleepEvents[i];
    const previous = sleepEvents[i - 1];
    
    if ((current.sleep_state === "woke_up" || current.sleep_state === "nap_end") && 
        previous.sleep_state === "asleep") {
      const diffMs = new Date(current.ts) - new Date(previous.ts);
      return Math.floor(diffMs / 60000);
    }
  }
  
  return null;
}

/**
 * Get time since last wake up
 */
function getTimeSinceLastWakeUp(events, currentTime) {
  const lastWakeUp = events
    .filter(e => e.type === "sleep" && 
                 (e.sleep_state === "woke_up" || e.sleep_state === "nap_end"))
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))[0];
  
  if (!lastWakeUp) return null;
  
  const diffMs = currentTime - new Date(lastWakeUp.ts);
  return Math.floor(diffMs / 60000);
}

/**
 * Get most recent cry duration
 */
function getMostRecentCryDuration(events) {
  const lastCry = events
    .filter(e => e.type === "cry")
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))[0];
  
  return lastCry?.cry_duration_sec ?? null;
}

/**
 * Count events of specific type within time window
 */
function countEventsInWindow(events, type, windowMinutes, currentTime) {
  const windowStart = new Date(currentTime.getTime() - windowMinutes * 60 * 1000);
  
  return events.filter(e => 
    e.type === type && new Date(e.ts) >= windowStart
  ).length;
}

/**
 * Get most common cry pattern
 */
function getMostCommonCryPattern(events) {
  const cryEvents = events.filter(e => e.type === "cry" && e.cry_pattern);
  
  if (cryEvents.length === 0) return null;
  
  const patternCounts = {};
  cryEvents.forEach(e => {
    patternCounts[e.cry_pattern] = (patternCounts[e.cry_pattern] || 0) + 1;
  });
  
  return Object.entries(patternCounts)
    .sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Calculate average feed interval
 */
function getAverageFeedInterval(events) {
  const feedEvents = events
    .filter(e => e.type === "feed")
    .sort((a, b) => new Date(a.ts) - new Date(b.ts));
  
  if (feedEvents.length < 2) return null;
  
  const intervals = [];
  for (let i = 1; i < feedEvents.length; i++) {
    const diffMs = new Date(feedEvents[i].ts) - new Date(feedEvents[i - 1].ts);
    intervals.push(diffMs / 60000);  // Convert to minutes
  }
  
  const sum = intervals.reduce((acc, val) => acc + val, 0);
  return Math.floor(sum / intervals.length);
}

/**
 * Detect cry escalation pattern
 */
function detectCryEscalation(events) {
  const cryEvents = events
    .filter(e => e.type === "cry")
    .sort((a, b) => new Date(a.ts) - new Date(b.ts))
    .slice(-3);  // Last 3 cry events
  
  if (cryEvents.length < 2) return "insufficient_data";
  
  const intensities = cryEvents.map(e => e.cry_intensity ?? 0.5);
  const durations = cryEvents.map(e => e.cry_duration_sec ?? 0);
  
  const intensityIncreasing = intensities.every((val, i, arr) => 
    i === 0 || val >= arr[i - 1]
  );
  const durationIncreasing = durations.every((val, i, arr) => 
    i === 0 || val >= arr[i - 1]
  );
  
  if (intensityIncreasing && durationIncreasing) return "escalating";
  if (intensityIncreasing || durationIncreasing) return "worsening";
  return "stable";
}

/**
 * Assess feeding adequacy based on time since last feed
 */
function assessFeedingAdequacy(timeSinceLastFeedMin, babyAgeMonths = 3) {
  if (timeSinceLastFeedMin === null) return "unknown";
  
  // Expected interval based on age
  const expectedIntervalMin = babyAgeMonths < 1 ? 120 : 180;
  
  if (timeSinceLastFeedMin > expectedIntervalMin * 1.2) return "overdue";
  if (timeSinceLastFeedMin < expectedIntervalMin * 0.5) return "recent";
  return "normal";
}

/**
 * Assess overtired risk based on awake window
 */
function assessOvertiredRisk(awakeWindowMin, babyAgeMonths = 3) {
  if (awakeWindowMin === null) return "unknown";
  
  // Max awake window based on age
  const maxAwakeMin = babyAgeMonths < 1 ? 45 : 90;
  
  if (awakeWindowMin > maxAwakeMin * 1.3) return "high";
  if (awakeWindowMin > maxAwakeMin) return "medium";
  return "low";
}

/**
 * Get most recent cry event
 */
function getMostRecentCryEvent(events) {
  return events
    .filter(e => e.type === "cry")
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))[0];
}

/**
 * Check if diaper change is overdue
 */
function isDiaperChangeOverdue(timeSinceLastDiaperMin) {
  if (timeSinceLastDiaperMin === null) return false;
  return timeSinceLastDiaperMin > 180;  // 3 hours
}

module.exports = {
  computeDerivedSignals,
  getTimeSinceLastEvent,
  getLastSleepDuration,
  getTimeSinceLastWakeUp,
  getMostRecentCryDuration,
  countEventsInWindow,
  getMostCommonCryPattern,
  getAverageFeedInterval,
  detectCryEscalation,
  assessFeedingAdequacy,
  assessOvertiredRisk,
  getMostRecentCryEvent,
  isDiaperChangeOverdue
};
