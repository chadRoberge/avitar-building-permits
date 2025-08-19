const express = require('express');
const router = express.Router();

// Test route to confirm admin routes work
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Admin routes working!', 
    timestamp: new Date().toISOString() 
  });
});

// Dashboard route (minimal version)
router.get('/dashboard', (req, res) => {
  res.json({
    overview: {
      totalMunicipalities: 1,
      activeMunicipalities: 1,
      totalUsers: 1,
      totalPermits: 0
    },
    analytics: {
      usersByType: { system_admin: 1 },
      permitsByStatus: {}
    }
  });
});

// Municipalities route (minimal version)
router.get('/municipalities', (req, res) => {
  res.json({
    municipalities: [],
    total: 0,
    page: 1,
    limit: 50
  });
});

module.exports = router;