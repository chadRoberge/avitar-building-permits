const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const userSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
  firstName: String,
  lastName: String,
  userType: String,
  isActive: { type: Boolean, default: true },
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

async function testLogin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');
    
    const user = await User.findOne({ email: 'muninspection@test.com' });
    if (!user) {
      console.log('User not found');
      return;
    }
    
    console.log('User found:', {
      email: user.email,
      userType: user.userType,
      isActive: user.isActive,
      hasPassword: !!user.password,
      passwordLength: user.password && user.password.length
    });
    
    // Test various password combinations
    const passwords = ['password123!', 'TempPassword123!', 'password123'];
    for (const pwd of passwords) {
      const result = await user.comparePassword(pwd);
      console.log('Password "' + pwd + '": ' + (result ? 'MATCH' : 'NO MATCH'));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    mongoose.connection.close();
  }
}

testLogin();
