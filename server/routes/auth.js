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
    await user.save();

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      message: 'User created successfully',
      token,
      user,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, userType } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user type matches requested login type
    if (userType && user.userType !== userType) {
      if (userType === 'municipal') {
        return res.status(401).json({
          error:
            'This portal is for municipal staff only. Please use the public portal.',
        });
      } else {
        return res
          .status(401)
          .json({ error: 'Invalid user type for this portal' });
      }
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user);

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
