# CryFlow Implementation Plan

**Version:** 1.0.0  
**Date:** 2026-01-16  
**Status:** Ready for Implementation

---

## Current Folder Structure

```
cryflow-backend/
├── src/
│   ├── config/
│   │   └── database.js                 ✅ Existing
│   ├── controllers/
│   │   ├── analysisController.js       ✅ Existing
│   │   └── eventController.js          ✅ Existing
│   ├── middleware/
│   │   ├── auth.js                     ✅ Existing
│   │   └── requestId.js                ✅ Existing
│   ├── models/
│   │   ├── Analysis.js                 ✅ Existing
│   │   └── Event.js                    ✅ Existing
│   ├── routes/
│   │   └── index.js                    ✅ Existing
│   ├── services/
│   │   ├── analysisService.js          ✅ Existing
│   │   ├── hypothesisGenerator.js      ✅ Existing
│   │   └── suggestionGenerator.js      ✅ Existing
│   ├── utils/
│   │   ├── eventValidator.js           ✅ Existing
│   │   └── signalComputer.js           ✅ Existing
│   ├── __tests__/
│   │   ├── hypothesisGenerator.test.js ✅ Existing
│   │   ├── integration.test.js         ✅ Existing
│   │   └── signalComputer.test.js      ✅ Existing
│   └── server.js                       ✅ Existing
├── scripts/
│   ├── seedDatabase.js                 ✅ Existing
│   └── setupDatabase.js                ✅ Existing
└── package.json                        ✅ Existing
```

## Proposed Additions (Optional)

```
src/
├── events/                             🆕 Optional (for event-driven)
│   ├── eventQueue.js                   🆕 Simple in-memory queue
│   ├── consumers/                      🆕 Event consumers
│   │   ├── eventConsumer.js            🆕 Handle baby_event.created
│   │   └── analysisConsumer.js         🆕 Handle analysis.requested
│   └── schemas/                        🆕 Event validation schemas
│       ├── babyEvent.js                🆕 Event schema validation
│       └── analysisEvent.js            🆕 Analysis schema validation
├── validation/                         🆕 Enhanced validation
│   ├── schemas/                        🆕 Request schemas
│   │   ├── eventSchemas.js             🆕 Event validation rules
│   │   └── analysisSchemas.js          🆕 Analysis validation rules
│   └── errorCodes.js                   🆕 Centralized error codes
└── __tests__/
    ├── controllers/                    🆕 Controller tests
    │   ├── eventController.test.js     🆕 Event endpoint tests
    │   └── analysisController.test.js  🆕 Analysis endpoint tests
    └── events/                         🆕 Event system tests
        └── eventQueue.test.js          🆕 Event queue tests
```

---

## Implementation Priority

### Phase 1: Core Endpoints (Already Done ✅)
1. ✅ POST /v1/babies/{baby_id}/analyze
2. ✅ POST /v1/babies/{baby_id}/events  
3. ✅ GET /v1/babies/{baby_id}/events

### Phase 2: Enhanced Validation (Optional)
4. 🆕 Enhanced error handling
5. 🆕 Request validation middleware
6. 🆕 Centralized error codes

### Phase 3: Event-Driven (Optional)
7. 🆕 Event queue system
8. 🆕 Event consumers
9. 🆕 Async analysis processing

---

## Endpoint Implementation

### 1. POST /v1/babies/{baby_id}/analyze ✅

**Status:** Already implemented in `src/controllers/analysisController.js`

**Enhanced Pseudocode:**
```javascript
async function analyzeBaby(req, res) {
  try {
    // 1. Validate request
    const { baby_id } = req.params;
    const { format = 'openapi' } = req.query;
    
    if (!baby_id) {
      return res.status(400).json({
        error: 'MISSING_BABY_ID',
        message: 'Baby ID is required'
      });
    }
    
    // 2. Fetch recent events
    const events = await Event.find({ baby_id })
      .sort({ ts: -1 })
      .limit(100);
    
    if (events.length === 0) {
      return res.status(404).json({
        error: 'NO_EVENTS_FOUND',
        message: 'No events found for this baby'
      });
    }
    
    // 3. Run analysis
    const startTime = Date.now();
    const result = await analysisService.analyzeBaby(baby_id, {}, events);
    const executionTime = Date.now() - startTime;
    
    // 4. Store analysis result
    const analysis = await Analysis.create({
      baby_id,
      hypotheses: result.hypotheses,
      suggestions: result.suggestions,
      execution_time_ms: executionTime,
      analyzed_events: events.map(e => e._id)
    });
    
    // 5. Transform response format
    let response = result;
    if (format === 'frontend') {
      response = analysisService.transformToFrontendFormat(result);
    }
    
    // 6. Return result
    res.json({
      ...response,
      analysis_id: analysis._id,
      execution_time_ms: executionTime
    });
    
  } catch (error) {
    console.error('Analysis failed:', error);
    res.status(500).json({
      error: 'ANALYSIS_FAILED',
      message: 'Internal server error during analysis'
    });
  }
}
```

---

### 2. POST /v1/babies/{baby_id}/events ✅

**Status:** Already implemented in `src/controllers/eventController.js`

**Enhanced Pseudocode:**
```javascript
async function createEvent(req, res) {
  try {
    // 1. Validate request
    const { baby_id } = req.params;
    const eventData = req.body;
    
    if (!baby_id) {
      return res.status(400).json({
        error: 'MISSING_BABY_ID',
        message: 'Baby ID is required'
      });
    }
    
    // 2. Validate event data
    const validation = eventValidator.validateEvent(eventData);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'INVALID_EVENT_DATA',
        message: 'Event validation failed',
        details: validation.errors
      });
    }
    
    // 3. Add metadata
    const event = {
      ...eventData,
      baby_id,
      ts: eventData.ts || new Date(),
      created_at: new Date(),
      request_id: req.headers['x-request-id']
    };
    
    // 4. Check for duplicates (optional)
    const duplicate = await Event.findOne({
      baby_id,
      type: event.type,
      ts: event.ts
    });
    
    if (duplicate) {
      return res.status(409).json({
        error: 'DUPLICATE_EVENT',
        message: 'Event already exists',
        existing_id: duplicate._id
      });
    }
    
    // 5. Save event
    const savedEvent = await Event.create(event);
    
    // 6. Trigger analysis for cry events (optional)
    if (event.type === 'cry') {
      // Could emit event here for async processing
      // eventQueue.emit('baby_analysis.requested', { baby_id });
    }
    
    // 7. Return created event
    res.status(201).json({
      event_id: savedEvent._id,
      baby_id: savedEvent.baby_id,
      type: savedEvent.type,
      ts: savedEvent.ts,
      created_at: savedEvent.created_at
    });
    
  } catch (error) {
    console.error('Event creation failed:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Event data validation failed',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: 'EVENT_CREATION_FAILED',
      message: 'Internal server error during event creation'
    });
  }
}
```

---

### 3. GET /v1/babies/{baby_id}/events ✅

**Status:** Already implemented in `src/controllers/eventController.js`

**Enhanced Pseudocode:**
```javascript
async function getEvents(req, res) {
  try {
    // 1. Validate request
    const { baby_id } = req.params;
    const { 
      limit = 50, 
      offset = 0, 
      type, 
      since, 
      until 
    } = req.query;
    
    if (!baby_id) {
      return res.status(400).json({
        error: 'MISSING_BABY_ID',
        message: 'Baby ID is required'
      });
    }
    
    // 2. Validate query parameters
    if (limit > 1000) {
      return res.status(400).json({
        error: 'LIMIT_TOO_LARGE',
        message: 'Limit cannot exceed 1000'
      });
    }
    
    // 3. Build query
    const query = { baby_id };
    
    if (type) {
      if (!['cry', 'feed', 'diaper', 'sleep', 'note'].includes(type)) {
        return res.status(400).json({
          error: 'INVALID_EVENT_TYPE',
          message: 'Invalid event type'
        });
      }
      query.type = type;
    }
    
    if (since) {
      query.ts = { ...query.ts, $gte: new Date(since) };
    }
    
    if (until) {
      query.ts = { ...query.ts, $lte: new Date(until) };
    }
    
    // 4. Fetch events
    const events = await Event.find(query)
      .sort({ ts: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));
    
    // 5. Get total count for pagination
    const total = await Event.countDocuments(query);
    
    // 6. Return events
    res.json({
      events: events.map(event => ({
        event_id: event._id,
        baby_id: event.baby_id,
        type: event.type,
        ts: event.ts,
        ...event.toObject()
      })),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: total > (parseInt(offset) + parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Event fetch failed:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'INVALID_QUERY_PARAMETER',
        message: 'Invalid query parameter format'
      });
    }
    
    res.status(500).json({
      error: 'EVENT_FETCH_FAILED',
      message: 'Internal server error during event fetch'
    });
  }
}
```

---

## Validation Rules

### Event Validation

```javascript
// src/validation/schemas/eventSchemas.js
const eventSchemas = {
  cry: {
    type: { type: 'string', enum: ['cry'], required: true },
    ts: { type: 'date', required: true },
    cry_pattern: { type: 'string', enum: ['continuous', 'intermittent', 'escalating'] },
    cry_intensity: { type: 'number', min: 0, max: 1 },
    cry_duration_sec: { type: 'number', min: 0, max: 3600 },
    cry_pitch_hint: { type: 'string', enum: ['low', 'medium', 'high'] }
  },
  
  feed: {
    type: { type: 'string', enum: ['feed'], required: true },
    ts: { type: 'date', required: true },
    feed_amount_ml: { type: 'number', min: 0, max: 500 },
    feed_duration_min: { type: 'number', min: 0, max: 120 },
    feed_type: { type: 'string', enum: ['breast', 'bottle', 'solid'] }
  },
  
  diaper: {
    type: { type: 'string', enum: ['diaper'], required: true },
    ts: { type: 'date', required: true },
    diaper_dirty: { type: 'boolean' },
    diaper_wet: { type: 'boolean' }
  },
  
  sleep: {
    type: { type: 'string', enum: ['sleep'], required: true },
    ts: { type: 'date', required: true },
    sleep_state: { type: 'string', enum: ['asleep', 'woke_up', 'nap_start', 'nap_end'], required: true }
  },
  
  note: {
    type: { type: 'string', enum: ['note'], required: true },
    ts: { type: 'date', required: true },
    note_text: { type: 'string', maxLength: 1000, required: true }
  }
};
```

### Analysis Validation

```javascript
// src/validation/schemas/analysisSchemas.js
const analysisRequestSchema = {
  baby_id: { type: 'string', required: true, pattern: /^[a-zA-Z0-9_-]+$/ },
  options: {
    window_minutes: { type: 'number', min: 60, max: 1440, default: 360 },
    format: { type: 'string', enum: ['openapi', 'frontend'], default: 'openapi' }
  }
};
```

---

## Error Codes

### Centralized Error Codes

```javascript
// src/validation/errorCodes.js
const ERROR_CODES = {
  // Request Validation
  MISSING_BABY_ID: {
    code: 'MISSING_BABY_ID',
    status: 400,
    message: 'Baby ID is required'
  },
  
  INVALID_EVENT_DATA: {
    code: 'INVALID_EVENT_DATA',
    status: 400,
    message: 'Event validation failed'
  },
  
  INVALID_EVENT_TYPE: {
    code: 'INVALID_EVENT_TYPE',
    status: 400,
    message: 'Invalid event type. Must be one of: cry, feed, diaper, sleep, note'
  },
  
  LIMIT_TOO_LARGE: {
    code: 'LIMIT_TOO_LARGE',
    status: 400,
    message: 'Limit cannot exceed 1000'
  },
  
  INVALID_QUERY_PARAMETER: {
    code: 'INVALID_QUERY_PARAMETER',
    status: 400,
    message: 'Invalid query parameter format'
  },
  
  // Resource Errors
  NO_EVENTS_FOUND: {
    code: 'NO_EVENTS_FOUND',
    status: 404,
    message: 'No events found for this baby'
  },
  
  DUPLICATE_EVENT: {
    code: 'DUPLICATE_EVENT',
    status: 409,
    message: 'Event already exists'
  },
  
  // Processing Errors
  ANALYSIS_FAILED: {
    code: 'ANALYSIS_FAILED',
    status: 500,
    message: 'Internal server error during analysis'
  },
  
  EVENT_CREATION_FAILED: {
    code: 'EVENT_CREATION_FAILED',
    status: 500,
    message: 'Internal server error during event creation'
  },
  
  EVENT_FETCH_FAILED: {
    code: 'EVENT_FETCH_FAILED',
    status: 500,
    message: 'Internal server error during event fetch'
  },
  
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    status: 400,
    message: 'Data validation failed'
  }
};
```

### Error Response Format

```javascript
// Standard error response format
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {}, // Optional additional details
  "timestamp": "2026-01-16T10:00:00.000Z",
  "request_id": "req_abc123"
}
```

### Error Examples

#### 400 Bad Request
```json
{
  "error": "INVALID_EVENT_DATA",
  "message": "Event validation failed",
  "details": {
    "cry_intensity": "Must be between 0 and 1",
    "ts": "Invalid date format"
  },
  "timestamp": "2026-01-16T10:00:00.000Z",
  "request_id": "req_abc123"
}
```

#### 404 Not Found
```json
{
  "error": "NO_EVENTS_FOUND",
  "message": "No events found for this baby",
  "timestamp": "2026-01-16T10:00:00.000Z",
  "request_id": "req_abc123"
}
```

#### 409 Conflict
```json
{
  "error": "DUPLICATE_EVENT",
  "message": "Event already exists",
  "details": {
    "existing_id": "evt_123456789"
  },
  "timestamp": "2026-01-16T10:00:00.000Z",
  "request_id": "req_abc123"
}
```

#### 500 Internal Server Error
```json
{
  "error": "ANALYSIS_FAILED",
  "message": "Internal server error during analysis",
  "timestamp": "2026-01-16T10:00:00.000Z",
  "request_id": "req_abc123"
}
```

---

## Optional Enhancements

### 1. Enhanced Validation Middleware

```javascript
// src/middleware/validation.js
function validateRequest(schema) {
  return (req, res, next) => {
    const validation = validateSchema(req.body, schema);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: validation.errors
      });
    }
    next();
  };
}
```

### 2. Event Queue System

```javascript
// src/events/eventQueue.js
class EventQueue {
  constructor() {
    this.consumers = new Map();
  }
  
  emit(eventType, payload) {
    const event = {
      event_id: generateId(),
      event_type: eventType,
      timestamp: new Date().toISOString(),
      payload
    };
    
    const consumer = this.consumers.get(eventType);
    if (consumer) {
      setImmediate(() => consumer(event));
    }
  }
  
  on(eventType, handler) {
    this.consumers.set(eventType, handler);
  }
}
```

### 3. Request ID Middleware Enhancement

```javascript
// src/middleware/requestId.js (enhanced)
function requestId(req, res, next) {
  req.requestId = req.headers['x-request-id'] || generateId();
  res.setHeader('x-request-id', req.requestId);
  next();
}
```

---

## Implementation Steps

### Step 1: Core Functionality ✅
- ✅ Basic endpoints working
- ✅ Analysis algorithm implemented
- ✅ Database models created

### Step 2: Enhanced Validation (Optional)
1. Create `src/validation/errorCodes.js`
2. Create `src/validation/schemas/`
3. Add validation middleware
4. Update controllers with better error handling

### Step 3: Event System (Optional)
1. Create `src/events/eventQueue.js`
2. Create `src/events/consumers/`
3. Add event emission to controllers
4. Add async analysis processing

### Step 4: Testing (Optional)
1. Add controller tests
2. Add validation tests
3. Add event system tests
4. Add error handling tests

---

## Summary

**Current Status:** ✅ Core implementation complete and working

**Optional Enhancements:**
- 🆕 Enhanced error handling with centralized codes
- 🆕 Better request validation
- 🆕 Event-driven architecture
- 🆕 Comprehensive testing

**Folder Structure:** Clean and organized, ready for optional enhancements

**Endpoints:** All 3 core endpoints implemented and functional

**Next Steps:** Choose which optional enhancements to implement based on demo needs

---

**Implementation Plan Status:** Complete and Ready  
**Version:** 1.0.0  
**Date:** 2026-01-16