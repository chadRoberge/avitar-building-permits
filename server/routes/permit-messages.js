const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const PermitMessage = require('../models/PermitMessage');
const Permit = require('../models/Permit');
const User = require('../models/User');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('JWT verification failed:', error.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Get messages for a specific permit
router.get('/permit/:permitId', authenticateToken, async (req, res) => {
  try {
    const { permitId } = req.params;
    const userId = req.user.userId;
    const userType = req.user.userType;

    // First verify the user has access to this permit
    const permit = await Permit.findById(permitId);
    if (!permit) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    // Check access permissions
    const hasAccess =
      permit.applicant?.id === userId ||
      permit.contractor?.id === userId ||
      userType === 'municipal';

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get messages for this permit
    const messages = await PermitMessage.getPermitMessages(permitId, userType);

    // Mark messages as read for this user
    await PermitMessage.markAsRead(permitId, userId);

    res.json(messages);
  } catch (error) {
    console.error('Error fetching permit messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Post a new message to a permit
router.post('/permit/:permitId', authenticateToken, async (req, res) => {
  try {
    const { permitId } = req.params;
    const { message, messageType = 'general', isInternal = false } = req.body;
    const userId = req.user.userId;
    const userType = req.user.userType;

    // Validate message content
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (message.length > 2000) {
      return res
        .status(400)
        .json({ error: 'Message too long (max 2000 characters)' });
    }

    // Verify the user has access to this permit
    const permit = await Permit.findById(permitId);
    if (!permit) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    const hasAccess =
      permit.applicant?.id === userId ||
      permit.contractor?.id === userId ||
      userType === 'municipal';

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get user information for the message
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Determine sender type and department
    let senderType;
    let department = null;

    if (userType === 'municipal') {
      senderType = 'municipal_staff';
      department = user.department || 'Municipal Staff';
    } else if (userType === 'commercial') {
      senderType = 'contractor';
    } else {
      senderType = 'applicant';
    }

    // Only municipal staff can send internal messages
    const messageIsInternal = isInternal && userType === 'municipal';

    // Create the message
    const newMessage = new PermitMessage({
      permit: permitId,
      message: message.trim(),
      messageType: messageType,
      isInternal: messageIsInternal,
      sender: {
        id: userId,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        type: senderType,
        department: department,
      },
    });

    const savedMessage = await newMessage.save();

    console.log('New permit message created:', {
      permitId,
      messageId: savedMessage._id,
      sender: savedMessage.sender.name,
      type: savedMessage.messageType,
    });

    res.status(201).json({
      message: 'Message sent successfully',
      data: savedMessage,
    });
  } catch (error) {
    console.error('Error posting permit message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get unread message count for a permit
router.get('/permit/:permitId/unread', authenticateToken, async (req, res) => {
  try {
    const { permitId } = req.params;
    const userId = req.user.userId;
    const userType = req.user.userType;

    // Verify access to permit
    const permit = await Permit.findById(permitId);
    if (!permit) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    const hasAccess =
      permit.applicant?.id === userId ||
      permit.contractor?.id === userId ||
      userType === 'municipal';

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Count unread messages (exclude own messages and internal if not municipal)
    const query = {
      permit: permitId,
      'sender.id': { $ne: userId },
      isRead: false,
    };

    if (userType !== 'municipal') {
      query.isInternal = { $ne: true };
    }

    const unreadCount = await PermitMessage.countDocuments(query);

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error getting unread message count:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Delete a message (only sender or municipal staff)
router.delete('/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;
    const userType = req.user.userType;

    const message = await PermitMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Only allow deletion by sender or municipal staff
    const canDelete = message.sender.id === userId || userType === 'municipal';

    if (!canDelete) {
      return res.status(403).json({ error: 'Cannot delete this message' });
    }

    await PermitMessage.findByIdAndDelete(messageId);

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;
