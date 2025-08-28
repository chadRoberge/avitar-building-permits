const express = require('express');
const router = express.Router();
const { stripe } = require('../config/stripe');
const auth = require('../middleware/auth');


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