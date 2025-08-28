import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class CommercialSignInFormComponent extends Component {
  @service router;
  @tracked email = '';
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
  async handleSubmit(event) {
    event.preventDefault();

    if (!this.email || !this.password) {
      this.errorMessage = 'Please fill in all fields';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      console.log('Commercial sign in attempt:', {
        email: this.email,
        userType: 'commercial',
      });

      const response = await fetch(`${config.APP.API_HOST}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: this.email,
          password: this.password,
          userType: 'commercial',
          // No municipality required for commercial login
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Sign in failed');
      }

      // Verify user type matches
      if (result.user.userType !== 'commercial') {
        throw new Error(
          'This account is not registered as a commercial user.',
        );
      }

      // Store authentication data
      localStorage.setItem('auth_token', result.token);
      localStorage.setItem('user_type', result.user.userType);
      localStorage.setItem('user_id', result.user._id);
      localStorage.setItem('user_details', JSON.stringify(result.user));

      console.log('Commercial sign in successful:', result);

      // Show success message and redirect
      alert(`Welcome back ${result.user.firstName}! You are now signed in to the commercial portal.`);

      // Redirect to commercial dashboard
      this.router.transitionTo('commercial.dashboard');
    } catch (error) {
      console.error('Commercial sign in error:', error);
      this.errorMessage =
        error.message ||
        'Failed to sign in. Please check your credentials and try again.';
    } finally {
      this.isLoading = false;
    }
  }
}