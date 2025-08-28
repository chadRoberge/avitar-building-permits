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

    // Check for email conflicts before updating
    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const existingUser = await User.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: user._id }
      });
      
      if (existingUser) {
        return res.status(400).json({ 
          error: 'This email address is already in use by another account. Please choose a different email address.' 
        });
      }
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
      if (error.keyValue && error.keyValue.email) {
        return res.status(400).json({ 
          error: `The email address "${error.keyValue.email}" is already in use by another account. Please choose a different email address.` 
        });
      }
      return res.status(400).json({ error: 'This information is already in use by another account' });
    }
    
    res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
});

// Update business information
router.put('/business', auth, async (req, res) => {
  try {
    const { businessInfo } = req.body;
    
    if (!businessInfo) {
      return res.status(400).json({ error: 'Business information is required' });
    }
    
    // req.user is already the full user object from auth middleware
    const user = req.user;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Ensure this is a commercial user
    if (user.userType !== 'commercial') {
      return res.status(400).json({ error: 'Business information can only be updated for commercial users' });
    }

    // Update business information
    if (!user.businessInfo) {
      user.businessInfo = {};
    }

    if (businessInfo.businessName !== undefined) {
      user.businessInfo.businessName = businessInfo.businessName;
    }
    if (businessInfo.businessType !== undefined) {
      user.businessInfo.businessType = businessInfo.businessType;
    }
    if (businessInfo.licenseNumber !== undefined) {
      user.businessInfo.licenseNumber = businessInfo.licenseNumber;
    }

    // Update business address if provided
    if (businessInfo.businessAddress) {
      if (!user.businessInfo.businessAddress) {
        user.businessInfo.businessAddress = {};
      }
      
      const addr = businessInfo.businessAddress;
      if (addr.street !== undefined) user.businessInfo.businessAddress.street = addr.street;
      if (addr.city !== undefined) user.businessInfo.businessAddress.city = addr.city;
      if (addr.state !== undefined) user.businessInfo.businessAddress.state = addr.state;
      if (addr.zip !== undefined) user.businessInfo.businessAddress.zip = addr.zip;
      if (addr.county !== undefined) user.businessInfo.businessAddress.county = addr.county;
    }

    await user.save();
    
    console.log('Updated business information for user:', {
      id: user._id,
      email: user.email,
      businessName: user.businessInfo.businessName,
      businessType: user.businessInfo.businessType
    });

    const userResponse = user.toJSON();
    res.json(userResponse);
  } catch (error) {
    console.error('Error updating business information:', error);
    res.status(500).json({ error: 'Failed to update business information', details: error.message });
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

    // Get fresh user from database to ensure we have the full Mongoose document with methods
    const userId = req.user._id || req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('Change password attempt for user:', user.email);
    console.log('Current password provided:', !!currentPassword);
    console.log('Current password value:', currentPassword);
    console.log('New password provided:', !!newPassword);
    console.log('User has comparePassword method:', typeof user.comparePassword);
    console.log('Stored password hash:', user.password?.substring(0, 20) + '...');

    // Verify current password
    const isValidPassword = await user.comparePassword(currentPassword);
    console.log('Current password valid:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('Password verification failed for user:', user.email);
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Update password (will be hashed by pre-save middleware)
    user.password = newPassword;
    await user.save();
    
    console.log('Password changed successfully for user:', user.email);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password', details: error.message });
  }
});

// Get user activity/statistics
router.get('/activity', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;
    const Permit = require('../models/Permit');
    
    const activityData = {
      permitReviews: 0,
      inspectionCount: 0,
      departmentReviews: 0,
      recentActivity: []
    };

    // If user is municipal, get real statistics
    if (req.user.userType === 'municipal') {
      // Count permits reviewed by this user
      const permitReviewsCount = await Permit.countDocuments({
        'reviewedBy.id': userId
      });

      // Count department reviews by this user
      const departmentReviewsCount = await Permit.countDocuments({
        'departmentReviews.reviewer.id': userId
      });

      // Count inspections completed by this user
      const inspectionCount = await Permit.countDocuments({
        'inspections.inspector.id': userId
      });

      activityData.permitReviews = permitReviewsCount;
      activityData.inspectionCount = inspectionCount;
      activityData.departmentReviews = departmentReviewsCount;
      
      // Get recent activity - permits reviewed, inspections completed, department reviews
      const recentPermitReviews = await Permit.find({
        'reviewedBy.id': userId
      })
        .sort({ approvedDate: -1 })
        .limit(3)
        .select('permitNumber approvedDate')
        .lean();

      const recentInspections = await Permit.find({
        'inspections.inspector.id': userId
      })
        .sort({ 'inspections.completedDate': -1 })
        .limit(3)
        .select('permitNumber inspections')
        .lean();

      const recentDepartmentReviews = await Permit.find({
        'departmentReviews.reviewer.id': userId
      })
        .sort({ 'departmentReviews.reviewedAt': -1 })
        .limit(3)
        .select('permitNumber departmentReviews')
        .lean();

      // Build recent activity array
      const activities = [];

      // Add permit reviews
      recentPermitReviews.forEach(permit => {
        if (permit.approvedDate) {
          activities.push({
            icon: '📋',
            description: `Reviewed permit application #${permit.permitNumber}`,
            timestamp: permit.approvedDate
          });
        }
      });

      // Add inspections
      recentInspections.forEach(permit => {
        const userInspections = permit.inspections?.filter(
          inspection => inspection.inspector?.id?.toString() === userId.toString() && inspection.completedDate
        ) || [];
        userInspections.forEach(inspection => {
          activities.push({
            icon: '🔍',
            description: `Completed ${inspection.type} inspection for permit #${permit.permitNumber}`,
            timestamp: inspection.completedDate
          });
        });
      });

      // Add department reviews
      recentDepartmentReviews.forEach(permit => {
        const userReviews = permit.departmentReviews?.filter(
          review => review.reviewer?.id?.toString() === userId.toString() && review.reviewedAt
        ) || [];
        userReviews.forEach(review => {
          activities.push({
            icon: '✅',
            description: `${review.status === 'approved' ? 'Approved' : 'Reviewed'} ${review.department} department review for permit #${permit.permitNumber}`,
            timestamp: review.reviewedAt
          });
        });
      });

      // Sort activities by timestamp (newest first) and take top 5
      activityData.recentActivity = activities
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5);
    }

    res.json(activityData);
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity', details: error.message });
  }
});

module.exports = router;