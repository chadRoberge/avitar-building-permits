const express = require('express');
const Municipality = require('../models/Municipality');
const User = require('../models/User');
const Permit = require('../models/Permit');
const auth = require('../middleware/auth');

console.log('=== ADMIN ROUTES FILE LOADED ===');
const router = express.Router();

// Simple test route that doesn't require auth or database
router.get('/test', (req, res) => {
  console.log('Admin test route hit!');
  res.json({ message: 'Admin routes are working!', timestamp: new Date().toISOString() });
});

// Middleware to ensure user is system admin
const requireSystemAdmin = (req, res, next) => {
  if (req.user.userType !== 'system_admin') {
    return res.status(403).json({ error: 'System administrator access required' });
  }
  next();
};

// Apply auth middleware to all admin routes
router.use(auth);
router.use(requireSystemAdmin);

// ===== DASHBOARD ENDPOINTS =====

// Get system overview dashboard data
console.log('Registering admin dashboard route');
router.get('/dashboard', async (req, res) => {
  console.log('Admin dashboard route hit');
  try {
    // Get counts and statistics
    const [
      municipalityCount,
      userCount,
      permitCount,
      activeMunicipalities,
      recentUsers,
      recentPermits
    ] = await Promise.all([
      Municipality.countDocuments(),
      User.countDocuments(),
      Permit.countDocuments(),
      Municipality.countDocuments({ isActive: true }),
      User.find().sort({ createdAt: -1 }).limit(10).select('firstName lastName email userType createdAt'),
      Permit.find().sort({ createdAt: -1 }).limit(10).populate('municipalityId', 'name')
    ]);

    // Get user counts by type
    const usersByType = await User.aggregate([
      { $group: { _id: '$userType', count: { $sum: 1 } } }
    ]);

    // Get permit counts by status
    const permitsByStatus = await Permit.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Get municipalities by subscription plan
    const municipalitiesByPlan = await Municipality.aggregate([
      { $group: { _id: '$subscription.plan', count: { $sum: 1 } } }
    ]);

    res.json({
      overview: {
        totalMunicipalities: municipalityCount,
        activeMunicipalities,
        totalUsers: userCount,
        totalPermits: permitCount
      },
      analytics: {
        usersByType: usersByType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        permitsByStatus: permitsByStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        municipalitiesByPlan: municipalitiesByPlan.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      },
      recent: {
        users: recentUsers,
        permits: recentPermits
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ===== MUNICIPALITY MANAGEMENT =====

// Get all municipalities with detailed info
router.get('/municipalities', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, plan } = req.query;
    
    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
        { 'address.state': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      query.isActive = status === 'active';
    }
    
    if (plan) {
      query['subscription.plan'] = plan;
    }

    const municipalities = await Municipality.find(query)
      .select('+paymentConfig.invoiceCloud.apiKey +paymentConfig.invoiceCloud.webhookSecret')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate({
        path: 'subscription',
        select: 'plan status currentPeriodStart currentPeriodEnd'
      });

    const total = await Municipality.countDocuments(query);

    // Get user count for each municipality
    const municipalityUsers = await User.aggregate([
      { $match: { userType: 'municipal' } },
      { $group: { _id: '$municipality._id', userCount: { $sum: 1 } } }
    ]);

    const municipalityUserMap = municipalityUsers.reduce((acc, item) => {
      acc[item._id] = item.userCount;
      return acc;
    }, {});

    const municipalitiesWithUserCount = municipalities.map(municipality => ({
      ...municipality.toObject(),
      userCount: municipalityUserMap[municipality._id] || 0
    }));

    res.json({
      municipalities: municipalitiesWithUserCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching municipalities:', error);
    res.status(500).json({ error: 'Failed to fetch municipalities' });
  }
});

// Get specific municipality details
router.get('/municipalities/:id', async (req, res) => {
  try {
    const municipality = await Municipality.findById(req.params.id)
      .select('+paymentConfig.invoiceCloud.apiKey +paymentConfig.invoiceCloud.webhookSecret +paymentConfig.stripe.secretKey');
    
    if (!municipality) {
      return res.status(404).json({ error: 'Municipality not found' });
    }

    // Get users for this municipality
    const users = await User.find({ 'municipality._id': municipality._id })
      .select('firstName lastName email userType isActive createdAt lastLogin');

    // Get recent permits for this municipality
    const permits = await Permit.find({ municipalityId: municipality._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('permitNumber type status createdAt applicant totalFees');

    res.json({
      municipality,
      users,
      permits
    });
  } catch (error) {
    console.error('Error fetching municipality details:', error);
    res.status(500).json({ error: 'Failed to fetch municipality details' });
  }
});

// Update municipality payment configuration
router.put('/municipalities/:id/payment-config', async (req, res) => {
  try {
    const { paymentConfig } = req.body;
    
    const municipality = await Municipality.findById(req.params.id);
    if (!municipality) {
      return res.status(404).json({ error: 'Municipality not found' });
    }

    // Update payment configuration
    municipality.paymentConfig = {
      ...municipality.paymentConfig,
      ...paymentConfig
    };

    await municipality.save();

    res.json({
      message: 'Payment configuration updated successfully',
      paymentConfig: municipality.paymentConfig
    });
  } catch (error) {
    console.error('Error updating payment configuration:', error);
    res.status(500).json({ error: 'Failed to update payment configuration' });
  }
});

// Update municipality information
router.put('/municipalities/:id', async (req, res) => {
  try {
    const { name, type, population, website, address, settings } = req.body;
    
    const municipality = await Municipality.findById(req.params.id);
    if (!municipality) {
      return res.status(404).json({ error: 'Municipality not found' });
    }

    // Update municipality fields
    if (name !== undefined) municipality.name = name;
    if (type !== undefined) municipality.type = type;
    if (population !== undefined) municipality.population = population;
    if (website !== undefined) municipality.website = website;
    if (address !== undefined) municipality.address = address;

    await municipality.save();

    // Update settings if provided
    let updatedSettings = municipality.settings || {};
    if (settings) {
      updatedSettings = { ...updatedSettings, ...settings };
      municipality.settings = updatedSettings;
      await municipality.save();
    }

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
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Error updating municipality:', error);
    res.status(500).json({ error: 'Failed to update municipality' });
  }
});

// Update municipality status (activate/deactivate)
router.put('/municipalities/:id/status', async (req, res) => {
  try {
    const { isActive } = req.body;
    
    const municipality = await Municipality.findById(req.params.id);
    if (!municipality) {
      return res.status(404).json({ error: 'Municipality not found' });
    }

    municipality.isActive = isActive;
    await municipality.save();

    res.json({
      message: `Municipality ${isActive ? 'activated' : 'deactivated'} successfully`,
      municipality
    });
  } catch (error) {
    console.error('Error updating municipality status:', error);
    res.status(500).json({ error: 'Failed to update municipality status' });
  }
});

// ===== USER MANAGEMENT =====

// Get all users with filtering
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, userType, status } = req.query;
    
    let query = {};
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (userType && userType !== 'all') {
      query.userType = userType;
    }
    
    if (status) {
      query.isActive = status === 'active';
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('municipality.name', 'name');

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user status (activate/deactivate)
router.put('/users/:id/status', async (req, res) => {
  try {
    const { isActive } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deactivating the last system admin
    if (user.userType === 'system_admin' && !isActive) {
      const adminCount = await User.countDocuments({ 
        userType: 'system_admin', 
        isActive: true,
        _id: { $ne: user._id }
      });
      
      if (adminCount === 0) {
        return res.status(400).json({ 
          error: 'Cannot deactivate the last system administrator' 
        });
      }
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        userType: user.userType,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Get user details
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('municipality.name', 'name');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's recent activity (permits if applicable)
    let recentActivity = [];
    if (user.userType === 'residential') {
      recentActivity = await Permit.find({ applicant: user._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('permitNumber type status createdAt');
    }

    res.json({
      user,
      recentActivity
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// ===== MUNICIPALITY USER MANAGEMENT =====

// Get users for a specific municipality
router.get('/municipalities/:id/users', async (req, res) => {
  try {
    const { userType = 'all', limit = 50 } = req.query;
    const municipalityId = req.params.id;

    // Build query
    let query = {
      $or: [
        { 'municipality._id': municipalityId },
        { 'municipality': municipalityId }
      ]
    };

    if (userType !== 'all') {
      query.userType = userType;
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ lastName: 1, firstName: 1 })
      .limit(parseInt(limit));

    res.json({ users });
  } catch (error) {
    console.error('Error fetching municipality users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create a new user for a municipality
router.post('/municipalities/:id/users', async (req, res) => {
  try {
    const municipalityId = req.params.id;
    const { email, firstName, lastName, phone, userType, department, permissionLevel, businessInfo, propertyAddress } = req.body;

    // Validate required fields
    if (!email || !firstName || !lastName || !userType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Get municipality details
    const municipality = await Municipality.findById(municipalityId);
    if (!municipality) {
      return res.status(404).json({ error: 'Municipality not found' });
    }

    // Generate temporary password
    const tempPassword = `TempPass${Math.random().toString(36).slice(2, 8)}!`;

    // Create user data
    const userData = {
      email: email.toLowerCase(),
      firstName,
      lastName,
      phone: phone || '',
      userType,
      password: tempPassword,
      municipality: {
        _id: municipality._id,
        name: municipality.name
      },
      isActive: true
    };

    // Add type-specific data
    if (userType === 'municipal' && department && permissionLevel) {
      userData.department = department;
      userData.permissionLevel = parseInt(permissionLevel);
      userData.role = permissionLevel >= 21 ? 'admin' : 'user';
    } else if (userType === 'commercial' && businessInfo) {
      userData.businessInfo = businessInfo;
      userData.permissionLevel = permissionLevel || 5;
    } else if (userType === 'residential' && propertyAddress) {
      userData.propertyAddress = propertyAddress;
      userData.permissionLevel = permissionLevel || 1;
    }

    const newUser = new User(userData);
    await newUser.save();

    // Remove password from response
    const userResponse = newUser.toJSON();
    delete userResponse.password;

    console.log('Created user for municipality:', {
      userId: newUser._id,
      email: newUser.email,
      userType: newUser.userType,
      municipalityId
    });

    res.status(201).json({
      ...userResponse,
      tempPassword // Send temp password for admin to share
    });

  } catch (error) {
    console.error('Error creating user:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update a user
router.put('/municipalities/:municipalityId/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, phone, department, permissionLevel, businessInfo, propertyAddress, isActive } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (isActive !== undefined) user.isActive = isActive;

    // Update type-specific data
    if (user.userType === 'municipal') {
      if (department) user.department = department;
      if (permissionLevel !== undefined) {
        user.permissionLevel = parseInt(permissionLevel);
        user.role = permissionLevel >= 21 ? 'admin' : 'user';
      }
    } else if (user.userType === 'commercial' && businessInfo) {
      user.businessInfo = businessInfo;
    } else if (user.userType === 'residential' && propertyAddress) {
      user.propertyAddress = propertyAddress;
    }

    await user.save();

    const userResponse = user.toJSON();
    res.json(userResponse);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Send user invitation email
router.post('/municipalities/:municipalityId/users/:userId/send-invitation', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate a new temporary password
    const tempPassword = `Welcome${Math.random().toString(36).slice(2, 8)}!`;
    user.password = tempPassword; // Will be hashed by pre-save middleware
    await user.save();

    // In a real application, you would send an actual email here
    // For now, we'll just log the invitation details and return them
    const invitationDetails = {
      email: user.email,
      tempPassword: tempPassword,
      loginUrl: process.env.APP_URL || 'http://localhost:4200',
      userName: `${user.firstName} ${user.lastName}`,
      userType: user.userType
    };

    console.log('User invitation sent:', {
      userId: user._id,
      email: user.email,
      tempPassword: tempPassword
    });

    // TODO: Implement actual email sending here
    // await sendEmail({
    //   to: user.email,
    //   subject: 'Welcome to Municipal Permit System',
    //   template: 'user-invitation',
    //   data: invitationDetails
    // });

    res.json({
      message: `Invitation email would be sent to ${user.email}`,
      tempPassword: tempPassword, // In production, don't return this
      loginInstructions: `Please use email: ${user.email} and temporary password: ${tempPassword}`
    });

  } catch (error) {
    console.error('Error sending user invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// ===== SYSTEM SETTINGS =====

// Get system settings
router.get('/settings', async (req, res) => {
  try {
    // Return system-wide configuration
    const settings = {
      maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
      allowRegistrations: process.env.ALLOW_REGISTRATIONS !== 'false',
      maxMunicipalities: parseInt(process.env.MAX_MUNICIPALITIES) || 1000,
      version: process.env.npm_package_version || '1.0.0'
    };

    res.json(settings);
  } catch (error) {
    console.error('Error fetching system settings:', error);
    res.status(500).json({ error: 'Failed to fetch system settings' });
  }
});

module.exports = router;