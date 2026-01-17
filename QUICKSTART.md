# CryFlow Quick Start Guide

Get the backend running in 5 minutes! 🚀

---

## Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **MongoDB 6+** - [Download](https://www.mongodb.com/try/download/community)

---

## Step 1: Install Dependencies

```bash
npm install
```

---

## Step 2: Configure Environment

```bash
# Copy environment template
cp .env.example .env
```

**Edit `.env` file:**
```bash
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/cryflow
DEMO_API_KEY=demo
```

---

## Step 3: Start MongoDB

### macOS (Homebrew)
```bash
brew services start mongodb-community
```

### Windows
```bash
mongod --dbpath C:\data\db
```

### Linux
```bash
sudo systemctl start mongod
```

### Docker
```bash
docker run -d -p 27017:27017 --name mongodb mongo:6
```

---

## Step 4: Setup Database

```bash
npm run setup
```

**Expected output:**
```
🔧 Starting database setup...
✅ Connected to MongoDB
✅ Created events collection
✅ Created analyses collection
✅ Created actions collection

📊 Creating indexes for events...
✅ Events indexes created

📊 Creating indexes for analyses...
✅ Analyses indexes created

📊 Creating indexes for actions...
✅ Actions indexes created

📋 Index Summary:
   events: 5 indexes
   analyses: 4 indexes
   actions: 4 indexes

✨ Database setup complete!
```

---

## Step 5: Seed Database

```bash
npm run seed
```

**Expected output:**
```
🌱 Starting database seed...
✅ Connected to MongoDB
🗑️  Cleared 0 existing events
📄 Parsed 112 events from CSV
✅ Inserted 112 events

📊 Event Summary:
   sleep: 35
   feed: 30
   cry: 25
   diaper: 20
   note: 2

👶 Baby IDs: baby_demo_1, baby_demo_2

✨ Database seeding complete!
```

---

## Step 6: Start Server

```bash
npm run dev
```

**Expected output:**
```
🚀 CryFlow API running on port 3000
📊 Environment: development
🔗 Health check: http://localhost:3000/v1/health
```

---

## Step 7: Test API

### Health Check
```bash
curl http://localhost:3000/v1/health
```

**Response:**
```json
{
  "ok": true,
  "ts": "2026-01-16T19:22:10Z"
}
```

### Analyze Baby Events
```bash
curl -X POST http://localhost:3000/v1/babies/baby_demo_1/analyze \
  -H "X-Demo-Key: demo" \
  -H "Content-Type: application/json" \
  -d '{"window_min": 360}'
```

**Response:**
```json
{
  "analysis_id": "ana_xyz123",
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
      "why": ["Long time since last feed suggests hunger"]
    }
  ],
  "suggestions": [
    {
      "title": "Try feeding",
      "steps": ["Offer breast or bottle", "Ensure comfortable position"],
      "safety_note": "This is non-medical guidance. Consult pediatrician for concerns."
    }
  ],
  "next_best_questions": ["Has baby eaten in the last 3 hours?"]
}
```

### Get Frontend Format
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
    "event_id": "50",
    "likely_reasons": ["hunger", "sleepy"],
    "recommended_checks": ["Offer breast or bottle", "Ensure comfortable position"],
    "confidence": 0.62,
    "explanation": "Long time since last feed suggests hunger"
  }
]
```

### List Events
```bash
curl "http://localhost:3000/v1/babies/baby_demo_1/events?limit=5" \
  -H "X-Demo-Key: demo"
```

---

## Step 8: Connect Frontend

### Retool Configuration

1. **Open Retool** → Resources → Add REST API
2. **Base URL:** `http://localhost:3000`
3. **Headers:**
   ```
   X-Demo-Key: demo
   Content-Type: application/json
   ```

4. **Create Query:** `analyzeCryEventsAPI`
   - **Method:** POST
   - **URL:** `/v1/babies/baby_demo_1/analyze?format=frontend`
   - **Body:**
     ```json
     {
       "window_min": 360,
       "include_questions": true
     }
     ```

5. **Replace `runAnalysisScript`:**
   ```javascript
   // Old: runAnalysisScript.trigger()
   // New:
   analyzeCryEventsAPI.trigger();
   ```

6. **On Success:**
   ```javascript
   analysisResultsVariable.setValue(analyzeCryEventsAPI.data);
   ```

---

## Troubleshooting

### MongoDB Connection Error
```bash
# Check MongoDB is running
mongosh

# If not running, start it (see Step 3)
```

### Port 3000 Already in Use
```bash
# Change port in .env
PORT=3001

# Restart server
npm run dev
```

### No Events Found
```bash
# Re-seed database
npm run seed
```

### Module Not Found
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

## Next Steps

✅ **Backend is running!**

Now you can:
1. 🔗 Connect Retool frontend to API
2. 🧪 Test end-to-end flow
3. 📊 Monitor analysis results
4. 🚀 Deploy to production

---

## Useful Commands

```bash
# Development
npm run dev          # Start with auto-reload
npm start            # Start production server

# Database
npm run seed         # Load sample data

# Testing
npm test             # Run tests
npm run test:watch   # Watch mode

# Code Quality
npm run lint         # Check code style
npm run lint:fix     # Fix code style
```

---

## API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/v1/health` | Health check |
| POST | `/v1/babies/:baby_id/analyze` | Analyze events |
| GET | `/v1/babies/:baby_id/events` | List events |
| POST | `/v1/babies/:baby_id/events` | Create event |

---

## Documentation

- **Backend API:** `README_BACKEND.md`
- **API Contract:** `BACKEND_CONTRACT.md`
- **Data Schema:** `DATA_SCHEMA.md`
- **Architecture:** `ARCHITECTURE.md`
- **Implementation:** `IMPLEMENTATION_SUMMARY.md`

---

**You're all set!** 🎉

The CryFlow backend is now running and ready to analyze baby cry events.
