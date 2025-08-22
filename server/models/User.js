const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const municipalityRefSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Municipality',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zip: { type: String, trim: true },
    county: { type: String, trim: true },
  },
});

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    userType: {
      type: String,
      enum: ['municipal', 'residential', 'commercial', 'system_admin'],
      required: true,
    },
    // Municipal users have municipality data
    municipality: {
      type: municipalityRefSchema,
      required: function () {
        return this.userType === 'municipal';
      },
    },
    // Municipal users have department assignment
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
        'finance',
        'admin'
      ],
      required: function () {
        return this.userType === 'municipal';
      },
    },
    // Residential users have property address
    propertyAddress: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zip: { type: String, trim: true },
      county: { type: String, trim: true },
    },
    // Commercial users have business information
    businessInfo: {
      businessName: { type: String, trim: true },
      businessType: { type: String, trim: true },
      licenseNumber: { type: String, trim: true },
      businessAddress: {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        zip: { type: String, trim: true },
        county: { type: String, trim: true },
      },
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      // DEPRECATED: Use permissionLevel for granular access control
      // This field is maintained for backward compatibility only
    },
    // Numeric permission level system
    permissionLevel: {
      type: Number,
      required: true,
      default: 1, // Will be set by pre-save middleware based on userType
      min: 1,
      max: 50
    },
    // Optional: Human-readable role name for UI display
    roleName: {
      type: String,
      default: function() {
        return this.getRoleName();
      }
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre('save', async function (next) {
  // Set default permission level based on user type if not already set
  if (this.isNew && !this.permissionLevel) {
    switch (this.userType) {
      case 'residential':
        this.permissionLevel = 1; // Residential Basic User
        break;
      case 'commercial':
        this.permissionLevel = 5; // Commercial Basic User  
        break;
      case 'municipal':
        this.permissionLevel = 11; // Municipal Basic User
        break;
      case 'system_admin':
        this.permissionLevel = 32; // System Developer
        break;
      default:
        this.permissionLevel = 1; // Default to residential basic
    }
  }

  // Sync legacy role field with permission level
  if (this.isModified('permissionLevel')) {
    this.role = this.permissionLevel >= 21 ? 'admin' : 'user';
  }

  // Hash password if modified
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Permission level methods
userSchema.methods.getRoleName = function () {
  const permissionMap = {
    // Residential Users (1-4)
    1: 'Residential Basic User',
    2: 'Residential Verified User',
    3: 'Residential Premium User',
    4: 'Residential VIP User',
    
    // Commercial Users (5-10) 
    5: 'Commercial Basic User',
    6: 'Commercial Verified User',
    7: 'Commercial Premium User',
    8: 'Commercial Enterprise User',
    9: 'Commercial Partner User',
    10: 'Commercial VIP User',
    
    // Municipal Users (11-20)
    11: 'Municipal Basic User',
    12: 'Municipal Viewer',
    13: 'Municipal Power User',
    14: 'Department Reviewer',
    15: 'Municipal Inspector',
    16: 'Senior Inspector',
    17: 'Department Supervisor',
    18: 'Municipal Coordinator',
    19: 'Municipal Manager',
    20: 'Assistant Admin',
    
    // Admin Users (21-30)
    21: 'Municipal Admin',
    22: 'Municipal System Admin',
    23: 'Municipality Super Admin',
    24: 'Regional Admin',
    25: 'District Admin',
    26: 'State Admin',
    27: 'Federal Admin',
    28: 'Enterprise Admin',
    29: 'Master Admin',
    30: 'Global Admin',
    
    // System Users (31-50)
    31: 'Platform Admin',
    32: 'System Developer',
    33: 'System Architect',
    34: 'Security Admin',
    35: 'Database Admin',
    40: 'Integration Specialist',
    45: 'System Owner',
    50: 'Root Admin'
  };
  return permissionMap[this.permissionLevel] || `Level ${this.permissionLevel} User`;
};

userSchema.methods.hasPermissionLevel = function (requiredLevel) {
  return this.permissionLevel >= requiredLevel;
};

// User type category methods
userSchema.methods.isResidentialUser = function () {
  return this.permissionLevel >= 1 && this.permissionLevel <= 4;
};

userSchema.methods.isCommercialUser = function () {
  return this.permissionLevel >= 5 && this.permissionLevel <= 10;
};

userSchema.methods.isMunicipalUser = function () {
  return this.permissionLevel >= 11 && this.permissionLevel <= 20;
};

userSchema.methods.isAdmin = function () {
  return this.permissionLevel >= 21 && this.permissionLevel <= 30;
};

userSchema.methods.isSystemUser = function () {
  return this.permissionLevel >= 31;
};

// Capability methods
userSchema.methods.canSubmitPermits = function () {
  return this.permissionLevel >= 1; // All users can submit
};

userSchema.methods.canEditOwnPermits = function () {
  return this.permissionLevel >= 1; // All users can edit their own permits
};

userSchema.methods.canViewOtherPermits = function () {
  return this.permissionLevel >= 11; // Municipal users and above
};

userSchema.methods.canEditAnyPermits = function () {
  return this.permissionLevel >= 13; // Municipal power users and above
};

userSchema.methods.canReviewDepartment = function (department) {
  if (this.permissionLevel < 14) return false; // Must be department reviewer or above
  if (this.userType !== 'municipal') return false;
  return !department || this.department === department; // Can review own department
};

userSchema.methods.canManageUsers = function () {
  return this.permissionLevel >= 21; // Admin and above
};

userSchema.methods.canConfigureSystem = function () {
  return this.permissionLevel >= 22; // System admin and above
};

userSchema.methods.canManagePermitTypes = function () {
  return this.permissionLevel >= 13; // Municipal power users and above
};

userSchema.methods.canAccessBilling = function () {
  return this.permissionLevel >= 21; // Admin users and above
};

// Commercial-specific methods
userSchema.methods.canManageMultipleProjects = function () {
  return this.permissionLevel >= 7; // Commercial premium and above
};

userSchema.methods.canAccessAPIIntegrations = function () {
  return this.permissionLevel >= 8; // Commercial enterprise and above
};

// Legacy compatibility methods
userSchema.methods.getLegacyRole = function () {
  // Map permission levels to legacy role system
  return this.permissionLevel >= 21 ? 'admin' : 'user';
};

userSchema.methods.syncLegacyRole = function () {
  // Sync the legacy role field with permission level
  this.role = this.getLegacyRole();
};

userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  // Add computed role name for frontend
  user.roleName = this.getRoleName();
  return user;
};

module.exports = mongoose.model('User', userSchema);
