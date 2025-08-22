const express = require('express');
const router = express.Router();
const InspectionRequest = require('../models/InspectionRequest');
const Permit = require('../models/Permit');
const auth = require('../middleware/auth');

// Request an inspection (for permit holders)
router.post('/', auth, async (req, res) => {
  try {
    const { permitId, requestType, preferredDate, inspectionType, notes } = req.body;

    // Verify the permit exists and belongs to the user
    const permit = await Permit.findById(permitId);
    if (!permit) {
      return res.status(404).json({ message: 'Permit not found' });
    }

    // Check if user has permission to request inspection for this permit
    if (permit.applicant.toString() !== req.user.id && 
        permit.contractor?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to request inspection for this permit' });
    }

    // Check if permit is in correct status for inspection
    if (permit.status !== 'approved') {
      return res.status(400).json({ message: 'Permit must be approved before requesting inspection' });
    }

    // Check for existing pending inspection requests
    const existingRequest = await InspectionRequest.findOne({
      permitId,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'There is already a pending inspection request for this permit' });
    }

    // Create inspection request
    const inspectionRequest = new InspectionRequest({
      permitId,
      requestedBy: req.user.id,
      requestType,
      preferredDate: requestType === 'specific_date' ? preferredDate : undefined,
      inspectionType: inspectionType || 'Final Inspection',
      notes
    });

    await inspectionRequest.save();

    // Update permit status to indicate inspection requested
    await Permit.findByIdAndUpdate(permitId, {
      status: 'inspection-requested'
    });

    // Populate the response
    await inspectionRequest.populate([
      { path: 'requestedBy', select: 'firstName lastName email' },
      { path: 'permitId', select: 'permitNumber type status' }
    ]);

    res.status(201).json(inspectionRequest);
  } catch (error) {
    console.error('Error creating inspection request:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get inspection requests for a permit (for permit holders and municipal users)
router.get('/permit/:permitId', auth, async (req, res) => {
  try {
    const { permitId } = req.params;

    const permit = await Permit.findById(permitId);
    if (!permit) {
      return res.status(404).json({ message: 'Permit not found' });
    }

    // Check permissions
    const isMunicipalUser = req.user.role === 'municipal';
    const isPermitOwner = permit.applicant.toString() === req.user.id || 
                         permit.contractor?.toString() === req.user.id;

    if (!isMunicipalUser && !isPermitOwner) {
      return res.status(403).json({ message: 'Not authorized to view inspection requests for this permit' });
    }

    const inspectionRequests = await InspectionRequest.find({ permitId })
      .populate([
        { path: 'requestedBy', select: 'firstName lastName email' },
        { path: 'scheduledBy', select: 'firstName lastName email' }
      ])
      .sort({ createdAt: -1 });

    res.json(inspectionRequests);
  } catch (error) {
    console.error('Error fetching inspection requests:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Schedule an inspection (for municipal users)
router.put('/:requestId/schedule', auth, async (req, res) => {
  try {
    if (req.user.role !== 'municipal') {
      return res.status(403).json({ message: 'Only municipal users can schedule inspections' });
    }

    const { requestId } = req.params;
    const { scheduledDate, inspector } = req.body;

    const inspectionRequest = await InspectionRequest.findById(requestId);
    if (!inspectionRequest) {
      return res.status(404).json({ message: 'Inspection request not found' });
    }

    if (inspectionRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Can only schedule pending inspection requests' });
    }

    // Update the inspection request
    inspectionRequest.status = 'scheduled';
    inspectionRequest.scheduledDate = scheduledDate;
    inspectionRequest.scheduledBy = req.user.id;
    
    if (inspector) {
      inspectionRequest.inspector = inspector;
    }

    await inspectionRequest.save();

    // Update permit status
    await Permit.findByIdAndUpdate(inspectionRequest.permitId, {
      status: 'inspections'
    });

    // Add inspection to permit's inspections array
    await Permit.findByIdAndUpdate(inspectionRequest.permitId, {
      $push: {
        inspections: {
          type: inspectionRequest.inspectionType,
          status: 'scheduled',
          scheduledDate: scheduledDate,
          inspector: inspector || { name: req.user.firstName + ' ' + req.user.lastName, id: req.user.id }
        }
      }
    });

    await inspectionRequest.populate([
      { path: 'requestedBy', select: 'firstName lastName email' },
      { path: 'scheduledBy', select: 'firstName lastName email' }
    ]);

    res.json(inspectionRequest);
  } catch (error) {
    console.error('Error scheduling inspection:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all pending inspection requests (for municipal users)
router.get('/pending', auth, async (req, res) => {
  try {
    if (req.user.role !== 'municipal') {
      return res.status(403).json({ message: 'Only municipal users can view pending inspection requests' });
    }

    const inspectionRequests = await InspectionRequest.find({ status: 'pending' })
      .populate([
        { path: 'requestedBy', select: 'firstName lastName email' },
        { path: 'permitId', select: 'permitNumber type status property' }
      ])
      .sort({ createdAt: 1 }); // Oldest first

    res.json(inspectionRequests);
  } catch (error) {
    console.error('Error fetching pending inspection requests:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;