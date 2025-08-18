const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Property = require('../models/Property');
const Municipality = require('../models/Municipality');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Get all properties for a user
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { municipalityId } = req.query;
    
    // Verify access (user can only see their own properties, unless municipal)
    if (req.user.userId !== userId && req.user.userType !== 'municipal') {
      return res.status(403).json({ error: 'Access denied' });
    }

    let properties;
    if (municipalityId) {
      // Filter properties by municipality
      properties = await Property.getUserPropertiesByMunicipality(userId, municipalityId);
    } else {
      properties = await Property.getUserProperties(userId);
    }
    
    res.json(properties);

  } catch (error) {
    console.error('Error fetching user properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// Get user's primary property
router.get('/user/:userId/primary', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verify access
    if (req.user.userId !== userId && req.user.userType !== 'municipal') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const primaryProperty = await Property.getPrimary(userId);
    
    if (!primaryProperty) {
      return res.status(404).json({ error: 'No primary property found' });
    }
    
    res.json(primaryProperty);

  } catch (error) {
    console.error('Error fetching primary property:', error);
    res.status(500).json({ error: 'Failed to fetch primary property' });
  }
});

// Create a new property
router.post('/', authenticateToken, async (req, res) => {
  try {
    const propertyData = req.body;
    
    // Validate required fields
    if (!propertyData.address || !propertyData.address.street || 
        !propertyData.address.city || !propertyData.municipalityId) {
      return res.status(400).json({ 
        error: 'Missing required fields: address (street, city) and municipalityId' 
      });
    }

    // Verify municipality exists
    const municipality = await Municipality.findById(propertyData.municipalityId);
    if (!municipality) {
      return res.status(400).json({ error: 'Invalid municipality' });
    }

    // Check if this is the user's first property (auto-set as primary)
    const existingProperties = await Property.find({ 
      owner: req.user.userId, 
      isActive: true 
    });
    
    const isFirstProperty = existingProperties.length === 0;

    const newProperty = new Property({
      owner: req.user.userId,
      displayName: propertyData.displayName || propertyData.address.street,
      address: {
        street: propertyData.address.street,
        city: propertyData.address.city,
        state: propertyData.address.state || municipality.state,
        zip: propertyData.address.zip,
        county: propertyData.address.county,
        parcelId: propertyData.address.parcelId
      },
      municipality: propertyData.municipalityId,
      propertyType: propertyData.propertyType || 'residential',
      details: propertyData.details || {},
      isPrimary: isFirstProperty || propertyData.isPrimary || false,
      notes: propertyData.notes
    });

    const savedProperty = await newProperty.save();
    await savedProperty.populate('municipality');

    res.status(201).json({
      success: true,
      message: 'Property added successfully',
      property: savedProperty
    });

  } catch (error) {
    console.error('Error creating property:', error);
    res.status(500).json({ error: 'Failed to create property' });
  }
});

// Update property
router.put('/:propertyId', authenticateToken, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const updateData = req.body;
    
    // Find property and verify ownership
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    if (property.owner.toString() !== req.user.userId && req.user.userType !== 'municipal') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update allowed fields
    const allowedUpdates = [
      'displayName', 'address', 'propertyType', 'details', 'notes'
    ];
    
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        property[field] = updateData[field];
      }
    });

    const updatedProperty = await property.save();
    await updatedProperty.populate('municipality');

    res.json({
      success: true,
      message: 'Property updated successfully',
      property: updatedProperty
    });

  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ error: 'Failed to update property' });
  }
});

// Set property as primary
router.put('/:propertyId/set-primary', authenticateToken, async (req, res) => {
  try {
    const { propertyId } = req.params;
    
    // Find property and verify ownership
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    if (property.owner.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await property.setAsPrimary();
    await property.populate('municipality');

    res.json({
      success: true,
      message: 'Primary property updated successfully',
      property: property
    });

  } catch (error) {
    console.error('Error setting primary property:', error);
    res.status(500).json({ error: 'Failed to set primary property' });
  }
});

// Delete property (soft delete)
router.delete('/:propertyId', authenticateToken, async (req, res) => {
  try {
    const { propertyId } = req.params;
    
    // Find property and verify ownership
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    if (property.owner.toString() !== req.user.userId && req.user.userType !== 'municipal') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Don't allow deletion if it's the only property
    const userProperties = await Property.find({ 
      owner: req.user.userId, 
      isActive: true 
    });
    
    if (userProperties.length === 1) {
      return res.status(400).json({ 
        error: 'Cannot delete your only property. Add another property first.' 
      });
    }

    // Soft delete
    property.isActive = false;
    
    // If this was the primary property, set another as primary
    if (property.isPrimary) {
      property.isPrimary = false;
      await property.save();
      
      // Set the most recent remaining property as primary
      const nextPrimary = await Property.findOne({ 
        owner: req.user.userId, 
        isActive: true,
        _id: { $ne: propertyId }
      }).sort({ createdAt: -1 });
      
      if (nextPrimary) {
        await nextPrimary.setAsPrimary();
      }
    } else {
      await property.save();
    }

    res.json({
      success: true,
      message: 'Property removed successfully'
    });

  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({ error: 'Failed to delete property' });
  }
});

module.exports = router;