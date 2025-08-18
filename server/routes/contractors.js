const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log(
    'Contractors auth middleware - header exists:',
    !!authHeader,
    'token exists:',
    !!token,
  );

  if (!token) {
    console.log('Contractors - No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log('Contractors JWT verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    console.log(
      'Contractors JWT verified successfully for user:',
      user.userId,
      'type:',
      user.userType,
    );
    req.user = user;
    next();
  });
};

// Get contractors who have worked at a specific property
router.get('/property/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(
      'Contractors request - JWT user:',
      req.user.userId,
      'Requested userId:',
      userId,
      'User type:',
      req.user.userType,
    );

    // Verify the requesting user matches the userId or is authorized
    if (req.user.userId !== userId && req.user.userType !== 'municipal') {
      console.log(
        'Access denied - JWT user ID does not match requested user ID',
      );
      return res.status(403).json({ error: 'Access denied' });
    }

    // For now, return mock contractor data since we don't have a Contractor model yet
    // In a real application, you would query permits and extract contractor information
    const mockContractors = [
      {
        id: '1',
        businessName: 'Superior Home Builders',
        businessType: 'General Contractor',
        licenseNumber: 'NH-GC-12345',
        rating: 4.8,
        lastWorked: new Date('2024-01-10'),
        projectCount: 3,
        phone: '(603) 555-0123',
        email: 'contact@superiorhomebuilders.com',
        specialties: ['Residential Construction', 'Renovations', 'Additions'],
      },
      {
        id: '2',
        businessName: 'Lightning Electric LLC',
        businessType: 'Electrical Contractor',
        licenseNumber: 'NH-EL-67890',
        rating: 4.9,
        lastWorked: new Date('2023-12-15'),
        projectCount: 2,
        phone: '(603) 555-0456',
        email: 'info@lightningelectric.com',
        specialties: ['Residential Electrical', 'Panel Upgrades', 'Smart Home'],
      },
      {
        id: '3',
        businessName: 'Granite State Plumbing',
        businessType: 'Plumbing Contractor',
        licenseNumber: 'NH-PL-11223',
        rating: 4.7,
        lastWorked: new Date('2023-11-20'),
        projectCount: 1,
        phone: '(603) 555-0789',
        email: 'service@granitestatepl.com',
        specialties: [
          'Bathroom Renovation',
          'Fixture Installation',
          'Water Heaters',
        ],
      },
    ];

    console.log(
      `Fetching contractors for property (user ${userId}), returning ${mockContractors.length} contractors`,
    );
    res.json(mockContractors);
  } catch (error) {
    console.error('Error fetching contractors:', error);
    res.status(500).json({ error: 'Failed to fetch contractors' });
  }
});

// Get all contractors (for municipal users)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Only municipal users can view all contractors
    if (req.user.userType !== 'municipal') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Mock data for all contractors in the municipality
    const mockContractors = [
      {
        id: '1',
        businessName: 'Superior Home Builders',
        businessType: 'General Contractor',
        licenseNumber: 'NH-GC-12345',
        status: 'active',
      },
      {
        id: '2',
        businessName: 'Lightning Electric LLC',
        businessType: 'Electrical Contractor',
        licenseNumber: 'NH-EL-67890',
        status: 'active',
      },
    ];

    res.json(mockContractors);
  } catch (error) {
    console.error('Error fetching all contractors:', error);
    res.status(500).json({ error: 'Failed to fetch contractors' });
  }
});

module.exports = router;
