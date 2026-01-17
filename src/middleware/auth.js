/**
 * Authentication Middleware
 * Supports JWT and demo key authentication
 */

/**
 * Authenticate request
 */
function authenticate(req, res, next) {
  // Check for demo key
  const demoKey = req.headers['x-demo-key'];
  if (demoKey === process.env.DEMO_API_KEY) {
    req.user = { type: 'demo' };
    return next();
  }
  
  // Check for Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    // TODO: Implement JWT validation with Auth0
    // For now, accept any bearer token in development
    if (process.env.NODE_ENV === 'development') {
      req.user = { type: 'jwt', token };
      return next();
    }
    
    // In production, validate JWT here
    return res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Invalid or expired token',
        request_id: req.id
      }
    });
  }
  
  // No valid authentication
  res.status(401).json({
    error: {
      code: 'unauthorized',
      message: 'Missing or invalid credentials',
      request_id: req.id
    }
  });
}

module.exports = {
  authenticate
};
