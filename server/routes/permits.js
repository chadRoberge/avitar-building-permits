const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Permit = require('../models/Permit');
const PermitType = require('../models/PermitType');

// Helper function to calculate completion date based on duration
function calculateCompletionDate(startDate, duration) {
  const start = new Date(startDate);
  let days = 30; // Default to 30 days
  
  switch (duration) {
    case '1-7 days':
      days = 7;
      break;
    case '1-2 weeks':
      days = 14;
      break;
    case '2-4 weeks':
      days = 28;
      break;
    case '1-3 months':
      days = 90;
      break;
    case '3-6 months':
      days = 180;
      break;
    case '6+ months':
      days = 365;
      break;
  }
  
  const completion = new Date(start);
  completion.setDate(completion.getDate() + days);
  return completion;
}

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('Auth middleware - header exists:', !!authHeader, 'token exists:', !!token);

  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log('JWT verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    console.log('JWT verified successfully for user:', user.userId, 'type:', user.userType);
    req.user = user;
    next();
  });
};

// Get permits for a specific user
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { propertyId, contractorFilter } = req.query;
    
    console.log('Permits request - JWT user:', req.user.userId, 'Requested userId:', userId, 'User type:', req.user.userType, 'PropertyId:', propertyId, 'ContractorFilter:', contractorFilter);
    
    // Verify the requesting user matches the userId or is authorized
    if (req.user.userId !== userId && req.user.userType !== 'municipal') {
      console.log('Access denied - JWT user ID does not match requested user ID');
      return res.status(403).json({ error: 'Access denied' });
    }

    // Build query based on filter type
    let query;
    
    // Automatically use contractor filtering for commercial users, or when explicitly requested
    const useContractorFilter = contractorFilter === 'true' || req.user.userType === 'commercial';
    
    if (useContractorFilter) {
      // For contractors: find permits where they are either the applicant OR the contractor
      query = {
        $or: [
          { 'applicant.id': userId },
          { 'contractor.id': userId }
        ]
      };
    } else {
      // For property owners: find permits where they are the applicant
      query = { 'applicant.id': userId };
      
      // Optionally filter by property for residential users
      if (propertyId) {
        query['property'] = propertyId;
      }
    }

    // Get permits from database
    console.log(`DEBUG: Querying permits for userId: ${userId}, propertyId: ${propertyId}, contractorFilter: ${contractorFilter}`);
    const permits = await Permit.find(query)
      .populate('permitType')
      .populate('municipality')
      .sort({ applicationDate: -1 });

    console.log(`Fetching permits for user ${userId}, found ${permits.length} permits`);
    
    // Debug: Let's also check if there are any permits at all in the database
    const allPermits = await Permit.find({}).limit(5);
    console.log('DEBUG: Sample permits in database:', allPermits.map(p => ({
      id: p._id,
      permitNumber: p.permitNumber,
      applicantId: p.applicant?.id,
      applicantEmail: p.applicant?.email
    })));
    
    // Transform permits to match frontend expectations
    const transformedPermits = permits.map(permit => ({
      id: permit._id,
      applicationId: permit.permitNumber,
      type: permit.permitType?.name || 'Unknown',
      category: permit.permitType?.category || 'general',
      status: permit.status,
      submittedDate: permit.submittedDate || permit.applicationDate,
      approvedDate: permit.approvedDate,
      completedDate: permit.completionDate,
      expiryDate: permit.expirationDate,
      fee: permit.totalFees || 0,
      projectValue: permit.estimatedValue || 0,
      description: permit.projectDescription,
      projectDescription: permit.projectDescription,
      workDescription: permit.workDescription,
      municipality: permit.municipality?.name
    }));

    res.json(transformedPermits);

  } catch (error) {
    console.error('Error fetching permits:', error);
    res.status(500).json({ error: 'Failed to fetch permits' });
  }
});

// Get all permits (for municipal users)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Only municipal users can view all permits
    if (req.user.userType !== 'municipal') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Mock data for all permits
    const mockPermits = [
      {
        id: '1',
        type: 'Building Permit',
        applicant: 'John Doe',
        status: 'pending',
        submittedDate: new Date('2024-01-15'),
        fee: 150.00
      },
      {
        id: '2',
        type: 'Electrical Permit', 
        applicant: 'Jane Smith',
        status: 'approved',
        submittedDate: new Date('2024-01-10'),
        fee: 75.00
      }
    ];

    res.json(mockPermits);

  } catch (error) {
    console.error('Error fetching all permits:', error);
    res.status(500).json({ error: 'Failed to fetch permits' });
  }
});

// Submit a new permit application
router.post('/', authenticateToken, async (req, res) => {
  try {
    const permitData = req.body;
    
    console.log('Received permit application:', permitData);

    // Validate required fields
    if (!permitData.userId || !permitData.municipalityId || !permitData.permitTypeId) {
      return res.status(400).json({ error: 'Missing required fields: userId, municipalityId, or permitTypeId' });
    }

    if (!permitData.projectDescription || permitData.projectDescription.trim().length < 10) {
      return res.status(400).json({ error: 'Project description must be at least 10 characters long' });
    }

    if (!permitData.projectValue || permitData.projectValue < 0) {
      return res.status(400).json({ error: 'Project value must be a positive number' });
    }

    // Verify the user owns this application
    if (req.user.userId !== permitData.userId && req.user.userType !== 'municipal') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get user and permit type details
    const user = await User.findById(permitData.userId);
    const permitType = await PermitType.findById(permitData.permitTypeId);

    if (!user || !permitType) {
      return res.status(400).json({ error: 'Invalid user or permit type' });
    }

    // Create permit in database using the comprehensive model
    const newPermit = new Permit({
      municipality: permitData.municipalityId,
      permitType: permitData.permitTypeId,
      property: permitData.property, // Add the property field
      projectDescription: permitData.projectDescription,
      workDescription: permitData.projectDescription, // Same as project description for now
      estimatedValue: permitData.projectValue,
      estimatedStartDate: new Date(permitData.workDetails.startDate),
      estimatedCompletionDate: permitData.workDetails.estimatedDuration ? 
        calculateCompletionDate(permitData.workDetails.startDate, permitData.workDetails.estimatedDuration) : null,
      
      // Project address (use user's property address)
      projectAddress: {
        street: user.propertyAddress?.street || '',
        city: user.propertyAddress?.city || '',
        state: user.propertyAddress?.state || '',
        zip: user.propertyAddress?.zip || '',
        parcelId: user.propertyAddress?.parcelId || ''
      },

      // Applicant information (the user)
      applicant: {
        id: permitData.userId, // Add the user ID for querying later
        type: 'owner',
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || '',
        address: user.propertyAddress,
        relationshipToProperty: 'owner'
      },

      // Contractor info if provided
      contractor: permitData.contractorInfo ? {
        type: 'contractor',
        firstName: permitData.contractorInfo.name.split(' ')[0] || '',
        lastName: permitData.contractorInfo.name.split(' ').slice(1).join(' ') || '',
        email: permitData.contractorInfo.email || '',
        phone: permitData.contractorInfo.phone || '',
        licenseNumber: permitData.contractorInfo.licenseNumber || '',
        businessName: permitData.contractorInfo.name || ''
      } : null,

      status: 'submitted',
      submittedDate: new Date(),
      
      // Fees
      fees: [{
        type: 'Base Permit Fee',
        amount: permitData.calculatedFee || 0,
        description: `${permitType.name} application fee`
      }],
      
      // Custom fields for additional info
      customFields: {
        additionalInfo: permitData.additionalInfo || '',
        workLocation: permitData.workDetails?.workLocation || 'primary',
        estimatedDuration: permitData.workDetails?.estimatedDuration || ''
      }
    });

    // Save to database
    const savedPermit = await newPermit.save();
    await savedPermit.populate(['permitType', 'municipality']);

    console.log('Saved permit application to database:', savedPermit.permitNumber);

    res.status(201).json({
      success: true,
      message: 'Permit application submitted successfully',
      id: savedPermit.permitNumber,
      applicationId: savedPermit.permitNumber,
      permit: {
        id: savedPermit._id,
        applicationId: savedPermit.permitNumber,
        status: savedPermit.status,
        submittedDate: savedPermit.submittedDate,
        type: savedPermit.permitType?.name,
        projectDescription: savedPermit.projectDescription,
        estimatedValue: savedPermit.estimatedValue,
        totalFees: savedPermit.totalFees
      }
    });

  } catch (error) {
    console.error('Error submitting permit application:', error);
    res.status(500).json({ error: 'Failed to submit permit application' });
  }
});

// Get specific permit by ID
router.get('/:permitId', authenticateToken, async (req, res) => {
  try {
    const { permitId } = req.params;
    
    // Find the permit and populate related data
    const permit = await Permit.findById(permitId)
      .populate('permitType')
      .populate('municipality')
      .populate('property');
    
    if (!permit) {
      return res.status(404).json({ error: 'Permit not found' });
    }
    
    // Verify the user has access to this permit
    const userId = req.user.userId;
    const userType = req.user.userType;
    
    // Allow access if:
    // 1. User is the applicant
    // 2. User is the contractor 
    // 3. User is municipal staff
    const hasAccess = 
      permit.applicant?.id === userId ||
      permit.contractor?.id === userId ||
      userType === 'municipal';
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Transform permit data for frontend
    const transformedPermit = {
      id: permit._id,
      permitNumber: permit.permitNumber,
      applicationId: permit.permitNumber,
      type: permit.permitType?.name || 'Unknown',
      category: permit.permitType?.category || 'general',
      status: permit.status,
      submittedDate: permit.submittedDate || permit.applicationDate,
      approvedDate: permit.approvedDate,
      completedDate: permit.completionDate,
      expiryDate: permit.expirationDate,
      fee: permit.totalFees || 0,
      projectValue: permit.estimatedValue || 0,
      description: permit.projectDescription,
      projectDescription: permit.projectDescription,
      workDescription: permit.workDescription,
      municipality: permit.municipality?.name,
      property: permit.property,
      applicant: permit.applicant,
      contractor: permit.contractor,
      fees: permit.fees || [],
      customFields: permit.customFields || {},
      
      // Review process status
      reviewProcess: {
        currentStep: permit.status,
        steps: [
          {
            name: 'Application Submitted',
            status: 'completed',
            date: permit.submittedDate,
            department: 'System'
          },
          {
            name: 'Initial Review',
            status: ['submitted', 'under_review'].includes(permit.status) ? 'in_progress' : 
                   ['pending_corrections', 'rejected'].includes(permit.status) ? 'failed' : 'completed',
            date: permit.status === 'under_review' ? new Date() : null,
            department: 'Building Department'
          },
          {
            name: 'Fire Department Review',
            status: permit.status === 'approved' ? 'completed' : 
                   permit.status === 'under_review' ? 'pending' : 'not_started',
            date: null,
            department: 'Fire Department'
          },
          {
            name: 'Public Works Review',
            status: permit.status === 'approved' ? 'completed' : 
                   permit.status === 'under_review' ? 'pending' : 'not_started',
            date: null,
            department: 'Public Works'
          },
          {
            name: 'Final Approval',
            status: permit.status === 'approved' ? 'completed' : 'not_started',
            date: permit.approvedDate,
            department: 'Building Department'
          }
        ]
      }
    };
    
    res.json(transformedPermit);
    
  } catch (error) {
    console.error('Error fetching permit:', error);
    res.status(500).json({ error: 'Failed to fetch permit details' });
  }
});

module.exports = router;