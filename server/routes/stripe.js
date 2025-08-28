const express = require('express');
const router = express.Router();
const { stripe, MUNICIPAL_PLANS, stripeKeys } = require('../config/stripe');
const Municipality = require('../models/Municipality');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Create Stripe checkout session for subscription
router.post('/create-checkout-session', auth, async (req, res) => {
  try {
    console.log('🛒 Stripe checkout request:', {
      body: req.body,
      userType: req.user.userType,
      userId: req.user._id,
      userObject: req.user
    });
    
    const { planType, municipalityId, priceId, productId } = req.body;
    const userType = req.user.userType;

    // Validate user type
    if (!['municipal', 'residential', 'commercial'].includes(userType)) {
      console.error('❌ Invalid user type:', userType);
      return res.status(403).json({ error: 'Access denied' });
    }
    
    console.log('✅ User type validation passed for:', userType);

    let customerId;
    let successUrl, cancelUrl;
    let customerName, customerEmail;

    if (userType === 'municipal') {
      // Handle municipal users
      const municipality = await Municipality.findById(municipalityId);
      if (!municipality) {
        return res.status(404).json({ error: 'Municipality not found' });
      }

      customerId = municipality.subscription.stripeCustomerId;
      customerName = municipality.name;
      customerEmail = req.user.email;
      successUrl = `${process.env.CLIENT_URL}/municipal/billing?session_id={CHECKOUT_SESSION_ID}&success=true`;
      cancelUrl = `${process.env.CLIENT_URL}/municipal/billing?canceled=true`;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: customerEmail,
          name: customerName,
          metadata: {
            municipalityId: municipality._id.toString(),
            planType: planType,
            userType: userType,
          },
        });

        customerId = customer.id;
        municipality.subscription.stripeCustomerId = customerId;
        await municipality.save();
      }
    } else {
      // Handle residential/commercial users
      console.log('Looking for user with ID:', req.user._id);
      const user = await User.findById(req.user._id);
      console.log('Found user:', user ? user.email : 'null');
      if (!user) {
        console.error('User not found with ID:', req.user._id);
        return res.status(404).json({ error: 'User not found' });
      }

      customerId = user.stripeCustomerId;
      customerName = `${user.firstName} ${user.lastName}`;
      customerEmail = user.email;
      successUrl = `${process.env.CLIENT_URL}/residential/profile?session_id={CHECKOUT_SESSION_ID}&success=true`;
      cancelUrl = `${process.env.CLIENT_URL}/residential/profile?canceled=true`;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: customerEmail,
          name: customerName,
          metadata: {
            userId: user._id.toString(),
            planType: planType,
            userType: userType,
          },
        });

        customerId = customer.id;
        user.stripeCustomerId = customerId;
        await user.save();
      }
    }

    let lineItems;

    // If we have a Stripe price ID, use it directly
    if (priceId) {
      lineItems = [
        {
          price: priceId,
          quantity: 1,
        },
      ];
    } else {
      // Fallback: Try to get plan from StripePlansService or use hardcoded plans
      try {
        const StripePlansService = require('../services/stripe-plans');
        const plans = await StripePlansService.getAvailablePlans(userType);
        const plan = plans[planType];

        if (plan && plan.price) {
          lineItems = [
            {
              price_data: {
                currency: plan.currency || 'usd',
                product_data: {
                  name: plan.name,
                  description: plan.description,
                  metadata: {
                    planType: planType,
                    ...(userType === 'municipal' ? { municipalityId: municipalityId } : { userId: req.user._id.toString() }),
                    plan_type: userType,
                    plan_key: planType,
                  },
                },
                unit_amount: plan.price,
                recurring: {
                  interval: plan.interval || 'year',
                },
              },
              quantity: 1,
            },
          ];
        } else {
          // Final fallback to hardcoded plans
          if (!MUNICIPAL_PLANS[planType]) {
            return res.status(400).json({ error: 'Invalid plan type and no price ID provided' });
          }

          const fallbackPlan = MUNICIPAL_PLANS[planType];
          lineItems = [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: fallbackPlan.name,
                  description: fallbackPlan.description,
                  metadata: {
                    planType: planType,
                    municipalityId: municipality._id.toString(),
                    plan_type: 'municipal',
                    plan_key: planType,
                  },
                },
                unit_amount: fallbackPlan.price,
                recurring: {
                  interval: fallbackPlan.interval,
                },
              },
              quantity: 1,
            },
          ];
        }
      } catch (serviceError) {
        console.error('Error getting plans from service:', serviceError);
        
        // Final fallback to hardcoded plans
        if (!MUNICIPAL_PLANS[planType]) {
          return res.status(400).json({ error: 'Invalid plan type and no price ID provided' });
        }

        const fallbackPlan = MUNICIPAL_PLANS[planType];
        lineItems = [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: fallbackPlan.name,
                description: fallbackPlan.description,
                metadata: {
                  planType: planType,
                  municipalityId: municipality._id.toString(),
                  plan_type: 'municipal',
                  plan_key: planType,
                },
              },
              unit_amount: fallbackPlan.price,
              recurring: {
                interval: fallbackPlan.interval,
              },
            },
            quantity: 1,
          },
        ];
      }
    }

    // Create checkout session
    const sessionMetadata = {
      planType: planType,
      userType: userType,
      userId: req.user._id.toString(),
      priceId: priceId || '',
      productId: productId || '',
    };

    const subscriptionMetadata = {
      planType: planType,
      userType: userType,
      userId: req.user._id.toString(),
    };

    // Add municipality ID for municipal users
    if (userType === 'municipal' && municipalityId) {
      sessionMetadata.municipalityId = municipalityId;
      subscriptionMetadata.municipalityId = municipalityId;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: sessionMetadata,
      subscription_data: {
        metadata: subscriptionMetadata,
      },
    });

    res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      details: error.message,
    });
  }
});

// Get checkout session details
router.get('/checkout-session/:sessionId', auth, async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(
      req.params.sessionId,
    );

    res.json({
      id: session.id,
      payment_status: session.payment_status,
      customer_email: session.customer_details?.email,
      amount_total: session.amount_total,
      subscription_id: session.subscription,
    });
  } catch (error) {
    console.error('Error retrieving checkout session:', error);
    res.status(500).json({
      error: 'Failed to retrieve checkout session',
      details: error.message,
    });
  }
});

// Create customer portal session for subscription management
router.post('/create-portal-session', auth, async (req, res) => {
  try {
    const { municipalityId } = req.body;
    const userType = req.user.userType;

    // Validate user type
    if (!['municipal', 'residential', 'commercial'].includes(userType)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let stripeCustomerId;
    let returnUrl;

    if (userType === 'municipal') {
      // Get municipality
      const municipality = await Municipality.findById(municipalityId);
      if (!municipality || !municipality.subscription.stripeCustomerId) {
        return res
          .status(404)
          .json({ error: 'Municipality or customer not found' });
      }
      stripeCustomerId = municipality.subscription.stripeCustomerId;
      returnUrl = `${process.env.CLIENT_URL}/municipal/billing`;
    } else {
      // Get user
      const user = await User.findById(req.user._id);
      if (!user || !user.stripeCustomerId) {
        return res
          .status(404)
          .json({ error: 'User or customer not found' });
      }
      stripeCustomerId = user.stripeCustomerId;
      returnUrl = `${process.env.CLIENT_URL}/residential/profile`;
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    res.json({
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({
      error: 'Failed to create portal session',
      details: error.message,
    });
  }
});

// Get current subscription details
router.get('/subscription/:municipalityId', auth, async (req, res) => {
  try {
    const { municipalityId } = req.params;

    // Validate user is municipal admin
    if (req.user.userType !== 'municipal') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get municipality
    const municipality = await Municipality.findById(municipalityId);
    if (!municipality) {
      return res.status(404).json({ error: 'Municipality not found' });
    }

    let subscriptionData = {
      plan: municipality.subscription.plan,
      status: municipality.subscription.status,
      currentPeriodStart: municipality.subscription.currentPeriodStart,
      currentPeriodEnd: municipality.subscription.currentPeriodEnd,
      cancelAtPeriodEnd: municipality.subscription.cancelAtPeriodEnd,
    };

    // If there's a Stripe subscription, get the latest data
    if (municipality.subscription.stripeSubscriptionId) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          municipality.subscription.stripeSubscriptionId,
        );

        subscriptionData = {
          ...subscriptionData,
          stripeStatus: stripeSubscription.status,
          currentPeriodStart: new Date(
            stripeSubscription.current_period_start * 1000,
          ),
          currentPeriodEnd: new Date(
            stripeSubscription.current_period_end * 1000,
          ),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        };
      } catch (stripeError) {
        console.warn(
          'Could not retrieve Stripe subscription:',
          stripeError.message,
        );
      }
    }

    res.json(subscriptionData);
  } catch (error) {
    console.error('Error getting subscription details:', error);
    res.status(500).json({
      error: 'Failed to get subscription details',
      details: error.message,
    });
  }
});

// Stripe webhook handler
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      stripeKeys.webhookSecret,
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Received Stripe webhook event:', event.type);

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'product.created':
      case 'product.updated':
      case 'product.deleted':
      case 'price.created':
      case 'price.updated':
      case 'price.deleted':
        await handleProductPriceChange(event.type, event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Webhook handler functions
async function handleSubscriptionCreated(subscription) {
  try {
    const userType = subscription.metadata.userType;
    const planType = subscription.metadata.planType;
    
    console.log('🎉 Subscription created webhook:', {
      subscriptionId: subscription.id,
      userType,
      planType,
      metadata: subscription.metadata
    });

    if (userType === 'municipal') {
      // Handle municipal subscription
      const municipalityId = subscription.metadata.municipalityId;
      if (!municipalityId) {
        console.warn('No municipalityId in subscription metadata');
        return;
      }

      const municipality = await Municipality.findById(municipalityId);
      if (!municipality) {
        console.error('Municipality not found for subscription:', municipalityId);
        return;
      }

      municipality.subscription.stripeSubscriptionId = subscription.id;
      municipality.subscription.plan = planType;
      municipality.subscription.status = subscription.status;
      municipality.subscription.currentPeriodStart = new Date(
        subscription.current_period_start * 1000,
      );
      municipality.subscription.currentPeriodEnd = new Date(
        subscription.current_period_end * 1000,
      );
      municipality.subscription.cancelAtPeriodEnd =
        subscription.cancel_at_period_end;

      await municipality.save();
      console.log('✅ Subscription created for municipality:', municipality.name);
    } else {
      // Handle residential/commercial subscription
      const userId = subscription.metadata.userId;
      if (!userId) {
        console.warn('No userId in subscription metadata');
        return;
      }

      const user = await User.findById(userId);
      if (!user) {
        console.error('User not found for subscription:', userId);
        return;
      }

      // Update user subscription info
      user.stripeSubscriptionId = subscription.id;
      user.stripePlanId = planType;
      
      await user.save();
      console.log('✅ Subscription created for user:', user.email, 'Plan:', planType);
    }
  } catch (error) {
    console.error('Error handling subscription created:', error);
  }
}

async function handleSubscriptionUpdated(subscription) {
  try {
    const userType = subscription.metadata.userType;
    
    console.log('🔄 Subscription updated webhook:', {
      subscriptionId: subscription.id,
      userType,
      status: subscription.status
    });

    if (userType === 'municipal') {
      // Handle municipal subscription update
      const municipality = await Municipality.findOne({
        'subscription.stripeSubscriptionId': subscription.id,
      });

      if (!municipality) {
        console.warn(
          'Municipality not found for subscription update:',
          subscription.id,
        );
        return;
      }

      municipality.subscription.status = subscription.status;
      municipality.subscription.currentPeriodStart = new Date(
        subscription.current_period_start * 1000,
      );
      municipality.subscription.currentPeriodEnd = new Date(
        subscription.current_period_end * 1000,
      );
      municipality.subscription.cancelAtPeriodEnd =
        subscription.cancel_at_period_end;

      // If plan changed, update it
      if (subscription.metadata.planType) {
        municipality.subscription.plan = subscription.metadata.planType;
      }

      await municipality.save();
      console.log('✅ Subscription updated for municipality:', municipality.name);
    } else {
      // Handle residential/commercial subscription update
      const user = await User.findOne({
        stripeSubscriptionId: subscription.id,
      });

      if (!user) {
        console.warn('User not found for subscription update:', subscription.id);
        return;
      }

      // Update plan if changed
      if (subscription.metadata.planType) {
        user.stripePlanId = subscription.metadata.planType;
      }

      await user.save();
      console.log('✅ Subscription updated for user:', user.email);
    }
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

async function handleSubscriptionDeleted(subscription) {
  try {
    const municipality = await Municipality.findOne({
      'subscription.stripeSubscriptionId': subscription.id,
    });

    if (!municipality) {
      console.warn(
        'Municipality not found for subscription deletion:',
        subscription.id,
      );
      return;
    }

    municipality.subscription.status = 'canceled';
    municipality.subscription.stripeSubscriptionId = null;
    municipality.subscription.stripePriceId = null;
    municipality.subscription.stripeProductId = null;

    await municipality.save();
    console.log('Subscription canceled for municipality:', municipality.name);
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

async function handlePaymentSucceeded(invoice) {
  try {
    const subscription = await stripe.subscriptions.retrieve(
      invoice.subscription,
    );
    const municipality = await Municipality.findOne({
      'subscription.stripeSubscriptionId': subscription.id,
    });

    if (!municipality) {
      console.warn(
        'Municipality not found for payment succeeded:',
        subscription.id,
      );
      return;
    }

    // Update subscription status if it was past_due
    if (municipality.subscription.status === 'past_due') {
      municipality.subscription.status = 'active';
      await municipality.save();
    }

    // Reset usage counters at the start of a new billing period
    const periodStart = new Date(subscription.current_period_start * 1000);
    if (municipality.usage.permits.lastResetDate < periodStart) {
      municipality.usage.permits.currentPeriod = 0;
      municipality.usage.permits.lastResetDate = periodStart;
      await municipality.save();
    }

    console.log('Payment succeeded for municipality:', municipality.name);
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

async function handlePaymentFailed(invoice) {
  try {
    const subscription = await stripe.subscriptions.retrieve(
      invoice.subscription,
    );
    const municipality = await Municipality.findOne({
      'subscription.stripeSubscriptionId': subscription.id,
    });

    if (!municipality) {
      console.warn(
        'Municipality not found for payment failed:',
        subscription.id,
      );
      return;
    }

    municipality.subscription.status = 'past_due';
    await municipality.save();

    console.log('Payment failed for municipality:', municipality.name);
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

async function handleCheckoutCompleted(session) {
  try {
    const municipalityId = session.metadata.municipalityId;
    const planType = session.metadata.planType;

    if (!municipalityId || !session.subscription) {
      console.warn('Missing required metadata in checkout session');
      return;
    }

    const municipality = await Municipality.findById(municipalityId);
    if (!municipality) {
      console.error(
        'Municipality not found for checkout completion:',
        municipalityId,
      );
      return;
    }

    // The subscription will be handled by the subscription.created event
    // Here we just log the successful checkout
    console.log(
      'Checkout completed for municipality:',
      municipality.name,
      'Plan:',
      planType,
    );
  } catch (error) {
    console.error('Error handling checkout completed:', error);
  }
}

async function handleProductPriceChange(eventType, object) {
  try {
    console.log(`Product/Price change detected: ${eventType}`, object.id);
    
    // Clear plans cache when products or prices change
    const StripePlansService = require('../services/stripe-plans');
    StripePlansService.clearCache();
    
    console.log('Plans cache cleared due to product/price change');
  } catch (error) {
    console.error('Error handling product/price change:', error);
  }
}

module.exports = router;
