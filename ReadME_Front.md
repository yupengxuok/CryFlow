Baby Cry Analysis System - Frontend Documentation
Overview
This Retool application provides a non-medical caregiver support dashboard for analyzing baby cry events. The frontend displays cry event data from a database, runs analysis (currently client-side, ready for backend integration), and visualizes insights to help caregivers respond appropriately.

⚠️ Important: This system provides non-medical caregiver guidance only and should not be used for medical diagnosis.

Current Architecture
Data Flow
Retool Database (cryflow_events_sample)
    ↓
getCryEventsQuery (SQL)
    ↓
rawCryDataVariable (formatted data)
    ↓
runAnalysisScript (client-side analysis) ← **READY FOR BACKEND API REPLACEMENT**
    ↓
analysisResultsVariable
    ↓
UI Components (Alert, Tables, Charts, KPIs)
Key Components
🍼 Cry Alert Banner - Shows top 3 crying reasons with percentages
KPI Cards - Total Events, Avg Confidence, Analyzed Events
Reason Distribution Chart - Horizontal bar chart showing reason percentages
Raw Data Table - All cry events from database
Analysis Results Table - Detailed analysis per event
Database Schema
Table: cryflow_events_sample
The frontend expects this table structure in Retool Database:

Column	Type	Description
id	integer (PK)	Unique event identifier
ts	timestamptz	Event timestamp
baby_id	text	Baby identifier (e.g., "baby_demo_1")
source	text	Event source: "manual", "device", "agent"
type	text	Event type: "cry", "feed", "diaper", "sleep", "note"
cry_pattern	text	Cry pattern: "continuous", "intermittent", "escalating", ""
cry_pitch_hint	text	Pitch hint: "high", "low", ""
cry_intensity	real	Cry intensity (0.0-1.0) or null
cry_duration_sec	integer	Duration in seconds or null
feed_method	text	Feed method: "bottle", "breast", ""
feed_amount_ml	integer	Amount in ml or null
feed_notes	text	Feed notes
diaper_wet	boolean	Wet diaper flag or null
diaper_dirty	boolean	Dirty diaper flag or null
diaper_notes	text	Diaper notes
sleep_state	text	Sleep state: "asleep", "woke_up", "nap_end", ""
sleep_notes	text	Sleep notes
note_text	text	General notes
Current Query:

SELECT
  id AS event_id,
  ts AS timestamp,
  baby_id,
  source,
  type,
  cry_pattern,
  cry_pitch_hint,
  cry_intensity,
  cry_duration_sec,
  feed_method,
  feed_amount_ml,
  feed_notes,
  diaper_wet,
  diaper_dirty,
  diaper_notes,
  sleep_state,
  sleep_notes,
  note_text
FROM cryflow_events_sample
ORDER BY ts DESC
LIMIT 500;
Backend API Integration (To Be Implemented)
Replacing Client-Side Analysis with Backend API
The frontend currently uses a JavaScript-based analysis (runAnalysisScript). To integrate your backend, you'll need to:

Replace runAnalysisScript with a REST API query
Call your backend endpoint: POST /v1/babies/{baby_id}/analyze
Map the response to analysisResultsVariable
Required API Endpoint
POST /v1/babies/{baby_id}/analyze
Analyzes recent cry events and returns non-medical caregiver suggestions.

Request Headers:

Authorization: Bearer <JWT_TOKEN>
# OR
X-Demo-Key: demo
Content-Type: application/json
Request Body:

{
  "window_min": 360,
  "include_questions": true,
  "context": {
    "caregiver_note": "Baby woke up 10 min ago.",
    "locale": "en-US"
  }
}
Response Format:

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
    },
    {
      "label": "sleepy",
      "confidence": 0.30,
      "why": ["Recently woke from short nap"]
    }
  ],
  "suggestions": [
    {
      "title": "Try feeding",
      "steps": [
        "Offer breast or bottle",
        "Ensure comfortable position",
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
Frontend Data Format Requirements
Input to Backend (Cry Events)
The frontend will send cry event data to your backend. Expected format:

interface CryEvent {
  event_id: number;
  timestamp: string;  // ISO 8601 format
  baby_id: string;
  source: "manual" | "device" | "agent";
  type: "cry" | "feed" | "diaper" | "sleep" | "note";
  cry_pattern?: string;
  cry_pitch_hint?: string;
  cry_intensity?: number | null;
  cry_duration_sec?: number | null;
  feed_method?: string;
  feed_amount_ml?: number | null;
  feed_notes?: string;
  diaper_wet?: boolean | null;
  diaper_dirty?: boolean | null;
  diaper_notes?: string;
  sleep_state?: string;
  sleep_notes?: string;
  note_text?: string;
}
Output from Backend (Analysis Results)
CRITICAL: The frontend expects this exact structure:

interface AnalysisResult {
  event_id: string;           // Required: links to cry event
  likely_reasons: string[];   // Required: array of reason labels
  recommended_checks: string[]; // Required: array of caregiver actions
  confidence: number;         // Required: 0.0 to 1.0
  explanation: string;        // Required: short sentence explaining reasoning
}
Allowed Reason Labels (must use these exact values):

"hunger"
"dirty_diaper"
"sleepy"
"overstimulated"
"discomfort"
"needs_soothing"
"unknown"
Example Response for Frontend:

[
  {
    "event_id": "50",
    "likely_reasons": ["hunger", "sleepy"],
    "recommended_checks": [
      "Offer feeding",
      "Check if hungry",
      "Create calm environment for sleep"
    ],
    "confidence": 0.75,
    "explanation": "Long time since last feed suggests hunger"
  },
  {
    "event_id": "49",
    "likely_reasons": ["dirty_diaper"],
    "recommended_checks": [
      "Check diaper",
      "Change if needed"
    ],
    "confidence": 0.85,
    "explanation": "Extended time since diaper change"
  }
]
Frontend Variables & Data Binding
Key Variables
rawCryDataVariable

Source: {{ formatDataAsArray(getCryEventsQuery.data) }}
Type: Array of cry events
Used by: Raw Data Table, Total Events KPI
analysisResultsVariable

Source: Set by runAnalysisScript (or future backend API)
Type: Array of analysis results
Used by: Alert Banner, Results Table, Chart, KPIs
Transformers
topReasonsTransformer

Calculates top 3 reasons with percentages
Powers the alert banner text
reasonDistributionTransformer

Aggregates reason counts and percentages
Powers the bar chart
API Integration Steps
Step 1: Create REST API Resource in Retool
Go to Retool Resources
Create new REST API resource
Set Base URL: https://api.example.com (replace with your backend URL)
Add authentication headers as needed
Step 2: Replace Analysis Script with API Query
Current (Client-side):

// runAnalysisScript.js
const data = rawCryDataVariable.value;
// ... analysis logic ...
analysisResultsVariable.setValue(results);
New (Backend API):
Create a new REST API query called analyzeCryEventsAPI:

Endpoint: POST /v1/babies/baby_demo_1/analyze

Request Body:

{
  "events": {{ rawCryDataVariable.value }},
  "window_min": 360,
  "include_questions": true
}
Transform Response:

// Map backend response to frontend format
return data.results.map(result => ({
  event_id: result.event_id,
  likely_reasons: result.hypotheses.map(h => h.label),
  recommended_checks: result.suggestions.flatMap(s => s.steps),
  confidence: result.hypotheses[0]?.confidence || 0.5,
  explanation: result.hypotheses[0]?.why[0] || "Analysis complete"
}));
On Success Handler:

analysisResultsVariable.setValue(analyzeCryEventsAPI.data);
Step 3: Update Auto-Run Logic
Modify autoRunAnalysisOnDataLoad:

const data = rawCryDataVariable.value;
if (!data || data.length === 0) {
  return 'No data to analyze yet';
}

// Trigger backend API instead
analyzeCryEventsAPI.trigger();

return `Triggered analysis for ${data.length} events.`;
OpenAPI Specification
Your backend should follow the WhyMyBabyCries API v0.1.0 specification you provided. Key endpoints:

Core Endpoints
Method	Endpoint	Purpose
GET	/v1/health	Health check
POST	/v1/babies/{baby_id}/events	Create new event
GET	/v1/babies/{baby_id}/events	Get event timeline
POST	/v1/babies/{baby_id}/analyze	Analyze events (CRITICAL)
POST	/v1/babies/{baby_id}/actions	Record caregiver action
POST	/v1/datasets/senso/import	Import synthetic patterns
Testing the Integration
1. Test with Sample Data
Use the existing 112 events in cryflow_events_sample table.

2. Expected Behavior
When data loads:

getCryEventsQuery fetches events
rawCryDataVariable populates (112 events)
autoRunAnalysisOnDataLoad triggers
Backend API analyzes events
analysisResultsVariable receives results
UI updates:
Alert banner shows top reasons
KPIs show counts and confidence
Chart displays distribution
Results table shows details
3. Verify Data Flow
Check browser console:

// Should see 112 events
rawCryDataVariable.value

// Should see 112 analysis results
analysisResultsVariable.value

// Should see top 3 reasons
topReasonsTransformer.value
Export & GitHub Integration
Option 1: Export JSON
Click ... menu in top-right
Select "Export as JSON"
Save to your GitHub repo
Track versions with Git
Option 2: Retool Source Control (Enterprise)
Requires Retool Enterprise plan
Direct GitHub integration
Branch-based development
PR-based deployments
Environment Variables (Backend)
Your backend should support these configurations:

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# API Keys
RETOOL_API_KEY=your_retool_api_key
OPENAI_API_KEY=your_openai_key  # if using AI models
SENSO_API_KEY=your_senso_key    # for Senso.ai integration

# CORS
ALLOWED_ORIGINS=https://yourapp.retool.com

# Auth
JWT_SECRET=your_jwt_secret
DEMO_API_KEY=demo  # for hackathon testing
Next Steps
✅ Build Backend API following OpenAPI spec
✅ Implement /v1/babies/{baby_id}/analyze endpoint
✅ Test with Postman/curl using sample cry events
✅ Update Retool to call your backend API
✅ Test end-to-end flow
Support & Questions
Frontend Issues: Check Retool app logs and browser console
Backend Issues: Check API logs and response format
Data Format Issues: Verify JSON structure matches TypeScript interfaces above
Demo Data: The app includes 112 sample events for testing. Baby ID: baby_demo_1

License & Disclaimer
⚠️ Medical Disclaimer: This application provides non-medical caregiver support only. Always consult a pediatrician for medical concerns about your baby.

Privacy: Handle baby data with care. Implement proper authentication and encryption in production.

Last Updated: 2026-01-16
Frontend Version: 1.0.0
Backend API Version: 0.1.0