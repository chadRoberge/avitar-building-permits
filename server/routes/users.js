const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// Get users for current municipality (Admin only)
router.get('/municipality', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.permissionLevel || req.user.permissionLevel < 21) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const municipalityId = req.user.municipality._id || req.user.municipality;
    if (!municipalityId) {
      return res.status(400).json({ error: 'Municipality not found for user' });
    }

    const users = await User.find({
      'municipality._id': municipalityId,
      userType: 'municipal'
    }).select('-password').sort({ lastName: 1, firstName: 1 });

    console.log(`Found ${users.length} municipal users for municipality ${municipalityId}`);
    res.json(users);
  } catch (error) {
    console.error('Error fetching municipal users:', error);
    res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
});

// Create new municipal user (Admin only)
router.post('/municipal', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.permissionLevel || req.user.permissionLevel < 21) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { firstName, lastName, email, department, permissionLevel, isActive } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !department || !permissionLevel) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Validate permission level for municipal users
    if (permissionLevel < 11 || permissionLevel > 23) {
      return res.status(400).json({ error: 'Invalid permission level for municipal user (must be 11-23)' });
    }

    const municipalityId = req.user.municipality._id || req.user.municipality;
    if (!municipalityId) {
      return res.status(400).json({ error: 'Municipality not found for user' });
    }

    // Create temporary password (user should change on first login)
    const tempPassword = `TempPass${Math.random().toString(36).slice(2, 8)}!`;

    const newUser = new User({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: tempPassword,
      userType: 'municipal',
      municipality: req.user.municipality, // Copy full municipality object
      department,
      permissionLevel: parseInt(permissionLevel),
      isActive: isActive !== false, // default to true
      role: permissionLevel >= 21 ? 'admin' : 'user'
    });

    await newUser.save();
    
    console.log('Created new municipal user:', {
      id: newUser._id,
      email: newUser.email,
      permissionLevel: newUser.permissionLevel,
      department: newUser.department
    });

    // Don't send password in response
    const userResponse = newUser.toJSON();
    delete userResponse.password;

    res.status(201).json({
      ...userResponse,
      tempPassword // Send temp password for admin to share (in real app, would email user)
    });
  } catch (error) {
    console.error('Error creating municipal user:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    
    res.status(500).json({ error: 'Failed to create user', details: error.message });
  }
});

// Get current user profile
router.get('/profile', auth, async (req, res) => {
  try {
    // req.user is already the full user object from auth middleware
    const user = req.user;
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userResponse = user.toJSON();
    res.json(userResponse);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile', details: error.message });
  }
});

// Update current user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, department, propertyAddress } = req.body;
    
    // req.user is already the full user object from auth middleware
    const user = req.user;

    // Security check: User can only update their own profile
    // This is already guaranteed by the auth middleware, but keeping for safety
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user fields (only allow certain fields to be updated by user)
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email.toLowerCase();
    if (phone !== undefined) user.phone = phone;
    
    // Update property address for residential users
    if (propertyAddress && user.userType === 'residential') {
      user.propertyAddress = {
        street: propertyAddress.street || user.propertyAddress?.street || '',
        city: propertyAddress.city || user.propertyAddress?.city || '',
        state: propertyAddress.state || user.propertyAddress?.state || '',
        zip: propertyAddress.zip || user.propertyAddress?.zip || '',
        county: propertyAddress.county || user.propertyAddress?.county || ''
      };
    }
    
    // Only allow municipal users to change department, and only if they're admin level
    if (department && user.userType === 'municipal' && user.permissionLevel >= 21) {
      user.department = department;
    }

    await user.save();
    
    console.log('Updated user profile:', {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    });

    const userResponse = user.toJSON();
    res.json(userResponse);
  } catch (error) {
    console.error('Error updating user profile:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already in use by another user' });
    }
    
    res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
});

// Update municipal user (Admin only)
router.put('/:userId', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.permissionLevel || req.user.permissionLevel < 21) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;
    const { firstName, lastName, email, department, permissionLevel, isActive } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user belongs to same municipality
    const municipalityId = req.user.municipality._id || req.user.municipality;
    const userMunicipalityId = user.municipality._id || user.municipality;
    
    if (municipalityId.toString() !== userMunicipalityId.toString()) {
      return res.status(403).json({ error: 'Access denied - different municipality' });
    }

    // Update user fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email.toLowerCase();
    if (department) user.department = department;
    if (permissionLevel !== undefined) {
      if (permissionLevel < 11 || permissionLevel > 23) {
        return res.status(400).json({ error: 'Invalid permission level for municipal user (must be 11-23)' });
      }
      user.permissionLevel = parseInt(permissionLevel);
      user.role = permissionLevel >= 21 ? 'admin' : 'user';
    }
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();
    
    console.log('Updated municipal user:', {
      id: user._id,
      email: user.email,
      permissionLevel: user.permissionLevel,
      isActive: user.isActive
    });

    const userResponse = user.toJSON();
    res.json(userResponse);
  } catch (error) {
    console.error('Error updating user:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already in use by another user' });
    }
    
    res.status(500).json({ error: 'Failed to update user', details: error.message });
  }
});

// Toggle user active status (Admin only)
router.patch('/:userId/toggle-status', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.permissionLevel || req.user.permissionLevel < 21) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user belongs to same municipality
    const municipalityId = req.user.municipality._id || req.user.municipality;
    const userMunicipalityId = user.municipality._id || user.municipality;
    
    if (municipalityId.toString() !== userMunicipalityId.toString()) {
      return res.status(403).json({ error: 'Access denied - different municipality' });
    }

    // Prevent user from deactivating themselves
    if (user._id.toString() === req.user.userId) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    user.isActive = !user.isActive;
    await user.save();
    
    console.log('Toggled user status:', {
      id: user._id,
      email: user.email,
      isActive: user.isActive
    });

    const userResponse = user.toJSON();
    res.json(userResponse);
  } catch (error) {
    console.error('Error toggling user status:', error);
    res.status(500).json({ error: 'Failed to toggle user status', details: error.message });
  }
});

// Reset user password (Admin only)
router.post('/:userId/reset-password', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.permissionLevel || req.user.permissionLevel < 21) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user belongs to same municipality
    const municipalityId = req.user.municipality._id || req.user.municipality;
    const userMunicipalityId = user.municipality._id || user.municipality;
    
    if (municipalityId.toString() !== userMunicipalityId.toString()) {
      return res.status(403).json({ error: 'Access denied - different municipality' });
    }

    // Generate new temporary password
    const tempPassword = `Reset${Math.random().toString(36).slice(2, 8)}!`;
    user.password = tempPassword; // Will be hashed by pre-save middleware
    
    await user.save();
    
    console.log('Reset password for user:', {
      id: user._id,
      email: user.email
    });

    res.json({
      message: 'Password reset successfully',
      tempPassword // In real app, would email user
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password', details: error.message });
  }
});

// Delete user (Super Admin only)
router.delete('/:userId', auth, async (req, res) => {
  try {
    // Check if user is super admin
    if (!req.user.permissionLevel || req.user.permissionLevel < 23) {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent user from deleting themselves
    if (user._id.toString() === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await User.findByIdAndDelete(userId);
    
    console.log('Deleted user:', {
      id: userId,
      email: user.email
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user', details: error.message });
  }
});

// Change password
router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current and new passwords are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await user.comparePassword(currentPassword);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Update password (will be hashed by pre-save middleware)
    user.password = newPassword;
    await user.save();
    
    console.log('Password changed for user:', user.email);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password', details: error.message });
  }
});

// Get user activity/statistics
router.get('/activity', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // For now, return mock data. In a real app, you'd query various collections
    // to get actual statistics about the user's activity
    
    const activityData = {
      permitReviews: 0,
      inspectionCount: 0,
      departmentReviews: 0,
      recentActivity: []
    };

    // If user is municipal, get some basic stats
    if (req.user.userType === 'municipal') {
      // You could query the Permit model here to get real statistics
      // For example:
      // const Permit = require('../models/Permit');
      // const reviewCount = await Permit.countDocuments({
      //   'departmentReviews.reviewer.id': userId
      // });
      
      activityData.permitReviews = Math.floor(Math.random() * 50); // Mock data
      activityData.inspectionCount = Math.floor(Math.random() * 25); // Mock data
      activityData.departmentReviews = Math.floor(Math.random() * 75); // Mock data
      
      activityData.recentActivity = [
        {
          icon: '📋',
          description: 'Reviewed permit application #1234',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
        },
        {
          icon: '✅', 
          description: 'Approved building department review',
          timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000) // 5 hours ago
        },
        {
          icon: '🔍',
          description: 'Completed inspection for permit #5678',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
        }
      ];
    }

    res.json(activityData);
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity', details: error.message });
  }
});

module.exports = router;