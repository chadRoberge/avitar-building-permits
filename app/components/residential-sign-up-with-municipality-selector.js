import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class ResidentialSignUpWithMunicipalitySelectorComponent extends Component {
  @service router;

  @tracked firstName = '';
  @tracked lastName = '';
  @tracked email = '';
  @tracked phone = '';
  @tracked password = '';
  @tracked confirmPassword = '';
  @tracked selectedMunicipalityId = '';
  
  // Property address
  @tracked propertyStreet = '';
  @tracked propertyCity = '';
  @tracked propertyState = '';
  @tracked propertyZip = '';
  
  @tracked isLoading = false;
  @tracked errorMessage = '';

  @action
  updateField(field, event) {
    const value = event.target ? event.target.value : event;
    this[field] = value;
  }

  @action
  updateSelectedMunicipality(event) {
    this.selectedMunicipalityId = event.target.value;
  }

  @action
  async handleSubmit(event) {
    event.preventDefault();
    
    if (this.isLoading) return;

    // Validation
    if (!this.firstName || !this.lastName || !this.email || !this.password || !this.confirmPassword) {
      this.errorMessage = 'Please fill in all required fields';
      return;
    }

    if (!this.selectedMunicipalityId) {
      this.errorMessage = 'Please select your municipality';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      return;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters long';
      return;
    }

    if (!this.propertyStreet || !this.propertyCity || !this.propertyState || !this.propertyZip) {
      this.errorMessage = 'Please fill in all property address fields';
      return;
    }

    try {
      this.isLoading = true;
      this.errorMessage = '';

      const registrationData = {
        userType: 'residential',
        firstName: this.firstName,
        lastName: this.lastName,
        email: this.email,
        phone: this.phone,
        password: this.password,
        municipalityId: this.selectedMunicipalityId,
        propertyInfo: {
          street: this.propertyStreet,
          city: this.propertyCity,
          state: this.propertyState,
          zip: this.propertyZip
        }
      };

      console.log('Residential registration attempt:', {
        userType: 'residential',
        municipalityId: this.selectedMunicipalityId,
        hasPropertyInfo: !!registrationData.propertyInfo
      });

      const response = await fetch(`${config.APP.API_HOST}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Registration failed');
      }

      console.log('Residential registration successful:', result);

      // Store auth info
      localStorage.setItem('auth_token', result.token);
      localStorage.setItem('user_type', 'residential');
      localStorage.setItem('user_id', result.user.id);
      
      if (result.user.municipality) {
        localStorage.setItem('municipality_id', result.user.municipality.id);
        localStorage.setItem('municipality_name', result.user.municipality.name);
      }

      // Redirect to residential dashboard
      this.router.transitionTo('residential.dashboard');

    } catch (error) {
      console.error('Residential registration error:', error);
      this.errorMessage = error.message || 'Registration failed. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }
}