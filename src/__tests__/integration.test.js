/**
 * Integration Test - Full Analysis Flow
 * Tests the complete analysis pipeline from events to suggestions
 */

const { computeDerivedSignals } = require('../utils/signalComputer');
const { generateHypotheses } = require('../services/hypothesisGenerator');
const { generateSuggestions } = require('../services/suggestionGenerator');

describe('Integration Tests - Full Analysis Flow', () => {
  
  test('Complete analysis flow: events → signals → hypotheses → suggestions', () => {
    // Step 1: Sample events (hunger scenario)
    const currentTime = new Date('2026-01-16T10:00:00Z');
    const events = [
      {
        type: 'feed',
        ts: new Date('2026-01-16T06:30:00Z'),
        feed_amount_ml: 90
      },
      {
        type: 'diaper',
        ts: new Date('2026-01-16T07:00:00Z'),
        diaper_dirty: false
      },
      {
        type: 'sleep',
        ts: new Date('2026-01-16T07:30:00Z'),
        sleep_state: 'asleep'
      },
      {
        type: 'sleep',
        ts: new Date('2026-01-16T09:00:00Z'),
        sleep_state: 'woke_up'
      },
      {
        type: 'cry',
        ts: new Date('2026-01-16T09:55:00Z'),
        cry_pattern: 'continuous',
        cry_intensity: 0.75,
        cry_duration_sec: 180,
        cry_pitch_hint: 'low'
      }
    ];
    
    // Step 2: Compute signals
    const signals = computeDerivedSignals(events, currentTime, 360);
    
    expect(signals.time_since_last_feed_min).toBe(210); // 3.5 hours
    expect(signals.awake_window_min).toBe(60); // 1 hour
    expect(signals.cry_pattern_mode).toBe('continuous');
    
    // Step 3: Generate hypotheses
    const hypotheses = generateHypotheses(signals, events);
    
    expect(hypotheses.length).toBeGreaterThan(0);
    expect(hypotheses[0].label).toBe('hunger');
    expect(hypotheses[0].confidence).toBeGreaterThan(0.6);
    expect(hypotheses[0].matchedRules).toContain('H1');
    
    // Step 4: Generate suggestions
    const suggestions = generateSuggestions(hypotheses);
    
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].title).toContain('feeding');
    expect(suggestions[0].steps).toBeDefined();
    expect(suggestions[0].safety_note).toBeDefined();
  });
  
  test('Overtired scenario: long awake window + short nap', () => {
    const currentTime = new Date('2026-01-16T14:00:00Z');
    const events = [
      {
        type: 'feed',
        ts: new Date('2026-01-16T12:00:00Z'),
        feed_amount_ml: 120
      },
      {
        type: 'sleep',
        ts: new Date('2026-01-16T11:00:00Z'),
        sleep_state: 'asleep'
      },
      {
        type: 'sleep',
        ts: new Date('2026-01-16T11:20:00Z'),
        sleep_state: 'woke_up'
      },
      {
        type: 'cry',
        ts: new Date('2026-01-16T13:55:00Z'),
        cry_pattern: 'escalating',
        cry_intensity: 0.85,
        cry_duration_sec: 240,
        cry_pitch_hint: 'high'
      }
    ];
    
    const signals = computeDerivedSignals(events, currentTime, 360);
    const hypotheses = generateHypotheses(signals, events);
    
    expect(signals.awake_window_min).toBeGreaterThan(120);
    expect(signals.recent_sleep_min).toBeLessThan(30);
    
    const sleepy = hypotheses.find(h => h.label === 'sleepy');
    expect(sleepy).toBeDefined();
    expect(sleepy.confidence).toBeGreaterThan(0.5);
    expect(sleepy.matchedRules).toContain('S1');
    expect(sleepy.matchedRules).toContain('S3');
  });
  
  test('Discomfort scenario: post-feed timing + high pitch', () => {
    const currentTime = new Date('2026-01-16T10:30:00Z');
    const events = [
      {
        type: 'feed',
        ts: new Date('2026-01-16T10:00:00Z'),
        feed_amount_ml: 150
      },
      {
        type: 'cry',
        ts: new Date('2026-01-16T10:28:00Z'),
        cry_pattern: 'intermittent',
        cry_intensity: 0.8,
        cry_duration_sec: 150,
        cry_pitch_hint: 'high'
      }
    ];
    
    const signals = computeDerivedSignals(events, currentTime, 360);
    const hypotheses = generateHypotheses(signals, events);
    
    expect(signals.time_since_last_feed_min).toBeGreaterThanOrEqual(15);
    expect(signals.time_since_last_feed_min).toBeLessThanOrEqual(60);
    
    const discomfort = hypotheses.find(h => h.label === 'discomfort');
    expect(discomfort).toBeDefined();
    expect(discomfort.matchedRules).toContain('C3');
  });
  
  test('Unknown scenario: insufficient data', () => {
    const currentTime = new Date('2026-01-16T10:00:00Z');
    const events = [
      {
        type: 'cry',
        ts: new Date('2026-01-16T09:55:00Z'),
        cry_pattern: 'unknown',
        cry_intensity: null,
        cry_duration_sec: null
      }
    ];
    
    const signals = computeDerivedSignals(events, currentTime, 360);
    const hypotheses = generateHypotheses(signals, events);
    
    expect(signals.time_since_last_feed_min).toBeNull();
    expect(signals.time_since_last_diaper_min).toBeNull();
    
    const unknown = hypotheses.find(h => h.label === 'unknown');
    expect(unknown).toBeDefined();
    expect(unknown.matchedRules).toContain('U1');
    expect(unknown.matchedRules).toContain('U2');
    expect(unknown.matchedRules).toContain('U3');
  });
  
  test('Performance: analysis completes in < 100ms', () => {
    const currentTime = new Date('2026-01-16T10:00:00Z');
    const events = Array.from({ length: 50 }, (_, i) => ({
      type: i % 5 === 0 ? 'feed' : i % 5 === 1 ? 'diaper' : i % 5 === 2 ? 'sleep' : 'cry',
      ts: new Date(currentTime.getTime() - (50 - i) * 60000),
      cry_pattern: 'continuous',
      cry_intensity: 0.7,
      cry_duration_sec: 120
    }));
    
    const startTime = Date.now();
    
    const signals = computeDerivedSignals(events, currentTime, 360);
    const hypotheses = generateHypotheses(signals, events);
    const suggestions = generateSuggestions(hypotheses);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(100);
    expect(hypotheses.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeGreaterThan(0);
  });
});
