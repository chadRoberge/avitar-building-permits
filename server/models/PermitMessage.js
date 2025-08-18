const mongoose = require('mongoose');

const permitMessageSchema = new mongoose.Schema(
  {
    permit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Permit',
      required: true,
    },

    // Message content
    message: {
      type: String,
      required: true,
      maxLength: 2000,
    },

    // Sender information
    sender: {
      id: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
      },
      type: {
        type: String,
        enum: ['applicant', 'contractor', 'municipal_staff', 'system'],
        required: true,
      },
      department: {
        type: String, // For municipal staff: "Building Department", "Fire Department", etc.
        required: false,
      },
    },

    // Message metadata
    messageType: {
      type: String,
      enum: [
        'general',
        'question',
        'request_info',
        'status_update',
        'approval',
        'rejection',
        'system_notification',
      ],
      default: 'general',
    },

    // Visibility and status
    isInternal: {
      type: Boolean,
      default: false, // Internal messages only visible to municipal staff
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },

    // Optional attachments reference
    attachments: [
      {
        filename: String,
        originalName: String,
        fileSize: Number,
        mimeType: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient querying
permitMessageSchema.index({ permit: 1, createdAt: -1 });
permitMessageSchema.index({ 'sender.id': 1 });
permitMessageSchema.index({ messageType: 1 });

// Virtual for formatted creation date
permitMessageSchema.virtual('formattedDate').get(function () {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
});

// Static method to get messages for a permit
permitMessageSchema.statics.getPermitMessages = function (
  permitId,
  userType = 'residential',
) {
  const query = { permit: permitId };

  // Filter out internal messages for non-municipal users
  if (userType !== 'municipal') {
    query.isInternal = { $ne: true };
  }

  return this.find(query)
    .sort({ createdAt: 1 }) // Chronological order
    .lean();
};

// Static method to mark messages as read
permitMessageSchema.statics.markAsRead = function (permitId, userId) {
  return this.updateMany(
    {
      permit: permitId,
      'sender.id': { $ne: userId }, // Don't mark own messages as read
      isRead: false,
    },
    {
      isRead: true,
      updatedAt: new Date(),
    },
  );
};

// Instance method to check if user can view this message
permitMessageSchema.methods.canView = function (userType) {
  if (userType === 'municipal') {
    return true; // Municipal staff can see all messages
  }

  return !this.isInternal; // Others can only see non-internal messages
};

const PermitMessage = mongoose.model('PermitMessage', permitMessageSchema);

module.exports = PermitMessage;
