import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class ResidentialSignUpFormComponent extends Component {
  @service router;
  @tracked email = '';
  @tracked password = '';
  @tracked confirmPassword = '';
  @tracked firstName = '';
  @tracked lastName = '';
  @tracked phone = '';
  
  // Property information
  @tracked propertyStreet = '';
  @tracked propertyCity = '';
  @tracked propertyState = 'NH';
  @tracked propertyZip = '';
  @tracked propertyType = '';
  @tracked isOwner = true;

  constructor() {
    super(...arguments);
    
    // Pre-populate property city with municipality city
    if (this.args.municipality?.city) {
      this.propertyCity = this.args.municipality.city;
    }
  }
  
  @tracked isLoading = false;
  @tracked errorMessage = '';

  @action
  updateField(field, event) {
    this[field] = event.target.value;
    this.errorMessage = '';
  }

  @action
  updateOwnerStatus(event) {
    this.isOwner = event.target.value === 'true';
    this.errorMessage = '';
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
        userType: 'residential',
        municipality: {
          id: this.args.municipality.id || this.args.municipality._id,
          name: this.args.municipality.name
        },
        propertyAddress: {
          street: this.propertyStreet,
          city: this.propertyCity,
          state: this.propertyState,
          zip: this.propertyZip
        },
        propertyInfo: {
          type: this.propertyType,
          isOwner: this.isOwner
        }
      };

      console.log('Registering residential user:', userData);

      const response = await fetch(`${config.APP.API_HOST}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed');
      }

      // Store authentication data
      localStorage.setItem('auth_token', result.token);
      localStorage.setItem('user_type', result.user.userType);
      localStorage.setItem('user_id', result.user._id);
      localStorage.setItem('municipality_id', result.user.municipality._id || result.user.municipality);

      // Show success message and redirect
      console.log('Registration successful:', result);
      
      // Redirect to residential dashboard
      alert(`Welcome ${result.user.firstName}! Your residential account has been created successfully. You can now apply for building permits in ${this.args.municipality.name}.`);
      
      this.router.transitionTo('residential.dashboard');
      
    } catch (error) {
      console.error('Registration error:', error);
      this.errorMessage = error.message || 'Failed to create account. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  validateForm() {
    if (!this.email || !this.password || !this.confirmPassword || 
        !this.firstName || !this.lastName || !this.propertyStreet ||
        !this.propertyCity || !this.propertyZip || !this.propertyType) {
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

    // Validate that property city matches municipality city
    const municipalityCity = this.args.municipality?.city?.toLowerCase().trim();
    const propertyCity = this.propertyCity?.toLowerCase().trim();
    
    if (municipalityCity && propertyCity && municipalityCity !== propertyCity) {
      this.errorMessage = `Property must be located in ${this.args.municipality.city}. You entered "${this.propertyCity}".`;
      return false;
    }

    return true;
  }
}