/**
 * Event Model
 * Stores baby events (cry, feed, diaper, sleep, note)
 */
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  baby_id: {
    type: String,
    required: true,
    index: true,
    trim: true,
    maxlength: 128
  },
  source: {
    type: String,
    required: true,
    enum: ['manual', 'device', 'agent'],
    default: 'manual'
  },
  type: {
    type: String,
    required: true,
    enum: ['cry', 'feed', 'diaper', 'sleep', 'note'],
    index: true
  },
  ts: {
    type: Date,
    required: true,
    index: true
  },
  
  // Cry fields
  cry_pattern: {
    type: String,
    enum: ['continuous', 'intermittent', 'escalating', 'unknown', null],
    default: null
  },
  cry_pitch_hint: {
    type: String,
    enum: ['high', 'low', 'unknown', null],
    default: null
  },
  cry_intensity: {
    type: Number,
    min: 0,
    max: 1,
    default: null
  },
  cry_duration_sec: {
    type: Number,
    min: 1,
    max: 7200,
    default: null
  },
  
  // Feed fields
  feed_method: {
    type: String,
    enum: ['bottle', 'breast', 'unknown', null],
    default: null
  },
  feed_amount_ml: {
    type: Number,
    min: 0,
    max: 500,
    default: null
  },
  feed_notes: {
    type: String,
    maxlength: 500,
    default: null
  },
  
  // Diaper fields
  diaper_wet: {
    type: Boolean,
    default: null
  },
  diaper_dirty: {
    type: Boolean,
    default: null
  },
  diaper_notes: {
    type: String,
    maxlength: 500,
    default: null
  },
  
  // Sleep fields
  sleep_state: {
    type: String,
    enum: ['asleep', 'woke_up', 'nap_end', null],
    default: null
  },
  sleep_notes: {
    type: String,
    maxlength: 500,
    default: null
  },
  
  // Note fields
  note_text: {
    type: String,
    maxlength: 2000,
    default: null
  },
  
  // Metadata for auditability
  metadata: {
    user_agent: { type: String, default: null },
    device_id: { type: String, default: null },
    correlation_id: { type: String, default: null }
  },
  
  // Archival support
  archived: {
    type: Boolean,
    default: false
  },
  archived_at: {
    type: Date,
    default: null
  },
  
  // Schema version
  schema_version: {
    type: String,
    default: '1.0.0'
  }
}, {
  timestamps: true,
  collection: 'events'
});

// Compound indexes for common queries
eventSchema.index({ baby_id: 1, ts: -1 });
eventSchema.index({ baby_id: 1, type: 1, ts: -1 });

// Virtual for event_id (use MongoDB _id)
eventSchema.virtual('event_id').get(function() {
  return this._id.toString();
});

// Ensure virtuals are included in JSON
eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Event', eventSchema);
