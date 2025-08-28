import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class SystemAdminSignInFormComponent extends Component {
  @service router;

  @tracked email = '';
  @tracked password = '';
  @tracked isLoading = false;
  @tracked errorMessage = '';

  @action
  updateEmail(event) {
    this.email = event.target.value;
  }

  @action
  updatePassword(event) {
    this.password = event.target.value;
  }

  @action
  async handleSubmit(event) {
    event.preventDefault();
    
    if (this.isLoading) return;

    // Validation
    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter both email and password';
      return;
    }

    try {
      this.isLoading = true;
      this.errorMessage = '';

      const loginData = {
        email: this.email,
        password: this.password,
        userType: 'system_admin'
      };

      console.log('System admin sign-in attempt:', {
        userType: 'system_admin',
        email: this.email
      });

      const response = await fetch(`${config.APP.API_HOST}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Authentication failed');
      }

      console.log('System admin sign-in successful:', result);

      // Store auth info
      localStorage.setItem('auth_token', result.token);
      localStorage.setItem('user_type', result.user.userType);
      localStorage.setItem('user_id', result.user.id);

      // Redirect to system admin dashboard
      this.router.transitionTo('system-admin.dashboard');

    } catch (error) {
      console.error('System admin sign-in error:', error);
      this.errorMessage = error.message || 'Authentication failed. Please check your credentials.';
    } finally {
      this.isLoading = false;
    }
  }
}