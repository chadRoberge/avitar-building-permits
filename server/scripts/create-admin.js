require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function createAdminUser() {
  try {
    // Show connection string being used (without credentials)
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/building_permits';
    console.log('Attempting to connect to:', mongoUri.replace(/\/\/.*@/, '//**:**@'));
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri);
    
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      email: 'admin@avitarbuildingpermits.com',
      userType: 'system_admin' 
    });

    if (existingAdmin) {
      console.log('System admin already exists!');
      console.log('Email: admin@avitarbuildingpermits.com');
      console.log('Password: AdminPass123!');
      console.log('\nIf you need to reset the password, delete this user and run the script again.');
      process.exit(0);
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash('AdminPass123!', 10);

    // Create the admin user
    const adminUser = new User({
      email: 'admin@avitarbuildingpermits.com',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      phone: '555-0123',
      userType: 'system_admin',
      isActive: true,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await adminUser.save();

    console.log('\n✅ System Admin User Created Successfully!');
    console.log('==========================================');
    console.log('Email:    admin@avitarbuildingpermits.com');
    console.log('Password: AdminPass123!');
    console.log('Role:     System Administrator');
    console.log('==========================================');
    console.log('\n🔐 Please change this password after first login!');
    console.log('\n📝 This user can:');
    console.log('   - Access /api/admin/* endpoints');
    console.log('   - Manage all municipalities');
    console.log('   - Configure InvoiceCloud payment settings');
    console.log('   - View and manage all system users');
    console.log('   - Access system analytics and reports');

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the script
createAdminUser();