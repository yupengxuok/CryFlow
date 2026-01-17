/**
 * Analysis Service
 * Main service for analyzing baby cry events
 */
const { nanoid } = require('nanoid');
const Event = require('../models/Event');
const Analysis = require('../models/Analysis');
const { computeDerivedSignals, getMostRecentCryEvent } = require('../utils/signalComputer');
const { generateHypotheses } = require('./hypothesisGenerator');
const { generateSuggestions, generateNextBestQuestions } = require('./suggestionGenerator');

/**
 * Analyze baby events and generate insights
 */
async function analyzeBaby(babyId, options = {}) {
  const {
    window_min = 360,
    include_questions = true,
    context = {}
  } = options;
  
  // Calculate time window
  const currentTime = new Date();
  const windowStart = new Date(currentTime.getTime() - window_min * 60 * 1000);
  
  // Query events within window
  const events = await Event.find({
    baby_id: babyId,
    ts: { $gte: windowStart, $lte: currentTime }
  }).sort({ ts: 1 }).lean();
  
  // Check if we have any events
  if (events.length === 0) {
    return generateNoEventsResponse(babyId, currentTime, window_min, context);
  }
  
  // Compute derived signals
  const signals = computeDerivedSignals(events, currentTime, window_min);
  
  // Generate hypotheses
  const hypotheses = generateHypotheses(signals, events);
  
  // Generate suggestions
  const suggestions = generateSuggestions(hypotheses, signals);
  
  // Generate next best questions
  const next_best_questions = include_questions 
    ? generateNextBestQuestions(hypotheses, signals)
    : [];
  
  // Get most recent cry event for linking
  const mostRecentCry = getMostRecentCryEvent(events);
  
  // Generate unique analysis ID
  const analysis_id = `ana_${nanoid(10)}`;
  
  // Create analysis result
  const analysisResult = {
    analysis_id,
    baby_id: babyId,
    ts: currentTime.toISOString(),
    signals: {
      time_since_last_feed_min: signals.time_since_last_feed_min,
      time_since_last_diaper_min: signals.time_since_last_diaper_min,
      recent_sleep_min: signals.recent_sleep_min,
      cry_duration_sec: signals.cry_duration_sec
    },
    hypotheses,
    suggestions,
    next_best_questions
  };
  
  // Store analysis for audit trail
  try {
    const startTime = Date.now();
    
    // Build analyzed_events array for audit trail
    const analyzed_events = events.map(e => ({
      event_id: e._id.toString(),
      type: e.type,
      ts: e.ts
    }));
    
    await Analysis.create({
      analysis_id,
      baby_id: babyId,
      ts: currentTime,
      window_min,
      caregiver_note: context.caregiver_note || null,
      locale: context.locale || null,
      analyzed_events,
      signals: {
        time_since_last_feed_min: signals.time_since_last_feed_min,
        time_since_last_diaper_min: signals.time_since_last_diaper_min,
        recent_sleep_min: signals.recent_sleep_min,
        awake_window_min: signals.awake_window_min,
        cry_duration_sec: signals.cry_duration_sec,
        cry_count_last_hour: signals.cry_count_last_hour,
        feed_count_last_6h: signals.feed_count_last_6h || 0,
        diaper_count_last_6h: signals.diaper_count_last_6h || 0,
        cry_pattern_mode: signals.cry_pattern_mode,
        avg_feed_interval_min: signals.avg_feed_interval_min,
        cry_escalation: signals.cry_escalation
      },
      hypotheses,
      suggestions,
      next_best_questions,
      cry_event_id: mostRecentCry?._id || null,
      model_version: 'cryflow-v0.1.0',
      algorithm: 'rule_based_heuristic',
      execution_time_ms: Date.now() - startTime,
      events_processed: events.length
    });
  } catch (error) {
    console.error('Failed to store analysis:', error);
    // Continue even if storage fails
  }
  
  return analysisResult;
}

/**
 * Generate response when no events found
 */
function generateNoEventsResponse(babyId, currentTime, window_min, context) {
  const analysis_id = `ana_${nanoid(10)}`;
  
  return {
    analysis_id,
    baby_id: babyId,
    ts: currentTime.toISOString(),
    signals: {
      time_since_last_feed_min: null,
      time_since_last_diaper_min: null,
      recent_sleep_min: null,
      cry_duration_sec: null
    },
    hypotheses: [
      {
        label: 'unknown',
        confidence: 0.1,
        why: ['No recent events to analyze in the specified time window']
      }
    ],
    suggestions: [
      {
        title: 'Continue monitoring',
        steps: [
          'Watch for signs of distress',
          'Log events as they occur',
          'Contact pediatrician if concerned'
        ],
        safety_note: 'This is non-medical guidance. Consult pediatrician for concerns.'
      }
    ],
    next_best_questions: [
      'Has baby cried recently?',
      'When did baby last eat?',
      'When was the last diaper change?'
    ]
  };
}

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

module.exports = {
  analyzeBaby,
  transformToFrontendFormat
};
