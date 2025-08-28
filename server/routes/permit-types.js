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

    console.log('Creating permit type with data:', {
      requiredDepartments: req.body.requiredDepartments,
      requiredInspections: req.body.requiredInspections,
      name: req.body.name
    });

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

      // Set required inspections from frontend
      requiredInspections: req.body.requiredInspections || [],

      // Set required departments from frontend  
      requiredDepartments: req.body.requiredDepartments || [],

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

    console.log('Updating permit type with data:', {
      requiredDepartments: req.body.requiredDepartments,
      requiredInspections: req.body.requiredInspections,
      name: req.body.name,
      feeStructure: req.body.feeStructure,
      departmentChecklists: req.body.departmentChecklists
    });

    // Handle enhanced fee structure
    if (req.body.feeStructure !== undefined) {
      console.log('Processing fee structure:', req.body.feeStructure);
      
      const feeStructure = req.body.feeStructure;
      const fees = [];
      
      // Always add base fee if provided
      if (feeStructure.baseFee && feeStructure.baseFee > 0) {
        fees.push({
          name: 'Base Application Fee',
          type: 'fixed',
          amount: parseFloat(feeStructure.baseFee),
          description: 'Base application fee'
        });
      }
      
      // Add additional fee structure based on type
      if (feeStructure.additionalType && feeStructure.additionalType !== 'none') {
        switch (feeStructure.additionalType) {
          case 'percentage':
            if (feeStructure.percentage) {
              fees.push({
                name: 'Project Value Fee',
                type: 'percentage',
                percentage: parseFloat(feeStructure.percentage),
                baseField: 'projectValue',
                description: `${feeStructure.percentage}% of project value`,
                minimumAmount: parseFloat(feeStructure.minimumFee) || 0
              });
            }
            break;
          case 'square_footage':
            if (feeStructure.feePerSquareFoot) {
              fees.push({
                name: 'Square Footage Fee',
                type: 'per-unit',
                unitAmount: parseFloat(feeStructure.feePerSquareFoot),
                unitField: 'squareFootage',
                description: `$${feeStructure.feePerSquareFoot} per square foot`,
                minimumAmount: parseFloat(feeStructure.minimumFee) || 0
              });
            }
            break;
          case 'tiered':
            if (feeStructure.tiers && feeStructure.tiers.length > 0) {
              fees.push({
                name: 'Tiered Fee',
                type: 'tiered',
                baseField: 'projectValue',
                description: 'Tiered fee based on project value',
                tiers: feeStructure.tiers.map(tier => ({
                  min: parseFloat(tier.minValue) || 0,
                  max: parseFloat(tier.maxValue) || Infinity,
                  amount: parseFloat(tier.fee) || 0
                }))
              });
            }
            break;
        }
      }
      
      permitType.fees = fees;
      delete req.body.feeStructure;
    }
    
    // Handle legacy baseFee for backwards compatibility
    else if (req.body.baseFee !== undefined) {
      const baseFee = parseFloat(req.body.baseFee) || 0;
      if (baseFee > 0) {
        permitType.fees = [{
          name: 'Application Fee',
          type: 'fixed',
          amount: baseFee,
          description: 'Standard application fee'
        }];
      } else {
        permitType.fees = [];
      }
      delete req.body.baseFee;
    }

    // Handle formFields specially - convert to applicationFields
    if (req.body.formFields) {
      permitType.applicationFields = req.body.formFields.map((field, index) => ({
        name: field.id || `field_${index}`,
        label: field.label,
        type: field.type,
        required: field.isRequired || false,
        helpText: field.description,
        options: field.options
          ? field.options.map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt))
          : [],
        order: index,
      }));
      // Remove formFields from the request body since it's converted to applicationFields
      delete req.body.formFields;
    }

    // Handle department checklists specially
    if (req.body.departmentChecklists !== undefined) {
      console.log('Processing department checklists:', req.body.departmentChecklists);
      
      // Validate and process department checklists
      const validDepartments = ['building', 'planning', 'fire', 'health', 'engineering', 'zoning', 'environmental', 'finance'];
      const processedChecklists = {};
      
      for (const [department, items] of Object.entries(req.body.departmentChecklists)) {
        if (validDepartments.includes(department) && Array.isArray(items)) {
          processedChecklists[department] = items.map((item, index) => ({
            id: item.id || `${department}-item-${index}`,
            label: item.label || '',
            required: Boolean(item.required),
            order: item.order || index
          })).filter(item => item.label.trim() !== ''); // Remove empty labels
        }
      }
      
      permitType.departmentChecklists = processedChecklists;
      delete req.body.departmentChecklists;
    }

    // Update remaining fields
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

// Update department checklists for a permit type
router.put('/:id/department-checklists', auth, async (req, res) => {
  try {
    const permitType = await PermitType.findById(req.params.id);

    if (!permitType) {
      return res.status(404).json({ message: 'Permit type not found' });
    }

    // Check if user belongs to the same municipality
    const userMunicipalityId = req.user.municipality._id || req.user.municipality;
    if (permitType.municipality.toString() !== userMunicipalityId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { departmentChecklists } = req.body;
    
    console.log('Updating department checklists for permit type:', permitType.name);
    console.log('New checklists:', JSON.stringify(departmentChecklists, null, 2));

    // Validate the checklist structure
    const validDepartments = ['building', 'planning', 'fire', 'health', 'engineering', 'zoning', 'environmental', 'finance'];
    
    for (const department of Object.keys(departmentChecklists)) {
      if (!validDepartments.includes(department)) {
        return res.status(400).json({ 
          message: `Invalid department: ${department}. Valid departments are: ${validDepartments.join(', ')}` 
        });
      }
      
      // Validate checklist items
      for (const item of departmentChecklists[department]) {
        if (!item.id || !item.label) {
          return res.status(400).json({ 
            message: `Each checklist item must have 'id' and 'label' properties. Department: ${department}` 
          });
        }
      }
    }

    // Update the department checklists
    permitType.departmentChecklists = departmentChecklists;
    await permitType.save();

    res.json({
      message: 'Department checklists updated successfully',
      permitType: {
        id: permitType._id,
        name: permitType.name,
        departmentChecklists: permitType.departmentChecklists
      }
    });
  } catch (error) {
    console.error('Error updating department checklists:', error);
    res.status(500).json({ 
      message: 'Error updating department checklists', 
      error: error.message 
    });
  }
});

// Get department checklists for a permit type
router.get('/:id/department-checklists', auth, async (req, res) => {
  try {
    const permitType = await PermitType.findById(req.params.id);

    if (!permitType) {
      return res.status(404).json({ message: 'Permit type not found' });
    }

    // Check if user belongs to the same municipality
    const userMunicipalityId = req.user.municipality._id || req.user.municipality;
    if (permitType.municipality.toString() !== userMunicipalityId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({
      permitTypeId: permitType._id,
      permitTypeName: permitType.name,
      requiredDepartments: permitType.requiredDepartments || [],
      departmentChecklists: permitType.departmentChecklists || {}
    });
  } catch (error) {
    console.error('Error fetching department checklists:', error);
    res.status(500).json({ 
      message: 'Error fetching department checklists', 
      error: error.message 
    });
  }
});

module.exports = router;
