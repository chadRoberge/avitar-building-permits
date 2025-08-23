const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    console.log('Auth middleware - token exists:', !!token);

    if (!token) {
      console.log('No token provided');
      return res
        .status(401)
        .json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback_secret_key',
    );
    console.log('Decoded token:', decoded);

    // Support both old format (id) and new format (userId)
    const userId = decoded.userId || decoded.id;
    const user = await User.findById(userId).populate('municipality');

    if (!user || !user.isActive) {
      console.log('User not found or inactive for ID:', userId);
      return res.status(401).json({ error: 'Access denied. Invalid token.' });
    }

    console.log('Auth middleware successful for user:', user.email);
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.status(401).json({ error: 'Access denied. Invalid token.' });
  }
};

module.exports = auth;
