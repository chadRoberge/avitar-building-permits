const express = require('express');
const router = express.Router();
const { apiKeyAuth } = require('../middleware/apiKeyAuth');
const Permit = require('../models/Permit');
const User = require('../models/User');

// Apply API key authentication to all routes
router.use(apiKeyAuth);

// Get permits for the authenticated municipality
router.get('/permits', async (req, res) => {
  try {
    const { page = 1, limit = 50, status, dateFrom, dateTo, permitType } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query filter
    const query = { municipality: req.municipality._id };
    
    if (status) {
      query.status = status;
    }
    
    if (permitType) {
      query.permitType = permitType;
    }
    
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.createdAt.$lte = new Date(dateTo);
      }
    }

    // Get permits with pagination
    const permits = await Permit.find(query)
      .populate('applicant', 'firstName lastName email phone businessInfo propertyAddress')
      .populate('permitType', 'name category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Permit.countDocuments(query);

    // Format permits for external consumption
    const formattedPermits = permits.map(permit => ({
      id: permit._id,
      permitNumber: permit.permitNumber,
      status: permit.status,
      permitType: {
        name: permit.permitType?.name,
        category: permit.permitType?.category
      },
      applicant: {
        name: `${permit.applicant?.firstName || ''} ${permit.applicant?.lastName || ''}`.trim(),
        email: permit.applicant?.email,
        phone: permit.applicant?.phone,
        businessName: permit.applicant?.businessInfo?.businessName,
        propertyAddress: permit.applicant?.propertyAddress
      },
      projectDetails: {
        description: permit.projectDetails?.description,
        estimatedCost: permit.projectDetails?.estimatedCost,
        startDate: permit.projectDetails?.startDate,
        expectedCompletionDate: permit.projectDetails?.expectedCompletionDate
      },
      propertyInfo: {
        address: permit.propertyInfo?.address,
        parcelNumber: permit.propertyInfo?.parcelNumber,
        zoning: permit.propertyInfo?.zoning,
        lotSize: permit.propertyInfo?.lotSize
      },
      fees: {
        total: permit.fees?.total,
        paid: permit.fees?.paid,
        balance: permit.fees?.balance
      },
      dates: {
        submitted: permit.createdAt,
        lastUpdated: permit.updatedAt,
        approved: permit.approvalDate,
        completed: permit.completionDate
      }
    }));

    res.json({
      permits: formattedPermits,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      municipality: {
        id: req.municipality._id,
        name: req.municipality.name,
        portalUrl: req.municipality.portalUrl
      }
    });

  } catch (error) {
    console.error('API permits fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch permits',
      message: 'An error occurred while retrieving permit data'
    });
  }
});

// Get a specific permit by ID
router.get('/permits/:permitId', async (req, res) => {
  try {
    const permit = await Permit.findOne({ 
      _id: req.params.permitId, 
      municipality: req.municipality._id 
    })
      .populate('applicant', 'firstName lastName email phone businessInfo propertyAddress')
      .populate('permitType', 'name category description requirements')
      .populate('reviewedBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email');

    if (!permit) {
      return res.status(404).json({ 
        error: 'Permit not found',
        message: 'No permit found with the specified ID for this municipality'
      });
    }

    // Format permit for external consumption
    const formattedPermit = {
      id: permit._id,
      permitNumber: permit.permitNumber,
      status: permit.status,
      permitType: {
        name: permit.permitType?.name,
        category: permit.permitType?.category,
        description: permit.permitType?.description,
        requirements: permit.permitType?.requirements
      },
      applicant: {
        name: `${permit.applicant?.firstName || ''} ${permit.applicant?.lastName || ''}`.trim(),
        email: permit.applicant?.email,
        phone: permit.applicant?.phone,
        businessName: permit.applicant?.businessInfo?.businessName,
        businessType: permit.applicant?.businessInfo?.businessType,
        propertyAddress: permit.applicant?.propertyAddress
      },
      projectDetails: permit.projectDetails,
      propertyInfo: permit.propertyInfo,
      fees: permit.fees,
      reviewComments: permit.reviewComments,
      attachments: permit.attachments?.map(att => ({
        filename: att.filename,
        originalName: att.originalName,
        fileType: att.fileType,
        uploadedAt: att.uploadedAt,
        // Note: File URLs are not included for security reasons
      })),
      staff: {
        reviewedBy: permit.reviewedBy ? {
          name: `${permit.reviewedBy.firstName} ${permit.reviewedBy.lastName}`,
          email: permit.reviewedBy.email
        } : null,
        approvedBy: permit.approvedBy ? {
          name: `${permit.approvedBy.firstName} ${permit.approvedBy.lastName}`,
          email: permit.approvedBy.email
        } : null
      },
      dates: {
        submitted: permit.createdAt,
        lastUpdated: permit.updatedAt,
        approved: permit.approvalDate,
        completed: permit.completionDate
      }
    };

    res.json({
      permit: formattedPermit,
      municipality: {
        id: req.municipality._id,
        name: req.municipality.name,
        portalUrl: req.municipality.portalUrl
      }
    });

  } catch (error) {
    console.error('API permit fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch permit',
      message: 'An error occurred while retrieving permit data'
    });
  }
});

// Get permit statistics
router.get('/statistics', async (req, res) => {
  try {
    const { year, month } = req.query;
    
    // Build date filter
    let dateFilter = { municipality: req.municipality._id };
    
    if (year) {
      const startDate = new Date(parseInt(year), month ? parseInt(month) - 1 : 0, 1);
      const endDate = month 
        ? new Date(parseInt(year), parseInt(month), 0) // Last day of the month
        : new Date(parseInt(year) + 1, 0, 0); // Last day of the year
      
      dateFilter.createdAt = {
        $gte: startDate,
        $lte: endDate
      };
    }

    // Get statistics
    const [
      totalPermits,
      permitsByStatus,
      permitsByType,
      averageProcessingTime
    ] = await Promise.all([
      Permit.countDocuments(dateFilter),
      
      Permit.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      
      Permit.aggregate([
        { $match: dateFilter },
        { $lookup: { from: 'permittypes', localField: 'permitType', foreignField: '_id', as: 'type' } },
        { $unwind: '$type' },
        { $group: { _id: '$type.category', count: { $sum: 1 } } }
      ]),
      
      Permit.aggregate([
        { 
          $match: { 
            ...dateFilter, 
            status: { $in: ['approved', 'completed'] },
            approvalDate: { $exists: true }
          } 
        },
        {
          $group: {
            _id: null,
            avgDays: {
              $avg: {
                $divide: [
                  { $subtract: ['$approvalDate', '$createdAt'] },
                  1000 * 60 * 60 * 24 // Convert to days
                ]
              }
            }
          }
        }
      ])
    ]);

    // Format statistics
    const statusStats = permitsByStatus.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const typeStats = permitsByType.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    res.json({
      statistics: {
        totalPermits,
        byStatus: statusStats,
        byType: typeStats,
        averageProcessingDays: averageProcessingTime[0]?.avgDays || null
      },
      municipality: {
        id: req.municipality._id,
        name: req.municipality.name
      },
      period: {
        year: year ? parseInt(year) : null,
        month: month ? parseInt(month) : null
      }
    });

  } catch (error) {
    console.error('API statistics error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      message: 'An error occurred while retrieving statistics'
    });
  }
});

// Get API information and usage
router.get('/info', (req, res) => {
  res.json({
    api: {
      version: '1.0.0',
      municipality: {
        id: req.municipality._id,
        name: req.municipality.name,
        portalUrl: req.municipality.portalUrl
      }
    },
    endpoints: [
      'GET /api/integration/permits - List permits with filtering options',
      'GET /api/integration/permits/:id - Get specific permit details',
      'GET /api/integration/statistics - Get permit statistics',
      'GET /api/integration/info - This endpoint'
    ],
    authentication: {
      method: 'API Key',
      header: 'X-API-Key or Authorization: Bearer <key>'
    }
  });
});

module.exports = router;