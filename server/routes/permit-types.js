const express = require('express');
const router = express.Router();
const PermitType = require('../models/PermitType');
const auth = require('../middleware/auth');

// Get all permit types for a municipality
router.get('/', auth, async (req, res) => {
  try {
    // Get municipality ID from authenticated user
    const municipalityId = req.user.municipality._id || req.user.municipality;

    if (!municipalityId) {
      return res
        .status(400)
        .json({ message: 'Municipality not found for user' });
    }

    const permitTypes = await PermitType.getByMunicipality(
      municipalityId,
      true,
    ); // Include inactive

    res.json(permitTypes);
  } catch (error) {
    console.error('Error fetching permit types:', error);
    res
      .status(500)
      .json({ message: 'Error fetching permit types', error: error.message });
  }
});

// Get a specific permit type
router.get('/:id', auth, async (req, res) => {
  try {
    const permitType = await PermitType.findById(req.params.id);

    if (!permitType) {
      return res.status(404).json({ message: 'Permit type not found' });
    }

    // Check if user belongs to the same municipality
    const userMunicipalityId =
      req.user.municipality._id || req.user.municipality;

    if (permitType.municipality.toString() !== userMunicipalityId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(permitType);
  } catch (error) {
    console.error('Error fetching permit type:', error);
    res
      .status(500)
      .json({ message: 'Error fetching permit type', error: error.message });
  }
});

// Create a new permit type
router.post('/', auth, async (req, res) => {
  try {
    const municipalityId = req.user.municipality;

    if (!municipalityId) {
      return res
        .status(400)
        .json({ message: 'Municipality not found for user' });
    }

    // Map frontend data to backend model structure
    const permitTypeData = {
      name: req.body.name,
      code: req.body.code,
      description: req.body.description,
      category: req.body.category === 'custom' ? 'other' : req.body.category,
      municipality: municipalityId,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      estimatedProcessingTime: req.body.processingTime || 14,

      // Convert frontend formFields to backend applicationFields
      applicationFields: (req.body.formFields || []).map((field, index) => ({
        name: field.id || `field_${index}`,
        label: field.label,
        type: field.type,
        required: field.isRequired || false,
        helpText: field.description,
        options: field.options
          ? field.options.map((opt) => ({
              value: opt,
              label: opt,
            }))
          : [],
        order: index,
      })),

      // Create basic fee structure if baseFee is provided
      fees: req.body.baseFee
        ? [
            {
              name: 'Application Fee',
              type: 'fixed',
              amount: parseFloat(req.body.baseFee),
              description: 'Standard application fee',
            },
          ]
        : [],

      // Set inspection requirement
      requiredInspections: req.body.requiresInspection
        ? [
            {
              name: 'Standard Inspection',
              description: 'Required inspection for this permit type',
              triggerCondition: 'approval',
            },
          ]
        : [],

      // Custom category handling
      ...(req.body.category === 'custom' && req.body.customCategory
        ? {
            name: req.body.customCategory.name || req.body.name,
            description:
              req.body.customCategory.description || req.body.description,
          }
        : {}),
    };

    // Create the permit type
    const permitType = new PermitType(permitTypeData);
    await permitType.save();

    res.status(201).json(permitType);
  } catch (error) {
    console.error('Error creating permit type:', error);

    // Handle specific MongoDB errors
    if (error.code === 11000) {
      return res.status(400).json({
        message:
          'A permit type with this code already exists for your municipality',
      });
    }

    res
      .status(500)
      .json({ message: 'Error creating permit type', error: error.message });
  }
});

// Update a permit type
router.put('/:id', auth, async (req, res) => {
  try {
    const permitType = await PermitType.findById(req.params.id);

    if (!permitType) {
      return res.status(404).json({ message: 'Permit type not found' });
    }

    // Check if user belongs to the same municipality
    const userMunicipalityId =
      req.user.municipality._id || req.user.municipality;
    if (permitType.municipality.toString() !== userMunicipalityId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update fields
    Object.keys(req.body).forEach((key) => {
      if (req.body[key] !== undefined) {
        permitType[key] = req.body[key];
      }
    });

    await permitType.save();
    res.json(permitType);
  } catch (error) {
    console.error('Error updating permit type:', error);
    res
      .status(500)
      .json({ message: 'Error updating permit type', error: error.message });
  }
});

// Toggle permit type active status
router.patch('/:id/toggle', auth, async (req, res) => {
  try {
    const permitType = await PermitType.findById(req.params.id);

    if (!permitType) {
      return res.status(404).json({ message: 'Permit type not found' });
    }

    // Check if user belongs to the same municipality
    const userMunicipalityId =
      req.user.municipality._id || req.user.municipality;
    if (permitType.municipality.toString() !== userMunicipalityId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    permitType.isActive = !permitType.isActive;
    await permitType.save();

    res.json({ isActive: permitType.isActive });
  } catch (error) {
    console.error('Error toggling permit type:', error);
    res
      .status(500)
      .json({ message: 'Error toggling permit type', error: error.message });
  }
});

// Delete a permit type
router.delete('/:id', auth, async (req, res) => {
  try {
    const permitType = await PermitType.findById(req.params.id);

    if (!permitType) {
      return res.status(404).json({ message: 'Permit type not found' });
    }

    // Check if user belongs to the same municipality
    const userMunicipalityId =
      req.user.municipality._id || req.user.municipality;
    if (permitType.municipality.toString() !== userMunicipalityId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await PermitType.findByIdAndDelete(req.params.id);
    res.json({ message: 'Permit type deleted successfully' });
  } catch (error) {
    console.error('Error deleting permit type:', error);
    res
      .status(500)
      .json({ message: 'Error deleting permit type', error: error.message });
  }
});

// Get permit types by category
router.get('/category/:category', auth, async (req, res) => {
  try {
    const municipalityId = req.user.municipality;
    const { category } = req.params;

    const permitTypes = await PermitType.getByCategory(
      municipalityId,
      category,
    );
    res.json(permitTypes);
  } catch (error) {
    console.error('Error fetching permit types by category:', error);
    res
      .status(500)
      .json({ message: 'Error fetching permit types', error: error.message });
  }
});

module.exports = router;
