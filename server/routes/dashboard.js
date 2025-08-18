const express = require('express');
const mongoose = require('mongoose');
const Municipality = require('../models/Municipality');
const Permit = require('../models/Permit');
const PermitType = require('../models/PermitType');
const auth = require('../middleware/auth');

const router = express.Router();

// Get dashboard statistics
router.get('/stats/:municipalityId', auth, async (req, res) => {
  try {
    const { municipalityId } = req.params;
    const { year = new Date().getFullYear() } = req.query;
    
    // Verify user has access to this municipality
    if (req.user.userType !== 'municipal' || req.user.municipality._id.toString() !== municipalityId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const currentYear = parseInt(year);
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);
    const startOfLastYear = new Date(currentYear - 1, 0, 1);
    const endOfLastYear = new Date(currentYear - 1, 11, 31, 23, 59, 59);

    // Get current year statistics
    const currentYearStats = await Permit.aggregate([
      {
        $match: {
          municipality: mongoose.Types.ObjectId(municipalityId),
          applicationDate: { $gte: startOfYear, $lte: endOfYear }
        }
      },
      {
        $group: {
          _id: null,
          totalPermits: { $sum: 1 },
          totalValue: { $sum: '$estimatedValue' },
          totalRevenue: { $sum: '$totalFees' },
          pendingApprovals: {
            $sum: { $cond: [{ $eq: ['$status', 'under-review'] }, 1, 0] }
          },
          pendingInspections: {
            $sum: { $cond: [{ $eq: ['$status', 'inspections'] }, 1, 0] }
          },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          avgProcessingTime: {
            $avg: {
              $cond: [
                { $and: ['$submittedDate', '$approvedDate'] },
                { $subtract: ['$approvedDate', '$submittedDate'] },
                null
              ]
            }
          }
        }
      }
    ]);

    // Get last year statistics for comparison
    const lastYearStats = await Permit.aggregate([
      {
        $match: {
          municipality: mongoose.Types.ObjectId(municipalityId),
          applicationDate: { $gte: startOfLastYear, $lte: endOfLastYear }
        }
      },
      {
        $group: {
          _id: null,
          totalPermits: { $sum: 1 },
          totalRevenue: { $sum: '$totalFees' }
        }
      }
    ]);

    // Get status breakdown
    const statusBreakdown = await Permit.aggregate([
      {
        $match: {
          municipality: mongoose.Types.ObjectId(municipalityId),
          status: { $nin: ['completed', 'cancelled', 'denied', 'expired'] }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get monthly trends
    const monthlyTrends = await Permit.aggregate([
      {
        $match: {
          municipality: mongoose.Types.ObjectId(municipalityId),
          applicationDate: { $gte: startOfYear, $lte: endOfYear }
        }
      },
      {
        $group: {
          _id: { $month: '$applicationDate' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Get recent activity
    const recentActivity = await Permit.find({
      municipality: municipalityId
    })
    .populate('permitType', 'name')
    .sort({ updatedAt: -1 })
    .limit(10)
    .select('permitNumber status applicant.firstName applicant.lastName permitType updatedAt')
    .lean();

    // Calculate growth percentages
    const current = currentYearStats[0] || {};
    const last = lastYearStats[0] || {};
    
    const permitGrowth = last.totalPermits ? 
      ((current.totalPermits - last.totalPermits) / last.totalPermits * 100).toFixed(1) : 0;
    const revenueGrowth = last.totalRevenue ? 
      ((current.totalRevenue - last.totalRevenue) / last.totalRevenue * 100).toFixed(1) : 0;

    // Format response
    const stats = {
      totalPermits: current.totalPermits || 0,
      permitGrowth: parseFloat(permitGrowth),
      pendingInspections: current.pendingInspections || 0,
      overdueInspections: 0, // TODO: Calculate based on scheduled dates
      pendingApprovals: current.pendingApprovals || 0,
      avgApprovalTime: current.avgProcessingTime ? 
        Math.round(current.avgProcessingTime / (1000 * 60 * 60 * 24) * 10) / 10 : 0,
      permitRevenue: current.totalRevenue || 0,
      revenueGrowth: parseFloat(revenueGrowth),
      totalProjectValue: current.totalValue || 0,
      completionRate: current.totalPermits ? 
        Math.round((current.completed / current.totalPermits) * 100 * 10) / 10 : 0,
      
      statusBreakdown: statusBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {
        submitted: 0,
        'under-review': 0,
        approved: 0,
        active: 0,
        inspections: 0
      }),
      
      monthlyTrends: Array.from({ length: 12 }, (_, i) => {
        const monthData = monthlyTrends.find(m => m._id === i + 1);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return {
          name: monthNames[i],
          count: monthData ? monthData.count : 0,
          percentage: 0 // Will be calculated on frontend
        };
      }),
      
      recentActivity: recentActivity.map(permit => ({
        id: permit._id,
        permitId: permit.permitNumber,
        type: getActivityType(permit.status),
        title: getActivityTitle(permit.status),
        permitType: permit.permitType?.name || 'Unknown',
        applicant: `${permit.applicant.firstName} ${permit.applicant.lastName}`,
        timeAgo: getTimeAgo(permit.updatedAt)
      }))
    };

    res.json(stats);

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to load dashboard statistics' });
  }
});

// Get permit counts by type
router.get('/permit-types/:municipalityId', auth, async (req, res) => {
  try {
    const { municipalityId } = req.params;
    
    // Verify user has access
    if (req.user.userType !== 'municipal' || req.user.municipality._id.toString() !== municipalityId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const permitTypeCounts = await Permit.aggregate([
      {
        $match: {
          municipality: mongoose.Types.ObjectId(municipalityId),
          applicationDate: { 
            $gte: new Date(new Date().getFullYear(), 0, 1) 
          }
        }
      },
      {
        $group: {
          _id: '$permitType',
          count: { $sum: 1 },
          totalValue: { $sum: '$estimatedValue' },
          avgProcessingTime: {
            $avg: {
              $cond: [
                { $and: ['$submittedDate', '$approvedDate'] },
                { $subtract: ['$approvedDate', '$submittedDate'] },
                null
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'permittypes',
          localField: '_id',
          foreignField: '_id',
          as: 'permitType'
        }
      },
      {
        $unwind: '$permitType'
      },
      {
        $project: {
          name: '$permitType.name',
          code: '$permitType.code',
          category: '$permitType.category',
          count: 1,
          totalValue: 1,
          avgProcessingTime: {
            $round: [{ $divide: ['$avgProcessingTime', 1000 * 60 * 60 * 24] }, 1]
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json(permitTypeCounts);

  } catch (error) {
    console.error('Permit types stats error:', error);
    res.status(500).json({ error: 'Failed to load permit type statistics' });
  }
});

// Helper functions
function getActivityType(status) {
  switch (status) {
    case 'submitted': return 'submitted';
    case 'approved': return 'approved';
    case 'inspections': return 'inspection';
    case 'completed': return 'completed';
    default: return 'updated';
  }
}

function getActivityTitle(status) {
  switch (status) {
    case 'submitted': return 'New permit application submitted';
    case 'approved': return 'Permit approved';
    case 'inspections': return 'Inspection required';
    case 'completed': return 'Project completed';
    default: return 'Permit updated';
  }
}

function getTimeAgo(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

module.exports = router;