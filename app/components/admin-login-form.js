import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from '../config/environment';

export default class AdminLoginFormComponent extends Component {
  @service router;

  @tracked email = 'admin@avitarbuildingpermits.com';
  @tracked password = '';
  @tracked isLoading = false;
  @tracked errorMessage = '';

  @action
  updateEmail(event) {
    this.email = event.target.value;
    this.errorMessage = '';
  }

  @action
  updatePassword(event) {
    this.password = event.target.value;
    this.errorMessage = '';
  }

  @action
  async submitLogin(event) {
    event.preventDefault();
    
    if (this.isLoading) return;

    // Basic validation
    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter both email and password';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      console.log('Admin login attempt:', {
        email: this.email,
        userType: 'system_admin',
        apiHost: config.APP.API_HOST
      });

      const response = await fetch(`${config.APP.API_HOST}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: this.email,
          password: this.password,
          userType: 'system_admin'
        }),
      });

      console.log('Admin login response status:', response.status);
      const data = await response.json();
      console.log('Admin login response data:', data);

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error('Service temporarily unavailable. Please try again in a moment.');
        }
        throw new Error(data.error || 'Login failed');
      }

      // Check if user is actually a system admin
      if (data.user.userType !== 'system_admin') {
        throw new Error('Access denied. System administrator privileges required.');
      }

      // Store authentication token
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Navigate to admin dashboard
      this.router.transitionTo('admin.dashboard');

    } catch (error) {
      console.error('Login error:', error);
      this.errorMessage = error.message || 'Login failed. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  @action
  fillDemoCredentials() {
    this.email = 'admin@avitarbuildingpermits.com';
    this.password = 'AdminPass123!';
  }
}