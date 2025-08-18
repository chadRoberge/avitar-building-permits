const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema(
  {
    // Owner of the property
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Property identification
    displayName: {
      type: String,
      required: true,
      trim: true,
      default: function () {
        return this.address.street;
      },
    },

    // Property address
    address: {
      street: {
        type: String,
        required: true,
        trim: true,
      },
      city: {
        type: String,
        required: true,
        trim: true,
      },
      state: {
        type: String,
        required: true,
        trim: true,
      },
      zip: {
        type: String,
        required: true,
        trim: true,
      },
      county: {
        type: String,
        trim: true,
      },
      parcelId: {
        type: String,
        trim: true,
      },
    },

    // Municipality this property belongs to
    municipality: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Municipality',
      required: true,
    },

    // Property details
    propertyType: {
      type: String,
      enum: ['residential', 'commercial', 'industrial', 'mixed-use'],
      default: 'residential',
    },

    // Property characteristics
    details: {
      yearBuilt: Number,
      squareFootage: Number,
      lotSize: Number,
      bedrooms: Number,
      bathrooms: Number,
      stories: Number,
      propertyValue: Number,
    },

    // Whether this is the user's primary property for default selection
    isPrimary: {
      type: Boolean,
      default: false,
    },

    // Property status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Additional notes
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for performance
propertySchema.index({ owner: 1, isActive: 1 });
propertySchema.index({ municipality: 1 });
propertySchema.index({ 'address.street': 'text', 'address.city': 'text' });

// Virtual for full address display
propertySchema.virtual('fullAddress').get(function () {
  const addr = this.address;
  return `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`;
});

// Virtual for short address display
propertySchema.virtual('shortAddress').get(function () {
  return `${this.address.street}, ${this.address.city}`;
});

// Ensure only one primary property per user
propertySchema.pre('save', async function (next) {
  if (this.isPrimary && this.isModified('isPrimary')) {
    // Remove primary flag from other properties of this owner
    await mongoose
      .model('Property')
      .updateMany(
        { owner: this.owner, _id: { $ne: this._id } },
        { $set: { isPrimary: false } },
      );
  }
  next();
});

// Static method to get user's primary property
propertySchema.statics.getPrimary = function (userId) {
  return this.findOne({
    owner: userId,
    isPrimary: true,
    isActive: true,
  }).populate('municipality');
};

// Static method to get all user properties
propertySchema.statics.getUserProperties = function (userId) {
  return this.find({
    owner: userId,
    isActive: true,
  })
    .populate('municipality')
    .sort({ isPrimary: -1, createdAt: -1 });
};

// Static method to get user properties filtered by municipality
propertySchema.statics.getUserPropertiesByMunicipality = function (
  userId,
  municipalityId,
) {
  return this.find({
    owner: userId,
    municipality: municipalityId,
    isActive: true,
  })
    .populate('municipality')
    .sort({ isPrimary: -1, createdAt: -1 });
};

// Instance method to set as primary
propertySchema.methods.setAsPrimary = async function () {
  // Remove primary from other properties
  await mongoose
    .model('Property')
    .updateMany(
      { owner: this.owner, _id: { $ne: this._id } },
      { $set: { isPrimary: false } },
    );

  // Set this as primary
  this.isPrimary = true;
  return this.save();
};

module.exports = mongoose.model('Property', propertySchema);
