const mongoose = require('mongoose');

// Field definition for dynamic forms
const fieldDefinitionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: [
      'text',
      'textarea',
      'number',
      'currency',
      'date',
      'email',
      'phone',
      'select',
      'radio',
      'checkbox',
      'file',
      'address',
    ],
    required: true,
  },
  required: {
    type: Boolean,
    default: false,
  },
  helpText: String,
  placeholder: String,

  // For select/radio options
  options: [
    {
      value: String,
      label: String,
    },
  ],

  // Validation rules
  validation: {
    min: Number,
    max: Number,
    minLength: Number,
    maxLength: Number,
    pattern: String, // RegEx pattern
    customMessage: String,
  },

  // Conditional display
  conditionalDisplay: {
    dependsOn: String, // Field name
    value: String, // Value that triggers display
    operator: {
      type: String,
      enum: ['equals', 'not_equals', 'greater_than', 'less_than', 'contains'],
      default: 'equals',
    },
  },

  // Field ordering
  order: {
    type: Number,
    default: 0,
  },
});

// Workflow step definition
const workflowStepSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: String,
  order: {
    type: Number,
    required: true,
  },

  // Who can perform this step
  allowedRoles: [
    {
      type: String,
      enum: ['applicant', 'municipal-staff', 'inspector', 'admin'],
    },
  ],

  // What happens in this step
  actions: [
    {
      type: {
        type: String,
        enum: [
          'review',
          'approve',
          'request-info',
          'schedule-inspection',
          'payment',
          'upload-document',
        ],
      },
      required: {
        type: Boolean,
        default: false,
      },
      description: String,
    },
  ],

  // Required documents for this step
  requiredDocuments: [String],

  // Auto-transitions
  autoTransition: {
    enabled: {
      type: Boolean,
      default: false,
    },
    condition: String, // e.g., "payment_received", "documents_uploaded"
    nextStep: String,
  },

  // Notification settings
  notifications: {
    onEntry: {
      type: Boolean,
      default: false,
    },
    recipients: [String], // email addresses or roles
    emailTemplate: String,
  },
});

// Fee structure
const feeStructureSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['fixed', 'percentage', 'per-unit', 'tiered'],
    required: true,
  },

  // Fixed fee
  amount: Number,

  // Percentage fee
  percentage: Number,
  baseField: String, // Field name to calculate percentage from

  // Per-unit fee
  unitAmount: Number,
  unitField: String, // Field name that contains unit count

  // Tiered fee structure
  tiers: [
    {
      min: Number,
      max: Number,
      amount: Number,
      percentage: Number,
    },
  ],

  description: String,
  optional: {
    type: Boolean,
    default: false,
  },
});

const permitTypeSchema = new mongoose.Schema(
  {
    // Basic Information
    name: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        'building',
        'electrical',
        'plumbing',
        'mechanical',
        'zoning',
        'specialized',
        'demolition',
        'sign',
        'occupancy',
        'fire',
        'environmental',
        'other',
      ],
    },
    description: String,

    // Municipality
    municipality: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Municipality',
      required: true,
    },

    // Form Configuration
    applicationFields: [fieldDefinitionSchema],

    // Workflow Configuration
    workflow: [workflowStepSchema],

    // Fee Structure
    fees: [feeStructureSchema],

    // Requirements
    requiredDocuments: [
      {
        name: String,
        description: String,
        required: {
          type: Boolean,
          default: true,
        },
        allowedFormats: [String], // e.g., ['pdf', 'jpg', 'png']
        maxSize: Number, // in MB
      },
    ],

    requiredInspections: [
      {
        name: String,
        type: {
          type: String,
          enum: [
            'foundation-certification',
            'footing-inspection', 
            'rebar-inspection',
            'electrical-inspection',
            'framing-inspection',
            'plumbing-inspection',
            'mechanical-inspection',
            'insulation-inspection',
            'drywall-inspection',
            'final-inspection',
            'fire-safety-inspection',
            'accessibility-inspection',
            'energy-efficiency-inspection',
            'environmental-inspection',
            'other'
          ],
          required: true
        },
        description: String,
        triggerCondition: String, // When this inspection is required
        estimatedDuration: Number, // in minutes
        required: {
          type: Boolean,
          default: true
        },
        order: {
          type: Number,
          default: 0
        }
      },
    ],

    // Required departments that must review this permit type
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

    // Processing Settings
    estimatedProcessingTime: {
      type: Number, // in business days
      default: 5,
    },
    expirationPeriod: {
      type: Number, // in months
      default: 6,
    },

    // Approval Requirements
    approvalCriteria: [String],
    automaticApproval: {
      enabled: {
        type: Boolean,
        default: false,
      },
      conditions: [String], // Conditions that must be met for auto-approval
    },

    // Display Settings
    isActive: {
      type: Boolean,
      default: true,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    icon: String,
    color: String,

    // Help and Documentation
    helpText: String,
    instructionsUrl: String,
    faqUrl: String,

    // Compliance and Legal
    legalReferences: [String],
    codeReferences: [String],

    // Statistics tracking
    stats: {
      totalApplications: {
        type: Number,
        default: 0,
      },
      averageProcessingTime: Number,
      approvalRate: Number,
      lastUpdated: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
permitTypeSchema.index({ municipality: 1, isActive: 1 });
permitTypeSchema.index({ code: 1, municipality: 1 }, { unique: true });
permitTypeSchema.index({ category: 1, municipality: 1 });
permitTypeSchema.index({ displayOrder: 1 });

// Pre-save middleware
permitTypeSchema.pre('save', function (next) {
  // Ensure code is uppercase
  if (this.code) {
    this.code = this.code.toUpperCase();
  }

  // Sort workflow steps by order
  if (this.workflow && this.workflow.length > 0) {
    this.workflow.sort((a, b) => a.order - b.order);
  }

  // Sort application fields by order
  if (this.applicationFields && this.applicationFields.length > 0) {
    this.applicationFields.sort((a, b) => a.order - b.order);
  }

  next();
});

// Instance methods
permitTypeSchema.methods.calculateFees = function (applicationData) {
  if (!this.fees || this.fees.length === 0) return 0;

  let totalFees = 0;

  this.fees.forEach((fee) => {
    switch (fee.type) {
      case 'fixed':
        totalFees += fee.amount || 0;
        break;

      case 'percentage':
        if (fee.baseField && applicationData[fee.baseField]) {
          const baseValue = parseFloat(applicationData[fee.baseField]) || 0;
          totalFees += (baseValue * (fee.percentage || 0)) / 100;
        }
        break;

      case 'per-unit':
        if (fee.unitField && applicationData[fee.unitField]) {
          const units = parseFloat(applicationData[fee.unitField]) || 0;
          totalFees += units * (fee.unitAmount || 0);
        }
        break;

      case 'tiered':
        if (fee.baseField && applicationData[fee.baseField] && fee.tiers) {
          const baseValue = parseFloat(applicationData[fee.baseField]) || 0;

          for (const tier of fee.tiers) {
            if (
              baseValue >= (tier.min || 0) &&
              baseValue <= (tier.max || Infinity)
            ) {
              if (tier.amount) {
                totalFees += tier.amount;
              } else if (tier.percentage) {
                totalFees += (baseValue * tier.percentage) / 100;
              }
              break;
            }
          }
        }
        break;
    }
  });

  return Math.round(totalFees * 100) / 100; // Round to 2 decimal places
};

permitTypeSchema.methods.validateApplicationData = function (applicationData) {
  const errors = [];

  this.applicationFields.forEach((field) => {
    const value = applicationData[field.name];

    // Check required fields
    if (field.required && (!value || value === '')) {
      errors.push(`${field.label} is required`);
      return;
    }

    // Skip validation if field is empty and not required
    if (!value || value === '') return;

    // Type-specific validation
    switch (field.type) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push(`${field.label} must be a valid email address`);
        }
        break;

      case 'number':
      case 'currency':
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          errors.push(`${field.label} must be a valid number`);
        } else {
          if (field.validation) {
            if (
              field.validation.min !== undefined &&
              numValue < field.validation.min
            ) {
              errors.push(
                `${field.label} must be at least ${field.validation.min}`,
              );
            }
            if (
              field.validation.max !== undefined &&
              numValue > field.validation.max
            ) {
              errors.push(
                `${field.label} must be no more than ${field.validation.max}`,
              );
            }
          }
        }
        break;

      case 'text':
      case 'textarea':
        if (field.validation) {
          if (
            field.validation.minLength &&
            value.length < field.validation.minLength
          ) {
            errors.push(
              `${field.label} must be at least ${field.validation.minLength} characters`,
            );
          }
          if (
            field.validation.maxLength &&
            value.length > field.validation.maxLength
          ) {
            errors.push(
              `${field.label} must be no more than ${field.validation.maxLength} characters`,
            );
          }
          if (field.validation.pattern) {
            const regex = new RegExp(field.validation.pattern);
            if (!regex.test(value)) {
              errors.push(
                field.validation.customMessage ||
                  `${field.label} format is invalid`,
              );
            }
          }
        }
        break;
    }
  });

  return errors;
};

permitTypeSchema.methods.getNextWorkflowStep = function (currentStep) {
  if (!this.workflow || this.workflow.length === 0) return null;

  const currentIndex = this.workflow.findIndex(
    (step) => step.name === currentStep,
  );
  if (currentIndex === -1 || currentIndex === this.workflow.length - 1)
    return null;

  return this.workflow[currentIndex + 1];
};

// Static methods
permitTypeSchema.statics.getByMunicipality = function (
  municipalityId,
  includeInactive = false,
) {
  const query = { municipality: municipalityId };
  if (!includeInactive) {
    query.isActive = true;
  }

  return this.find(query).sort({ displayOrder: 1, name: 1 });
};

permitTypeSchema.statics.getByCategory = function (municipalityId, category) {
  return this.find({
    municipality: municipalityId,
    category,
    isActive: true,
  }).sort({ displayOrder: 1, name: 1 });
};

module.exports = mongoose.model('PermitType', permitTypeSchema);
