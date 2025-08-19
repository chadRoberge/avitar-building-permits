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

// Stripe product and price configurations for municipal plans
const MUNICIPAL_PLANS = {
  basic: {
    productId: 'prod_municipal_basic',
    priceId: 'price_municipal_basic_yearly',
    name: 'Municipal Basic',
    description: 'Essential permit management for small municipalities',
    price: 2400, // $24.00 in cents
    interval: 'year',
    features: [
      'Up to 100 permits per year',
      'Basic reporting',
      'Email support',
      'Standard integrations',
    ],
  },
  professional: {
    productId: 'prod_municipal_professional',
    priceId: 'price_municipal_professional_yearly',
    name: 'Municipal Professional',
    description: 'Advanced features for growing municipalities',
    price: 4800, // $48.00 in cents
    interval: 'year',
    features: [
      'Up to 500 permits per year',
      'Advanced reporting & analytics',
      'Priority support',
      'Custom integrations',
      'Workflow automation',
      'Multi-department management',
    ],
  },
  enterprise: {
    productId: 'prod_municipal_enterprise',
    priceId: 'price_municipal_enterprise_yearly',
    name: 'Municipal Enterprise',
    description: 'Full-featured solution for large municipalities',
    price: null, // Custom pricing
    interval: 'year',
    features: [
      'Unlimited permits',
      'Custom reporting suite',
      'Dedicated account manager',
      'Full API access',
      'Advanced workflow automation',
      'Multi-jurisdiction support',
      'Custom training & onboarding',
    ],
  },
};

module.exports = {
  stripe: stripeInstance,
  stripeKeys,
  MUNICIPAL_PLANS,
};
