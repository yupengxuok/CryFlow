# CryFlow Backend API

Non-medical caregiver support system - Backend service

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 6+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your MongoDB URI
# MONGODB_URI=mongodb://localhost:27017/cryflow

# Seed database with sample data
npm run seed

# Start development server
npm run dev
```

The API will be available at `http://localhost:3000`

---

## API Endpoints

### Health Check
```bash
GET /v1/health
```

**Response:**
```json
{
  "ok": true,
  "ts": "2026-01-16T19:22:10Z"
}
```

---

### Analyze Baby Events (Priority 1) 🔴

```bash
POST /v1/babies/:baby_id/analyze
```

**Headers:**
```
X-Demo-Key: demo
# OR
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "window_min": 360,
  "include_questions": true,
  "context": {
    "caregiver_note": "Baby woke up 10 min ago.",
    "locale": "en-US"
  }
}
```

**Response (OpenAPI Format):**
```json
{
  "analysis_id": "ana_01J3QZ9ABC",
  "baby_id": "baby_demo_1",
  "ts": "2026-01-16T19:22:10Z",
  "signals": {
    "time_since_last_feed_min": 185,
    "time_since_last_diaper_min": 95,
    "recent_sleep_min": 22,
    "cry_duration_sec": 140
  },
  "hypotheses": [
    {
      "label": "hunger",
      "confidence": 0.62,
      "why": [
        "Long time since last feed suggests hunger",
        "Cry pattern indicates hunger cue"
      ]
    }
  ],
  "suggestions": [
    {
      "title": "Try feeding",
      "steps": [
        "Offer breast or bottle",
        "Ensure comfortable position"
      ],
      "safety_note": "This is non-medical guidance. Consult pediatrician for concerns."
    }
  ],
  "next_best_questions": [
    "Has baby eaten in the last 3 hours?"
  ]
}
```

**Frontend Format:**

Add query parameter `?format=frontend` or header `X-Frontend-Format: true`

```json
[
  {
    "event_id": "50",
    "likely_reasons": ["hunger", "sleepy"],
    "recommended_checks": [
      "Offer breast or bottle",
      "Ensure comfortable position"
    ],
    "confidence": 0.62,
    "explanation": "Long time since last feed suggests hunger"
  }
]
```

---

### List Events (Priority 2) 🟠

```bash
GET /v1/babies/:baby_id/events?limit=50&types=cry,feed
```

**Query Parameters:**
- `limit` (optional): Max events to return (1-500, default: 50)
- `since` (optional): ISO 8601 timestamp
- `until` (optional): ISO 8601 timestamp
- `types` (optional): Comma-separated event types

**Response:**
```json
{
  "baby_id": "baby_demo_1",
  "events": [
    {
      "event_id": "evt_01J3QZ8KQ2",
      "baby_id": "baby_demo_1",
      "source": "manual",
      "type": "cry",
      "ts": "2026-01-16T19:22:10Z",
      "payload": {
        "cry": {
          "intensity": 0.8,
          "duration_sec": 140,
          "pattern": "continuous",
          "pitch_hint": "high"
        }
      }
    }
  ]
}
```

---

### Create Event (Priority 3) 🟡

```bash
POST /v1/babies/:baby_id/events
```

**Request Body (Cry Event):**
```json
{
  "source": "manual",
  "type": "cry",
  "ts": "2026-01-16T19:22:10Z",
  "payload": {
    "cry": {
      "intensity": 0.8,
      "duration_sec": 140,
      "pattern": "continuous",
      "pitch_hint": "high"
    }
  }
}
```

**Response:**
```json
{
  "event_id": "evt_01J3QZ8KQ2",
  "stored": true
}
```

---

## Authentication

### Demo Key (Development/Testing)
```bash
curl -H "X-Demo-Key: demo" http://localhost:3000/v1/health
```

### JWT Bearer Token (Production)
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/v1/health
```

---

## Testing

### Test with Sample Data

```bash
# Seed database
npm run seed

# Test analyze endpoint
curl -X POST http://localhost:3000/v1/babies/baby_demo_1/analyze \
  -H "X-Demo-Key: demo" \
  -H "Content-Type: application/json" \
  -d '{"window_min": 360}'

# Test frontend format
curl -X POST "http://localhost:3000/v1/babies/baby_demo_1/analyze?format=frontend" \
  -H "X-Demo-Key: demo" \
  -H "Content-Type: application/json" \
  -d '{"window_min": 360}'

# List events
curl http://localhost:3000/v1/babies/baby_demo_1/events?limit=10 \
  -H "X-Demo-Key: demo"
```

### Run Tests
```bash
npm test
```

---

## Project Structure

```
cryflow-backend/
├── src/
│   ├── config/
│   │   └── database.js          # MongoDB connection
│   ├── controllers/
│   │   ├── analysisController.js # Analysis endpoint logic
│   │   └── eventController.js    # Event CRUD logic
│   ├── middleware/
│   │   ├── auth.js               # Authentication
│   │   └── requestId.js          # Request tracing
│   ├── models/
│   │   ├── Event.js              # Event schema
│   │   └── Analysis.js           # Analysis schema
│   ├── routes/
│   │   └── index.js              # API routes
│   ├── services/
│   │   ├── analysisService.js    # Main analysis logic
│   │   ├── hypothesisGenerator.js # Hypothesis generation
│   │   └── suggestionGenerator.js # Suggestion generation
│   ├── utils/
│   │   ├── eventValidator.js     # Event validation
│   │   └── signalComputer.js     # Signal computation
│   └── server.js                 # Express app
├── scripts/
│   └── seedDatabase.js           # Database seeding
├── .env.example                  # Environment template
├── package.json
└── README_BACKEND.md
```

---

## Environment Variables

```bash
# Server
NODE_ENV=development
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/cryflow

# Authentication
JWT_SECRET=your-secret-key
DEMO_API_KEY=demo

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://yourapp.retool.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Hypothesis Labels

### Backend Labels (OpenAPI)
- `hunger`
- `overtired`
- `discomfort`
- `needs_burp_or_gas`
- `overstimulated`
- `wants_contact`
- `unknown`

### Frontend Labels (Transformed)
- `hunger` ← hunger
- `sleepy` ← overtired
- `discomfort` ← discomfort, needs_burp_or_gas
- `overstimulated` ← overstimulated
- `needs_soothing` ← wants_contact
- `dirty_diaper` ← inferred from signals
- `unknown` ← unknown

---

## Non-Medical Compliance

### ✅ Allowed Terms
- "care suggestions"
- "contextual insights"
- "hunger", "sleepy", "discomfort"

### ❌ Forbidden Terms
- "diagnosis", "treatment"
- "colic", "reflux", "illness"

### 🔒 Mandatory
Every suggestion includes:
```
"safety_note": "This is non-medical guidance. Consult pediatrician for concerns."
```

---

## Deployment

### Local Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Docker (Optional)
```bash
docker build -t cryflow-backend .
docker run -p 3000:3000 --env-file .env cryflow-backend
```

---

## Troubleshooting

### MongoDB Connection Error
```bash
# Check MongoDB is running
mongosh

# Or start MongoDB
mongod --dbpath /path/to/data
```

### Port Already in Use
```bash
# Change PORT in .env
PORT=3001
```

### No Events Found
```bash
# Seed database
npm run seed
```

---

## Next Steps

1. ✅ Backend implementation complete
2. 🔄 Connect Retool frontend to API
3. 🧪 Test end-to-end flow
4. 🚀 Deploy to production
5. 📊 Add monitoring and logging

---

## Support

For issues or questions:
- Check documentation: `BACKEND_CONTRACT.md`, `DATA_SCHEMA.md`
- Review architecture: `ARCHITECTURE.md`
- See implementation guide: `IMPLEMENTATION_SUMMARY.md`

---

**CryFlow Backend v0.1.0** - Non-medical caregiver support system 🍼
