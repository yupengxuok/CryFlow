# CryFlow Quick Reference Card

**Backend API - Essential Commands & Examples**

---

## 🚀 Quick Start

```bash
# 1. Install & Configure
npm install
cp .env.example .env

# 2. Setup Database
npm run setup

# 3. Seed Sample Data
npm run seed

# 4. Start Server
npm run dev

# 5. Test
curl http://localhost:3000/v1/health
```

---

## 📡 API Endpoints

### Health Check
```bash
GET /v1/health
```

### Analyze Baby Events
```bash
# OpenAPI Format (default)
POST /v1/babies/{baby_id}/analyze

# Frontend Format (Retool)
POST /v1/babies/{baby_id}/analyze?format=frontend
```

### List Events
```bash
GET /v1/babies/{baby_id}/events?limit=50&types=cry,feed
```

### Create Event
```bash
POST /v1/babies/{baby_id}/events
```

---

## 🔑 Authentication

```bash
# Demo Key (Development)
-H "X-Demo-Key: demo"

# JWT (Production)
-H "Authorization: Bearer <token>"
```

---

## 📊 Analysis Examples

### OpenAPI Format
```bash
curl -X POST http://localhost:3000/v1/babies/baby_demo_1/analyze \
  -H "X-Demo-Key: demo" \
  -H "Content-Type: application/json" \
  -d '{"window_min": 360}'
```

**Response:**
```json
{
  "analysis_id": "ana_xyz",
  "hypotheses": [
    {"label": "hunger", "confidence": 0.62, "why": [...]}
  ],
  "suggestions": [
    {"title": "Try feeding", "steps": [...]}
  ]
}
```

---

### Frontend Format (Retool)
```bash
curl -X POST "http://localhost:3000/v1/babies/baby_demo_1/analyze?format=frontend" \
  -H "X-Demo-Key: demo" \
  -H "Content-Type: application/json" \
  -d '{"window_min": 360}'
```

**Response:**
```json
[
  {
    "event_id": "67890abcdef",
    "likely_reasons": ["hunger", "sleepy"],
    "recommended_checks": ["Offer breast or bottle", "..."],
    "confidence": 0.62,
    "explanation": "Long time since last feed"
  }
]
```

---

## 🏷️ Label Mapping

| Backend | Frontend |
|---------|----------|
| `hunger` | `hunger` |
| `overtired` | `sleepy` |
| `discomfort` | `discomfort` |
| `overstimulated` | `overstimulated` |
| `wants_contact` | `needs_soothing` |
| `unknown` | `unknown` |
| (inferred) | `dirty_diaper` |

---

## 📁 Project Structure

```
cryflow-backend/
├── src/
│   ├── controllers/     # API endpoint handlers
│   ├── models/          # MongoDB schemas
│   ├── services/        # Business logic
│   ├── utils/           # Validators, signal computer
│   └── server.js        # Express app
├── scripts/
│   ├── setupDatabase.js # Create indexes
│   └── seedDatabase.js  # Load sample data
└── .env                 # Configuration
```

---

## 🗄️ Database Collections

1. **babies** - Baby profiles
2. **events** - Event timeline (cry/feed/diaper/sleep/note)
3. **analyses** - Analysis audit trail
4. **actions** - Caregiver actions

---

## 🔧 Useful Commands

```bash
# Development
npm run dev          # Start with auto-reload
npm start            # Production server

# Database
npm run setup        # Create collections & indexes
npm run seed         # Load 112 sample events

# Testing
npm test             # Run tests
npm run test:watch   # Watch mode

# Code Quality
npm run lint         # Check code style
npm run lint:fix     # Fix code style
```

---

## 📊 Sample Data

- **112 events** loaded from CSV
- **2 babies:** baby_demo_1, baby_demo_2
- **Event types:** cry (25), feed (30), diaper (20), sleep (35), note (2)
- **Date:** 2026-01-16

---

## 🎯 Response Formats

### When to Use Each

**OpenAPI Format:**
- API consumers
- ML training
- Analytics
- Audit trail

**Frontend Format:**
- Retool dashboard
- Mobile app
- Quick insights
- Bandwidth sensitive

---

## 🔍 Debugging

### Check MongoDB Connection
```bash
mongosh
use cryflow
db.events.countDocuments()
```

### View Recent Analyses
```bash
mongosh
use cryflow
db.analyses.find().sort({ts: -1}).limit(5).pretty()
```

### Check Indexes
```bash
mongosh
use cryflow
db.events.getIndexes()
```

---

## 🚨 Troubleshooting

### Port Already in Use
```bash
# Change PORT in .env
PORT=3001
```

### MongoDB Connection Error
```bash
# Check MongoDB is running
mongosh

# Or start MongoDB
# macOS: brew services start mongodb-community
# Windows: mongod --dbpath C:\data\db
# Docker: docker run -d -p 27017:27017 mongo:6
```

### No Events Found
```bash
# Re-seed database
npm run seed
```

---

## 📚 Documentation

- `QUICKSTART.md` - 5-minute setup
- `README_BACKEND.md` - Complete API docs
- `BACKEND_CONTRACT.md` - Frontend integration
- `DATABASE_DESIGN.md` - Schema reference
- `API_CONTRACT_VALIDATION.md` - Format comparison
- `ARCHITECTURE.md` - System design

---

## 🎯 Next Steps

1. ✅ Backend running locally
2. 🔄 Connect Retool frontend
3. 🧪 Test end-to-end flow
4. 🚀 Deploy to production

---

## 💡 Pro Tips

- Use `?format=frontend` for Retool
- Demo key works for local testing
- Sample data has 2 babies for testing
- Check logs for debugging
- Use MongoDB Compass for visual DB inspection

---

**CryFlow Backend v0.1.0** - Ready for production! 🚀
