/**
 * Analysis Controller
 * Handles analysis endpoint requests
 */
const Joi = require('joi');
const Event = require('../models/Event');
const { analyzeBaby, transformToFrontendFormat } = require('../services/analysisService');

// Validation schema for analyze request
const analyzeRequestSchema = Joi.object({
  window_min: Joi.number().integer().min(5).max(1440).default(360),
  include_questions: Joi.boolean().default(true),
  context: Joi.object({
    caregiver_note: Joi.string().max(2000).allow('', null),
    locale: Joi.string().max(32).allow('', null)
  }).default({})
});

/**
 * POST /v1/babies/:baby_id/analyze
 * Analyze baby events and return insights
 */
async function analyzeBabyHandler(req, res) {
  try {
    const { baby_id } = req.params;
    
    // Validate request body
    const { error, value } = analyzeRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: error.details[0].message,
          request_id: req.id
        }
      });
    }
    
    // Validate baby_id
    if (!baby_id || baby_id.length > 128) {
      return res.status(400).json({
        error: {
          code: 'bad_request',
          message: 'Invalid baby_id',
          request_id: req.id
        }
      });
    }
    
    // Check if baby exists (has any events)
    const eventCount = await Event.countDocuments({ baby_id });
    if (eventCount === 0) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Baby not found or has no events',
          request_id: req.id
        }
      });
    }
    
    // Perform analysis
    const analysisResult = await analyzeBaby(baby_id, value);
    
    // Check if frontend format is requested
    const acceptFrontendFormat = req.query.format === 'frontend' || 
                                 req.headers['x-frontend-format'] === 'true';
    
    if (acceptFrontendFormat) {
      // Get events for transformation
      const windowStart = new Date(Date.now() - value.window_min * 60 * 1000);
      const events = await Event.find({
        baby_id,
        ts: { $gte: windowStart }
      }).lean();
      
      const frontendResult = transformToFrontendFormat(analysisResult, events);
      return res.json([frontendResult]);
    }
    
    // Return OpenAPI format
    res.json(analysisResult);
    
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Unexpected error during analysis',
        request_id: req.id
      }
    });
  }
}

module.exports = {
  analyzeBabyHandler
};
