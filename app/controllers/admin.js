import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class AdminController extends Controller {
  @service router;

  @tracked email = '';
  @tracked password = '';
  @tracked rememberMe = false;
  @tracked isLoading = false;
  @tracked errorMessage = '';
  @tracked successMessage = '';

  // Forgot password functionality
  @tracked showForgotPasswordForm = false;
  @tracked resetEmail = '';
  @tracked isResetting = false;

  get currentYear() {
    return new Date().getFullYear();
  }

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
  toggleRememberMe(event) {
    this.rememberMe = event.target.checked;
  }

  @action
  updateResetEmail(event) {
    this.resetEmail = event.target.value;
  }

  @action
  showForgotPassword() {
    this.showForgotPasswordForm = true;
    this.resetEmail = this.email;
    this.errorMessage = '';
  }

  @action
  hideForgotPassword() {
    this.showForgotPasswordForm = false;
    this.resetEmail = '';
    this.errorMessage = '';
    this.successMessage = '';
  }

  @action
  async handleSignIn(event) {
    event.preventDefault();

    if (!this.validateSignInForm()) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const response = await fetch(`${config.APP.API_HOST}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: this.email,
          password: this.password,
          userType: 'municipal', // Specify we want municipal user login
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Sign in failed');
      }

      // Verify user is municipal staff
      if (result.user.userType !== 'municipal') {
        throw new Error(
          'This portal is for municipal staff only. Please use the public portal.',
        );
      }

      // Store authentication data
      localStorage.setItem('auth_token', result.token);
      localStorage.setItem('user_type', result.user.userType);
      localStorage.setItem('user_id', result.user._id);
      localStorage.setItem('user_details', JSON.stringify(result.user));
      localStorage.setItem('municipality_id', result.user.municipality._id);

      // Check if there's a selected municipality from the portal flow
      const selectedMunicipalityId = localStorage.getItem(
        'selected_municipality_id',
      );
      if (selectedMunicipalityId) {
        localStorage.setItem('current_municipality_id', selectedMunicipalityId);
        localStorage.removeItem('selected_municipality_id'); // Clear temporary storage
      } else {
        localStorage.setItem(
          'current_municipality_id',
          result.user.municipality._id,
        );
      }

      if (this.rememberMe) {
        localStorage.setItem('remember_me', 'true');
        // Set longer expiration for remember me
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 30);
        localStorage.setItem('auth_expiration', expirationDate.toISOString());
      }

      this.successMessage = 'Welcome back! Redirecting to dashboard...';

      // Redirect to municipal dashboard
      setTimeout(() => {
        this.router.transitionTo('municipal.dashboard');
      }, 1000);
    } catch (error) {
      console.error('Sign in error:', error);
      this.errorMessage =
        error.message ||
        'Sign in failed. Please check your credentials and try again.';
    } finally {
      this.isLoading = false;
    }
  }

  @action
  async handleForgotPassword(event) {
    event.preventDefault();

    if (!this.resetEmail) {
      this.errorMessage = 'Please enter your work email address';
      return;
    }

    if (!this.validateEmail(this.resetEmail)) {
      this.errorMessage = 'Please enter a valid email address';
      return;
    }

    this.isResetting = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const response = await fetch(
        `${config.APP.API_HOST}/api/auth/forgot-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: this.resetEmail,
            userType: 'municipal',
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Password reset failed');
      }

      this.successMessage =
        'Password reset instructions have been sent to your email address.';
      this.showForgotPasswordForm = false;
      this.resetEmail = '';
    } catch (error) {
      console.error('Password reset error:', error);
      this.errorMessage =
        error.message ||
        'Password reset failed. Please try again or contact your IT administrator.';
    } finally {
      this.isResetting = false;
    }
  }

  validateSignInForm() {
    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter both email and password';
      return false;
    }

    if (!this.validateEmail(this.email)) {
      this.errorMessage = 'Please enter a valid email address';
      return false;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters long';
      return false;
    }

    return true;
  }

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
