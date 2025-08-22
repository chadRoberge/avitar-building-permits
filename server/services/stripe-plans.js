const { stripe } = require('../config/stripe');

// Cache plans for 10 minutes to reduce Stripe API calls
let cachedPlans = null;
let cacheExpiry = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

class StripePlansService {
  /**
   * Get all available municipal plans from Stripe with caching
   * @param {boolean} forceRefresh - Force refresh cache
   * @returns {Object} Available plans object
   */
  static async getAvailablePlans(forceRefresh = false) {
    // Return cached plans if still valid
    if (!forceRefresh && cachedPlans && cacheExpiry && Date.now() < cacheExpiry) {
      return cachedPlans;
    }

    try {
      // Fetch products and prices in parallel for better performance
      const [productsResponse, pricesResponse] = await Promise.all([
        stripe.products.list({
          active: true,
          expand: ['data.default_price'],
          limit: 100,
        }),
        stripe.prices.list({
          active: true,
          type: 'recurring',
          limit: 100,
        })
      ]);

      const plans = this.processStripeProducts(productsResponse.data, pricesResponse.data);
      
      // Cache the results
      cachedPlans = plans;
      cacheExpiry = Date.now() + CACHE_DURATION;
      
      return plans;

    } catch (error) {
      console.error('Error fetching plans from Stripe:', error);
      
      // Return cached plans if available, even if expired
      if (cachedPlans) {
        return cachedPlans;
      }
      
      // Return default plans as fallback
      return this.getDefaultPlans();
    }
  }

  /**
   * Process Stripe products and prices into plan objects
   * @param {Array} products - Stripe products
   * @param {Array} prices - Stripe prices
   * @returns {Object} Processed plans
   */
  static processStripeProducts(products, prices) {
    const plans = {};

    for (const product of products) {
      // Skip if not a municipal plan
      if (!product.metadata.plan_type || product.metadata.plan_type !== 'municipal') {
        continue;
      }

      const planKey = product.metadata.plan_key || product.name.toLowerCase().replace(/\s+/g, '_');
      
      // Find the best price for this product
      const productPrice = this.findBestPrice(product, prices);

      plans[planKey] = {
        // Stripe IDs
        id: product.id,
        priceId: productPrice?.id,
        
        // Basic info
        name: product.name,
        description: product.description,
        
        // Pricing
        price: productPrice?.unit_amount || null,
        currency: productPrice?.currency || 'usd',
        interval: productPrice?.recurring?.interval || 'year',
        intervalCount: productPrice?.recurring?.interval_count || 1,
        
        // Features from metadata
        features: this.parseFeatures(product.metadata.features),
        
        // Plan limits
        permits: this.parseLimit(product.metadata.permits),
        users: this.parseLimit(product.metadata.users),
        
        // Display options
        popular: product.metadata.popular === 'true',
        recommended: product.metadata.recommended === 'true',
        
        // Additional metadata
        metadata: product.metadata,
        
        // Status
        active: product.active,
        created: new Date(product.created * 1000),
      };
    }
    
    return plans;
  }

  /**
   * Find the best price for a product (prefer yearly recurring)
   * @param {Object} product - Stripe product
   * @param {Array} prices - Available prices
   * @returns {Object|null} Best price object
   */
  static findBestPrice(product, prices) {
    // First try the default price
    if (product.default_price && product.default_price.recurring) {
      return product.default_price;
    }

    // Find all prices for this product
    const productPrices = prices.filter(price => price.product === product.id);
    
    // Prefer yearly recurring prices
    const yearlyPrice = productPrices.find(price => 
      price.recurring?.interval === 'year'
    );
    
    if (yearlyPrice) return yearlyPrice;
    
    // Fallback to monthly
    const monthlyPrice = productPrices.find(price => 
      price.recurring?.interval === 'month'
    );
    
    if (monthlyPrice) return monthlyPrice;
    
    // Return any recurring price
    return productPrices.find(price => price.recurring) || null;
  }

  /**
   * Parse features from metadata string
   * @param {string} featuresString - JSON string of features
   * @returns {Array} Parsed features array
   */
  static parseFeatures(featuresString) {
    if (!featuresString) return [];
    
    try {
      return JSON.parse(featuresString);
    } catch (error) {
      // Fallback: split by comma if not valid JSON
      return featuresString.split(',').map(f => f.trim()).filter(f => f);
    }
  }

  /**
   * Parse numeric limits (handles "Unlimited" string)
   * @param {string} limitString - Limit value
   * @returns {number|string} Parsed limit
   */
  static parseLimit(limitString) {
    if (!limitString) return 'Unlimited';
    if (limitString.toLowerCase() === 'unlimited') return 'Unlimited';
    
    const parsed = parseInt(limitString, 10);
    return isNaN(parsed) ? 'Unlimited' : parsed;
  }

  /**
   * Get default fallback plans
   * @returns {Object} Default plans
   */
  static getDefaultPlans() {
    return {
      basic: {
        name: 'Basic',
        price: 2400, // $24/year
        currency: 'usd',
        interval: 'year',
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
        price: 4800, // $48/year
        currency: 'usd', 
        interval: 'year',
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
    };
  }

  /**
   * Clear cached plans (useful for webhook updates)
   */
  static clearCache() {
    cachedPlans = null;
    cacheExpiry = null;
  }

  /**
   * Get a specific plan by key
   * @param {string} planKey - Plan identifier
   * @returns {Object|null} Plan object
   */
  static async getPlan(planKey) {
    const plans = await this.getAvailablePlans();
    return plans[planKey] || null;
  }

  /**
   * Search plans by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Array} Matching plans
   */
  static async searchPlans(criteria = {}) {
    const plans = await this.getAvailablePlans();
    const planArray = Object.entries(plans).map(([key, plan]) => ({ key, ...plan }));
    
    return planArray.filter(plan => {
      if (criteria.maxPrice && plan.price > criteria.maxPrice) return false;
      if (criteria.minPermits && plan.permits !== 'Unlimited' && plan.permits < criteria.minPermits) return false;
      if (criteria.interval && plan.interval !== criteria.interval) return false;
      if (criteria.popular !== undefined && plan.popular !== criteria.popular) return false;
      
      return true;
    });
  }
}

module.exports = StripePlansService;