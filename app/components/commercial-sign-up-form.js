import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class CommercialSignUpFormComponent extends Component {
  @service router;
  @tracked email = '';
  @tracked password = '';
  @tracked confirmPassword = '';
  @tracked firstName = '';
  @tracked lastName = '';
  @tracked phone = '';

  // Business information
  @tracked businessName = '';
  @tracked businessType = '';
  @tracked licenseNumber = '';
  @tracked licenseType = '';
  @tracked federalTaxId = '';

  // Business address
  @tracked businessStreet = '';
  @tracked businessCity = '';
  @tracked businessState = 'NH';
  @tracked businessZip = '';

  // Plan selection
  @tracked selectedPlan = 'free';
  @tracked availablePlans = null;

  @tracked isLoading = false;
  @tracked errorMessage = '';

  constructor() {
    super(...arguments);
    
    // Load available plans
    this.loadAvailablePlans();
  }
  
  async loadAvailablePlans() {
    try {
      const response = await fetch(`${config.APP.API_HOST}/api/billing/public-plans/commercial`);
      if (response.ok) {
        this.availablePlans = await response.json();
        console.log('Loaded commercial plans from Stripe:', this.availablePlans);
        
        // Set default to 'free' plan if it exists
        if (this.availablePlans?.free) {
          this.selectedPlan = 'free';
        } else if (this.availablePlans) {
          // Otherwise select the first available plan
          const planKeys = Object.keys(this.availablePlans);
          if (planKeys.length > 0) {
            this.selectedPlan = planKeys[0];
          }
        }
      }
    } catch (error) {
      console.error('Error loading commercial plans from Stripe:', error);
      this.availablePlans = {};
    }
  }

  @action
  updateField(field, event) {
    this[field] = event.target.value;
    this.errorMessage = '';
  }

  @action
  selectPlan(planKey) {
    this.selectedPlan = planKey;
    this.errorMessage = '';
  }

  // Helper methods
  formatPrice(cents) {
    if (!cents || cents === 0) return '0';
    return (cents / 100).toFixed(0);
  }

  @action
  async handleSubmit(event) {
    event.preventDefault();

    if (!this.validateForm()) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const userData = {
        email: this.email,
        password: this.password,
        firstName: this.firstName,
        lastName: this.lastName,
        phone: this.phone,
        userType: 'commercial',
        businessInfo: {
          businessName: this.businessName,
          businessType: this.businessType,
          licenseNumber: this.licenseNumber,
          licenseType: this.licenseType,
          federalTaxId: this.federalTaxId,
          businessAddress: {
            street: this.businessStreet,
            city: this.businessCity,
            state: this.businessState,
            zip: this.businessZip,
          },
        },
        selectedPlan: this.selectedPlan,
      };

      console.log('Registering commercial user:', userData);

      const response = await fetch(`${config.APP.API_HOST}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed');
      }

      // Store authentication data
      localStorage.setItem('auth_token', result.token);
      localStorage.setItem('user_type', result.user.userType);
      localStorage.setItem('user_id', result.user._id);
      localStorage.setItem('user_details', JSON.stringify(result.user));

      // Show success message and redirect
      console.log('Registration successful:', result);

      // Redirect to commercial dashboard
      alert(
        `Welcome ${result.user.firstName}! Your commercial account has been created successfully. You can now apply for building permits across multiple municipalities.`,
      );

      this.router.transitionTo('commercial.dashboard');
    } catch (error) {
      console.error('Registration error:', error);
      this.errorMessage =
        error.message || 'Failed to create account. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  validateForm() {
    if (
      !this.email ||
      !this.password ||
      !this.confirmPassword ||
      !this.firstName ||
      !this.lastName ||
      !this.businessName ||
      !this.businessType ||
      !this.businessStreet ||
      !this.businessCity ||
      !this.businessState ||
      !this.businessZip
    ) {
      this.errorMessage = 'Please fill in all required fields';
      return false;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      return false;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters long';
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.errorMessage = 'Please enter a valid email address';
      return false;
    }

    return true;
  }
}
