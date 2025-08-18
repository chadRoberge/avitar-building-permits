// Stub environment config for serverless compatibility
// This prevents "Cannot find module '../config/environment'" errors
// when Ember-related code is accidentally included in serverless build

module.exports = {
  environment: process.env.NODE_ENV || 'production',
  APP: {
    API_HOST: process.env.API_HOST || ''
  }
};