/**
 * Request ID Middleware
 * Adds unique request ID for tracing
 */
const { nanoid } = require('nanoid');

function requestId(req, res, next) {
  req.id = `req_${nanoid(10)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
}

module.exports = requestId;
