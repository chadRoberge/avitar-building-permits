require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const municipalityRoutes = require('./routes/municipalities');
const dashboardRoutes = require('./routes/dashboard');
const permitTypeRoutes = require('./routes/permit-types');
const permitRoutes = require('./routes/permits');
const contractorRoutes = require('./routes/contractors');
const propertyRoutes = require('./routes/properties');
const permitMessageRoutes = require('./routes/permit-messages');
const billingRoutes = require('./routes/billing');
const stripeRoutes = require('./routes/stripe');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware - CORS configuration
app.use((req, res, next) => {
  // Set CORS headers manually for better control
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Also use the cors middleware as backup
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Special webhook endpoint that needs raw body - must come before json parsing
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/municipalities', municipalityRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/permit-types', permitTypeRoutes);
app.use('/api/permits', permitRoutes);
app.use('/api/contractors', contractorRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/permit-messages', permitMessageRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/stripe', stripeRoutes);

// Debug: Log all registered routes
console.log('Registered routes:');
console.log('- /api/auth');
console.log('- /api/municipalities');
console.log('- /api/dashboard');
console.log('- /api/permit-types');
console.log('- /api/permits (includes file upload endpoints)');
console.log('- /api/contractors');
console.log('- /api/properties');
console.log('- /api/permit-messages');
console.log('- /api/billing');
console.log('- /api/stripe');

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Building Permits API is running',
    environment: process.env.NODE_ENV,
    vercel: !!process.env.VERCEL,
    timestamp: new Date().toISOString()
  });
});

// List all routes endpoint
app.get('/api/routes', (req, res) => {
  res.json({
    message: 'Available API endpoints',
    routes: [
      'GET /api/health',
      'GET /api/routes',
      'GET /api/permit-types',
      'POST /api/permit-types',
      'PUT /api/permit-types/:id',
      'DELETE /api/permit-types/:id',
      'PATCH /api/permit-types/:id/toggle'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Only start server if not in Vercel environment
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Building Permits API server running on port ${PORT}`);
  });
}

module.exports = app;