const Municipality = require('../models/Municipality');

// Middleware to authenticate API key requests
const apiKeyAuth = async (req, res, next) => {
  try {
    const apiKey = req.header('X-API-Key') || req.header('Authorization')?.replace('Bearer ', '');
    
    if (!apiKey) {
      return res.status(401).json({ 
        error: 'API key required',
        message: 'Please provide an API key in the X-API-Key header or Authorization header'
      });
    }

    // Find municipality by API key
    const municipality = await Municipality.findByApiKey(apiKey);
    
    if (!municipality) {
      return res.status(401).json({ 
        error: 'Invalid API key',
        message: 'The provided API key is not valid or has been revoked'
      });
    }

    if (!municipality.isActive) {
      return res.status(403).json({ 
        error: 'Municipality inactive',
        message: 'This municipality account is currently inactive'
      });
    }

    // Update last used timestamp (fire and forget)
    municipality.updateApiKeyLastUsed().catch(err => {
      console.warn('Failed to update API key last used timestamp:', err);
    });

    // Add municipality info to request
    req.municipality = municipality;
    req.apiKeyUsed = true;

    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    res.status(500).json({ 
      error: 'Authentication error',
      message: 'An error occurred while validating the API key'
    });
  }
};

// Optional middleware - allows both API key and JWT authentication
const optionalApiKeyAuth = async (req, res, next) => {
  const apiKey = req.header('X-API-Key') || req.header('Authorization')?.replace('Bearer ', '');
  
  if (!apiKey) {
    // No API key provided, continue with normal flow (JWT auth might still work)
    return next();
  }

  try {
    // Find municipality by API key
    const municipality = await Municipality.findByApiKey(apiKey);
    
    if (municipality && municipality.isActive) {
      // Update last used timestamp (fire and forget)
      municipality.updateApiKeyLastUsed().catch(err => {
        console.warn('Failed to update API key last used timestamp:', err);
      });

      // Add municipality info to request
      req.municipality = municipality;
      req.apiKeyUsed = true;
    }
  } catch (error) {
    console.warn('Optional API key authentication warning:', error);
  }

  next();
};

module.exports = {
  apiKeyAuth,
  optionalApiKeyAuth
};