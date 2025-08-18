# Vercel Deployment Guide

## Setup Instructions

### 1. Push to GitHub
```bash
git add .
git commit -m "Add Vercel configuration"
git push origin main
```

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "New Project"
3. Import your GitHub repository
4. Vercel will auto-detect the configuration from `vercel.json`

### 3. Configure Environment Variables

In your Vercel dashboard, go to **Settings → Environment Variables** and add:

**Vercel Development Environment Variables:**
```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
NODE_ENV=development
CLIENT_URL=https://your-app.vercel.app
STRIPE_SECRET_KEY_DEV=sk_test_your_development_stripe_secret_key
STRIPE_PUBLISHABLE_KEY_DEV=pk_test_your_development_stripe_publishable_key
STRIPE_WEBHOOK_SECRET_DEV=whsec_your_development_webhook_secret
```

**NOTE**: Replace the placeholder values above with your actual development keys when configuring Vercel.

**For Future Production Deployment:**
```
NODE_ENV=production
STRIPE_SECRET_KEY_PROD=sk_live_your_production_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY_PROD=pk_live_your_production_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET_PROD=whsec_your_production_webhook_secret_here
```

### 4. Update CLIENT_URL After Deployment

After deployment, update the `CLIENT_URL` environment variable with your actual Vercel URL.

### 5. Configure Stripe Webhooks

1. In your Stripe Dashboard, go to **Developers → Webhooks**
2. Click **Add endpoint**
3. Set URL to: `https://your-app.vercel.app/api/stripe/webhook`
4. Select these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `checkout.session.completed`
5. Copy the webhook signing secret and update `STRIPE_WEBHOOK_SECRET_PROD`

## File Structure for Vercel

```
├── vercel.json          # Vercel configuration
├── package.json         # Build scripts
├── server/              # Express.js backend
│   └── app.js          # Entry point
├── app/                # Ember.js frontend
├── dist/               # Built frontend (generated)
└── .vercelignore       # Files to ignore
```

## How It Works

- **API Routes**: `/api/*` → Express.js server
- **Frontend**: `/*` → Static Ember.js build
- **Environment**: Automatically detects production/development
- **HTTPS**: Provided automatically by Vercel

## Testing Locally

Before deploying, test the build process:

```bash
npm run vercel-build
npm run server
```

## Troubleshooting

If deployment fails:
1. Check the build logs in Vercel dashboard
2. Ensure all environment variables are set
3. Verify `server/app.js` exists and exports the app
4. Check that MongoDB connection string is correct