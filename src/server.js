/**
 * CryFlow Backend Server
 * Non-medical caregiver support API
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDatabase = require('./config/database');
const routes = require('./routes');
const requestId = require('./middleware/requestId');
const { authenticate } = require('./middleware/auth');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to database
connectDatabase();

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: {
      code: 'rate_limit_exceeded',
      message: 'Too many requests, please try again later'
    }
  }
});

app.use('/v1/', limiter);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Request ID
app.use(requestId);

// Authentication (except health check)
app.use('/v1/', (req, res, next) => {
  if (req.path === '/health') {
    return next();
  }
  authenticate(req, res, next);
});

// API routes
app.use('/', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'CryFlow API',
    version: '0.1.0',
    description: 'Non-medical caregiver support system',
    endpoints: {
      health: 'GET /v1/health',
      analyze: 'POST /v1/babies/:baby_id/analyze',
      events: {
        list: 'GET /v1/babies/:baby_id/events',
        create: 'POST /v1/babies/:baby_id/events'
      }
    },
    documentation: '/docs'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'not_found',
      message: 'Endpoint not found',
      request_id: req.id
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    error: {
      code: err.code || 'internal_error',
      message: err.message || 'Unexpected error occurred',
      request_id: req.id
    }
  });
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 CryFlow API running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/v1/health`);
  });
}

module.exports = app;
