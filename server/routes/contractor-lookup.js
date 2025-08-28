const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Permit = require('../models/Permit');
const Municipality = require('../models/Municipality');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Get all contractors across all municipalities
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const { search, sortBy = 'recentActivity', limit = 100, municipalityFilter } = req.query;

    console.log(`Loading all contractors${municipalityFilter ? ` filtered by municipality: ${municipalityFilter}` : ''}`);

    // Build aggregation pipeline - look for contractors in multiple ways:
    // 1. Permits with separate contractor field populated
    // 2. Permits where applicant type is 'contractor' and has businessName
    // 3. Permits submitted by users with businessInfo (commercial users)
    const pipeline = [
      {
        $lookup: {
          from: 'users',
          localField: 'applicant.email',
          foreignField: 'email',
          as: 'applicantUser'
        }
      },
      {
        $match: {
          $or: [
            // Option 1: Has dedicated contractor field with businessName
            { 'contractor.businessName': { $exists: true, $ne: null, $ne: '' } },
            // Option 2: Applicant type is contractor and has businessName
            { 
              'applicant.type': 'contractor',
              'applicant.businessName': { $exists: true, $ne: null, $ne: '' }
            },
            // Option 3: Applicant is a commercial user (has businessInfo)
            { 'applicantUser.businessInfo.businessName': { $exists: true, $ne: null, $ne: '' } }
          ]
        }
      }
    ];

    // Add municipality filter if provided
    if (municipalityFilter && municipalityFilter !== 'all') {
      pipeline[1].$match.municipality = municipalityFilter;
    }

    // Continue with grouping and aggregation
    pipeline.push(
      {
        $lookup: {
          from: 'municipalities',
          localField: 'municipality',
          foreignField: '_id',
          as: 'municipalityDetails'
        }
      },
      {
        $group: {
          _id: {
            businessName: {
              $ifNull: [
                '$contractor.businessName', 
                {
                  $ifNull: [
                    '$applicant.businessName',
                    { $arrayElemAt: ['$applicantUser.businessInfo.businessName', 0] }
                  ]
                }
              ]
            },
            email: {
              $ifNull: [
                '$contractor.email',
                '$applicant.email'
              ]
            },
            phone: {
              $ifNull: [
                '$contractor.phone',
                '$applicant.phone'
              ]
            },
            licenseNumber: {
              $ifNull: [
                '$contractor.licenseNumber',
                {
                  $ifNull: [
                    '$applicant.licenseNumber',
                    { $arrayElemAt: ['$applicantUser.businessInfo.licenseNumber', 0] }
                  ]
                }
              ]
            },
            businessType: {
              $ifNull: [
                '$contractor.licenseType',
                {
                  $ifNull: [
                    '$applicant.licenseType',
                    { $arrayElemAt: ['$applicantUser.businessInfo.businessType', 0] }
                  ]
                }
              ]
            }
          },
          totalProjects: { $sum: 1 },
          lastPermitDate: { $max: '$submittedDate' },
          firstPermitDate: { $min: '$submittedDate' },
          completedProjects: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          activeProjects: {
            $sum: { $cond: [{ $in: ['$status', ['approved', 'inspections', 'under-review']] }, 1, 0] }
          },
          totalProjectValue: { $sum: '$estimatedValue' },
          permitTypes: { $addToSet: '$permitType' },
          averageProjectValue: { $avg: '$estimatedValue' },
          municipalities: { $addToSet: { $arrayElemAt: ['$municipalityDetails', 0] } },
          statuses: { $push: '$status' }
        }
      },
      {
        $lookup: {
          from: 'permittypes',
          localField: 'permitTypes',
          foreignField: '_id',
          as: 'permitTypeDetails'
        }
      },
      {
        $project: {
          businessName: '$_id.businessName',
          email: '$_id.email',
          phone: '$_id.phone',
          licenseNumber: '$_id.licenseNumber',
          businessType: '$_id.businessType',
          totalProjects: 1,
          completedProjects: 1,
          activeProjects: 1,
          lastPermitDate: 1,
          firstPermitDate: 1,
          totalProjectValue: 1,
          averageProjectValue: { $round: ['$averageProjectValue', 2] },
          completionRate: {
            $round: [
              { $multiply: [{ $divide: ['$completedProjects', '$totalProjects'] }, 100] },
              1
            ]
          },
          permitTypes: {
            $map: {
              input: '$permitTypeDetails',
              as: 'type',
              in: {
                name: '$$type.name',
                category: '$$type.category'
              }
            }
          },
          municipalities: {
            $map: {
              input: '$municipalities',
              as: 'muni',
              in: {
                id: '$$muni._id',
                name: '$$muni.name',
                city: '$$muni.address.city',
                state: '$$muni.address.state'
              }
            }
          },
          yearsActive: {
            $round: [
              {
                $divide: [
                  { $subtract: ['$lastPermitDate', '$firstPermitDate'] },
                  { $multiply: [365, 24, 60, 60, 1000] }
                ]
              },
              1
            ]
          },
          _id: 0
        }
      }
    );

    // Add search filter if provided
    if (search && search.trim()) {
      pipeline.push({
        $match: {
          businessName: { $regex: search.trim(), $options: 'i' }
        }
      });
    }

    // Add sorting
    let sortStage = {};
    switch (sortBy) {
      case 'name':
        sortStage = { businessName: 1 };
        break;
      case 'totalProjects':
        sortStage = { totalProjects: -1 };
        break;
      case 'completionRate':
        sortStage = { completionRate: -1 };
        break;
      case 'totalValue':
        sortStage = { totalProjectValue: -1 };
        break;
      case 'recentActivity':
      default:
        sortStage = { lastPermitDate: -1 };
        break;
    }

    pipeline.push({ $sort: sortStage });
    pipeline.push({ $limit: parseInt(limit) });

    const contractors = await Permit.aggregate(pipeline);

    console.log(`Found ${contractors.length} contractors total`);

    // Get summary statistics
    const totalContractors = contractors.length;
    const avgCompletionRate = contractors.length > 0 
      ? Math.round(contractors.reduce((sum, c) => sum + c.completionRate, 0) / contractors.length) 
      : 0;
    const totalProjectsAllContractors = contractors.reduce((sum, c) => sum + c.totalProjects, 0);

    res.json({
      contractors: contractors,
      summary: {
        totalContractors,
        avgCompletionRate,
        totalProjectsAllContractors,
        searchTerm: search || null,
        sortBy,
        municipalityFilter: municipalityFilter || null
      }
    });

  } catch (error) {
    console.error('Error fetching all contractors:', error);
    res.status(500).json({ error: 'Failed to fetch contractors' });
  }
});

// Get contractors who have worked in a specific municipality
router.get('/municipality/:municipalityId', authenticateToken, async (req, res) => {
  try {
    const { municipalityId } = req.params;
    const { search, sortBy = 'recentActivity', limit = 50 } = req.query;

    console.log(`Loading contractors for municipality: ${municipalityId}`);

    // Verify municipality exists
    const municipality = await Municipality.findById(municipalityId);
    if (!municipality) {
      return res.status(404).json({ error: 'Municipality not found' });
    }

    // Build aggregation pipeline - look for contractors in multiple ways
    const pipeline = [
      {
        $lookup: {
          from: 'users',
          localField: 'applicant.email',
          foreignField: 'email',
          as: 'applicantUser'
        }
      },
      {
        $match: {
          municipality: municipalityId,
          $or: [
            // Option 1: Has dedicated contractor field with businessName
            { 'contractor.businessName': { $exists: true, $ne: null, $ne: '' } },
            // Option 2: Applicant type is contractor and has businessName
            { 
              'applicant.type': 'contractor',
              'applicant.businessName': { $exists: true, $ne: null, $ne: '' }
            },
            // Option 3: Applicant is a commercial user (has businessInfo)
            { 'applicantUser.businessInfo.businessName': { $exists: true, $ne: null, $ne: '' } }
          ]
        }
      },
      {
        $group: {
          _id: {
            businessName: {
              $ifNull: [
                '$contractor.businessName', 
                {
                  $ifNull: [
                    '$applicant.businessName',
                    { $arrayElemAt: ['$applicantUser.businessInfo.businessName', 0] }
                  ]
                }
              ]
            },
            email: {
              $ifNull: [
                '$contractor.email',
                '$applicant.email'
              ]
            },
            phone: {
              $ifNull: [
                '$contractor.phone',
                '$applicant.phone'
              ]
            },
            licenseNumber: {
              $ifNull: [
                '$contractor.licenseNumber',
                {
                  $ifNull: [
                    '$applicant.licenseNumber',
                    { $arrayElemAt: ['$applicantUser.businessInfo.licenseNumber', 0] }
                  ]
                }
              ]
            },
            businessType: {
              $ifNull: [
                '$contractor.licenseType',
                {
                  $ifNull: [
                    '$applicant.licenseType',
                    { $arrayElemAt: ['$applicantUser.businessInfo.businessType', 0] }
                  ]
                }
              ]
            }
          },
          totalProjects: { $sum: 1 },
          lastPermitDate: { $max: '$submittedDate' },
          firstPermitDate: { $min: '$submittedDate' },
          completedProjects: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          activeProjects: {
            $sum: { $cond: [{ $in: ['$status', ['approved', 'inspections', 'under-review']] }, 1, 0] }
          },
          totalProjectValue: { $sum: '$estimatedValue' },
          permitTypes: { $addToSet: '$permitType' },
          averageProjectValue: { $avg: '$estimatedValue' },
          statuses: { $push: '$status' }
        }
      },
      {
        $lookup: {
          from: 'permittypes',
          localField: 'permitTypes',
          foreignField: '_id',
          as: 'permitTypeDetails'
        }
      },
      {
        $project: {
          businessName: '$_id.businessName',
          email: '$_id.email',
          phone: '$_id.phone',
          licenseNumber: '$_id.licenseNumber',
          businessType: '$_id.businessType',
          totalProjects: 1,
          completedProjects: 1,
          activeProjects: 1,
          lastPermitDate: 1,
          firstPermitDate: 1,
          totalProjectValue: 1,
          averageProjectValue: { $round: ['$averageProjectValue', 2] },
          completionRate: {
            $round: [
              { $multiply: [{ $divide: ['$completedProjects', '$totalProjects'] }, 100] },
              1
            ]
          },
          permitTypes: {
            $map: {
              input: '$permitTypeDetails',
              as: 'type',
              in: {
                name: '$$type.name',
                category: '$$type.category'
              }
            }
          },
          yearsActive: {
            $round: [
              {
                $divide: [
                  { $subtract: ['$lastPermitDate', '$firstPermitDate'] },
                  { $multiply: [365, 24, 60, 60, 1000] } // milliseconds in a year
                ]
              },
              1
            ]
          },
          _id: 0
        }
      }
    ];

    // Add search filter if provided
    if (search && search.trim()) {
      pipeline.push({
        $match: {
          businessName: { $regex: search.trim(), $options: 'i' }
        }
      });
    }

    // Add sorting
    let sortStage = {};
    switch (sortBy) {
      case 'name':
        sortStage = { businessName: 1 };
        break;
      case 'totalProjects':
        sortStage = { totalProjects: -1 };
        break;
      case 'completionRate':
        sortStage = { completionRate: -1 };
        break;
      case 'totalValue':
        sortStage = { totalProjectValue: -1 };
        break;
      case 'recentActivity':
      default:
        sortStage = { lastPermitDate: -1 };
        break;
    }

    pipeline.push({ $sort: sortStage });
    pipeline.push({ $limit: parseInt(limit) });

    const contractors = await Permit.aggregate(pipeline);

    console.log(`Found ${contractors.length} contractors for ${municipality.name}`);

    // Get summary statistics
    const totalContractors = contractors.length;
    const avgCompletionRate = contractors.length > 0 
      ? Math.round(contractors.reduce((sum, c) => sum + c.completionRate, 0) / contractors.length) 
      : 0;
    const totalProjectsAllContractors = contractors.reduce((sum, c) => sum + c.totalProjects, 0);

    res.json({
      municipality: {
        id: municipality._id,
        name: municipality.name,
        city: municipality.address?.city,
        state: municipality.address?.state
      },
      contractors: contractors,
      summary: {
        totalContractors,
        avgCompletionRate,
        totalProjectsAllContractors,
        searchTerm: search || null,
        sortBy
      }
    });

  } catch (error) {
    console.error('Error fetching contractors:', error);
    res.status(500).json({ error: 'Failed to fetch contractors' });
  }
});

// Get detailed contractor information across all municipalities
router.get('/contractor/:businessName', authenticateToken, async (req, res) => {
  try {
    const { businessName } = req.params;
    
    console.log(`Loading detailed info for contractor: ${businessName}`);

    const pipeline = [
      {
        $match: {
          'contractor.businessName': { $regex: new RegExp(`^${businessName}$`, 'i') }
        }
      },
      {
        $lookup: {
          from: 'municipalities',
          localField: 'municipality',
          foreignField: '_id',
          as: 'municipalityDetails'
        }
      },
      {
        $lookup: {
          from: 'permittypes',
          localField: 'permitType',
          foreignField: '_id',
          as: 'permitTypeDetails'
        }
      },
      {
        $project: {
          permitNumber: 1,
          status: 1,
          submittedDate: 1,
          approvedDate: 1,
          completionDate: 1,
          estimatedValue: 1,
          projectDescription: 1,
          projectAddress: 1,
          contractor: 1,
          municipality: {
            $arrayElemAt: ['$municipalityDetails', 0]
          },
          permitType: {
            $arrayElemAt: ['$permitTypeDetails', 0]
          }
        }
      },
      {
        $sort: { submittedDate: -1 }
      }
    ];

    const permits = await Permit.aggregate(pipeline);

    if (permits.length === 0) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    // Aggregate statistics
    const stats = permits.reduce((acc, permit) => {
      const municipality = permit.municipality?.name || 'Unknown';
      
      if (!acc.byMunicipality[municipality]) {
        acc.byMunicipality[municipality] = {
          totalProjects: 0,
          completedProjects: 0,
          totalValue: 0,
          permitTypes: new Set()
        };
      }
      
      acc.byMunicipality[municipality].totalProjects++;
      acc.byMunicipality[municipality].totalValue += permit.estimatedValue || 0;
      
      if (permit.permitType?.name) {
        acc.byMunicipality[municipality].permitTypes.add(permit.permitType.name);
      }
      
      if (permit.status === 'completed') {
        acc.byMunicipality[municipality].completedProjects++;
      }

      return acc;
    }, {
      byMunicipality: {}
    });

    // Convert sets to arrays
    Object.keys(stats.byMunicipality).forEach(municipality => {
      stats.byMunicipality[municipality].permitTypes = 
        Array.from(stats.byMunicipality[municipality].permitTypes);
      stats.byMunicipality[municipality].completionRate = 
        Math.round((stats.byMunicipality[municipality].completedProjects / stats.byMunicipality[municipality].totalProjects) * 100);
    });

    const contractorInfo = permits[0].contractor || {};

    res.json({
      contractor: {
        businessName: contractorInfo.businessName,
        email: contractorInfo.email,
        phone: contractorInfo.phone,
        licenseNumber: contractorInfo.licenseNumber
      },
      statistics: stats,
      recentPermits: permits.slice(0, 10), // Last 10 permits
      totalPermits: permits.length
    });

  } catch (error) {
    console.error('Error fetching contractor details:', error);
    res.status(500).json({ error: 'Failed to fetch contractor details' });
  }
});

module.exports = router;