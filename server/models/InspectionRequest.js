const mongoose = require('mongoose');

const inspectionRequestSchema = new mongoose.Schema({
  permitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permit',
    required: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestType: {
    type: String,
    enum: ['asap', 'within_week', 'specific_date'],
    required: true
  },
  preferredDate: {
    type: Date,
    required: function() {
      return this.requestType === 'specific_date';
    }
  },
  inspectionType: {
    type: String,
    required: true,
    default: 'Final Inspection'
  },
  notes: {
    type: String,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'scheduled', 'completed', 'cancelled'],
    default: 'pending'
  },
  scheduledDate: Date,
  scheduledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  inspector: {
    name: String,
    id: mongoose.Schema.Types.ObjectId
  }
}, {
  timestamps: true
});

// Index for efficient queries
inspectionRequestSchema.index({ permitId: 1, status: 1 });
inspectionRequestSchema.index({ scheduledDate: 1 });

module.exports = mongoose.model('InspectionRequest', inspectionRequestSchema);