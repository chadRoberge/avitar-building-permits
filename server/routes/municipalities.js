const express = require('express');
const Municipality = require('../models/Municipality');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');

const router = express.Router();

const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || 'fallback_secret_key',
    {
      expiresIn: '7d',
    },
  );
};

// Register new municipality with admin user
router.post('/register', async (req, res) => {
  try {
    const { municipality: municipalityData, administrator: adminData } =
      req.body;

    // Validate required data
    if (!municipalityData || !adminData) {
      return res
        .status(400)
        .json({ error: 'Municipality and administrator data are required' });
    }

    // Check if municipality name already exists
    const existingMunicipality = await Municipality.findOne({
      name: { $regex: new RegExp(`^${municipalityData.name}$`, 'i') },
    });

    if (existingMunicipality) {
      return res
        .status(400)
        .json({ error: 'A municipality with this name already exists' });
    }

    // Check if admin email already exists
    const existingUser = await User.findOne({ email: adminData.email });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: 'A user with this email already exists' });
    }

    // Create municipality
    const municipality = new Municipality(municipalityData);
    await municipality.save();

    // Create admin user
    const adminUser = new User({
      email: adminData.email,
      password: adminData.password,
      firstName: adminData.firstName,
      lastName: adminData.lastName,
      phone: adminData.phone,
      userType: 'municipal',
      role: 'admin',
      municipality: {
        _id: municipality._id,
        name: municipality.name,
        address: {
          street: municipality.address.street,
          city: municipality.address.city,
          state: municipality.address.state,
          zip: municipality.address.zip,
          county: municipality.address.county,
        },
      },
    });

    await adminUser.save();

    // Generate token for immediate login
    const token = generateToken(adminUser._id);

    res.status(201).json({
      message: 'Municipality registered successfully',
      municipality: municipality.toPublic(),
      admin: adminUser,
      token,
      portalUrl: municipality.portalUrl,
    });
  } catch (error) {
    console.error('Municipality registration error:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json({ error: `Validation error: ${messages.join(', ')}` });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ error: `${field} already exists` });
    }

    res
      .status(500)
      .json({ error: 'Server error during municipality registration' });
  }
});

// Get all municipalities (public endpoint for search)
router.get('/', async (req, res) => {
  try {
    console.log(
      'Getting municipalities - DB connection state:',
      require('mongoose').connection.readyState,
    );
    const { search, state, limit = 20 } = req.query;
    let query = { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
        { 'address.zip': search },
      ];
    }

    if (state) {
      query['address.state'] = state;
    }

    const municipalities = await Municipality.find(query)
      .select('name type address website population portalUrl')
      .limit(parseInt(limit))
      .sort({ name: 1 });

    console.log(`Found ${municipalities.length} municipalities`);
    res.json(municipalities);
  } catch (error) {
    console.error('Get municipalities error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: 'Server error retrieving municipalities',
      details:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Get municipality by ID or portal URL
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    console.log('Looking for municipality with identifier:', identifier);
    let municipality;

    // Try to find by ObjectId first, then by portalUrl
    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('Searching by ObjectId');
      municipality = await Municipality.findById(identifier);
    } else {
      console.log('Searching by portalUrl');
      municipality = await Municipality.findByPortalUrl(identifier);
      console.log(
        'Found municipality by portalUrl:',
        municipality ? municipality.name : 'not found',
      );
    }

    if (!municipality) {
      console.log('Municipality not found, checking all municipalities...');
      const allMunicipalities =
        await Municipality.find().select('name portalUrl');
      console.log(
        'Available municipalities:',
        allMunicipalities.map((m) => ({
          name: m.name,
          portalUrl: m.portalUrl,
        })),
      );
      return res.status(404).json({ error: 'Municipality not found' });
    }

    console.log('Returning municipality:', municipality.name);
    res.json(municipality.toPublic());
  } catch (error) {
    console.error('Get municipality error:', error);
    res.status(500).json({ error: 'Server error retrieving municipality' });
  }
});

// Update municipality (admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check if user is admin of this municipality
    if (req.user.userType !== 'municipal' || req.user.role !== 'admin') {
      return res
        .status(403)
        .json({ error: 'Access denied. Admin privileges required.' });
    }

    const municipality = await Municipality.findById(id);
    if (!municipality) {
      return res.status(404).json({ error: 'Municipality not found' });
    }

    // Verify user belongs to this municipality
    if (req.user.municipality.name !== municipality.name) {
      return res.status(403).json({
        error: 'Access denied. You can only update your own municipality.',
      });
    }

    // Update municipality
    Object.assign(municipality, updates);
    municipality.lastUpdated = new Date();
    await municipality.save();

    res.json({
      message: 'Municipality updated successfully',
      municipality: municipality.toPublic(),
    });
  } catch (error) {
    console.error('Update municipality error:', error);
    res.status(500).json({ error: 'Server error updating municipality' });
  }
});

// Check municipality name availability
router.post('/check-availability', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Municipality name is required' });
    }

    const existing = await Municipality.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
    });

    res.json({
      available: !existing,
      suggested: existing ? `${name} (${new Date().getFullYear()})` : null,
    });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({ error: 'Server error checking availability' });
  }
});

module.exports = router;
