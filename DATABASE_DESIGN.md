# CryFlow Database Design

**Version:** 1.0.0  
**Database:** MongoDB 6+  
**Last Updated:** 2026-01-16

---

## Overview

CryFlow uses MongoDB for flexible schema design, time-series optimization, and horizontal scalability. The data model supports:

- ✅ Event timeline queries (time-windowed analysis)
- ✅ Analysis auditability (why suggestions were made)
- ✅ Caregiver action tracking (feedback loop)
- ✅ GDPR/CCPA compliance (data deletion)
- ✅ Hot/warm/cold data tiering (TTL archival)

---

## Collections

### 1. babies
**Purpose:** Baby profiles and metadata

```javascript
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "baby_id": "baby_demo_1",              // Business key (indexed, unique)
  "display_name": "Baby Alex",           // Optional friendly name
  "birth_date": ISODate("2025-10-15"),   // For age-based analysis
  "created_at": ISODate("2026-01-01T00:00:00Z"),
  "updated_at": ISODate("2026-01-16T19:22:10Z"),
  
  // Optional metadata
  "metadata": {
    "weight_kg": 5.2,                    // Latest weight
    "gestational_age_weeks": 40,         // Premature adjustments
    "timezone": "America/Los_Angeles",   // Circadian analysis
    "primary_caregiver_id": "user_abc123"
  },
  
  // Computed stats (updated periodically)
  "stats": {
    "total_events": 112,
    "last_event_at": ISODate("2026-01-16T18:45:00Z"),
    "avg_feed_interval_min": 185,
    "avg_sleep_duration_min": 45
  },
  
  // Soft delete support
  "deleted_at": null,
  "schema_version": "1.0.0"
}
```

**Indexes:**
```javascript
db.babies.createIndex({ "baby_id": 1 }, { unique: true });
db.babies.createIndex({ "created_at": 1 });
db.babies.createIndex({ "deleted_at": 1 });
```

---

### 2. events
**Purpose:** Immutable event log (append-only)

```javascript
{
  "_id": ObjectId("507f1f77bcf86cd799439012"),
  "baby_id": "baby_demo_1",              // Foreign key to babies
  "source": "manual",                    // "manual" | "device" | "agent"
  "type": "cry",                         // "cry" | "feed" | "diaper" | "sleep" | "note"
  "ts": ISODate("2026-01-16T19:22:10Z"), // Event occurrence timestamp
  "created_at": ISODate("2026-01-16T19:22:15Z"), // Server ingestion time
  
  // Type-discriminated payload
  "cry_pattern": "continuous",           // Only for cry events
  "cry_pitch_hint": "high",
  "cry_intensity": 0.8,
  "cry_duration_sec": 140,
  
  "feed_method": null,                   // Only for feed events
  "feed_amount_ml": null,
  "feed_notes": null,
  
  "diaper_wet": null,                    // Only for diaper events
  "diaper_dirty": null,
  "diaper_notes": null,
  
  "sleep_state": null,                   // Only for sleep events
  "sleep_notes": null,
  
  "note_text": null,                     // Only for note events
  
  // Metadata for auditability
  "metadata": {
    "user_agent": "CryFlow-iOS/1.2.0",
    "device_id": "iphone_xyz",
    "correlation_id": "req_01J3R2ABC"
  },
  
  // Soft delete (never physically delete for audit trail)
  "deleted_at": null,
  "archived": false,
  "archived_at": null,
  "schema_version": "1.0.0"
}
```

**Indexes:**
```javascript
// PRIMARY: Time-windowed queries by baby
db.events.createIndex(
  { "baby_id": 1, "ts": -1 },
  { name: "baby_timeline_idx" }
);

// SECONDARY: Event type filtering
db.events.createIndex(
  { "baby_id": 1, "type": 1, "ts": -1 },
  { name: "baby_type_timeline_idx" }
);

// CREATED_AT: Ingestion monitoring
db.events.createIndex({ "created_at": 1 });

// SOFT DELETE FILTER (partial index for performance)
db.events.createIndex(
  { "baby_id": 1, "ts": -1 },
  {
    partialFilterExpression: { deleted_at: null },
    name: "active_events_idx"
  }
);

// TTL INDEX: Auto-archive old events after 90 days
db.events.createIndex(
  { "created_at": 1 },
  { expireAfterSeconds: 7776000, name: "ttl_90_days" }
);
```

**Query Examples:**
```javascript
// Get last 50 events for baby (uses baby_timeline_idx)
db.events.find({
  baby_id: "baby_demo_1",
  deleted_at: null
})
.sort({ ts: -1 })
.limit(50);

// Get cry events in last 6 hours (uses baby_type_timeline_idx)
db.events.find({
  baby_id: "baby_demo_1",
  type: "cry",
  ts: { $gte: ISODate("2026-01-16T13:22:10Z") },
  deleted_at: null
})
.sort({ ts: -1 });
```

---

### 3. analyses
**Purpose:** Immutable analysis results for auditability

```javascript
{
  "_id": ObjectId("507f1f77bcf86cd799439013"),
  "analysis_id": "ana_01J3QZ9ABC",       // Business key (indexed, unique)
  "baby_id": "baby_demo_1",              // Foreign key to babies
  "ts": ISODate("2026-01-16T19:22:10Z"), // Analysis execution timestamp
  "created_at": ISODate("2026-01-16T19:22:11Z"),
  
  // Analysis request parameters (for reproducibility)
  "window_min": 360,
  "caregiver_note": "Baby woke up 10 min ago.",
  "locale": "en-US",
  
  // Event references analyzed (for audit trail)
  "analyzed_events": [
    { "event_id": "evt_01J3QZ8KQ2", "type": "cry", "ts": ISODate("2026-01-16T19:22:10Z") },
    { "event_id": "evt_01J3QZ8KQ1", "type": "feed", "ts": ISODate("2026-01-16T16:17:00Z") }
  ],
  
  // Computed signals (what the algorithm saw)
  "signals": {
    "time_since_last_feed_min": 185,
    "time_since_last_diaper_min": 95,
    "recent_sleep_min": 22,
    "awake_window_min": 22,
    "cry_duration_sec": 140,
    "cry_count_last_hour": 1,
    "cry_escalation": "escalating"
  },
  
  // Hypotheses (ordered by confidence DESC)
  "hypotheses": [
    {
      "label": "hunger",
      "confidence": 0.62,
      "why": [
        "Time since last feed (185 min) exceeds typical 3-hour interval",
        "Continuous cry pattern consistent with hunger cue"
      ],
      "supporting_signals": ["time_since_last_feed_min", "cry_pattern_mode"]
    }
  ],
  
  // Actionable suggestions
  "suggestions": [
    {
      "title": "Try feeding",
      "steps": [
        "Offer breast or bottle",
        "Ensure comfortable feeding position"
      ],
      "safety_note": "This is non-medical guidance. Consult pediatrician for concerns.",
      "linked_hypotheses": ["hunger"]
    }
  ],
  
  // Follow-up questions
  "next_best_questions": [
    "Has baby eaten in the last 3 hours?"
  ],
  
  // Model version for reproducibility
  "model_version": "cryflow-v0.1.0",
  "algorithm": "rule_based_heuristic",
  
  // Performance metadata
  "execution_time_ms": 45,
  "events_processed": 12,
  
  // Linked cry event
  "cry_event_id": ObjectId("507f1f77bcf86cd799439012"),
  
  "schema_version": "1.0.0"
}
```

**Indexes:**
```javascript
// PRIMARY: Query analyses by baby over time
db.analyses.createIndex(
  { "baby_id": 1, "ts": -1 },
  { name: "baby_analysis_timeline_idx" }
);

// SECONDARY: Unique analysis_id lookups
db.analyses.createIndex(
  { "analysis_id": 1 },
  { unique: true, name: "analysis_id_unique_idx" }
);

// TERTIARY: Find analyses that processed a specific event
db.analyses.createIndex(
  { "analyzed_events.event_id": 1 },
  { name: "event_reference_idx" }
);

// HYPOTHESIS QUERIES: Find analyses with specific hypotheses
db.analyses.createIndex(
  { "baby_id": 1, "hypotheses.label": 1, "ts": -1 },
  { name: "hypothesis_label_idx" }
);

// TTL: Archive old analyses after 180 days
db.analyses.createIndex(
  { "created_at": 1 },
  { expireAfterSeconds: 15552000, name: "ttl_180_days" }
);
```

**Query Examples:**
```javascript
// Get recent analyses for baby
db.analyses.find({ baby_id: "baby_demo_1" })
  .sort({ ts: -1 })
  .limit(10);

// Find all analyses that concluded "hunger" hypothesis
db.analyses.find({
  baby_id: "baby_demo_1",
  "hypotheses.label": "hunger",
  "hypotheses.confidence": { $gte: 0.5 }
});

// Audit trail: What analyses used event X?
db.analyses.find({
  "analyzed_events.event_id": "evt_01J3QZ8KQ2"
});
```

---

### 4. actions
**Purpose:** Caregiver actions taken (for feedback loop)

```javascript
{
  "_id": ObjectId("507f1f77bcf86cd799439014"),
  "action_id": "act_01J3R0XYZ",          // Business key (indexed, unique)
  "baby_id": "baby_demo_1",
  "analysis_id": "ana_01J3QZ9ABC",       // Foreign key: which analysis triggered this
  "ts": ISODate("2026-01-16T19:25:00Z"), // Action execution timestamp
  "created_at": ISODate("2026-01-16T19:25:01Z"),
  
  // Action type
  "action": "log_feeding_attempt",       // "log_feeding_attempt" | "start_timer" | "open_checklist"
  
  // Action-specific parameters
  "params": {
    "timer_min": 10,
    "notes": "Baby accepted bottle"
  },
  
  // Outcome tracking (updated later)
  "outcome": {
    "status": "completed",               // "completed" | "skipped" | "failed"
    "completed_at": ISODate("2026-01-16T19:35:00Z"),
    "follow_up_event_id": "evt_01J3R1ABC",
    "caregiver_feedback": "Baby calmed down after feeding"
  },
  
  // UI hint for frontend
  "ui_hint": {
    "type": "toast",
    "message": "Timer started for 10 minutes"
  },
  
  // Source tracking
  "source": "retool_dashboard",
  "user_id": "user_abc123",
  
  "schema_version": "1.0.0"
}
```

**Indexes:**
```javascript
// PRIMARY: Query actions by baby
db.actions.createIndex(
  { "baby_id": 1, "ts": -1 },
  { name: "baby_actions_timeline_idx" }
);

// SECONDARY: Link actions to analyses
db.actions.createIndex(
  { "analysis_id": 1 },
  { name: "analysis_actions_idx" }
);

// TERTIARY: Unique action_id
db.actions.createIndex(
  { "action_id": 1 },
  { unique: true, name: "action_id_unique_idx" }
);

// OUTCOME QUERIES: Find completed/failed actions
db.actions.createIndex(
  { "baby_id": 1, "outcome.status": 1, "ts": -1 },
  { name: "action_outcome_idx" }
);

// TTL: Archive old actions after 90 days
db.actions.createIndex(
  { "created_at": 1 },
  { expireAfterSeconds: 7776000, name: "ttl_90_days" }
);
```

---

## Index Strategy

### ESR Rule (Equality → Sort → Range)

```javascript
// GOOD: Equality on baby_id, sort on ts
{ "baby_id": 1, "ts": -1 }

// BAD: Sort before equality
{ "ts": -1, "baby_id": 1 }
```

### Partial Indexes for Soft Deletes

```javascript
// Only index non-deleted documents
db.events.createIndex(
  { "baby_id": 1, "ts": -1 },
  {
    partialFilterExpression: { deleted_at: null },
    name: "active_events_idx"
  }
);
```

### Index Monitoring

```javascript
// Monitor index usage
db.events.aggregate([{ $indexStats: {} }]);

// Check slow queries
db.setProfilingLevel(1, { slowms: 100 });
db.system.profile.find().sort({ ts: -1 }).limit(10);

// Analyze explain plans
db.events.find({ baby_id: "baby_demo_1" })
  .sort({ ts: -1 })
  .explain("executionStats");
```

---

## TTL & Archival Strategy

### Data Tiers

| Tier | Age | Storage | Query Pattern | TTL |
|------|-----|---------|---------------|-----|
| Hot | 0-7 days | MongoDB (RAM + SSD) | Real-time analysis | No TTL |
| Warm | 7-90 days | MongoDB (SSD only) | Historical analysis | No TTL |
| Cold | 90+ days | S3/Glacier | Compliance, rare queries | 90 days |

### Implementation

```javascript
// 1. TTL Indexes (automatic deletion)
db.events.createIndex(
  { "created_at": 1 },
  { expireAfterSeconds: 7776000, name: "ttl_events_90d" }
);

db.analyses.createIndex(
  { "created_at": 1 },
  { expireAfterSeconds: 15552000, name: "ttl_analyses_180d" }
);

// 2. Pre-archive hook (export to S3 before TTL deletion)
async function archiveOldDocuments() {
  const cutoffDate = new Date(Date.now() - 85 * 24 * 60 * 60 * 1000);
  
  const toArchive = await db.events.find({
    created_at: { $lt: cutoffDate },
    archived: { $ne: true }
  }).toArray();
  
  if (toArchive.length > 0) {
    // Export to S3
    await s3.putObject({
      Bucket: 'cryflow-archive',
      Key: `events/${year}/${month}/events_${Date.now()}.json.gz`,
      Body: gzip(JSON.stringify(toArchive))
    });
    
    // Mark as archived
    await db.events.updateMany(
      { _id: { $in: toArchive.map(d => d._id) } },
      { $set: { archived: true, archived_at: new Date() } }
    );
  }
}

// 3. GDPR/CCPA Compliance: Hard delete on user request
async function deleteUserData(baby_id) {
  await db.events.deleteMany({ baby_id });
  await db.analyses.deleteMany({ baby_id });
  await db.actions.deleteMany({ baby_id });
  await db.babies.deleteOne({ baby_id });
  
  // Also delete from S3 archive
  await deleteFromS3Archive(baby_id);
}
```

---

## Performance & Scalability

### Target Latencies

- Single event by ID: < 5ms
- Event timeline (50 events): < 20ms
- Analysis computation: < 100ms
- Dashboard load (all data): < 200ms

### Vertical Scaling (Single Instance)

- **Good for:** 1-10k babies, 1M events/month
- **Limits:** RAM constraints (working set must fit in memory)

### Horizontal Scaling (Sharded Cluster)

```javascript
// Shard key: baby_id (natural partitioning)
sh.shardCollection("cryflow.events", { "baby_id": "hashed" });
sh.shardCollection("cryflow.analyses", { "baby_id": "hashed" });
sh.shardCollection("cryflow.actions", { "baby_id": "hashed" });

// Benefits:
// - Linear scalability (add shards as you grow)
// - Baby data stays co-located (no cross-shard queries)
// - Hot baby_ids automatically balanced
```

### Read Replicas

```javascript
// Send analytics queries to read replicas
const client = new MongoClient(uri, {
  readPreference: 'secondaryPreferred'
});
```

### Caching Strategy (Redis)

```javascript
// Cache hot data in Redis (TTL: 5 minutes)
const cacheKey = `baby:${baby_id}:recent_events`;

// 1. Check cache first
let events = await redis.get(cacheKey);

if (!events) {
  // 2. Cache miss: query MongoDB
  events = await db.events.find({ baby_id })
    .sort({ ts: -1 })
    .limit(50)
    .toArray();
  
  // 3. Store in cache
  await redis.setex(cacheKey, 300, JSON.stringify(events));
}

// Invalidate cache on new event
await redis.del(`baby:${baby_id}:recent_events`);
```

---

## Migration & Deployment

### Schema Versioning

```javascript
// Add schema_version to all collections
{
  "_id": ObjectId("..."),
  "schema_version": "1.0.0",
  // ... rest of document
}

// Migration script example
async function migrateToV2() {
  const docs = await db.events.find({ schema_version: "1.0.0" });
  
  for (const doc of docs) {
    doc.schema_version = "2.0.0";
    doc.new_field = computeNewField(doc);
    
    await db.events.replaceOne({ _id: doc._id }, doc);
  }
}
```

### Backup Strategy

```bash
# 1. Continuous backup (MongoDB Atlas built-in)
# - Point-in-time recovery (PITR)
# - Automated snapshots every 6 hours

# 2. Manual backup script
mongodump --uri="mongodb://..." --out=/backups/$(date +%Y%m%d)

# 3. Test restore monthly
mongorestore --uri="mongodb://test-cluster..." --drop /backups/latest
```

---

## Setup Script

```javascript
// scripts/setupDatabase.js
async function setupDatabase() {
  // Create collections
  await db.createCollection('babies');
  await db.createCollection('events');
  await db.createCollection('analyses');
  await db.createCollection('actions');
  
  // Create indexes
  await createBabiesIndexes();
  await createEventsIndexes();
  await createAnalysesIndexes();
  await createActionsIndexes();
  
  console.log('✅ Database setup complete');
}
```

---

## Next Steps

1. ✅ MongoDB schema design complete
2. 🔄 Update Mongoose models to match schema
3. 🔄 Add schema_version field to all documents
4. 🔄 Implement archival cron job
5. 🔄 Set up monitoring for index usage
6. 🔄 Load test with 1000 babies, 100k events

---

**Database Design v1.0.0** - Production-ready MongoDB schema for CryFlow
