const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Municipality = require('../models/Municipality');
const User = require('../models/User');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('JWT verification failed:', error.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Get billing information for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userType = req.user.userType;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let billingInfo = {
      userType,
      user: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
      subscription: null,
      usage: null,
    };

    // For municipal users, get municipality subscription info
    if (userType === 'municipal' && user.municipality) {
      const municipality = await Municipality.findById(user.municipality);
      if (municipality) {
        const limitsCheck = municipality.isWithinLimits();

        billingInfo.subscription = {
          plan: municipality.subscription.plan,
          status: municipality.subscription.status,
          currentPeriodStart: municipality.subscription.currentPeriodStart,
          currentPeriodEnd: municipality.subscription.currentPeriodEnd,
          cancelAtPeriodEnd: municipality.subscription.cancelAtPeriodEnd,
          isActive: municipality.isSubscriptionActive(),
          daysUntilRenewal: municipality.getDaysUntilRenewal(),
          limits: limitsCheck.limits,
          planName:
            municipality.subscription.plan.charAt(0).toUpperCase() +
            municipality.subscription.plan.slice(1),
        };

        billingInfo.usage = {
          permits: {
            current: limitsCheck.current.permits,
            limit: limitsCheck.limits.permits,
            percentage: limitsCheck.limits.permits
              ? Math.round(
                  (limitsCheck.current.permits / limitsCheck.limits.permits) *
                    100,
                )
              : 0,
          },
          users: {
            current: limitsCheck.current.users,
            limit: limitsCheck.limits.users,
            percentage: limitsCheck.limits.users
              ? Math.round(
                  (limitsCheck.current.users / limitsCheck.limits.users) * 100,
                )
              : 0,
          },
          isWithinLimits: limitsCheck.isValid,
        };

        billingInfo.municipality = {
          name: municipality.name,
          id: municipality._id,
        };
      }
    }

    // For residential/commercial users, provide basic account info
    if (userType === 'residential' || userType === 'commercial') {
      billingInfo.accountStatus = 'active';
      billingInfo.planName = 'Free Forever';
      billingInfo.benefits =
        userType === 'residential'
          ? [
              'Submit building permit applications',
              'Track permit status',
              'Communicate with review departments',
            ]
          : [
              'Submit contractor applications',
              'Manage multiple properties',
              'Track business permits',
            ];
    }

    res.json(billingInfo);
  } catch (error) {
    console.error('Error fetching billing information:', error);
    res.status(500).json({ error: 'Failed to fetch billing information' });
  }
});

// Get available subscription plans (for municipal users)
router.get('/plans', authenticateToken, async (req, res) => {
  try {
    const plans = {
      basic: {
        name: 'Basic',
        price: 2400, // Annual price in cents ($24.00)
        permits: 500,
        users: 5,
        features: [
          'Basic permit workflows',
          'Email notifications',
          'Basic reporting',
          'Email support',
        ],
        popular: false,
      },
      professional: {
        name: 'Professional',
        price: 4800, // Annual price in cents ($48.00)
        permits: 2000,
        users: 15,
        features: [
          'Advanced permit workflows',
          'Custom forms',
          'Advanced reporting & analytics',
          'API access',
          'Custom branding',
          'Phone support',
        ],
        popular: true,
      },
      enterprise: {
        name: 'Enterprise',
        price: null, // Custom pricing
        permits: 'Unlimited',
        users: 'Unlimited',
        features: [
          'Custom workflows',
          'Full API access',
          'Advanced integrations',
          'Dedicated account manager',
          'Custom training',
          '24/7 priority support',
        ],
        popular: false,
      },
    };

    res.json(plans);
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

// Update subscription plan (for municipal users)
router.put('/subscription/plan', authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.user.userId;
    const userType = req.user.userType;

    if (userType !== 'municipal') {
      return res
        .status(403)
        .json({ error: 'Only municipal users can update subscription plans' });
    }

    if (!['basic', 'professional', 'enterprise'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid subscription plan' });
    }

    const user = await User.findById(userId);
    if (!user || !user.municipality) {
      return res.status(404).json({ error: 'User or municipality not found' });
    }

    const municipality = await Municipality.findById(user.municipality);
    if (!municipality) {
      return res.status(404).json({ error: 'Municipality not found' });
    }

    // Update subscription plan
    municipality.subscription.plan = plan;

    // If upgrading from basic to professional, extend period end
    if (plan === 'professional' && municipality.subscription.plan === 'basic') {
      // In a real implementation, this would integrate with a payment processor
      console.log(`Municipality ${municipality.name} upgraded to ${plan} plan`);
    }

    await municipality.save();

    res.json({
      message: 'Subscription plan updated successfully',
      plan: plan,
      limits: municipality.getSubscriptionLimits(),
    });
  } catch (error) {
    console.error('Error updating subscription plan:', error);
    res.status(500).json({ error: 'Failed to update subscription plan' });
  }
});

// Get billing history (mock data for now)
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userType = req.user.userType;

    if (userType !== 'municipal') {
      return res.json([]);
    }

    // Mock billing history - in production this would come from payment processor
    const mockHistory = [
      {
        id: 'inv_001',
        date: new Date('2024-01-01'),
        amount: 2400,
        status: 'paid',
        plan: 'Basic',
        period: '2024-01-01 to 2024-12-31',
        downloadUrl: '/api/billing/invoice/inv_001.pdf',
      },
      {
        id: 'inv_002',
        date: new Date('2023-01-01'),
        amount: 2400,
        status: 'paid',
        plan: 'Basic',
        period: '2023-01-01 to 2023-12-31',
        downloadUrl: '/api/billing/invoice/inv_002.pdf',
      },
    ];

    res.json(mockHistory);
  } catch (error) {
    console.error('Error fetching billing history:', error);
    res.status(500).json({ error: 'Failed to fetch billing history' });
  }
});

// Cancel subscription (for municipal users)
router.post('/subscription/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userType = req.user.userType;
    const { cancelAtPeriodEnd = true } = req.body;

    if (userType !== 'municipal') {
      return res
        .status(403)
        .json({ error: 'Only municipal users can cancel subscriptions' });
    }

    const user = await User.findById(userId);
    if (!user || !user.municipality) {
      return res.status(404).json({ error: 'User or municipality not found' });
    }

    const municipality = await Municipality.findById(user.municipality);
    if (!municipality) {
      return res.status(404).json({ error: 'Municipality not found' });
    }

    municipality.subscription.cancelAtPeriodEnd = cancelAtPeriodEnd;

    if (!cancelAtPeriodEnd) {
      municipality.subscription.status = 'canceled';
    }

    await municipality.save();

    res.json({
      message: cancelAtPeriodEnd
        ? 'Subscription will be canceled at the end of the current period'
        : 'Subscription canceled immediately',
      subscription: {
        status: municipality.subscription.status,
        cancelAtPeriodEnd: municipality.subscription.cancelAtPeriodEnd,
        currentPeriodEnd: municipality.subscription.currentPeriodEnd,
      },
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Reactivate subscription (for municipal users)
router.post('/subscription/reactivate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userType = req.user.userType;

    if (userType !== 'municipal') {
      return res
        .status(403)
        .json({ error: 'Only municipal users can reactivate subscriptions' });
    }

    const user = await User.findById(userId);
    if (!user || !user.municipality) {
      return res.status(404).json({ error: 'User or municipality not found' });
    }

    const municipality = await Municipality.findById(user.municipality);
    if (!municipality) {
      return res.status(404).json({ error: 'Municipality not found' });
    }

    municipality.subscription.cancelAtPeriodEnd = false;
    municipality.subscription.status = 'active';

    await municipality.save();

    res.json({
      message: 'Subscription reactivated successfully',
      subscription: {
        status: municipality.subscription.status,
        cancelAtPeriodEnd: municipality.subscription.cancelAtPeriodEnd,
        currentPeriodEnd: municipality.subscription.currentPeriodEnd,
      },
    });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
});

module.exports = router;
