const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  street: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  zip: {
    type: String,
    required: true,
  },
  parcelId: {
    type: String,
  },
});

const applicantSchema = new mongoose.Schema({
  id: {
    type: String,
    required: false, // For linking to user who submitted the application
  },
  type: {
    type: String,
    enum: ['owner', 'contractor', 'agent'],
    required: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: false,
  },
  address: addressSchema,
  // For contractors
  licenseNumber: String,
  licenseType: String,
  businessName: String,
  // Relationship to property
  relationshipToProperty: String,
});

const inspectionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'passed', 'failed', 'cancelled'],
      default: 'scheduled',
    },
    scheduledDate: Date,
    completedDate: Date,
    inspector: {
      name: String,
      id: mongoose.Schema.Types.ObjectId,
    },
    notes: String,
    photos: [String], // URLs to inspection photos
    requirements: [String], // List of requirements for next steps
  },
  {
    timestamps: true,
  },
);

const feeSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  description: String,
  paid: {
    type: Boolean,
    default: false,
  },
  paidDate: Date,
  paymentMethod: String,
  transactionId: String,
});

const documentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  uploadedBy: {
    name: String,
    role: String,
    id: mongoose.Schema.Types.ObjectId,
  },
  uploadedDate: {
    type: Date,
    default: Date.now,
  },
  required: {
    type: Boolean,
    default: false,
  },
  approved: {
    type: Boolean,
    default: false,
  },
});

const permitSchema = new mongoose.Schema(
  {
    // Basic Information
    permitNumber: {
      type: String,
      required: false, // Auto-generated in pre-save hook
      unique: true,
    },
    municipality: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Municipality',
      required: true,
    },
    permitType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PermitType',
      required: true,
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
    },

    // Application Details
    projectAddress: {
      type: addressSchema,
      required: true,
    },
    projectDescription: {
      type: String,
      required: true,
    },
    workDescription: {
      type: String,
      required: true,
    },
    estimatedValue: {
      type: Number,
      required: true,
    },
    estimatedStartDate: Date,
    estimatedCompletionDate: Date,

    // Applicant Information
    applicant: {
      type: applicantSchema,
      required: true,
    },
    propertyOwner: applicantSchema, // If different from applicant
    contractor: applicantSchema, // If applicable

    // Status and Workflow
    status: {
      type: String,
      enum: [
        'draft', // Being prepared by applicant
        'submitted', // Submitted for review
        'under-review', // Being reviewed by staff
        'additional-info', // Waiting for additional information
        'approved', // Approved, ready for work
        'active', // Work in progress
        'inspection-requested', // Inspection has been requested
        'inspections', // Undergoing inspections
        'completed', // All work and inspections complete
        'cancelled', // Cancelled by applicant
        'denied', // Denied by municipality
        'expired', // Permit expired
      ],
      default: 'draft',
    },

    // Dates
    applicationDate: {
      type: Date,
      default: Date.now,
    },
    submittedDate: Date,
    approvedDate: Date,
    issuedDate: Date,
    expirationDate: Date,
    completionDate: Date,

    // Review Information
    reviewedBy: {
      name: String,
      id: mongoose.Schema.Types.ObjectId,
    },
    reviewNotes: String,
    approvalConditions: [String],

    // Department Review Tracking
    departmentReviews: [
      {
        department: {
          type: String,
          enum: [
            'building',
            'planning',
            'fire',
            'health',
            'engineering',
            'zoning',
            'environmental',
            'finance'
          ],
          required: true,
        },
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected', 'changes-requested'],
          default: 'pending',
        },
        reviewer: {
          name: String,
          id: mongoose.Schema.Types.ObjectId,
        },
        reviewedAt: Date,
        notes: String,
        conditions: [String],
      },
    ],

    // Required departments for this permit type
    requiredDepartments: [
      {
        type: String,
        enum: [
          'building',
          'planning',
          'fire',
          'health',
          'engineering',
          'zoning',
          'environmental',
          'finance'
        ],
      },
    ],

    // Financial
    fees: [feeSchema],
    totalFees: {
      type: Number,
      default: 0,
    },

    // Payment Information
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentMethod: String,
    transactionId: String,
    paymentSessionId: String,
    paidAt: Date,
    autoApproveOnPayment: {
      type: Boolean,
      default: false,
    },

    // Inspections
    inspections: [inspectionSchema],
    requiredInspections: [String],

    // Documents
    documents: [documentSchema],

    // Custom Fields (based on permit type configuration)
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },

    // Communication History
    notes: [
      {
        author: {
          name: String,
          role: String,
          id: mongoose.Schema.Types.ObjectId,
        },
        content: String,
        isPublic: {
          type: Boolean,
          default: false,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Tracking
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
permitSchema.index({ municipality: 1, status: 1 });
permitSchema.index({ 'applicant.email': 1 });
permitSchema.index({
  'projectAddress.street': 'text',
  'projectAddress.city': 'text',
});
permitSchema.index({ applicationDate: -1 });
permitSchema.index({ status: 1, municipality: 1 });

// Virtual for permit age
permitSchema.virtual('ageInDays').get(function () {
  if (!this.applicationDate) return 0;
  const now = new Date();
  const diffTime = Math.abs(now - this.applicationDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Generate permit number
permitSchema.pre('save', async function (next) {
  if (!this.permitNumber && this.municipality) {
    const year = new Date().getFullYear();
    const municipality = await mongoose
      .model('Municipality')
      .findById(this.municipality);

    if (municipality) {
      // Get the count of permits for this municipality this year
      const startOfYear = new Date(year, 0, 1);
      const count = await mongoose.model('Permit').countDocuments({
        municipality: this.municipality,
        applicationDate: { $gte: startOfYear },
      });

      // Generate permit number: P2024-HANOVER-001
      const municipalityCode = municipality.name
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .substring(0, 6);

      this.permitNumber = `P${year}-${municipalityCode}-${String(count + 1).padStart(3, '0')}`;
    }
  }

  // Calculate total fees
  if (this.fees && this.fees.length > 0) {
    this.totalFees = this.fees.reduce((total, fee) => total + fee.amount, 0);
  }

  // Initialize department reviews when permit is submitted for the first time
  if (this.isModified('status') && this.status === 'submitted' && !this.departmentReviews.length) {
    await this.initializeDepartmentReviews();
  }

  next();
});

// Instance methods
permitSchema.methods.updateStatus = function (newStatus, userId, notes) {
  this.status = newStatus;

  // Update relevant dates
  if (newStatus === 'submitted' && !this.submittedDate) {
    this.submittedDate = new Date();
  } else if (newStatus === 'approved' && !this.approvedDate) {
    this.approvedDate = new Date();
    // Set expiration date (typically 6 months from approval)
    this.expirationDate = new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000);
  } else if (newStatus === 'completed' && !this.completionDate) {
    this.completionDate = new Date();
  }

  // Add note about status change
  if (notes) {
    this.notes.push({
      author: { id: userId },
      content: `Status changed to ${newStatus}: ${notes}`,
      isPublic: true,
      createdAt: new Date(),
    });
  }

  return this.save();
};

permitSchema.methods.addInspection = function (inspectionData) {
  this.inspections.push(inspectionData);
  return this.save();
};

permitSchema.methods.isOverdue = function () {
  if (!this.expirationDate) return false;
  return new Date() > this.expirationDate && this.status !== 'completed';
};

// Department review methods
permitSchema.methods.initializeDepartmentReviews = async function () {
  try {
    // Get the permit type to determine required departments
    const PermitType = mongoose.model('PermitType');
    const permitType = await PermitType.findById(this.permitType);
    
    if (!permitType || !permitType.requiredDepartments || permitType.requiredDepartments.length === 0) {
      // If no required departments, initialize with default building department
      this.requiredDepartments = ['building'];
      this.departmentReviews = [{
        department: 'building',
        status: 'pending'
      }];
      return;
    }
    
    this.requiredDepartments = permitType.requiredDepartments;
    this.departmentReviews = permitType.requiredDepartments.map(dept => ({
      department: dept,
      status: 'pending'
    }));
  } catch (error) {
    console.error('Error initializing department reviews:', error);
    // Fallback to building department
    this.requiredDepartments = ['building'];
    this.departmentReviews = [{
      department: 'building',
      status: 'pending'
    }];
  }
};

permitSchema.methods.submitDepartmentReview = function (department, userId, userDetails, reviewData) {
  const review = this.departmentReviews.find(r => r.department === department);
  if (!review) {
    throw new Error(`Department ${department} is not required for this permit`);
  }
  
  review.status = reviewData.status;
  review.reviewer = {
    id: userId,
    name: userDetails.firstName + ' ' + userDetails.lastName
  };
  review.reviewedAt = new Date();
  review.notes = reviewData.notes;
  review.conditions = reviewData.conditions || [];
  
  // Check if all required departments have approved
  this.checkOverallApprovalStatus();
  
  return this.save();
};

permitSchema.methods.checkOverallApprovalStatus = function () {
  if (!this.departmentReviews || this.departmentReviews.length === 0) return;
  
  const approvalCheck = this.canBeApproved();
  const anyRejected = this.departmentReviews.some(review => review.status === 'rejected');
  const anyChangesRequested = this.departmentReviews.some(review => review.status === 'changes-requested');
  
  if (approvalCheck.canApprove && this.status === 'under-review') {
    this.status = 'approved';
    this.approvedDate = new Date();
    // Set expiration date (typically 6 months from approval)
    this.expirationDate = new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000);
  } else if (anyRejected && this.status === 'under-review') {
    this.status = 'denied';
  } else if (anyChangesRequested && this.status === 'under-review') {
    this.status = 'additional-info';
  }
};

permitSchema.methods.getPendingDepartments = function () {
  return this.departmentReviews
    .filter(review => review.status === 'pending')
    .map(review => review.department);
};

permitSchema.methods.getApprovedDepartments = function () {
  return this.departmentReviews
    .filter(review => review.status === 'approved')
    .map(review => review.department);
};

permitSchema.methods.canUserReview = function (user) {
  if (user.userType !== 'municipal') return false;
  if (!user.department) return false;
  
  const departmentReview = this.departmentReviews.find(
    review => review.department === user.department
  );
  
  return departmentReview && departmentReview.status === 'pending';
};

// Validation methods for permit progression
permitSchema.methods.canBeApproved = function () {
  // Check if all required departments have approved
  if (!this.departmentReviews || this.departmentReviews.length === 0) {
    return { canApprove: false, reason: 'No department reviews initialized' };
  }
  
  const pendingReviews = this.departmentReviews.filter(review => review.status === 'pending');
  const rejectedReviews = this.departmentReviews.filter(review => review.status === 'rejected');
  
  if (rejectedReviews.length > 0) {
    return { 
      canApprove: false, 
      reason: `Rejected by: ${rejectedReviews.map(r => r.department).join(', ')}` 
    };
  }
  
  if (pendingReviews.length > 0) {
    return { 
      canApprove: false, 
      reason: `Pending review by: ${pendingReviews.map(r => r.department).join(', ')}` 
    };
  }
  
  return { canApprove: true, reason: 'All departments have approved' };
};

permitSchema.methods.canBeCompleted = async function () {
  try {
    // First check if permit is approved
    if (this.status !== 'approved' && this.status !== 'active' && this.status !== 'inspections') {
      return { canComplete: false, reason: 'Permit must be approved before completion' };
    }
    
    // Check if all required departments have approved
    const approvalCheck = this.canBeApproved();
    if (!approvalCheck.canApprove && this.status !== 'approved') {
      return { canComplete: false, reason: approvalCheck.reason };
    }
    
    // Get required inspections from permit type
    const PermitType = mongoose.model('PermitType');
    const permitType = await PermitType.findById(this.permitType);
    
    if (permitType && permitType.requiredInspections && permitType.requiredInspections.length > 0) {
      const requiredInspectionTypes = permitType.requiredInspections
        .filter(inspection => inspection.required !== false)
        .map(inspection => inspection.type);
      
      // Check if all required inspections are completed and passed
      const completedInspections = this.inspections.filter(
        inspection => inspection.status === 'passed'
      );
      
      const missingInspections = requiredInspectionTypes.filter(
        requiredType => !completedInspections.some(
          inspection => inspection.type === requiredType
        )
      );
      
      if (missingInspections.length > 0) {
        return { 
          canComplete: false, 
          reason: `Missing required inspections: ${missingInspections.join(', ')}` 
        };
      }
      
      // Check if any required inspections failed
      const failedInspections = this.inspections.filter(
        inspection => inspection.status === 'failed' && 
        requiredInspectionTypes.includes(inspection.type)
      );
      
      if (failedInspections.length > 0) {
        return { 
          canComplete: false, 
          reason: `Failed required inspections: ${failedInspections.map(i => i.type).join(', ')}` 
        };
      }
    }
    
    return { canComplete: true, reason: 'All requirements met for completion' };
    
  } catch (error) {
    console.error('Error checking permit completion requirements:', error);
    return { canComplete: false, reason: 'Error checking requirements' };
  }
};

permitSchema.methods.getRequiredInspections = async function () {
  try {
    const PermitType = mongoose.model('PermitType');
    const permitType = await PermitType.findById(this.permitType);
    
    if (!permitType || !permitType.requiredInspections) {
      return [];
    }
    
    return permitType.requiredInspections.filter(inspection => inspection.required !== false);
  } catch (error) {
    console.error('Error getting required inspections:', error);
    return [];
  }
};

permitSchema.methods.getInspectionStatus = async function () {
  try {
    const requiredInspections = await this.getRequiredInspections();
    
    return requiredInspections.map(required => {
      const completedInspection = this.inspections.find(
        inspection => inspection.type === required.type
      );
      
      return {
        type: required.type,
        name: required.name,
        description: required.description,
        required: required.required,
        status: completedInspection ? completedInspection.status : 'not-scheduled',
        inspection: completedInspection || null
      };
    });
  } catch (error) {
    console.error('Error getting inspection status:', error);
    return [];
  }
};

// Static methods
permitSchema.statics.getStatistics = function (
  municipalityId,
  year = new Date().getFullYear(),
) {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);

  return this.aggregate([
    {
      $match: {
        municipality: mongoose.Types.ObjectId(municipalityId),
        applicationDate: { $gte: startOfYear, $lte: endOfYear },
      },
    },
    {
      $group: {
        _id: null,
        totalPermits: { $sum: 1 },
        totalValue: { $sum: '$estimatedValue' },
        totalFees: { $sum: '$totalFees' },
        avgProcessingTime: {
          $avg: { $subtract: ['$approvedDate', '$submittedDate'] },
        },
        statusBreakdown: {
          $push: '$status',
        },
      },
    },
  ]);
};

module.exports = mongoose.model('Permit', permitSchema);
