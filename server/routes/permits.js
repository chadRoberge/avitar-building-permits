const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Permit = require('../models/Permit');
const PermitType = require('../models/PermitType');
const PermitFile = require('../models/PermitFile');

console.log('PERMITS ROUTE MODULE LOADED!');

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

  console.log(
    'Auth middleware - header exists:',
    !!authHeader,
    'token exists:',
    !!token,
  );

  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log('JWT verification failed:', err.message, 'Token length:', token.length);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    console.log(
      'JWT verified successfully for user:',
      user.userId,
      'type:',
      user.userType,
    );
    req.user = user;
    next();
  });
};

// Get permits for a specific user
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { propertyId, contractorFilter } = req.query;

    console.log(
      'Permits request - JWT user:',
      req.user.userId,
      'Requested userId:',
      userId,
      'User type:',
      req.user.userType,
      'PropertyId:',
      propertyId,
      'ContractorFilter:',
      contractorFilter,
    );

    // Verify the requesting user matches the userId or is authorized
    if (req.user.userId !== userId && req.user.userType !== 'municipal') {
      console.log(
        'Access denied - JWT user ID does not match requested user ID',
      );
      return res.status(403).json({ error: 'Access denied' });
    }

    // Build query based on filter type
    let query;

    // Automatically use contractor filtering for commercial users, or when explicitly requested
    const useContractorFilter =
      contractorFilter === 'true' || req.user.userType === 'commercial';

    if (useContractorFilter) {
      // For contractors: find permits where they are either the applicant OR the contractor
      query = {
        $or: [{ 'applicant.id': userId }, { 'contractor.id': userId }],
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
    console.log(
      `DEBUG: Querying permits for userId: ${userId}, propertyId: ${propertyId}, contractorFilter: ${contractorFilter}`,
    );
    const permits = await Permit.find(query)
      .populate('permitType')
      .populate('municipality')
      .sort({ applicationDate: -1 });

    console.log(
      `Fetching permits for user ${userId}, found ${permits.length} permits`,
    );

    // Debug: Let's also check if there are any permits at all in the database
    const allPermits = await Permit.find({}).limit(5);
    console.log(
      'DEBUG: Sample permits in database:',
      allPermits.map((p) => ({
        id: p._id,
        permitNumber: p.permitNumber,
        applicantId: p.applicant?.id,
        applicantEmail: p.applicant?.email,
      })),
    );

    // Transform permits to match frontend expectations
    const transformedPermits = permits.map((permit) => ({
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
      municipality: permit.municipality?.name,
    }));

    res.json(transformedPermits);
  } catch (error) {
    console.error('Error fetching permits:', error);
    res.status(500).json({ error: 'Failed to fetch permits' });
  }
});

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Permits route is working!' });
});

// Get permits for a specific municipality (for municipal users)
router.get('/municipality/:municipalityId', authenticateToken, async (req, res) => {
  console.log('=== MUNICIPALITY PERMITS ROUTE CALLED ===');
  try {
    const { municipalityId } = req.params;
    const { status, search } = req.query;
    console.log('Municipality ID:', municipalityId);

    // Only municipal users can view municipality permits
    if (req.user.userType !== 'municipal') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // For now, allow any authenticated municipal user to access any municipality's permits
    // TODO: Add proper municipality access control if needed

    // Build query for permits in this municipality
    let query = { municipality: municipalityId };

    // Filter by status if provided
    if (status && status !== 'all') {
      query.status = status;
    }

    // Search functionality
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { permitNumber: searchRegex },
        { 'applicant.firstName': searchRegex },
        { 'applicant.lastName': searchRegex },
        { 'applicant.email': searchRegex },
        { projectDescription: searchRegex }
      ];
    }

    console.log('Municipal permits query:', query);
    console.log('User making request:', {
      userId: req.user.userId,
      userType: req.user.userType,
      requestedMunicipalityId: municipalityId
    });

    // Get permits from database
    const permits = await Permit.find(query)
      .populate('permitType')
      .populate('municipality')
      .sort({ submittedDate: -1, applicationDate: -1 });

    console.log(`Found ${permits.length} permits for municipality ${municipalityId}`);
    
    // Debug: Let's also check what permits exist in the database
    const allPermitsCount = await Permit.countDocuments({});
    console.log(`Total permits in database: ${allPermitsCount}`);
    
    // Show a sample permit if any exist
    if (permits.length > 0) {
      console.log('Sample permit:', {
        id: permits[0]._id,
        permitNumber: permits[0].permitNumber,
        municipality: permits[0].municipality,
        status: permits[0].status
      });
    }

    // Transform permits to match frontend expectations
    const transformedPermits = permits.map((permit) => ({
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
      applicant: {
        name: `${permit.applicant?.firstName || ''} ${permit.applicant?.lastName || ''}`.trim(),
        email: permit.applicant?.email,
        phone: permit.applicant?.phone
      },
      contractor: permit.contractor ? {
        name: `${permit.contractor?.firstName || ''} ${permit.contractor?.lastName || ''}`.trim() || permit.contractor?.businessName,
        email: permit.contractor?.email,
        phone: permit.contractor?.phone,
        licenseNumber: permit.contractor?.licenseNumber
      } : null,
      property: permit.projectAddress
    }));

    res.json(transformedPermits);
  } catch (error) {
    console.error('Error fetching municipality permits:', error);
    res.status(500).json({ error: 'Failed to fetch permits' });
  }
});

// Submit a new permit application
router.post('/', authenticateToken, async (req, res) => {
  try {
    const permitData = req.body;

    console.log('Received permit application:', permitData);

    // Validate required fields
    if (
      !permitData.userId ||
      !permitData.municipalityId ||
      !permitData.permitTypeId
    ) {
      return res.status(400).json({
        error:
          'Missing required fields: userId, municipalityId, or permitTypeId',
      });
    }

    if (
      !permitData.projectDescription ||
      permitData.projectDescription.trim().length < 10
    ) {
      return res.status(400).json({
        error: 'Project description must be at least 10 characters long',
      });
    }

    if (!permitData.projectValue || permitData.projectValue < 0) {
      return res
        .status(400)
        .json({ error: 'Project value must be a positive number' });
    }

    // Verify the user owns this application
    if (
      req.user.userId !== permitData.userId &&
      req.user.userType !== 'municipal'
    ) {
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
      estimatedCompletionDate: permitData.workDetails.estimatedDuration
        ? calculateCompletionDate(
            permitData.workDetails.startDate,
            permitData.workDetails.estimatedDuration,
          )
        : null,

      // Project address (use user's property address)
      projectAddress: {
        street: user.propertyAddress?.street || '',
        city: user.propertyAddress?.city || '',
        state: user.propertyAddress?.state || '',
        zip: user.propertyAddress?.zip || '',
        parcelId: user.propertyAddress?.parcelId || '',
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
        relationshipToProperty: 'owner',
      },

      // Contractor info if provided
      contractor: permitData.contractorInfo
        ? {
            type: 'contractor',
            firstName: permitData.contractorInfo.name.split(' ')[0] || '',
            lastName:
              permitData.contractorInfo.name.split(' ').slice(1).join(' ') ||
              '',
            email: permitData.contractorInfo.email || '',
            phone: permitData.contractorInfo.phone || '',
            licenseNumber: permitData.contractorInfo.licenseNumber || '',
            businessName: permitData.contractorInfo.name || '',
          }
        : null,

      status: 'submitted',
      submittedDate: new Date(),

      // Fees
      fees: [
        {
          type: 'Base Permit Fee',
          amount: permitData.calculatedFee || 0,
          description: `${permitType.name} application fee`,
        },
      ],

      // Custom fields for additional info
      customFields: {
        additionalInfo: permitData.additionalInfo || '',
        workLocation: permitData.workDetails?.workLocation || 'primary',
        estimatedDuration: permitData.workDetails?.estimatedDuration || '',
      },
    });

    // Save to database
    const savedPermit = await newPermit.save();
    await savedPermit.populate(['permitType', 'municipality']);

    console.log(
      'Saved permit application to database:',
      savedPermit.permitNumber,
    );

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
        totalFees: savedPermit.totalFees,
      },
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

      // Review process status - use permit type workflow if available
      reviewProcess: {
        currentStep: permit.status,
        steps: permit.permitType?.workflow?.length > 0 
          ? permit.permitType.workflow.map((workflowStep, index) => {
              // Determine status based on permit status and workflow order
              let stepStatus = 'not_started';
              let stepDate = null;
              
              // Map common workflow step names to permit statuses
              const stepName = workflowStep.name.toLowerCase();
              if (stepName.includes('submit') || stepName.includes('application')) {
                stepStatus = 'completed';
                stepDate = permit.submittedDate;
              } else if (stepName.includes('review') || stepName.includes('initial')) {
                if (['submitted', 'under-review', 'under_review'].includes(permit.status)) {
                  stepStatus = 'in_progress';
                  stepDate = permit.submittedDate; // When review started
                } else if (['approved', 'inspections', 'completed'].includes(permit.status)) {
                  stepStatus = 'completed';
                  stepDate = permit.submittedDate;
                } else if (['rejected', 'denied'].includes(permit.status)) {
                  stepStatus = 'failed';
                  stepDate = permit.submittedDate;
                }
              } else if (stepName.includes('approve') || stepName.includes('approval')) {
                if (permit.status === 'approved') {
                  stepStatus = 'completed';
                  stepDate = permit.approvedDate;
                } else if (['under-review', 'under_review'].includes(permit.status)) {
                  stepStatus = 'pending';
                }
              } else if (stepName.includes('inspection')) {
                if (permit.status === 'inspections') {
                  stepStatus = 'in_progress';
                } else if (permit.status === 'completed') {
                  stepStatus = 'completed';
                  stepDate = permit.completionDate;
                } else if (['approved'].includes(permit.status)) {
                  stepStatus = 'pending';
                }
              }
              
              return {
                name: workflowStep.name,
                description: workflowStep.description,
                status: stepStatus,
                date: stepDate,
                department: workflowStep.department || 'Municipal Staff',
                order: workflowStep.order,
                allowedRoles: workflowStep.allowedRoles,
                requiredDocuments: workflowStep.requiredDocuments,
              };
            })
          : [
              // Fallback to simplified workflow if no permit type workflow
              {
                name: 'Application Submitted',
                status: 'completed',
                date: permit.submittedDate,
                department: 'System',
                order: 1,
              },
              {
                name: 'Under Review',
                status: ['submitted', 'under-review', 'under_review'].includes(permit.status)
                  ? 'in_progress'
                  : ['approved', 'inspections', 'completed'].includes(permit.status)
                    ? 'completed'
                    : 'pending',
                date: permit.submittedDate,
                department: 'Building Department',
                order: 2,
              },
              {
                name: 'Approved',
                status: permit.status === 'approved' || permit.status === 'inspections' || permit.status === 'completed'
                  ? 'completed'
                  : 'pending',
                date: permit.approvedDate,
                department: 'Building Department',
                order: 3,
              },
              {
                name: 'Inspections',
                status: permit.status === 'inspections'
                  ? 'in_progress'
                  : permit.status === 'completed'
                    ? 'completed'
                    : 'pending',
                date: permit.status === 'inspections' ? new Date() : null,
                department: 'Inspections',
                order: 4,
              },
              {
                name: 'Completed',
                status: permit.status === 'completed' ? 'completed' : 'pending',
                date: permit.completionDate,
                department: 'System',
                order: 5,
              },
            ],
      },
    };

    res.json(transformedPermit);
  } catch (error) {
    console.error('Error fetching permit:', error);
    res.status(500).json({ error: 'Failed to fetch permit details' });
  }
});

// ===== PAYMENT FUNCTIONALITY =====

// Initiate payment for a permit
router.post('/:id/payment/initiate', authenticateToken, async (req, res) => {
  try {
    const permitId = req.params.id;
    const { paymentMethod, amount } = req.body;

    // Find and validate permit
    const permit = await Permit.findById(permitId);
    if (!permit) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    // Check user authorization
    if (req.user.userType === 'residential' && 
        permit.applicant.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if payment is already completed
    if (permit.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Payment already completed' });
    }

    // Validate amount matches permit fees
    const expectedAmount = permit.totalFees || permit.fee || 0;
    if (amount !== expectedAmount) {
      return res.status(400).json({ error: 'Payment amount mismatch' });
    }

    // Create InvoiceCloud payment session
    const invoiceCloudPayment = await createInvoiceCloudPayment({
      permitId: permit._id,
      municipalityId: permit.municipalityId,
      amount: amount,
      paymentMethod: paymentMethod,
      applicant: {
        firstName: permit.applicant.firstName,
        lastName: permit.applicant.lastName,
        email: permit.applicant.email
      },
      description: `${permit.type} Permit - ${permit.permitNumber}`,
      returnUrl: `${process.env.CLIENT_URL || 'http://localhost:4200'}/residential/permits/${permitId}?payment=success`,
      cancelUrl: `${process.env.CLIENT_URL || 'http://localhost:4200'}/residential/permits/${permitId}?payment=cancelled`
    });

    // Update permit with payment session info
    permit.paymentStatus = 'pending';
    permit.paymentSessionId = invoiceCloudPayment.sessionId;
    await permit.save();

    res.json({
      paymentUrl: invoiceCloudPayment.paymentUrl,
      sessionId: invoiceCloudPayment.sessionId
    });

  } catch (error) {
    console.error('Error initiating payment:', error);
    res.status(500).json({ 
      error: 'Failed to initiate payment',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Handle payment webhook from InvoiceCloud
router.post('/:id/payment/webhook', async (req, res) => {
  try {
    const permitId = req.params.id;
    const { sessionId, status, transactionId, paymentMethod } = req.body;

    // Validate webhook signature (implement based on InvoiceCloud docs)
    if (!validateInvoiceCloudWebhook(req)) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    // Find permit
    const permit = await Permit.findById(permitId);
    if (!permit) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    // Verify session ID matches
    if (permit.paymentSessionId !== sessionId) {
      return res.status(400).json({ error: 'Session ID mismatch' });
    }

    // Update payment status
    if (status === 'completed') {
      permit.paymentStatus = 'paid';
      permit.paymentMethod = paymentMethod;
      permit.transactionId = transactionId;
      permit.paidAt = new Date();

      // Auto-approve permit if configured
      if (permit.status === 'pending' && permit.autoApproveOnPayment) {
        permit.status = 'approved';
        permit.approvedAt = new Date();
      }
    } else if (status === 'failed' || status === 'cancelled') {
      permit.paymentStatus = 'failed';
    }

    await permit.save();

    res.json({ success: true });

  } catch (error) {
    console.error('Error processing payment webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Get payment status for a permit
router.get('/:id/payment/status', authenticateToken, async (req, res) => {
  try {
    const permitId = req.params.id;

    const permit = await Permit.findById(permitId).select('paymentStatus paymentMethod transactionId paidAt');
    if (!permit) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    // Check user authorization
    if (req.user.userType === 'residential' && 
        permit.applicant.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      paymentStatus: permit.paymentStatus,
      paymentMethod: permit.paymentMethod,
      transactionId: permit.transactionId,
      paidAt: permit.paidAt
    });

  } catch (error) {
    console.error('Error fetching payment status:', error);
    res.status(500).json({ error: 'Failed to fetch payment status' });
  }
});

// Helper function to create InvoiceCloud payment (mock for now)
async function createInvoiceCloudPayment(paymentData) {
  // TODO: Replace with actual InvoiceCloud API integration
  // This is a mock implementation for development
  
  if (process.env.NODE_ENV === 'development') {
    // Mock payment URL for development
    return {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      paymentUrl: `${process.env.CLIENT_URL || 'http://localhost:4200'}/mock-payment?` + 
                  `amount=${paymentData.amount}&` +
                  `description=${encodeURIComponent(paymentData.description)}&` +
                  `return_url=${encodeURIComponent(paymentData.returnUrl)}&` +
                  `cancel_url=${encodeURIComponent(paymentData.cancelUrl)}`
    };
  }

  // Production InvoiceCloud integration
  const invoiceCloudConfig = {
    apiKey: process.env.INVOICE_CLOUD_API_KEY,
    baseUrl: process.env.INVOICE_CLOUD_BASE_URL || 'https://api.invoicecloud.com',
    merchantId: process.env.INVOICE_CLOUD_MERCHANT_ID
  };

  if (!invoiceCloudConfig.apiKey) {
    throw new Error('InvoiceCloud API key not configured');
  }

  // Make API call to InvoiceCloud
  const response = await fetch(`${invoiceCloudConfig.baseUrl}/payments/create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${invoiceCloudConfig.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      merchant_id: invoiceCloudConfig.merchantId,
      amount: Math.round(paymentData.amount * 100), // Convert to cents
      currency: 'USD',
      description: paymentData.description,
      customer: {
        first_name: paymentData.applicant.firstName,
        last_name: paymentData.applicant.lastName,
        email: paymentData.applicant.email
      },
      metadata: {
        permit_id: paymentData.permitId,
        municipality_id: paymentData.municipalityId
      },
      return_url: paymentData.returnUrl,
      cancel_url: paymentData.cancelUrl
    })
  });

  if (!response.ok) {
    throw new Error(`InvoiceCloud API error: ${response.status}`);
  }

  const result = await response.json();
  return {
    sessionId: result.session_id,
    paymentUrl: result.payment_url
  };
}

// Helper function to validate InvoiceCloud webhook
function validateInvoiceCloudWebhook(req) {
  // TODO: Implement webhook signature validation based on InvoiceCloud docs
  // This is a mock implementation for development
  
  if (process.env.NODE_ENV === 'development') {
    return true; // Allow all webhooks in development
  }

  // Production webhook validation
  const signature = req.headers['x-invoicecloud-signature'];
  const webhookSecret = process.env.INVOICE_CLOUD_WEBHOOK_SECRET;
  
  if (!signature || !webhookSecret) {
    return false;
  }

  // Validate signature (implement based on InvoiceCloud documentation)
  // Example: HMAC-SHA256 validation
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  return signature === expectedSignature;
}

// ===== FILE UPLOAD FUNCTIONALITY =====

// Configure multer for file uploads - memory storage for Vercel serverless
let storage;
let uploadsDir;

if (process.env.VERCEL) {
  // Use memory storage for serverless (files won't persist)
  console.log('Using memory storage for Vercel serverless');
  storage = multer.memoryStorage();
} else {
  // Use disk storage for local development
  uploadsDir = path.join(__dirname, '../uploads/permit-files');
  fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);
  
  storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
      // Generate unique filename: timestamp-random-originalname
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext);
      cb(null, `${name}-${uniqueSuffix}${ext}`);
    },
  });
}

// File filter for security
const fileFilter = (req, file, cb) => {
  // Allowed file types for building permits
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Allowed: images, PDF, Word, Excel, text, ZIP',
      ),
      false,
    );
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5, // Maximum 5 files at once
  },
  fileFilter: fileFilter,
});

// Get all files for a permit
router.get('/:permitId/files', authenticateToken, async (req, res) => {
  try {
    console.log('Loading files for permit:', req.params.permitId);
    const { permitId } = req.params;
    const { fileType, status } = req.query;

    // Verify permit exists and user has access
    const permit = await Permit.findById(permitId);
    if (!permit) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    // Check authorization (owner, municipality users, or involved contractors)
    if (
      req.user.userType === 'residential' &&
      permit.applicant.id !== req.user.userId
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const options = {};
    if (fileType) options.fileType = fileType;
    if (status) options.status = status;

    const files = await PermitFile.getByPermit(permitId, options);
    const publicFiles = files.map((file) => file.toPublic());

    res.json(publicFiles);
  } catch (error) {
    console.error('Error fetching permit files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Upload files to a permit
router.post(
  '/:permitId/files/upload',
  authenticateToken,
  upload.array('files', 5),
  async (req, res) => {
    try {
      const { permitId } = req.params;
      const { fileType = 'other', description = '' } = req.body;

      // Verify permit exists and user has access
      const permit = await Permit.findById(permitId);
      if (!permit) {
        // Clean up uploaded files
        if (req.files) {
          req.files.forEach((file) => {
            fs.unlink(file.path).catch(console.error);
          });
        }
        return res.status(404).json({ error: 'Permit not found' });
      }

      // Check authorization
      if (
        req.user.userType === 'residential' &&
        permit.applicant.id !== req.user.userId
      ) {
        // Clean up uploaded files
        if (req.files) {
          req.files.forEach((file) => {
            fs.unlink(file.path).catch(console.error);
          });
        }
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const savedFiles = [];

      // Process each uploaded file
      for (const file of req.files) {
        try {
          const permitFile = new PermitFile({
            permitId: permitId,
            uploadedBy: req.user.userId,
            originalName: file.originalname,
            filename: file.filename,
            mimetype: file.mimetype,
            size: file.size,
            fileType: fileType,
            description: description,
            path: file.path,
          });

          await permitFile.save();

          // Populate user info for response
          await permitFile.populate(
            'uploadedBy',
            'firstName lastName email userType',
          );

          savedFiles.push(permitFile.toPublic());
        } catch (error) {
          console.error('Error saving file:', error);
          // Clean up file if database save failed
          fs.unlink(file.path).catch(console.error);
        }
      }

      if (savedFiles.length === 0) {
        return res.status(500).json({ error: 'Failed to save any files' });
      }

      // Update permit's updated date
      permit.updatedAt = new Date();
      await permit.save();

      res.status(201).json({
        message: `${savedFiles.length} file(s) uploaded successfully`,
        files: savedFiles,
      });
    } catch (error) {
      console.error('Error uploading files:', error);

      // Clean up uploaded files on error
      if (req.files) {
        req.files.forEach((file) => {
          fs.unlink(file.path).catch(console.error);
        });
      }

      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res
            .status(400)
            .json({ error: 'File too large. Maximum size is 10MB.' });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
          return res
            .status(400)
            .json({ error: 'Too many files. Maximum is 5 files at once.' });
        }
      }

      res
        .status(500)
        .json({ error: 'File upload failed', details: error.message });
    }
  },
);

// Download/view a specific file
router.get(
  '/:permitId/files/:fileId/download',
  authenticateToken,
  async (req, res) => {
    try {
      const { permitId, fileId } = req.params;

      // Find the file
      const permitFile = await PermitFile.findOne({
        _id: fileId,
        permitId: permitId,
      });

      if (!permitFile) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Verify permit access
      const permit = await Permit.findById(permitId);
      if (!permit) {
        return res.status(404).json({ error: 'Permit not found' });
      }

      // Check authorization
      if (
        req.user.userType === 'residential' &&
        permit.applicant.id !== req.user.userId
      ) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Check if file exists on disk
      try {
        await fs.access(permitFile.path);
      } catch (error) {
        return res.status(404).json({ error: 'File not found on server' });
      }

      // Set appropriate headers
      res.setHeader('Content-Type', permitFile.mimetype);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${permitFile.originalName}"`,
      );

      // Stream the file
      res.sendFile(path.resolve(permitFile.path));
    } catch (error) {
      console.error('Error downloading file:', error);
      res.status(500).json({ error: 'Failed to download file' });
    }
  },
);

// Delete a file
router.delete(
  '/:permitId/files/:fileId',
  authenticateToken,
  async (req, res) => {
    try {
      const { permitId, fileId } = req.params;

      // Find the file
      const permitFile = await PermitFile.findOne({
        _id: fileId,
        permitId: permitId,
      });

      if (!permitFile) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Check authorization (only uploader or municipal users can delete)
      if (
        req.user.userType === 'residential' &&
        permitFile.uploadedBy.toString() !== req.user.userId
      ) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Delete file from disk
      try {
        await fs.unlink(permitFile.path);
      } catch (error) {
        console.warn('File not found on disk:', permitFile.path);
      }

      // Remove from database
      await PermitFile.deleteOne({ _id: fileId });

      res.json({ message: 'File deleted successfully' });
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  },
);

// Get file statistics for a permit
router.get('/:permitId/files/stats', authenticateToken, async (req, res) => {
  try {
    const { permitId } = req.params;

    // Verify permit access
    const permit = await Permit.findById(permitId);
    if (!permit) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    const stats = await PermitFile.getFileStats(permitId);

    // Calculate totals
    const totals = stats.reduce(
      (acc, stat) => {
        acc.totalFiles += stat.count;
        acc.totalSize += stat.totalSize;
        return acc;
      },
      { totalFiles: 0, totalSize: 0 },
    );

    res.json({
      ...totals,
      byType: stats,
    });
  } catch (error) {
    console.error('Error fetching file stats:', error);
    res.status(500).json({ error: 'Failed to fetch file statistics' });
  }
});

// ===== PERMIT STATUS UPDATE FUNCTIONALITY =====

// Update permit status (for municipal users)
router.put('/:permitId/status', authenticateToken, async (req, res) => {
  try {
    const { permitId } = req.params;
    const { status, comment } = req.body;

    console.log('Updating permit status:', { permitId, status, comment, userId: req.user.userId });

    // Only municipal users can update permit status
    if (req.user.userType !== 'municipal') {
      return res.status(403).json({ error: 'Access denied - municipal access required' });
    }

    // Validate status
    const validStatuses = [
      'submitted', 'under-review', 'approved', 'denied', 
      'pending-corrections', 'inspections', 'completed', 'expired'
    ];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    // Find the permit
    const permit = await Permit.findById(permitId);
    if (!permit) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    // Validate status transitions with business rules
    if (status === 'approved') {
      const approvalCheck = permit.canBeApproved();
      if (!approvalCheck.canApprove) {
        return res.status(400).json({ 
          error: `Cannot approve permit: ${approvalCheck.reason}` 
        });
      }
    }

    if (status === 'completed') {
      const completionCheck = await permit.canBeCompleted();
      if (!completionCheck.canComplete) {
        return res.status(400).json({ 
          error: `Cannot complete permit: ${completionCheck.reason}` 
        });
      }
    }

    // Update permit status and set appropriate dates
    const oldStatus = permit.status;
    permit.status = status;
    permit.updatedAt = new Date();

    // Set status-specific dates
    switch (status) {
      case 'approved':
        if (!permit.approvedDate) {
          permit.approvedDate = new Date();
        }
        // Set expiration date (typically 6 months from approval)
        permit.expirationDate = new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000);
        break;
      case 'completed':
        if (!permit.completionDate) {
          permit.completionDate = new Date();
        }
        break;
      case 'denied':
        permit.deniedDate = new Date();
        break;
      case 'under-review':
        // Clear dates when returning to review status
        permit.approvedDate = undefined;
        permit.completionDate = undefined;
        permit.deniedDate = undefined;
        permit.expirationDate = undefined;
        break;
      case 'submitted':
        // Clear dates when returning to submitted status
        permit.approvedDate = undefined;
        permit.completionDate = undefined;
        permit.deniedDate = undefined;
        permit.expirationDate = undefined;
        break;
    }

    // Save permit
    await permit.save();

    console.log(`Permit ${permitId} status updated from ${oldStatus} to ${status}`);

    res.json({
      success: true,
      message: 'Permit status updated successfully',
      permit: {
        id: permit._id,
        status: permit.status,
        updatedAt: permit.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating permit status:', error);
    res.status(500).json({ error: 'Failed to update permit status' });
  }
});

// ===== DEPARTMENT REVIEW FUNCTIONALITY =====

// Submit department review for a permit
router.post('/:permitId/department-review', authenticateToken, async (req, res) => {
  try {
    const { permitId } = req.params;
    const { status, notes, conditions } = req.body;

    // Only municipal users can submit department reviews
    if (req.user.userType !== 'municipal') {
      return res.status(403).json({ error: 'Access denied - municipal access required' });
    }

    // Fetch full user data to get department information
    const fullUser = await User.findById(req.user.userId);
    if (!fullUser || !fullUser.department) {
      return res.status(403).json({ error: 'Access denied - municipal department access required' });
    }

    // Validate review status
    const validStatuses = ['approved', 'rejected', 'changes-requested'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid review status' });
    }

    // Find the permit
    const permit = await Permit.findById(permitId);
    if (!permit) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    // Check if user can review this permit
    if (!permit.canUserReview(fullUser)) {
      return res.status(403).json({ 
        error: `Department ${fullUser.department} cannot review this permit or has already reviewed it` 
      });
    }

    // Submit the department review
    await permit.submitDepartmentReview(
      fullUser.department, 
      fullUser._id, 
      fullUser, 
      { status, notes, conditions }
    );

    res.json({
      success: true,
      message: `Department review submitted successfully`,
      permit: {
        id: permit._id,
        status: permit.status,
        departmentReviews: permit.departmentReviews
      }
    });

  } catch (error) {
    console.error('Error submitting department review:', error);
    res.status(500).json({ error: 'Failed to submit department review' });
  }
});

// Get department review status for a permit
router.get('/:permitId/department-reviews', authenticateToken, async (req, res) => {
  try {
    const { permitId } = req.params;

    console.log('Fetching department reviews for permit:', permitId);

    // Find the permit
    const permit = await Permit.findById(permitId);
    if (!permit) {
      console.log('Permit not found:', permitId);
      return res.status(404).json({ error: 'Permit not found' });
    }

    console.log('Found permit:', {
      id: permit._id,
      status: permit.status,
      departmentReviewsCount: permit.departmentReviews ? permit.departmentReviews.length : 0,
      requiredDepartmentsCount: permit.requiredDepartments ? permit.requiredDepartments.length : 0
    });

    // Only municipal users or permit owners can view review status
    if (req.user.userType !== 'municipal' && permit.applicant?.id !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Initialize department reviews if not present but permit is submitted
    if (permit.status !== 'draft' && (!permit.departmentReviews || permit.departmentReviews.length === 0)) {
      console.log('Initializing department reviews for submitted permit');
      await permit.initializeDepartmentReviews();
      await permit.save();
    }

    const reviewStatus = {
      departmentReviews: permit.departmentReviews || [],
      requiredDepartments: permit.requiredDepartments || [],
      pendingDepartments: permit.getPendingDepartments(),
      approvedDepartments: permit.getApprovedDepartments(),
      canCurrentUserReview: permit.canUserReview(req.user)
    };

    console.log('Returning review status:', reviewStatus);
    res.json(reviewStatus);

  } catch (error) {
    console.error('Error fetching department reviews:', error);
    res.status(500).json({ error: 'Failed to fetch department reviews', details: error.message });
  }
});

// Get permits pending review for current user's department
router.get('/pending-review', authenticateToken, async (req, res) => {
  try {
    // Only municipal users can access this endpoint
    if (req.user.userType !== 'municipal') {
      return res.status(403).json({ error: 'Access denied - municipal access required' });
    }

    // Fetch full user data to get department information
    const fullUser = await User.findById(req.user.userId);
    if (!fullUser || !fullUser.department) {
      return res.status(403).json({ error: 'Access denied - municipal department access required' });
    }

    // Find permits that need review by this user's department
    const permits = await Permit.find({
      municipality: fullUser.municipality._id,
      status: 'under-review',
      'departmentReviews.department': fullUser.department,
      'departmentReviews.status': 'pending'
    })
    .populate('permitType', 'name category')
    .sort({ submittedDate: 1 });

    // Filter to only permits this user can actually review
    const reviewablePermits = permits.filter(permit => permit.canUserReview(fullUser));

    res.json({
      permits: reviewablePermits,
      count: reviewablePermits.length
    });

  } catch (error) {
    console.error('Error fetching pending reviews:', error);
    res.status(500).json({ error: 'Failed to fetch pending reviews' });
  }
});

// Reset department reviews for a permit
router.post('/:permitId/reset-department-reviews', authenticateToken, async (req, res) => {
  try {
    const { permitId } = req.params;
    const { departments, notes } = req.body;

    // Only municipal users can reset department reviews
    if (req.user.userType !== 'municipal') {
      return res.status(403).json({ error: 'Access denied - municipal access required' });
    }

    if (!departments || !Array.isArray(departments) || departments.length === 0) {
      return res.status(400).json({ error: 'Departments array is required' });
    }

    // Find the permit
    const permit = await Permit.findById(permitId);
    if (!permit) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    // Reset specified department reviews
    departments.forEach(department => {
      const review = permit.departmentReviews.find(r => r.department === department);
      if (review) {
        review.status = 'pending';
        review.reviewer = undefined;
        review.reviewedAt = undefined;
        review.notes = undefined;
        review.conditions = [];
      }
    });

    // Add internal note about the reset
    permit.notes.push({
      author: { 
        id: req.user.userId,
        name: req.user.firstName + ' ' + req.user.lastName,
        role: 'municipal'
      },
      content: `Department reviews reset for: ${departments.join(', ')}${notes ? '. ' + notes : ''}`,
      isPublic: false,
      createdAt: new Date()
    });

    // If permit was previously approved/denied, move back to under-review
    if (['approved', 'denied', 'additional-info'].includes(permit.status)) {
      permit.status = 'under-review';
      permit.approvedDate = undefined;
      permit.deniedDate = undefined;
    }

    await permit.save();

    res.json({
      success: true,
      message: `Reset reviews for ${departments.length} department(s)`,
      resetDepartments: departments,
      newStatus: permit.status
    });

  } catch (error) {
    console.error('Error resetting department reviews:', error);
    res.status(500).json({ error: 'Failed to reset department reviews' });
  }
});

// Check permit validation status
router.get('/:permitId/validation', authenticateToken, async (req, res) => {
  try {
    const { permitId } = req.params;

    // Find the permit
    const permit = await Permit.findById(permitId);
    if (!permit) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    // Only municipal users or permit owners can view validation status
    if (req.user.userType !== 'municipal' && permit.applicant?.id !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const approvalCheck = permit.canBeApproved();
    const completionCheck = await permit.canBeCompleted();
    const inspectionStatus = await permit.getInspectionStatus();
    const requiredInspections = await permit.getRequiredInspections();

    res.json({
      canBeApproved: approvalCheck.canApprove,
      approvalReason: approvalCheck.reason,
      canBeCompleted: completionCheck.canComplete,
      completionReason: completionCheck.reason,
      inspectionStatus: inspectionStatus,
      requiredInspections: requiredInspections,
      currentStatus: permit.status
    });

  } catch (error) {
    console.error('Error checking permit validation:', error);
    res.status(500).json({ error: 'Failed to check permit validation' });
  }
});

// Get inspection requirements for a permit
router.get('/:permitId/inspection-requirements', authenticateToken, async (req, res) => {
  try {
    const { permitId } = req.params;

    // Find the permit
    const permit = await Permit.findById(permitId);
    if (!permit) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    // Only municipal users or permit owners can view requirements
    if (req.user.userType !== 'municipal' && permit.applicant?.id !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const requiredInspections = await permit.getRequiredInspections();
    const inspectionStatus = await permit.getInspectionStatus();

    res.json({
      requiredInspections: requiredInspections,
      inspectionStatus: inspectionStatus,
      completedInspections: permit.inspections,
      canComplete: (await permit.canBeCompleted()).canComplete
    });

  } catch (error) {
    console.error('Error fetching inspection requirements:', error);
    res.status(500).json({ error: 'Failed to fetch inspection requirements' });
  }
});

module.exports = router;
