#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../server/models/User');

async function ensureAdminUser() {
  try {
    console.log('Connecting to MongoDB...');
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/building-permits';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB successfully');

    const adminEmail = 'admin@avitarbuildingpermits.com';
    const adminPassword = 'AdminPass123!';

    // Check if admin user already exists
    let adminUser = await User.findOne({ email: adminEmail });

    if (adminUser) {
      console.log('Admin user already exists');
      
      // Check if userType is correct
      if (adminUser.userType !== 'system_admin') {
        console.log(`Updating admin user type from '${adminUser.userType}' to 'system_admin'`);
        adminUser.userType = 'system_admin';
        await adminUser.save();
        console.log('Admin user type updated successfully');
      } else {
        console.log('Admin user type is correct: system_admin');
      }

      // Ensure user is active
      if (!adminUser.isActive) {
        console.log('Activating admin user');
        adminUser.isActive = true;
        await adminUser.save();
        console.log('Admin user activated');
      }
    } else {
      console.log('Creating new admin user...');
      
      adminUser = new User({
        email: adminEmail,
        password: adminPassword,
        firstName: 'System',
        lastName: 'Administrator',
        phone: '555-0123',
        userType: 'system_admin',
        isActive: true,
        emailVerified: true
      });

      await adminUser.save();
      console.log('Admin user created successfully');
    }

    console.log('\nAdmin user details:');
    console.log('Email:', adminUser.email);
    console.log('UserType:', adminUser.userType);
    console.log('IsActive:', adminUser.isActive);
    console.log('ID:', adminUser._id);

    console.log('\nAdmin login credentials:');
    console.log('Email: admin@avitarbuildingpermits.com');
    console.log('Password: AdminPass123!');

    await mongoose.disconnect();
    console.log('\nDone!');
  } catch (error) {
    console.error('Error ensuring admin user:', error);
    process.exit(1);
  }
}

ensureAdminUser();