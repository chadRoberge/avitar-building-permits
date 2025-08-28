require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin-working');
const municipalityRoutes = require('./routes/municipalities');
const dashboardRoutes = require('./routes/dashboard');
const permitTypeRoutes = require('./routes/permit-types');
const permitRoutes = require('./routes/permits');
const contractorRoutes = require('./routes/contractors');
const propertyRoutes = require('./routes/properties');
const permitMessageRoutes = require('./routes/permit-messages');
const inspectionRequestRoutes = require('./routes/inspection-requests');
const billingRoutes = require('./routes/billing');
const stripeRoutes = require('./routes/stripe');
const stripeSetupRoutes = require('./routes/stripe-setup');
const apiIntegrationRoutes = require('./routes/api-integration');
const userRoutes = require('./routes/users');
const contractorLookupRoutes = require('./routes/contractor-lookup');

const app = express();

// Connect to MongoDB (don't block on connection)
connectDB().catch(err => {
  console.error('Database connection failed on startup:', err.message);
});

// Middleware - CORS configuration
app.use((req, res, next) => {
  // Set CORS headers manually for better control
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization',
  );
  res.header('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

// Also use the cors middleware as backup
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Special webhook endpoint that needs raw body - must come before json parsing
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);

// System admin routes (inline for development)
app.get('/api/admin/test', (req, res) => {
  console.log('System admin test route hit');
  res.json({ message: 'System admin routes working!', userType: 'system_admin' });
});

app.get('/api/admin/dashboard', async (req, res) => {
  try {
    console.log('System admin dashboard route hit');
    
    const User = require('./models/User');
    const Municipality = require('./models/Municipality');
    const Permit = require('./models/Permit');
    
    // Get overview statistics
    const [
      totalMunicipalities,
      activeMunicipalities,
      totalUsers,
      totalPermits
    ] = await Promise.all([
      Municipality.countDocuments(),
      Municipality.countDocuments({ isActive: true }),
      User.countDocuments(),
      Permit.countDocuments()
    ]);
    
    // Get user counts by type
    const usersByType = await User.aggregate([
      { $group: { _id: '$userType', count: { $sum: 1 } } }
    ]);
    
    const userTypeMap = usersByType.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, { system_admin: 0, municipal: 0, residential: 0, commercial: 0 });
    
    // Get permit counts by status
    const permitsByStatus = await Permit.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    const permitStatusMap = permitsByStatus.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, { submitted: 0, under_review: 0, approved: 0, rejected: 0, completed: 0 });
    
    res.json({
      overview: {
        totalMunicipalities,
        activeMunicipalities,
        totalUsers,
        totalPermits
      },
      analytics: {
        usersByType: userTypeMap,
        permitsByStatus: permitStatusMap
      }
    });
    
  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

app.get('/api/admin/municipalities', async (req, res) => {
  try {
    console.log('System admin municipalities route hit');
    
    const Municipality = require('./models/Municipality');
    const User = require('./models/User');
    const Permit = require('./models/Permit');
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // Get municipalities with pagination
    const municipalities = await Municipality.find()
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Municipality.countDocuments();
    
    // Get user and permit counts for each municipality
    const municipalitiesWithCounts = await Promise.all(
      municipalities.map(async (municipality) => {
        const [userCount, permitCount] = await Promise.all([
          User.countDocuments({ 'municipality._id': municipality._id }),
          Permit.countDocuments({ municipality: municipality._id })
        ]);
        
        return {
          _id: municipality._id,
          name: municipality.name,
          type: municipality.type,
          city: municipality.address?.city,
          state: municipality.address?.state,
          zip: municipality.address?.zip,
          isActive: municipality.isActive,
          userCount,
          permitCount,
          subscription: municipality.subscription,
          address: municipality.address,
          website: municipality.website,
          population: municipality.population,
          createdAt: municipality.createdAt
        };
      })
    );
    
    res.json({
      municipalities: municipalitiesWithCounts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
    
  } catch (error) {
    console.error('Municipalities data error:', error);
    res.status(500).json({ error: 'Failed to load municipalities data' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    console.log('System admin users route hit');
    
    const User = require('./models/User');
    const Municipality = require('./models/Municipality');
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const userType = req.query.userType;
    
    // Build query filter
    const query = {};
    if (userType && userType !== 'all') {
      query.userType = userType;
    }
    
    // Get users with pagination
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments(query);
    
    // Add municipality name for municipal users
    const usersWithMunicipality = await Promise.all(
      users.map(async (user) => {
        const userData = {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          userType: user.userType,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        };
        
        // Add municipality name if municipal user
        if (user.userType === 'municipal' && user.municipality?._id) {
          userData.municipalityName = user.municipality.name;
        }
        
        // Add business info for commercial users
        if (user.userType === 'commercial' && user.businessInfo) {
          userData.businessName = user.businessInfo.businessName;
          userData.businessType = user.businessInfo.businessType;
        }
        
        // Add property address for residential users
        if (user.userType === 'residential' && user.propertyAddress) {
          userData.propertyAddress = user.propertyAddress;
        }
        
        return userData;
      })
    );
    
    res.json({
      users: usersWithMunicipality,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
    
  } catch (error) {
    console.error('Users data error:', error);
    res.status(500).json({ error: 'Failed to load users data' });
  }
});

app.get('/api/admin/municipalities/:municipalityId', async (req, res) => {
  try {
    console.log('Getting municipality details:', req.params.municipalityId);
    
    const Municipality = require('./models/Municipality');
    const User = require('./models/User');
    const Permit = require('./models/Permit');
    
    const municipality = await Municipality.findById(req.params.municipalityId);
    
    if (!municipality) {
      return res.status(404).json({ error: 'Municipality not found' });
    }
    
    // Get additional stats
    const [userCount, permitCount] = await Promise.all([
      User.countDocuments({ 'municipality._id': municipality._id }),
      Permit.countDocuments({ municipality: municipality._id })
    ]);
    
    // Get webhooks/integrations (placeholder for now)
    const webhooks = [];
    
    // Get API key (include it for admin access)
    const municipalityWithApiKey = await Municipality.findById(req.params.municipalityId).select('+apiKey +apiKeyCreatedAt +apiKeyLastUsed');
    
    res.json({
      municipality: {
        ...municipality.toObject(),
        userCount,
        permitCount
      },
      webhooks,
      settings: {
        portalUrl: municipality.portalUrl,
        website: municipality.website,
        isActive: municipality.isActive,
        subscription: municipality.subscription,
        paymentConfig: municipality.paymentConfig
      },
      apiKey: {
        key: municipalityWithApiKey.apiKey,
        createdAt: municipalityWithApiKey.apiKeyCreatedAt,
        lastUsed: municipalityWithApiKey.apiKeyLastUsed
      }
    });
    
  } catch (error) {
    console.error('Municipality details error:', error);
    res.status(500).json({ error: 'Failed to load municipality details' });
  }
});

// Update municipality information
app.put('/api/admin/municipalities/:municipalityId', async (req, res) => {
  try {
    console.log('Updating municipality:', req.params.municipalityId);
    
    const Municipality = require('./models/Municipality');
    const { name, type, population, website, address, settings } = req.body;
    
    const municipality = await Municipality.findById(req.params.municipalityId);
    if (!municipality) {
      return res.status(404).json({ error: 'Municipality not found' });
    }

    // Update municipality fields
    if (name !== undefined) municipality.name = name;
    if (type !== undefined) municipality.type = type;
    if (population !== undefined) municipality.population = population;
    if (website !== undefined) municipality.website = website;
    if (address !== undefined) {
      municipality.address = {
        street: address.street || '',
        city: address.city || '',
        state: address.state || '',
        zip: address.zip || '',
        county: address.county || ''
      };
    }

    // Update settings
    if (settings) {
      if (settings.portalUrl !== undefined) municipality.portalUrl = settings.portalUrl;
      if (settings.website !== undefined) municipality.website = settings.website;
    }

    await municipality.save();

    res.json({
      message: 'Municipality updated successfully',
      municipality: {
        _id: municipality._id,
        name: municipality.name,
        type: municipality.type,
        population: municipality.population,
        website: municipality.website,
        address: municipality.address,
        isActive: municipality.isActive
      },
      settings: {
        portalUrl: municipality.portalUrl,
        website: municipality.website
      }
    });
  } catch (error) {
    console.error('Error updating municipality:', error);
    res.status(500).json({ error: 'Failed to update municipality' });
  }
});

// User management endpoints
app.put('/api/admin/users/:userId/deactivate', async (req, res) => {
  try {
    console.log('Deactivating user:', req.params.userId);
    
    const User = require('./models/User');
    
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isActive: false },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      message: 'User deactivated successfully',
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive
      }
    });
    
  } catch (error) {
    console.error('Error deactivating user:', error);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

app.put('/api/admin/users/:userId/activate', async (req, res) => {
  try {
    console.log('Activating user:', req.params.userId);
    
    const User = require('./models/User');
    
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isActive: true },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      message: 'User activated successfully',
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive
      }
    });
    
  } catch (error) {
    console.error('Error activating user:', error);
    res.status(500).json({ error: 'Failed to activate user' });
  }
});

app.post('/api/admin/users/:userId/reset-password', async (req, res) => {
  try {
    console.log('Resetting password for user:', req.params.userId);
    
    const User = require('./models/User');
    const bcrypt = require('bcryptjs');
    
    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    
    // Hash the temporary password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);
    
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { password: hashedPassword },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // In a real application, you would send this via email
    console.log(`Temporary password for ${user.email}: ${tempPassword}`);
    
    res.json({ 
      message: `Password reset successful. Temporary password: ${tempPassword}`,
      tempPassword: tempPassword // In production, don't return this, send via email instead
    });
    
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// API key management endpoints
app.post('/api/admin/municipalities/:municipalityId/regenerate-api-key', async (req, res) => {
  try {
    console.log('Regenerating API key for municipality:', req.params.municipalityId);
    
    const Municipality = require('./models/Municipality');
    
    const municipality = await Municipality.findById(req.params.municipalityId).select('+apiKey');
    
    if (!municipality) {
      return res.status(404).json({ error: 'Municipality not found' });
    }
    
    // Generate new API key
    const newApiKey = municipality.regenerateApiKey();
    await municipality.save();
    
    res.json({
      message: 'API key regenerated successfully',
      apiKey: {
        key: newApiKey,
        createdAt: municipality.apiKeyCreatedAt,
        lastUsed: municipality.apiKeyLastUsed
      }
    });
    
  } catch (error) {
    console.error('Error regenerating API key:', error);
    res.status(500).json({ error: 'Failed to regenerate API key' });
  }
});

// Municipality-specific user management endpoints
app.get('/api/admin/municipalities/:municipalityId/users', async (req, res) => {
  try {
    console.log('Getting users for municipality:', req.params.municipalityId);
    
    const User = require('./models/User');
    const { page = 1, limit = 50, userType = 'all' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query filter
    const query = { 'municipality._id': req.params.municipalityId };
    
    if (userType && userType !== 'all') {
      query.userType = userType;
    }

    // Get users with pagination
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    // Format users for admin consumption
    const formattedUsers = users.map(user => ({
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      userType: user.userType,
      isActive: user.isActive,
      permissionLevel: user.permissionLevel,
      department: user.department,
      lastLoginDate: user.lastLoginDate,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      businessInfo: user.businessInfo,
      propertyAddress: user.propertyAddress,
      municipality: user.municipality
    }));

    res.json({
      users: formattedUsers,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });

  } catch (error) {
    console.error('Municipality users fetch error:', error);
    res.status(500).json({ error: 'Failed to load users for municipality' });
  }
});

app.post('/api/admin/municipalities/:municipalityId/users', async (req, res) => {
  try {
    console.log('Creating user for municipality:', req.params.municipalityId);
    
    const User = require('./models/User');
    const Municipality = require('./models/Municipality');
    const bcrypt = require('bcryptjs');

    // Get municipality details
    const municipality = await Municipality.findById(req.params.municipalityId);
    if (!municipality) {
      return res.status(404).json({ error: 'Municipality not found' });
    }

    const { 
      email, 
      firstName, 
      lastName, 
      phone, 
      userType, 
      password,
      department,
      permissionLevel,
      businessInfo,
      propertyAddress 
    } = req.body;


    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Set password (will be hashed by User model's pre-save middleware)
    const actualPassword = password || 'TempPassword123!';
    console.log('=== USER CREATION PASSWORD DEBUG ===');
    console.log('Email:', email);
    console.log('Password provided:', !!password);
    console.log('Password from request:', JSON.stringify(password));
    console.log('Actual password to hash:', JSON.stringify(actualPassword));
    console.log('Password length:', actualPassword?.length);
    console.log('Password char codes:', actualPassword ? Array.from(actualPassword).map(c => c.charCodeAt(0)) : 'none');
    console.log('Letting User model pre-save middleware handle hashing...');

    // Create user data
    const userData = {
      email,
      firstName,
      lastName,
      phone,
      password: actualPassword,
      userType,
      municipality: {
        _id: municipality._id,
        name: municipality.name,
        portalUrl: municipality.portalUrl
      },
      isActive: true
    };

    // Add type-specific data
    if (userType === 'municipal') {
      userData.department = department;
      userData.permissionLevel = permissionLevel || 11; // Default to basic municipal access
    }

    if (userType === 'commercial' && businessInfo) {
      userData.businessInfo = businessInfo;
    }

    if (userType === 'residential' && propertyAddress) {
      userData.propertyAddress = propertyAddress;
    }

    const user = new User(userData);
    await user.save();

    res.json({
      message: 'User created successfully',
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        isActive: user.isActive,
        municipality: user.municipality
      },
      tempPassword: password || 'TempPassword123!'
    });

  } catch (error) {
    console.error('Error creating municipality user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/admin/municipalities/:municipalityId/users/:userId', async (req, res) => {
  try {
    console.log('Updating user:', req.params.userId, 'for municipality:', req.params.municipalityId);
    
    const User = require('./models/User');

    // Find user and verify it belongs to the municipality
    const user = await User.findOne({ 
      _id: req.params.userId, 
      'municipality._id': req.params.municipalityId 
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found for this municipality' });
    }

    const { 
      firstName, 
      lastName, 
      phone, 
      isActive,
      businessInfo,
      propertyAddress 
    } = req.body;

    // Update user data
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.phone = phone || user.phone;
    user.isActive = isActive !== undefined ? isActive : user.isActive;

    // Update type-specific data
    if (user.userType === 'commercial' && businessInfo) {
      user.businessInfo = { ...user.businessInfo, ...businessInfo };
    }

    if (user.userType === 'residential' && propertyAddress) {
      user.propertyAddress = { ...user.propertyAddress, ...propertyAddress };
    }

    await user.save();

    res.json({
      message: 'User updated successfully',
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        userType: user.userType,
        isActive: user.isActive,
        businessInfo: user.businessInfo,
        propertyAddress: user.propertyAddress,
        municipality: user.municipality
      }
    });

  } catch (error) {
    console.error('Error updating municipality user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

console.log('Inline admin routes registered');
app.use('/api/municipalities', municipalityRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/permit-types', permitTypeRoutes);
app.use('/api/permits', permitRoutes);
app.use('/api/contractors', contractorRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/permit-messages', permitMessageRoutes);
app.use('/api/inspection-requests', inspectionRequestRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/stripe-setup', stripeSetupRoutes);
app.use('/api/integration', apiIntegrationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/contractor-lookup', contractorLookupRoutes);

// Debug: Log all registered routes
console.log('Registered routes:');
console.log('- /api/auth');
console.log('- /api/admin');
console.log('- /api/municipalities');
console.log('- /api/dashboard');
console.log('- /api/permit-types');
console.log('- /api/permits (includes file upload endpoints)');
console.log('- /api/contractors');
console.log('- /api/properties');
console.log('- /api/permit-messages');
console.log('- /api/billing');
console.log('- /api/stripe');
console.log('- /api/integration (API key secured endpoints)');
console.log('- /api/contractor-lookup');

// Simple test endpoint (no DB required)
app.get('/api/test', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Simple test endpoint working',
    environment: process.env.NODE_ENV,
    vercel: !!process.env.VERCEL,
    timestamp: new Date().toISOString(),
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Building Permits API is running',
    environment: process.env.NODE_ENV,
    vercel: !!process.env.VERCEL,
    dbState: require('mongoose').connection.readyState,
    timestamp: new Date().toISOString(),
  });
});

// List all routes endpoint
app.get('/api/routes', (req, res) => {
  res.json({
    message: 'Available API endpoints',
    routes: [
      'GET /api/health',
      'GET /api/routes',
      'GET /api/permit-types',
      'POST /api/permit-types',
      'PUT /api/permit-types/:id',
      'DELETE /api/permit-types/:id',
      'PATCH /api/permit-types/:id/toggle',
    ],
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Only start server if not in Vercel environment
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Building Permits API server running on port ${PORT}`);
  });
}

module.exports = app;
