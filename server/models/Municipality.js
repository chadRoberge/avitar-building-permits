const mongoose = require('mongoose');

const buildingDepartmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    default: 'Building Department',
  },
  phone: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
  },
  fax: {
    type: String,
  },
  address: {
    type: String,
    required: true,
  },
  hoursOfOperation: {
    type: String,
  },
  permitFeeSchedule: {
    type: String, // URL to fee schedule
  },
});

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
  county: {
    type: String,
    required: true,
  },
});

const municipalitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['town', 'city', 'county', 'village', 'township'],
      required: true,
    },
    address: {
      type: addressSchema,
      required: true,
    },
    website: {
      type: String,
      trim: true,
    },
    population: {
      type: Number,
    },
    buildingDepartment: {
      type: buildingDepartmentSchema,
      required: true,
    },

    // Portal configuration
    isActive: {
      type: Boolean,
      default: true,
    },
    portalUrl: {
      type: String,
      unique: true,
      sparse: true, // Allows null values to not be unique
    },

    // Administrative
    registrationDate: {
      type: Date,
      default: Date.now,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },

    // Subscription and Billing
    subscription: {
      plan: {
        type: String,
        enum: ['basic', 'professional', 'enterprise'],
        default: 'basic',
      },
      status: {
        type: String,
        enum: ['active', 'past_due', 'canceled', 'trialing'],
        default: 'active',
      },
      currentPeriodStart: {
        type: Date,
        default: Date.now,
      },
      currentPeriodEnd: {
        type: Date,
        default: function () {
          const oneYearFromNow = new Date();
          oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
          return oneYearFromNow;
        },
      },
      trialEnd: {
        type: Date,
      },
      cancelAtPeriodEnd: {
        type: Boolean,
        default: false,
      },
      stripeCustomerId: {
        type: String, // Stripe customer ID
      },
      stripeSubscriptionId: {
        type: String, // Stripe subscription ID
      },
      stripePriceId: {
        type: String, // Stripe price ID for the current plan
      },
      stripeProductId: {
        type: String, // Stripe product ID for the current plan
      },
    },

    // Usage tracking
    usage: {
      permits: {
        currentPeriod: {
          type: Number,
          default: 0,
        },
        lastResetDate: {
          type: Date,
          default: Date.now,
        },
      },
      users: {
        current: {
          type: Number,
          default: 1,
        },
      },
    },

    // Settings
    settings: {
      allowOnlinePayments: {
        type: Boolean,
        default: false,
      },
      requireDigitalSignatures: {
        type: Boolean,
        default: false,
      },
      autoEmailNotifications: {
        type: Boolean,
        default: true,
      },
      publicPortalAccess: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  },
);

// Generate portal URL from municipality name
municipalitySchema.pre('save', function (next) {
  if (!this.portalUrl && this.name) {
    // Create URL-friendly slug from municipality name
    const slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '');

    this.portalUrl = slug;
  }

  this.lastUpdated = new Date();
  next();
});

// Index for searching
municipalitySchema.index({
  name: 'text',
  'address.city': 'text',
  'address.zip': 1,
});
municipalitySchema.index({ 'address.state': 1, isActive: 1 });

// Instance methods
municipalitySchema.methods.getFullAddress = function () {
  const addr = this.address;
  return `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`;
};

municipalitySchema.methods.toPublic = function () {
  const municipality = this.toObject();

  // Remove sensitive information for public API
  delete municipality.settings;
  delete municipality.subscription;
  delete municipality.usage;
  delete municipality.__v;

  return municipality;
};

// Subscription helper methods
municipalitySchema.methods.getSubscriptionLimits = function () {
  const limits = {
    basic: {
      permits: 500,
      users: 5,
      price: 2400, // Annual price in cents
      features: ['basic_workflows', 'email_support'],
    },
    professional: {
      permits: 2000,
      users: 15,
      price: 4800,
      features: [
        'advanced_workflows',
        'api_access',
        'phone_support',
        'custom_branding',
      ],
    },
    enterprise: {
      permits: null, // Unlimited
      users: null, // Unlimited
      price: null, // Custom pricing
      features: [
        'custom_workflows',
        'full_api',
        'dedicated_support',
        'custom_integrations',
      ],
    },
  };

  return limits[this.subscription.plan] || limits.basic;
};

municipalitySchema.methods.isWithinLimits = function () {
  const limits = this.getSubscriptionLimits();
  const checks = {
    permits: limits.permits
      ? this.usage.permits.currentPeriod <= limits.permits
      : true,
    users: limits.users ? this.usage.users.current <= limits.users : true,
  };

  return {
    isValid: checks.permits && checks.users,
    limits: limits,
    current: {
      permits: this.usage.permits.currentPeriod,
      users: this.usage.users.current,
    },
    checks: checks,
  };
};

municipalitySchema.methods.isSubscriptionActive = function () {
  return (
    this.subscription.status === 'active' &&
    new Date() <= this.subscription.currentPeriodEnd
  );
};

municipalitySchema.methods.getDaysUntilRenewal = function () {
  const now = new Date();
  const renewalDate = this.subscription.currentPeriodEnd;
  const diffTime = renewalDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Static methods
municipalitySchema.statics.findByPortalUrl = function (portalUrl) {
  return this.findOne({ portalUrl, isActive: true });
};

municipalitySchema.statics.searchMunicipalities = function (
  searchTerm,
  state = null,
) {
  const query = {
    isActive: true,
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { 'address.city': { $regex: searchTerm, $options: 'i' } },
      { 'address.zip': searchTerm },
    ],
  };

  if (state) {
    query['address.state'] = state;
  }

  return this.find(query).limit(10);
};

module.exports = mongoose.model('Municipality', municipalitySchema);
