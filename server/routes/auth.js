const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      userType: user.userType,
      email: user.email,
    },
    process.env.JWT_SECRET || 'fallback_secret_key',
    {
      expiresIn: '7d',
    },
  );
};

// Register
router.post('/register', async (req, res) => {
  console.log('=== REGISTRATION REQUEST ===');
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  console.log('Body exists:', !!req.body);
  console.log('Body keys:', Object.keys(req.body || {}));

  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      userType,
      municipality,
      propertyAddress,
      propertyInfo,
      businessInfo,
    } = req.body;

    console.log(
      'Registration request body:',
      JSON.stringify(req.body, null, 2),
    );
    console.log('Extracted registration data:', {
      email,
      userType,
      municipality: municipality?.name || municipality,
      propertyAddress,
      propertyInfo,
      businessInfo,
    });

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: 'User with this email already exists' });
    }

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !userType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Prepare user data based on user type
    const userData = {
      email,
      password,
      firstName,
      lastName,
      phone,
      userType,
    };

    // Handle municipality data for different user types
    if (userType === 'municipal') {
      if (!municipality?.name) {
        return res
          .status(400)
          .json({ error: 'Municipality is required for municipal users' });
      }
      userData.municipality = municipality;
    } else if (userType === 'residential') {
      if (!municipality?.id && !municipality?._id) {
        return res
          .status(400)
          .json({ error: 'Municipality is required for residential users' });
      }

      // Validate that property city matches municipality city
      if (propertyAddress?.city && municipality?.city) {
        const municipalityCity = municipality.city.toLowerCase().trim();
        const propertyCity = propertyAddress.city.toLowerCase().trim();

        if (municipalityCity !== propertyCity) {
          return res.status(400).json({
            error: `Property must be located in ${municipality.city}. You entered "${propertyAddress.city}".`,
          });
        }
      }

      // For residential users, store municipality ID and property address
      userData.municipality = {
        _id: municipality.id || municipality._id,
        name: municipality.name,
      };

      if (propertyAddress) {
        userData.propertyAddress = propertyAddress;
      }

      if (propertyInfo) {
        userData.propertyInfo = propertyInfo;
      }
    } else if (userType === 'commercial') {
      if (!municipality?.id && !municipality?._id) {
        return res
          .status(400)
          .json({ error: 'Municipality is required for commercial users' });
      }

      userData.municipality = {
        _id: municipality.id || municipality._id,
        name: municipality.name,
      };

      if (businessInfo) {
        userData.businessInfo = businessInfo;
      }
    }

    console.log('Creating user with data:', userData);

    // Create user
    const user = new User(userData);
    const savedUser = await user.save();
    
    console.log('User created successfully with ID:', savedUser._id);

    // For residential users, create a Property record from their property address
    console.log('Checking property creation conditions:', {
      userType,
      hasPropertyAddress: !!propertyAddress,
      propertyAddress,
      hasPropertyInfo: !!propertyInfo,
      propertyInfo,
      savedUserId: savedUser._id
    });
    
    if (userType === 'residential' && propertyAddress) {
      console.log('Creating property record for residential user');
      
      const Property = require('../models/Property');
      const Municipality = require('../models/Municipality');
      
      try {
        // Get the municipality data for proper property creation
        const municipalityId = userData.municipality._id || municipality.id || municipality._id;
        const fullMunicipality = await Municipality.findById(municipalityId);
        
        if (fullMunicipality) {
          // Map frontend property type to database enum values
          const frontendPropertyType = propertyInfo?.type || 'residential';
          const propertyTypeMapping = {
            'single-family': 'residential',
            'multi-family': 'residential',
            'townhouse': 'residential',
            'condo': 'residential',
            'residential': 'residential',
            'commercial': 'commercial',
            'industrial': 'industrial',
            'mixed-use': 'mixed-use'
          };
          
          const propertyType = propertyTypeMapping[frontendPropertyType] || 'residential';
          
          // Use the original frontend type for display name (more descriptive)
          const propertyDisplayName = propertyInfo?.displayName || 
            (frontendPropertyType.split('-').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join('-'));
          
          // Create property data matching the dashboard property creation structure
          const propertyData = {
            owner: savedUser._id,
            displayName: propertyDisplayName,
            address: {
              street: propertyAddress.street,
              city: propertyAddress.city,
              state: propertyAddress.state || fullMunicipality.state,
              zip: propertyAddress.zip,
              county: propertyAddress.county,
              parcelId: propertyAddress.parcelId,
            },
            municipality: municipalityId,
            propertyType: propertyType,
            details: propertyInfo?.details || {},
            isPrimary: true, // First property is always primary during signup
            notes: propertyInfo?.notes || 'Created during user registration',
          };

          console.log('Property data to create:', propertyData);
          
          // Create and save property using the same structure as dashboard
          const property = new Property({
            owner: propertyData.owner,
            displayName: propertyData.displayName,
            address: {
              street: propertyData.address.street,
              city: propertyData.address.city,
              state: propertyData.address.state,
              zip: propertyData.address.zip,
              county: propertyData.address.county,
              parcelId: propertyData.address.parcelId,
            },
            municipality: propertyData.municipality,
            propertyType: propertyData.propertyType,
            details: propertyData.details,
            isPrimary: propertyData.isPrimary,
            notes: propertyData.notes,
          });
          
          const savedProperty = await property.save();
          await savedProperty.populate('municipality');
          
          console.log('Property created successfully:', {
            id: savedProperty._id,
            displayName: savedProperty.displayName,
            address: savedProperty.address,
            municipality: savedProperty.municipality?.name,
            propertyType: savedProperty.propertyType,
            isPrimary: savedProperty.isPrimary
          });
        } else {
          console.error('Municipality not found for property creation:', municipalityId);
        }
      } catch (propertyError) {
        console.error('Error creating property during signup:', propertyError);
        // Don't fail the user registration if property creation fails
      }
    }

    // Generate token
    const token = generateToken(savedUser);

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: savedUser,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, userType, municipality, municipalityName } = req.body;

    // Debug logging for admin login attempts
    if (email === 'admin@avitarbuildingpermits.com') {
      console.log('=== ADMIN LOGIN ATTEMPT ===');
      console.log('Email:', email);
      console.log('Requested userType:', userType);
      console.log('Environment:', process.env.NODE_ENV);
      console.log('Vercel:', !!process.env.VERCEL);
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check database connection
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.error('Database not connected. Connection state:', mongoose.connection.readyState);
      return res.status(503).json({ error: 'Service temporarily unavailable. Database connection issue.' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user || !user.isActive) {
      if (email === 'admin@avitarbuildingpermits.com') {
        console.log('Admin user not found or inactive:', { userFound: !!user, isActive: user?.isActive });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Debug admin user details
    if (email === 'admin@avitarbuildingpermits.com') {
      console.log('Admin user found:', {
        userType: user.userType,
        isActive: user.isActive,
        requestedType: userType
      });
    }

    // Check if user type matches requested login type
    if (userType && user.userType !== userType) {
      if (email === 'admin@avitarbuildingpermits.com') {
        console.log('Admin userType mismatch detected');
      }
      
      // Special handling for admin user - auto-fix userType if needed
      if (email === 'admin@avitarbuildingpermits.com' && userType === 'system_admin') {
        console.log(`Admin user has incorrect userType: ${user.userType}, updating to system_admin`);
        user.userType = 'system_admin';
        await user.save();
        console.log('Admin user type updated successfully');
        // Continue with login process after fixing userType
      } else if (userType === 'municipal') {
        return res.status(401).json({
          error:
            'This portal is for municipal staff only. Please use the public portal.',
        });
      } else {
        return res
          .status(401)
          .json({ error: 'Invalid user type for this portal' });
      }
    } else if (email === 'admin@avitarbuildingpermits.com') {
      console.log('Admin userType matches or no userType requested - proceeding with login');
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // For residential users, validate and potentially update municipality association
    if (userType === 'residential' && municipality) {
      console.log('Validating municipality for residential user:', {
        userId: user._id,
        requestedMunicipality: municipality,
        requestedMunicipalityName: municipalityName,
        currentMunicipality: user.municipality
      });
      
      // If user doesn't have a municipality or it doesn't match the selected one,
      // update it (this allows users to access different municipalities)
      const currentMunicipalityId = user.municipality?._id?.toString() || user.municipality?.toString();
      const requestedMunicipalityId = municipality.toString();
      
      if (!currentMunicipalityId || currentMunicipalityId !== requestedMunicipalityId) {
        console.log('Updating user municipality association');
        
        // Fetch the full municipality object
        try {
          const Municipality = require('../models/Municipality');
          const fullMunicipality = await Municipality.findById(municipality);
          
          if (fullMunicipality) {
            user.municipality = fullMunicipality._id;
            console.log('Updated user municipality to:', fullMunicipality.name);
          } else {
            console.warn('Municipality not found:', municipality);
          }
        } catch (municipalityError) {
          console.error('Error updating municipality:', municipalityError);
          // Don't fail the login if municipality update fails
        }
      }
    }

    // Update last login date
    user.lastLoginDate = new Date();
    
    try {
      await user.save();
    } catch (saveError) {
      console.error('Error saving user during login:', saveError);
      // Continue with login even if save fails
    }

    // Generate token
    const token = generateToken(user);

    // Populate municipality information for the response
    try {
      await user.populate('municipality');
    } catch (populateError) {
      console.error('Error populating municipality during login:', populateError);
      // Continue without municipality population if it fails
    }

    res.json({
      message: 'Login successful',
      token,
      user,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout (optional - mainly for token blacklisting if implemented)
router.post('/logout', auth, async (req, res) => {
  try {
    // In a production app, you might want to blacklist the token
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error during logout' });
  }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, userType } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    // Find user
    const user = await User.findOne({ email, isActive: true });

    // Always return success for security (don't reveal if email exists)
    if (!user) {
      return res.json({
        message:
          'If an account with that email exists, you will receive password reset instructions.',
      });
    }

    // Check user type if specified
    if (userType && user.userType !== userType) {
      return res.json({
        message:
          'If an account with that email exists, you will receive password reset instructions.',
      });
    }

    // Generate reset token (in production, use crypto.randomBytes)
    const resetToken = jwt.sign(
      { id: user._id, purpose: 'password-reset' },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '1h' },
    );

    // TODO: In production, send actual email
    // For now, just log the reset link
    console.log(`Password reset link for ${email}:`);
    console.log(`http://localhost:4200/reset-password?token=${resetToken}`);

    // Store reset token (in production, you might want to store this in database)
    // For now, just return success

    res.json({
      message:
        'If an account with that email exists, you will receive password reset instructions.',
      // TODO: Remove this in production
      resetToken: resetToken,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res
      .status(500)
      .json({ error: 'Server error processing password reset request' });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ error: 'Reset token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: 'Password must be at least 6 characters long' });
    }

    // Verify reset token
    let decoded;
    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'fallback_secret_key',
      );
    } catch (error) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    if (decoded.purpose !== 'password-reset') {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    // Find user
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error during password reset' });
  }
});

module.exports = router;
