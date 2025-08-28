const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Municipality = require('../models/Municipality');
const User = require('../models/User');

// Public endpoint for getting available plans (used during signup)
router.get('/public-plans/:userType', async (req, res) => {
  try {
    const userType = req.params.userType;
    const StripePlansService = require('../services/stripe-plans');
    
    // Get plans from Stripe based on user type
    const plans = await StripePlansService.getAvailablePlans(userType);
    
    res.json(plans);
  } catch (error) {
    console.error('Error fetching public subscription plans:', error);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

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

        let subscriptionData = {
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

        // If there's a Stripe subscription, get real-time data
        if (municipality.subscription.stripeSubscriptionId) {
          try {
            const { stripe } = require('../config/stripe');
            const stripeSubscription = await stripe.subscriptions.retrieve(
              municipality.subscription.stripeSubscriptionId,
              {
                expand: ['latest_invoice', 'items.data.price.product']
              }
            );

            // Update with real-time Stripe data
            subscriptionData = {
              ...subscriptionData,
              status: stripeSubscription.status,
              currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
              currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
              cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
              
              // Add additional Stripe-specific data
              stripeSubscriptionId: stripeSubscription.id,
              nextPaymentDate: stripeSubscription.current_period_end,
              lastPaymentDate: stripeSubscription.latest_invoice?.created 
                ? new Date(stripeSubscription.latest_invoice.created * 1000) 
                : null,
              
              // Price information from Stripe
              pricePerPeriod: stripeSubscription.items.data[0]?.price.unit_amount,
              currency: stripeSubscription.items.data[0]?.price.currency || 'usd',
              interval: stripeSubscription.items.data[0]?.price.recurring?.interval || 'year',
            };

            // Update municipality with latest Stripe data if it differs
            if (municipality.subscription.status !== stripeSubscription.status ||
                municipality.subscription.cancelAtPeriodEnd !== stripeSubscription.cancel_at_period_end) {
              municipality.subscription.status = stripeSubscription.status;
              municipality.subscription.currentPeriodStart = subscriptionData.currentPeriodStart;
              municipality.subscription.currentPeriodEnd = subscriptionData.currentPeriodEnd;
              municipality.subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;
              await municipality.save();
            }

          } catch (stripeError) {
            console.warn('Could not fetch real-time Stripe data:', stripeError.message);
          }
        }

        billingInfo.subscription = subscriptionData;

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

    // For residential/commercial users, check for Stripe subscription
    if (userType === 'residential' || userType === 'commercial') {
      billingInfo.accountStatus = 'active';
      
      
      // Check if user has a Stripe subscription
      if (user.stripeSubscriptionId) {
        try {
          const { stripe } = require('../config/stripe');
          
          // Get subscription details from Stripe
          const stripeSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
            expand: ['latest_invoice', 'items.data.price.product']
          });

          if (stripeSubscription && stripeSubscription.status === 'active') {
            const product = stripeSubscription.items.data[0]?.price?.product;
            const price = stripeSubscription.items.data[0]?.price;
            
            billingInfo.planName = product?.name || user.stripePlanId || 'Premium Plan';
            billingInfo.subscription = {
              status: stripeSubscription.status,
              currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
              currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
              cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
              pricePerPeriod: price?.unit_amount,
              currency: price?.currency || 'usd',
              interval: price?.recurring?.interval || 'month',
              stripeSubscriptionId: stripeSubscription.id,
            };

            // Get benefits from product metadata or set default premium benefits
            const features = product?.metadata?.features;
            if (features) {
              try {
                billingInfo.benefits = JSON.parse(features);
              } catch (e) {
                billingInfo.benefits = features.split(',').map(f => f.trim());
              }
            } else {
              billingInfo.benefits = userType === 'residential'
                ? [
                    'Everything in Free',
                    'SMS notifications', 
                    'Advanced document management',
                    'Property portfolio management',
                    'Permit history & analytics',
                  ]
                : [
                    'Everything in Free',
                    'Multi-property management',
                    'Team collaboration tools',
                    'Advanced analytics & reporting',
                    'API access for integrations',
                    'Priority phone support'
                  ];
            }
          } else {
            // Subscription exists but not active
            billingInfo.planName = 'Free Forever';
            billingInfo.benefits = userType === 'residential'
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
        } catch (stripeError) {
          console.warn('Error fetching Stripe subscription for user:', stripeError.message);
          // Fallback to free plan
          billingInfo.planName = 'Free Forever';
          billingInfo.benefits = userType === 'residential'
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
      } else {
        // No Stripe subscription - free user
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
    }

    res.json(billingInfo);
  } catch (error) {
    console.error('Error fetching billing information:', error);
    res.status(500).json({ error: 'Failed to fetch billing information' });
  }
});

// Get available subscription plans (authenticated)
router.get('/plans', authenticateToken, async (req, res) => {
  try {
    const userType = req.user.userType;

    const StripePlansService = require('../services/stripe-plans');
    const forceRefresh = req.query.refresh === 'true';
    
    // Get plans from Stripe for all user types
    const plans = await StripePlansService.getAvailablePlans(userType, forceRefresh);
    res.json(plans);
    
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

// Debug endpoint to check what plans are actually being loaded
router.get('/debug-plans', authenticateToken, async (req, res) => {
  try {
    const StripePlansService = require('../services/stripe-plans');
    
    // Force refresh to get fresh data
    const plans = await StripePlansService.getAvailablePlans(true);
    
    res.json({
      timestamp: new Date().toISOString(),
      plans_count: Object.keys(plans).length,
      plan_keys: Object.keys(plans),
      plans: plans,
      source: Object.keys(plans).length > 0 ? 'stripe_or_service' : 'fallback_default'
    });
  } catch (error) {
    console.error('Error in debug-plans:', error);
    res.status(500).json({ error: 'Debug failed', details: error.message });
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

// Get billing history from Stripe
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userType = req.user.userType;
    const userId = req.user.userId;

    // For residential/commercial users, check if they have Stripe subscription
    if (userType === 'residential' || userType === 'commercial') {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // If user has a Stripe customer ID, fetch real billing history from Stripe
      if (user.stripeCustomerId) {
        try {
          const { stripe } = require('../config/stripe');
          
          // Fetch invoices from Stripe
          const invoices = await stripe.invoices.list({
            customer: user.stripeCustomerId,
            limit: 50,
            status: 'paid',
          });

          const billingHistory = invoices.data.map(invoice => {
            const lineItem = invoice.lines.data[0];
            const planName = lineItem ? lineItem.description || 'Subscription' : 'Subscription';
            
            // Format period dates
            let period = 'N/A';
            if (lineItem && lineItem.period) {
              const startDate = new Date(lineItem.period.start * 1000).toLocaleDateString();
              const endDate = new Date(lineItem.period.end * 1000).toLocaleDateString();
              period = `${startDate} to ${endDate}`;
            }

            return {
              id: invoice.id,
              date: new Date(invoice.created * 1000),
              amount: invoice.amount_paid,
              status: invoice.status === 'paid' ? 'paid' : invoice.status,
              plan: planName,
              period: period,
              downloadUrl: invoice.hosted_invoice_url || invoice.invoice_pdf,
            };
          });

          return res.json(billingHistory);
        } catch (stripeError) {
          console.error('Error fetching Stripe invoices for user:', stripeError);
          // Fall through to show free account history if Stripe fails
        }
      }

      // Fallback for users without Stripe subscription - show free account
      const accountCreatedDate = user.createdAt || new Date();
      const planName = userType === 'residential' ? 'Free Forever' : 'Free Trial';
      
      const billingHistory = [
        {
          id: `free_${userId}`,
          date: accountCreatedDate.toISOString(),
          plan: planName,
          period: `${accountCreatedDate.toLocaleDateString()} - Present`,
          amount: 0,
          status: 'active',
          downloadUrl: null,
          description: `${planName} - No charges apply`
        }
      ];

      return res.json(billingHistory);
    }

    if (userType !== 'municipal') {
      return res.json([]);
    }

    const user = await User.findById(userId);
    if (!user || !user.municipality) {
      return res.status(404).json({ error: 'User or municipality not found' });
    }

    const municipality = await Municipality.findById(user.municipality);
    if (!municipality || !municipality.subscription.stripeCustomerId) {
      return res.json([]);
    }

    try {
      // Import Stripe here to avoid dependency issues if not configured
      const { stripe } = require('../config/stripe');
      
      // Fetch invoices from Stripe
      const invoices = await stripe.invoices.list({
        customer: municipality.subscription.stripeCustomerId,
        limit: 50,
        status: 'paid',
      });

      const billingHistory = invoices.data.map(invoice => {
        const lineItem = invoice.lines.data[0];
        const planName = lineItem ? lineItem.description || 'Subscription' : 'Subscription';
        
        // Format period dates
        let period = 'N/A';
        if (lineItem && lineItem.period) {
          const startDate = new Date(lineItem.period.start * 1000).toLocaleDateString();
          const endDate = new Date(lineItem.period.end * 1000).toLocaleDateString();
          period = `${startDate} to ${endDate}`;
        }

        return {
          id: invoice.id,
          date: new Date(invoice.created * 1000),
          amount: invoice.amount_paid,
          status: invoice.status === 'paid' ? 'paid' : invoice.status,
          plan: planName,
          period: period,
          downloadUrl: invoice.hosted_invoice_url || invoice.invoice_pdf,
        };
      });

      res.json(billingHistory);
    } catch (stripeError) {
      console.error('Error fetching invoices from Stripe:', stripeError);
      // Fallback to empty array if Stripe is not configured or fails
      res.json([]);
    }
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
