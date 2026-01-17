/**
 * Analysis Model
 * Stores analysis results for audit trail
 */
const mongoose = require('mongoose');

const hypothesisSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
    enum: ['hunger', 'overtired', 'discomfort', 'needs_burp_or_gas', 'overstimulated', 'wants_contact', 'unknown']
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  why: {
    type: [String],
    required: true,
    validate: {
      validator: function(arr) {
        return arr.length > 0;
      },
      message: 'At least one reason required in why array'
    }
  }
}, { _id: false });

const suggestionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 120
  },
  steps: {
    type: [String],
    required: true,
    validate: {
      validator: function(arr) {
        return arr.length > 0;
      },
      message: 'At least one step required'
    }
  },
  safety_note: {
    type: String,
    maxlength: 300,
    default: null
  }
}, { _id: false });

const analysisSchema = new mongoose.Schema({
  analysis_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  baby_id: {
    type: String,
    required: true,
    index: true
  },
  ts: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // Request context
  window_min: {
    type: Number,
    required: true
  },
  caregiver_note: {
    type: String,
    maxlength: 2000,
    default: null
  },
  locale: {
    type: String,
    maxlength: 32,
    default: null
  },
  
  // Event references analyzed (for audit trail)
  analyzed_events: [{
    event_id: { type: String, required: true },
    type: { type: String, required: true },
    ts: { type: Date, required: true }
  }],
  
  // Computed signals
  signals: {
    time_since_last_feed_min: { type: Number, default: null },
    time_since_last_diaper_min: { type: Number, default: null },
    recent_sleep_min: { type: Number, default: null },
    awake_window_min: { type: Number, default: null },
    cry_duration_sec: { type: Number, default: null },
    cry_count_last_hour: { type: Number, default: 0 },
    feed_count_last_6h: { type: Number, default: 0 },
    diaper_count_last_6h: { type: Number, default: 0 },
    cry_pattern_mode: { type: String, default: null },
    avg_feed_interval_min: { type: Number, default: null },
    cry_escalation: { type: String, default: null }
  },
  
  // Analysis results
  hypotheses: {
    type: [hypothesisSchema],
    required: true,
    validate: {
      validator: function(arr) {
        return arr.length > 0;
      },
      message: 'At least one hypothesis required'
    }
  },
  
  suggestions: {
    type: [suggestionSchema],
    required: true,
    validate: {
      validator: function(arr) {
        return arr.length > 0;
      },
      message: 'At least one suggestion required'
    }
  },
  
  next_best_questions: {
    type: [String],
    default: []
  },
  
  // Model version for reproducibility
  model_version: {
    type: String,
    default: 'cryflow-v0.1.0'
  },
  algorithm: {
    type: String,
    default: 'rule_based_heuristic'
  },
  
  // Performance metadata
  execution_time_ms: {
    type: Number,
    default: null
  },
  events_processed: {
    type: Number,
    default: 0
  },
  
  // Linked cry event
  cry_event_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    default: null
  },
  
  // Schema version
  schema_version: {
    type: String,
    default: '1.0.0'
  }
}, {
  timestamps: true,
  collection: 'analyses'
});

// Index for querying recent analyses
analysisSchema.index({ baby_id: 1, ts: -1 });

// Index for hypothesis queries
analysisSchema.index({ baby_id: 1, 'hypotheses.label': 1, ts: -1 });

// Index for event reference lookups
analysisSchema.index({ 'analyzed_events.event_id': 1 });

module.exports = mongoose.model('Analysis', analysisSchema);
