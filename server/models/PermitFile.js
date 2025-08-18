const mongoose = require('mongoose');

const permitFileSchema = new mongoose.Schema(
  {
    permitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Permit',
      required: true,
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
      required: true,
      unique: true,
    },
    mimetype: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    fileType: {
      type: String,
      enum: [
        'plans',
        'specifications',
        'calculations',
        'photos',
        'reports',
        'correspondence',
        'certificates',
        'surveys',
        'other',
      ],
      default: 'other',
    },
    description: {
      type: String,
      trim: true,
    },
    isPublic: {
      type: Boolean,
      default: false, // Only visible to permit stakeholders by default
    },
    uploadDate: {
      type: Date,
      default: Date.now,
    },
    // File metadata
    path: {
      type: String,
      required: true,
    },
    url: {
      type: String, // Will be generated based on storage solution
    },
    // Version control
    version: {
      type: Number,
      default: 1,
    },
    replacedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PermitFile',
    },
    replaces: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PermitFile',
    },
    // Status
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'approved', 'rejected', 'archived'],
      default: 'uploaded',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewDate: {
      type: Date,
    },
    reviewNotes: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient queries
permitFileSchema.index({ permitId: 1, uploadDate: -1 });
permitFileSchema.index({ uploadedBy: 1, uploadDate: -1 });
permitFileSchema.index({ fileType: 1 });
permitFileSchema.index({ status: 1 });

// Virtual for file URL
permitFileSchema.virtual('downloadUrl').get(function () {
  return `/api/permits/${this.permitId}/files/${this._id}/download`;
});

// Instance methods
permitFileSchema.methods.toPublic = function () {
  const file = this.toObject();

  // Remove sensitive server paths
  delete file.path;
  delete file.__v;

  return {
    ...file,
    downloadUrl: this.downloadUrl,
  };
};

// Static methods
permitFileSchema.statics.getByPermit = function (permitId, options = {}) {
  const query = { permitId };

  if (options.fileType) {
    query.fileType = options.fileType;
  }

  if (options.status) {
    query.status = options.status;
  }

  return this.find(query)
    .populate('uploadedBy', 'firstName lastName email userType')
    .populate('reviewedBy', 'firstName lastName email')
    .sort({ uploadDate: -1 });
};

permitFileSchema.statics.getFileStats = function (permitId) {
  return this.aggregate([
    { $match: { permitId: new mongoose.Types.ObjectId(permitId) } },
    {
      $group: {
        _id: '$fileType',
        count: { $sum: 1 },
        totalSize: { $sum: '$size' },
        latestUpload: { $max: '$uploadDate' },
      },
    },
  ]);
};

// Pre-save middleware
permitFileSchema.pre('save', function (next) {
  // Generate URL if not set
  if (!this.url && this.filename) {
    this.url = this.downloadUrl;
  }
  next();
});

module.exports = mongoose.model('PermitFile', permitFileSchema);
