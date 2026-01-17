/**
 * CryFlow Event Validation Utility
 * Validates event data against schema rules
 */

const VALID_ENUMS = {
  source: ["manual", "device", "agent"],
  type: ["cry", "feed", "diaper", "sleep", "note"],
  cry_pattern: ["continuous", "intermittent", "escalating", "unknown", null],
  cry_pitch_hint: ["high", "low", "unknown", null],
  feed_method: ["bottle", "breast", "unknown", null],
  sleep_state: ["asleep", "woke_up", "nap_end", null]
};

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

/**
 * Validate and normalize a single event
 */
function validateEvent(event) {
  const errors = [];
  
  // Required fields
  if (!event.baby_id || event.baby_id.trim() === "") {
    errors.push({ field: "baby_id", message: "baby_id is required" });
  }
  
  if (!event.type) {
    errors.push({ field: "type", message: "type is required" });
  }
  
  if (!event.ts) {
    errors.push({ field: "ts", message: "ts is required" });
  }
  
  // Validate timestamp
  try {
    validateTimestamp(event.ts, event.id);
  } catch (err) {
    errors.push({ field: "ts", message: err.message });
  }
  
  // Validate enums
  if (event.source && !VALID_ENUMS.source.includes(event.source)) {
    errors.push({ field: "source", message: `Invalid source: ${event.source}` });
  }
  
  if (event.type && !VALID_ENUMS.type.includes(event.type)) {
    errors.push({ field: "type", message: `Invalid type: ${event.type}` });
  }
  
  // Type-specific validation
  if (event.type) {
    const typeErrors = validateTypeSpecificFields(event);
    errors.push(...typeErrors);
  }
  
  if (errors.length > 0) {
    const error = new Error("Event validation failed");
    error.errors = errors;
    throw error;
  }
  
  // Normalize and return
  return normalizeEvent(event);
}

/**
 * Validate timestamp
 */
function validateTimestamp(ts, id) {
  const eventTime = new Date(ts);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  
  if (isNaN(eventTime.getTime())) {
    throw new ValidationError(`Invalid timestamp format: ${ts}`, "ts");
  }
  
  if (eventTime > fiveMinutesFromNow) {
    throw new ValidationError("Timestamp cannot be in the future", "ts");
  }
  
  if (eventTime < oneYearAgo) {
    console.warn(`Event ${id}: Timestamp older than 1 year`);
  }
  
  return eventTime;
}

/**
 * Validate type-specific fields
 */
function validateTypeSpecificFields(event) {
  const errors = [];
  
  switch (event.type) {
    case "cry":
      // cry_duration_sec is required
      if (event.cry_duration_sec === null || event.cry_duration_sec === undefined) {
        errors.push({ field: "cry_duration_sec", message: "cry_duration_sec required for cry events" });
      } else if (event.cry_duration_sec < 1 || event.cry_duration_sec > 7200) {
        errors.push({ field: "cry_duration_sec", message: "cry_duration_sec must be 1-7200" });
      }
      
      // Validate intensity range
      if (event.cry_intensity !== null && event.cry_intensity !== undefined) {
        if (event.cry_intensity < 0 || event.cry_intensity > 1) {
          errors.push({ field: "cry_intensity", message: "cry_intensity must be 0.0-1.0" });
        }
      }
      
      // Validate enums
      if (event.cry_pattern && !VALID_ENUMS.cry_pattern.includes(event.cry_pattern)) {
        errors.push({ field: "cry_pattern", message: `Invalid cry_pattern: ${event.cry_pattern}` });
      }
      
      if (event.cry_pitch_hint && !VALID_ENUMS.cry_pitch_hint.includes(event.cry_pitch_hint)) {
        errors.push({ field: "cry_pitch_hint", message: `Invalid cry_pitch_hint: ${event.cry_pitch_hint}` });
      }
      break;
      
    case "feed":
      // Validate feed_amount_ml range
      if (event.feed_amount_ml !== null && event.feed_amount_ml !== undefined) {
        if (event.feed_amount_ml < 0 || event.feed_amount_ml > 500) {
          console.warn(`Unusual feed_amount_ml: ${event.feed_amount_ml}`);
        }
      }
      
      // Validate feed_method enum
      if (event.feed_method && !VALID_ENUMS.feed_method.includes(event.feed_method)) {
        errors.push({ field: "feed_method", message: `Invalid feed_method: ${event.feed_method}` });
      }
      break;
      
    case "diaper":
      // At least one flag should be set
      if (!event.diaper_wet && !event.diaper_dirty) {
        console.warn(`Diaper event ${event.id} has no wet/dirty flags - will assume wet=true`);
      }
      break;
      
    case "sleep":
      // sleep_state is required
      if (!event.sleep_state || event.sleep_state === "") {
        errors.push({ field: "sleep_state", message: "sleep_state required for sleep events" });
      } else if (!VALID_ENUMS.sleep_state.includes(event.sleep_state)) {
        errors.push({ field: "sleep_state", message: `Invalid sleep_state: ${event.sleep_state}` });
      }
      break;
      
    case "note":
      // note_text is required
      if (!event.note_text || event.note_text.trim() === "") {
        errors.push({ field: "note_text", message: "note_text required for note events" });
      }
      break;
  }
  
  return errors;
}

/**
 * Normalize event data
 */
function normalizeEvent(event) {
  const normalized = {
    id: event.id,
    ts: event.ts,
    baby_id: event.baby_id.trim(),
    source: event.source || "manual",
    type: event.type
  };
  
  // Normalize empty strings to null
  const nullifyEmpty = (value) => {
    if (value === "" || value === undefined) return null;
    return value;
  };
  
  switch (event.type) {
    case "cry":
      normalized.cry_pattern = nullifyEmpty(event.cry_pattern) || "unknown";
      normalized.cry_pitch_hint = nullifyEmpty(event.cry_pitch_hint) || "unknown";
      normalized.cry_intensity = event.cry_intensity ?? 0.5;
      normalized.cry_duration_sec = event.cry_duration_sec;
      break;
      
    case "feed":
      normalized.feed_method = nullifyEmpty(event.feed_method) || "unknown";
      normalized.feed_amount_ml = event.feed_amount_ml ?? null;
      normalized.feed_notes = nullifyEmpty(event.feed_notes);
      break;
      
    case "diaper":
      normalized.diaper_wet = event.diaper_wet ?? true;  // Default to wet if both false
      normalized.diaper_dirty = event.diaper_dirty ?? false;
      normalized.diaper_notes = nullifyEmpty(event.diaper_notes);
      
      // Ensure at least one flag is true
      if (!normalized.diaper_wet && !normalized.diaper_dirty) {
        normalized.diaper_wet = true;
      }
      break;
      
    case "sleep":
      normalized.sleep_state = event.sleep_state;
      normalized.sleep_notes = nullifyEmpty(event.sleep_notes);
      break;
      
    case "note":
      normalized.note_text = event.note_text.trim();
      break;
  }
  
  return normalized;
}

/**
 * Validate analysis request
 */
function validateAnalyzeRequest(req) {
  const errors = [];
  
  if (req.window_min !== undefined && req.window_min !== null) {
    if (typeof req.window_min !== "number" || req.window_min < 5 || req.window_min > 1440) {
      errors.push({ field: "window_min", message: "window_min must be 5-1440" });
    }
  }
  
  if (req.context) {
    if (req.context.caregiver_note && req.context.caregiver_note.length > 2000) {
      errors.push({ field: "context.caregiver_note", message: "caregiver_note max 2000 chars" });
    }
    
    if (req.context.locale && req.context.locale.length > 32) {
      errors.push({ field: "context.locale", message: "locale max 32 chars" });
    }
  }
  
  if (errors.length > 0) {
    const error = new Error("Request validation failed");
    error.errors = errors;
    throw error;
  }
  
  return {
    window_min: req.window_min ?? 360,
    include_questions: req.include_questions ?? true,
    context: req.context || {}
  };
}

module.exports = {
  validateEvent,
  validateTimestamp,
  validateAnalyzeRequest,
  normalizeEvent,
  ValidationError,
  VALID_ENUMS
};
