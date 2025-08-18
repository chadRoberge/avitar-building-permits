const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      console.log('MongoDB already connected');
      return;
    }

    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/building_permits';
    console.log('Attempting to connect to MongoDB...', process.env.VERCEL ? '(Vercel environment)' : '(Local environment)');
    
    // Connection options for better compatibility with online clusters
    const options = {
      // Timeouts and retries for cloud connections
      serverSelectionTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 45000, // 45 seconds
      connectTimeoutMS: 10000, // 10 seconds
      
      // For Atlas/cloud clusters
      maxPoolSize: 10,
      minPoolSize: 2,
    };
    
    await mongoose.connect(mongoURI, options);
    
    console.log('MongoDB connected successfully to:', mongoURI.split('@')[1] || 'localhost');
    console.log('Connection state:', mongoose.connection.readyState);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    console.error('Error stack:', error.stack);
    console.warn('Server will continue without database connection. Some features may not work.');
    // Don't exit - allow server to run without DB for testing
  }
};

module.exports = connectDB;