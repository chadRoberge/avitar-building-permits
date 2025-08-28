const { stripe } = require('../config/stripe');

// Cache plans for 10 minutes to reduce Stripe API calls
let cachedPlans = null;
let cacheExpiry = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

class StripePlansService {
  /**
   * Get all available plans from Stripe with caching
   * @param {string} userType - User type to filter plans (optional)
   * @param {boolean} forceRefresh - Force refresh cache
   * @returns {Object} Available plans object
   */
  static async getAvailablePlans(userType = null, forceRefresh = false) {
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

      const plans = this.processStripeProducts(productsResponse.data, pricesResponse.data, userType);
      
      // Cache the results (if no userType filter, cache all plans)
      if (!userType) {
        cachedPlans = plans;
        cacheExpiry = Date.now() + CACHE_DURATION;
      }
      
      return plans;

    } catch (error) {
      console.error('Error fetching plans from Stripe:', error.message);
      
      // Return cached plans if available, even if expired
      if (cachedPlans) {
        return cachedPlans;
      }
      
      // Return default plans as fallback
      return this.getDefaultPlans(userType);
    }
  }

  /**
   * Process Stripe products and prices into plan objects
   * @param {Array} products - Stripe products
   * @param {Array} prices - Stripe prices
   * @param {string} userType - User type to filter plans (optional)
   * @returns {Object} Processed plans
   */
  static processStripeProducts(products, prices, userType = null) {
    const plans = {};

    for (const product of products) {
      // Filter by user type if specified
      if (userType && product.metadata.plan_type !== userType) {
        continue;
      }
      
      // Skip if no plan type specified in product metadata
      if (!product.metadata.plan_type) {
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
   * @param {string} userType - User type for fallback plans
   * @returns {Object} Default plans
   */
  static getDefaultPlans(userType = 'municipal') {
    if (userType === 'residential') {
      return {
        free: {
          name: 'Free Forever',
          price: 0,
          currency: 'usd',
          interval: 'month',
          permits: 'Unlimited',
          users: 1,
          features: [
            'Submit building permit applications',
            'Track permit status in real-time',
            'Communicate with review departments',
            'Upload required documents',
            'Schedule inspections',
            'Basic email notifications'
          ],
          popular: false,
          plan_type: 'residential',
          priceId: null,
        },
        premium: {
          name: 'Premium Residential',
          price: 999, // $9.99/month
          currency: 'usd',
          interval: 'month',
          permits: 'Unlimited',
          users: 1,
          features: [
            'Everything in Free',
            'SMS notifications',
            'Advanced document management',
            'Property portfolio management',
            'Permit history & analytics',
          ],
          popular: true,
          plan_type: 'residential',
          priceId: null,
        }
      };
    }
    
    if (userType === 'commercial') {
      // Return empty object - commercial plans should come from actual Stripe products
      // with metadata.plan_type = 'commercial'
      return {};
    }
    
    // Municipal plans (default)
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
        plan_type: 'municipal',
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
        plan_type: 'municipal',
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