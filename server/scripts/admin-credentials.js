const bcrypt = require('bcryptjs');

async function generateAdminCredentials() {
  console.log('\n🔐 System Admin Credentials');
  console.log('==========================================');
  console.log('Email:    admin@avitarbuildingpermits.com');
  console.log('Password: AdminPass123!');
  console.log('Role:     system_admin');
  console.log('==========================================');
  
  // Generate hashed password
  const hashedPassword = await bcrypt.hash('AdminPass123!', 10);
  
  console.log('\n📋 Manual Database Insert (if needed):');
  console.log('==========================================');
  console.log('You can manually insert this user document into your users collection:');
  console.log('\n```json');
  console.log(JSON.stringify({
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
  }, null, 2));
  console.log('```');
  
  console.log('\n🔍 Or use MongoDB Compass/CLI:');
  console.log('==========================================');
  console.log('db.users.insertOne({');
  console.log('  "email": "admin@avitarbuildingpermits.com",');
  console.log(`  "password": "${hashedPassword}",`);
  console.log('  "firstName": "System",');
  console.log('  "lastName": "Administrator",');
  console.log('  "phone": "555-0123",');
  console.log('  "userType": "system_admin",');
  console.log('  "isActive": true,');
  console.log('  "emailVerified": true,');
  console.log('  "createdAt": new Date(),');
  console.log('  "updatedAt": new Date()');
  console.log('});');
  
  console.log('\n✅ After creating the user, you can login with:');
  console.log('Email: admin@avitarbuildingpermits.com');
  console.log('Password: AdminPass123!');
  
  console.log('\n🚀 Admin Access:');
  console.log('- API endpoints: /api/admin/*');
  console.log('- Dashboard: /admin (when implemented)');
  console.log('- Full system access to manage municipalities and users');
  
  console.log('\n🔒 SECURITY NOTE: Please change this password after first login!');
}

generateAdminCredentials().catch(console.error);