const stripe = require('stripe');

// Get environment-specific Stripe keys
const getStripeKeys = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return {
    secretKey: isDevelopment
      ? process.env.STRIPE_SECRET_KEY_DEV
      : process.env.STRIPE_SECRET_KEY_PROD,
    publishableKey: isDevelopment
      ? process.env.STRIPE_PUBLISHABLE_KEY_DEV
      : process.env.STRIPE_PUBLISHABLE_KEY_PROD,
    webhookSecret: isDevelopment
      ? process.env.STRIPE_WEBHOOK_SECRET_DEV
      : process.env.STRIPE_WEBHOOK_SECRET_PROD,
  };
};

// Initialize Stripe with environment-specific secret key
const stripeKeys = getStripeKeys();
const stripeInstance = stripeKeys.secretKey 
  ? stripe(stripeKeys.secretKey)
  : null; // Allow server to run without Stripe in development

// Function to get actual Stripe products (replaces hardcoded plans)
const getStripeProducts = async () => {
  if (!stripeInstance) {
    console.warn('Stripe not configured, returning null');
    return null;
  }

  try {
    const products = await stripeInstance.products.list({
      active: true,
      expand: ['data.default_price'],
      limit: 100,
    });

    return products.data;
  } catch (error) {
    console.error('Error fetching Stripe products:', error);
    return null;
  }
};

// Function to get municipal products specifically
const getMunicipalProducts = async () => {
  const products = await getStripeProducts();
  if (!products) return null;

  return products.filter(product => 
    product.metadata.plan_type === 'municipal'
  );
};

module.exports = {
  stripe: stripeInstance,
  stripeKeys,
  getStripeProducts,
  getMunicipalProducts,
};
