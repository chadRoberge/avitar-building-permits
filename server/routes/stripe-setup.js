const express = require('express');
const router = express.Router();
const { stripe } = require('../config/stripe');
const auth = require('../middleware/auth');

// DEVELOPMENT ONLY: Create test municipal products in Stripe
router.post('/create-test-products', auth, async (req, res) => {
  try {
    // Only allow system admins to run this
    if (req.user.userType !== 'system_admin') {
      return res.status(403).json({ error: 'Only system admins can create test products' });
    }

    console.log('Creating test municipal products in Stripe...');

    const testProducts = [
      {
        name: 'Basic Municipal Plan',
        description: 'Essential features for small municipalities',
        metadata: {
          plan_type: 'municipal',
          plan_key: 'basic',
          features: JSON.stringify([
            'Basic permit workflows',
            'Email notifications',
            'Basic reporting',
            'Email support'
          ]),
          permits: '500',
          users: '5',
          popular: 'false'
        },
        priceData: {
          unit_amount: 2400, // $24.00
          currency: 'usd',
          recurring: { interval: 'year' }
        }
      },
      {
        name: 'Professional Municipal Plan',
        description: 'Advanced features for growing municipalities',
        metadata: {
          plan_type: 'municipal',
          plan_key: 'professional',
          features: JSON.stringify([
            'Advanced permit workflows',
            'Custom forms',
            'Advanced reporting & analytics',
            'API access',
            'Custom branding',
            'Phone support'
          ]),
          permits: '2000',
          users: '15',
          popular: 'true'
        },
        priceData: {
          unit_amount: 4800, // $48.00
          currency: 'usd',
          recurring: { interval: 'year' }
        }
      },
      {
        name: 'Enterprise Municipal Plan',
        description: 'Complete solution for large municipalities',
        metadata: {
          plan_type: 'municipal',
          plan_key: 'enterprise',
          features: JSON.stringify([
            'Custom workflows',
            'Full API access',
            'Advanced integrations',
            'Dedicated account manager',
            'Custom training',
            '24/7 priority support'
          ]),
          permits: 'Unlimited',
          users: 'Unlimited',
          popular: 'false'
        },
        priceData: null // Custom pricing - no price created
      }
    ];

    const createdProducts = [];

    for (const productData of testProducts) {
      try {
        // Create the product
        const product = await stripe.products.create({
          name: productData.name,
          description: productData.description,
          metadata: productData.metadata,
          active: true
        });

        console.log(`Created product: ${product.name} (${product.id})`);

        let price = null;
        // Create price if priceData is provided
        if (productData.priceData) {
          price = await stripe.prices.create({
            product: product.id,
            ...productData.priceData
          });

          // Set as default price
          await stripe.products.update(product.id, {
            default_price: price.id
          });

          console.log(`Created price: $${productData.priceData.unit_amount / 100}/${productData.priceData.recurring.interval} (${price.id})`);
        }

        createdProducts.push({
          product: {
            id: product.id,
            name: product.name,
            metadata: product.metadata
          },
          price: price ? {
            id: price.id,
            amount: price.unit_amount,
            currency: price.currency,
            interval: price.recurring?.interval
          } : null
        });

      } catch (productError) {
        console.error(`Error creating product ${productData.name}:`, productError);
      }
    }

    // Clear the plans cache so new products are loaded
    const StripePlansService = require('../services/stripe-plans');
    StripePlansService.clearCache();

    res.json({
      message: `Successfully created ${createdProducts.length} test products`,
      products: createdProducts,
      note: 'Plans cache has been cleared - refresh the billing page to see new plans'
    });

  } catch (error) {
    console.error('Error creating test products:', error);
    res.status(500).json({ 
      error: 'Failed to create test products',
      details: error.message 
    });
  }
});

// List all products for debugging
router.get('/debug-products', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'system_admin') {
      return res.status(403).json({ error: 'Only system admins can debug products' });
    }

    const products = await stripe.products.list({
      active: true,
      expand: ['data.default_price'],
      limit: 100
    });

    const prices = await stripe.prices.list({
      active: true,
      type: 'recurring',
      limit: 100
    });

    const productSummary = products.data.map(product => ({
      id: product.id,
      name: product.name,
      active: product.active,
      metadata: product.metadata,
      default_price: product.default_price ? {
        id: product.default_price.id,
        amount: product.default_price.unit_amount,
        currency: product.default_price.currency,
        interval: product.default_price.recurring?.interval
      } : null,
      all_prices: prices.data
        .filter(price => price.product === product.id)
        .map(price => ({
          id: price.id,
          amount: price.unit_amount,
          currency: price.currency,
          interval: price.recurring?.interval
        }))
    }));

    res.json({
      total_products: products.data.length,
      total_prices: prices.data.length,
      municipal_products: productSummary.filter(p => p.metadata.plan_type === 'municipal'),
      all_products: productSummary
    });

  } catch (error) {
    console.error('Error debugging products:', error);
    res.status(500).json({ 
      error: 'Failed to debug products',
      details: error.message 
    });
  }
});

// Force refresh plans cache
router.post('/refresh-plans-cache', auth, async (req, res) => {
  try {
    const StripePlansService = require('../services/stripe-plans');
    StripePlansService.clearCache();
    
    const plans = await StripePlansService.getAvailablePlans(true);
    
    res.json({
      message: 'Plans cache refreshed',
      plans_count: Object.keys(plans).length,
      plans: plans
    });

  } catch (error) {
    console.error('Error refreshing plans cache:', error);
    res.status(500).json({ 
      error: 'Failed to refresh plans cache',
      details: error.message 
    });
  }
});

module.exports = router;