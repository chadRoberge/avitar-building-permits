'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = function (defaults) {
  const app = new EmberApp(defaults, {
    // Add options here
  });

  // Import Leaflet CSS
  app.import('node_modules/leaflet/dist/leaflet.css');

  return app.toTree();
};
