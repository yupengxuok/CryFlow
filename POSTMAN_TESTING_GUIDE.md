# Postman Testing Guide

**Quick guide to test CryFlow backend with Postman**

---

## 🚀 Quick Start

### 1. Start Backend Locally

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Start MongoDB (choose one)
brew services start mongodb-community  # macOS
mongod --dbpath C:\data\db             # Windows
sudo systemctl start mongod            # Linux
docker run -d -p 27017:27017 --name mongodb mongo:6  # Docker

# Setup database
npm run setup

# Seed with sample data
npm run seed

# Start server
npm run dev
```

**Expected output:**
```
🚀 CryFlow API running on port 3000
📊 Environment: development
🔗 Health check: http://localhost:3000/v1/health
```

---

## 📋 Postman Collection

### Base Configuration

**Base URL:** `http://localhost:3000`

**Headers (for all requests):**
```
X-Demo-Key: demo
Content-Type: application/json
```

---

## 🧪 Test Requests

### 1. Health Check ✅

**Method:** `GET`  
**URL:** `{{baseUrl}}/v1/health`  
**Headers:** None required

**Expected Response:**
```json
{
  "ok": true,
  "ts": "2026-01-16T19:22:10Z"
}
```

---

### 2. Analyze Baby (Standard Format) 🧠

**Method:** `POST`  
**URL:** `{{baseUrl}}/v1/babies/baby_demo_1/analyze`  
**Headers:**
```
X-Demo-Key: demo
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "window_min": 360,
  "include_questions": true,
  "context": {
    "caregiver_note": "Baby seems fussy after feeding",
    "locale": "en-US"
  }
}
```

**Expected Response:**
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
      "confidence": 0.85,
      "ruleCount": 3,
      "matchedRules": ["H1", "H3", "H5"],
      "why": [
        "Time since last feed (210 min) exceeds typical 3-hour interval",
        "Continuous cry pattern with moderate-to-high intensity",
        "Low feeding frequency suggests insufficient intake"
      ]
    },
    {
      "label": "sleepy",
      "confidence": 0.30,
      "ruleCount": 2,
      "matchedRules": ["S1", "S3"],
      "why": [
        "Awake window exceeds age-appropriate threshold",
        "Recent nap was very short"
      ]
    }
  ],
  "suggestions": [
    {
      "title": "Try feeding",
      "steps": [
        "Offer breast or bottle",
        "Watch for feeding cues",
        "Burp after feeding"
      ],
      "safety_note": "This is non-medical guidance. Consult pediatrician for concerns."
    }
  ],
  "next_best_questions": [
    "Has baby eaten in the last 3 hours?",
    "Is baby showing other hunger cues?"
  ]
}
```

---

### 3. Analyze Baby (Frontend Format) 🎨

**Method:** `POST`  
**URL:** `{{baseUrl}}/v1/babies/baby_demo_1/analyze?format=frontend`  
**Headers:**
```
X-Demo-Key: demo
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "window_min": 360,
  "include_questions": true
}
```

**Expected Response (Retool-ready array):**
```json
[
  {
    "event_id": "507f1f77bcf86cd799439011",
    "likely_reasons": ["hunger", "sleepy"],
    "recommended_checks": [
      "Offer breast or bottle",
      "Watch for feeding cues",
      "Burp after feeding",
      "Dim lights",
      "Reduce noise"
    ],
    "confidence": 0.85,
    "explanation": "Time since last feed (210 min) exceeds typical 3-hour interval"
  },
  {
    "event_id": "507f1f77bcf86cd799439012",
    "likely_reasons": ["hunger", "sleepy"],
    "recommended_checks": [
      "Offer breast or bottle",
      "Watch for feeding cues",
      "Burp after feeding"
    ],
    "confidence": 0.85,
    "explanation": "Time since last feed (210 min) exceeds typical 3-hour interval"
  }
]
```

---

### 4. List Events 📋

**Method:** `GET`  
**URL:** `{{baseUrl}}/v1/babies/baby_demo_1/events?limit=10&type=cry`  
**Headers:**
```
X-Demo-Key: demo
```

**Query Parameters:**
- `limit`: 10 (optional, default 50)
- `offset`: 0 (optional, default 0)
- `type`: cry (optional, filter by event type)
- `since`: 2026-01-15T00:00:00Z (optional, ISO date)
- `until`: 2026-01-16T23:59:59Z (optional, ISO date)

**Expected Response:**
```json
{
  "events": [
    {
      "event_id": "507f1f77bcf86cd799439011",
      "baby_id": "baby_demo_1",
      "type": "cry",
      "ts": "2026-01-16T09:55:00.000Z",
      "cry_pattern": "continuous",
      "cry_intensity": 0.75,
      "cry_duration_sec": 180,
      "cry_pitch_hint": "low"
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 10,
    "offset": 0,
    "has_more": true
  }
}
```

---

### 5. Create Event ➕

**Method:** `POST`  
**URL:** `{{baseUrl}}/v1/babies/baby_demo_1/events`  
**Headers:**
```
X-Demo-Key: demo
Content-Type: application/json
```

**Body (Cry Event):**
```json
{
  "type": "cry",
  "ts": "2026-01-16T10:30:00.000Z",
  "cry_pattern": "continuous",
  "cry_intensity": 0.8,
  "cry_duration_sec": 120,
  "cry_pitch_hint": "high"
}
```

**Body (Feed Event):**
```json
{
  "type": "feed",
  "ts": "2026-01-16T10:00:00.000Z",
  "feed_amount_ml": 120,
  "feed_duration_min": 15,
  "feed_type": "bottle"
}
```

**Expected Response:**
```json
{
  "event_id": "507f1f77bcf86cd799439013",
  "baby_id": "baby_demo_1",
  "type": "cry",
  "ts": "2026-01-16T10:30:00.000Z",
  "created_at": "2026-01-16T10:30:05.000Z"
}
```

---

## 🔧 Postman Environment Variables

Create a Postman environment with these variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `baseUrl` | `http://localhost:3000` | Backend base URL |
| `demoKey` | `demo` | Demo API key |
| `babyId` | `baby_demo_1` | Test baby ID |

**Usage in requests:**
- URL: `{{baseUrl}}/v1/babies/{{babyId}}/analyze`
- Header: `X-Demo-Key: {{demoKey}}`

---

## 📊 Test Scenarios

### Scenario 1: Hunger Analysis

1. **Create feed event** (3+ hours ago)
2. **Create cry event** (recent, continuous pattern)
3. **Run analysis** → Should detect hunger

### Scenario 2: Sleepy Analysis

1. **Create sleep event** (woke_up, 2+ hours ago)
2. **Create cry event** (escalating pattern)
3. **Run analysis** → Should detect sleepy

### Scenario 3: Multiple Events

1. **Create multiple events** (feed, diaper, sleep, cry)
2. **Run analysis** → Should show comprehensive analysis
3. **Test frontend format** → Should return array

---

## 🚨 Common Issues & Solutions

### Issue: Connection Refused
**Solution:** Make sure backend is running on port 3000
```bash
npm run dev
```

### Issue: No Events Found
**Solution:** Seed the database
```bash
npm run seed
```

### Issue: 401 Unauthorized
**Solution:** Add demo API key header
```
X-Demo-Key: demo
```

### Issue: MongoDB Connection Error
**Solution:** Start MongoDB
```bash
# macOS
brew services start mongodb-community

# Windows
mongod --dbpath C:\data\db

# Docker
docker run -d -p 27017:27017 --name mongodb mongo:6
```

### Issue: Empty Analysis Results
**Solution:** Check if baby has events in the time window
```bash
# Check events exist
curl "http://localhost:3000/v1/babies/baby_demo_1/events?limit=5" \
  -H "X-Demo-Key: demo"
```

---

## 📁 Postman Collection JSON

Save this as `CryFlow-API.postman_collection.json`:

```json
{
  "info": {
    "name": "CryFlow API",
    "description": "Test collection for CryFlow backend API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/v1/health",
          "host": ["{{baseUrl}}"],
          "path": ["v1", "health"]
        }
      }
    },
    {
      "name": "Analyze Baby (Standard)",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "X-Demo-Key",
            "value": "{{demoKey}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"window_min\": 360,\n  \"include_questions\": true\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/v1/babies/{{babyId}}/analyze",
          "host": ["{{baseUrl}}"],
          "path": ["v1", "babies", "{{babyId}}", "analyze"]
        }
      }
    },
    {
      "name": "Analyze Baby (Frontend)",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "X-Demo-Key",
            "value": "{{demoKey}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"window_min\": 360,\n  \"include_questions\": true\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/v1/babies/{{babyId}}/analyze?format=frontend",
          "host": ["{{baseUrl}}"],
          "path": ["v1", "babies", "{{babyId}}", "analyze"],
          "query": [
            {
              "key": "format",
              "value": "frontend"
            }
          ]
        }
      }
    },
    {
      "name": "List Events",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "X-Demo-Key",
            "value": "{{demoKey}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/v1/babies/{{babyId}}/events?limit=10",
          "host": ["{{baseUrl}}"],
          "path": ["v1", "babies", "{{babyId}}", "events"],
          "query": [
            {
              "key": "limit",
              "value": "10"
            }
          ]
        }
      }
    },
    {
      "name": "Create Cry Event",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "X-Demo-Key",
            "value": "{{demoKey}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"type\": \"cry\",\n  \"ts\": \"2026-01-16T10:30:00.000Z\",\n  \"cry_pattern\": \"continuous\",\n  \"cry_intensity\": 0.8,\n  \"cry_duration_sec\": 120,\n  \"cry_pitch_hint\": \"high\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/v1/babies/{{babyId}}/events",
          "host": ["{{baseUrl}}"],
          "path": ["v1", "babies", "{{babyId}}", "events"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "demoKey",
      "value": "demo"
    },
    {
      "key": "babyId",
      "value": "baby_demo_1"
    }
  ]
}
```

---

## ✅ Quick Test Checklist

1. ✅ Health check returns `{"ok": true}`
2. ✅ List events returns sample data (112 events)
3. ✅ Standard analysis returns hypotheses and suggestions
4. ✅ Frontend analysis returns array of AnalysisResult objects
5. ✅ Create event returns success with event_id
6. ✅ All responses include proper headers and status codes

---

**You're ready to test!** 🚀

Import the collection into Postman and start testing the CryFlow API locally.