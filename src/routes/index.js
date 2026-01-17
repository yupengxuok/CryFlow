/**
 * API Routes
 */
const express = require('express');
const { analyzeBabyHandler } = require('../controllers/analysisController');
const { listEventsHandler, createEventHandler } = require('../controllers/eventController');

const router = express.Router();

// Health check
router.get('/v1/health', (req, res) => {
  res.json({
    ok: true,
    ts: new Date().toISOString()
  });
});

// Analysis endpoint (Priority 1)
router.post('/v1/babies/:baby_id/analyze', analyzeBabyHandler);

// Event endpoints (Priority 2 & 3)
router.get('/v1/babies/:baby_id/events', listEventsHandler);
router.post('/v1/babies/:baby_id/events', createEventHandler);

// Action endpoint (Priority 4) - Placeholder
router.post('/v1/babies/:baby_id/actions', (req, res) => {
  res.json({
    action_id: `act_${Date.now()}`,
    status: 'accepted',
    ui_hint: {
      type: 'toast',
      message: 'Action recorded'
    }
  });
});

// Senso import endpoint (Priority 5) - Placeholder
router.post('/v1/datasets/senso/import', (req, res) => {
  res.json({
    dataset_id: `ds_${Date.now()}`,
    imported: req.body.records?.length || 0
  });
});

module.exports = router;
