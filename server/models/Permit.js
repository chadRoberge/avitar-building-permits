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
