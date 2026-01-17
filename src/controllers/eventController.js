/**
 * Event Controller
 * Handles event CRUD operations
 */
const Joi = require('joi');
const Event = require('../models/Event');
const { validateEvent } = require('../utils/eventValidator');

// Validation schema for list events query
const listEventsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(500).default(50),
  since: Joi.date().iso(),
  until: Joi.date().iso(),
  types: Joi.string().pattern(/^(cry|feed|diaper|sleep|note)(,(cry|feed|diaper|sleep|note))*$/)
});

/**
 * GET /v1/babies/:baby_id/events
 * Get event timeline for a baby
 */
async function listEventsHandler(req, res) {
  try {
    const { baby_id } = req.params;
    
    // Validate query parameters
    const { error, value } = listEventsQuerySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: error.details[0].message,
          request_id: req.id
        }
      });
    }
    
    // Build query
    const query = { baby_id };
    
    if (value.since || value.until) {
      query.ts = {};
      if (value.since) query.ts.$gte = new Date(value.since);
      if (value.until) query.ts.$lt = new Date(value.until);
    }
    
    if (value.types) {
      const typeArray = value.types.split(',');
      query.type = { $in: typeArray };
    }
    
    // Query events
    const events = await Event.find(query)
      .sort({ ts: -1 })
      .limit(value.limit)
      .lean();
    
    // Format response
    const formattedEvents = events.map(e => ({
      event_id: e._id.toString(),
      baby_id: e.baby_id,
      source: e.source,
      type: e.type,
      ts: e.ts.toISOString(),
      payload: buildPayload(e)
    }));
    
    res.json({
      baby_id,
      events: formattedEvents
    });
    
  } catch (error) {
    console.error('List events error:', error);
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Unexpected error retrieving events',
        request_id: req.id
      }
    });
  }
}

/**
 * POST /v1/babies/:baby_id/events
 * Create a new event
 */
async function createEventHandler(req, res) {
  try {
    const { baby_id } = req.params;
    const eventData = { ...req.body, baby_id };
    
    // Validate event
    let validatedEvent;
    try {
      validatedEvent = validateEvent(eventData);
    } catch (validationError) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: validationError.message,
          errors: validationError.errors,
          request_id: req.id
        }
      });
    }
    
    // Create event
    const event = await Event.create(validatedEvent);
    
    res.status(200).json({
      event_id: event._id.toString(),
      stored: true
    });
    
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Unexpected error creating event',
        request_id: req.id
      }
    });
  }
}

/**
 * Build payload object based on event type
 */
function buildPayload(event) {
  const payload = {};
  
  switch (event.type) {
    case 'cry':
      payload.cry = {
        intensity: event.cry_intensity,
        duration_sec: event.cry_duration_sec,
        pattern: event.cry_pattern || 'unknown',
        pitch_hint: event.cry_pitch_hint || 'unknown'
      };
      break;
      
    case 'feed':
      payload.feed = {
        amount_ml: event.feed_amount_ml,
        method: event.feed_method || 'unknown',
        notes: event.feed_notes
      };
      break;
      
    case 'diaper':
      payload.diaper = {
        wet: event.diaper_wet,
        dirty: event.diaper_dirty,
        notes: event.diaper_notes
      };
      break;
      
    case 'sleep':
      payload.sleep = {
        state: event.sleep_state,
        notes: event.sleep_notes
      };
      break;
      
    case 'note':
      payload.note = {
        text: event.note_text
      };
      break;
  }
  
  return payload;
}

module.exports = {
  listEventsHandler,
  createEventHandler
};
