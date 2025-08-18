'use strict';

module.exports = function (environment) {
  const ENV = {
    modulePrefix: 'avitar-building-permits',
    environment,
    rootURL: '/',
    locationType: 'history',
    EmberENV: {
      EXTEND_PROTOTYPES: false,
      FEATURES: {
        // Here you can enable experimental features on an ember canary build
        // e.g. EMBER_NATIVE_DECORATOR_SUPPORT: true
      },
    },

    APP: {
      // Here you can pass flags/options to your application instance
      // when it is created
      // API_HOST is set per environment below
    },
  };

  if (environment === 'development') {
    // ENV.APP.LOG_RESOLVER = true;
    // ENV.APP.LOG_ACTIVE_GENERATION = true;
    // ENV.APP.LOG_TRANSITIONS = true;
    // ENV.APP.LOG_TRANSITIONS_INTERNAL = true;
    // ENV.APP.LOG_VIEW_LOOKUPS = true;
    
    // Development API configuration
    ENV.APP.API_HOST = 'http://localhost:3000';
  }

  if (environment === 'test') {
    // Testem prefers this...
    ENV.locationType = 'none';

    // keep test console output quieter
    ENV.APP.LOG_ACTIVE_GENERATION = false;
    ENV.APP.LOG_VIEW_LOOKUPS = false;

    ENV.APP.rootElement = '#ember-testing';
    ENV.APP.autoboot = false;
    
    // Test API configuration (mock server or test backend)
    ENV.APP.API_HOST = 'http://localhost:3001';
  }

  if (environment === 'production') {
    // Production API configuration - Vercel deployment
    ENV.APP.API_HOST = 'https://avitar-building-permits.vercel.app';
    
    // Enable production optimizations
    ENV.APP.LOG_ACTIVE_GENERATION = false;
    ENV.APP.LOG_VIEW_LOOKUPS = false;
    ENV.APP.LOG_TRANSITIONS = false;
    ENV.APP.LOG_TRANSITIONS_INTERNAL = false;
  }
  
  // Special case for Vercel deployment (which runs as development but needs production settings)
  if (process.env.VERCEL_URL || process.env.VERCEL) {
    ENV.APP.API_HOST = `https://${process.env.VERCEL_URL || 'avitar-building-permits.vercel.app'}`;
  }

  return ENV;
};
