import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class UniversalSignInFormComponent extends Component {
  @service router;

  @tracked email = '';
  @tracked password = '';
  @tracked selectedMunicipalityId = '';
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
  updateSelectedMunicipality(event) {
    this.selectedMunicipalityId = event.target.value;
  }

  @action
  async handleSubmit(event) {
    event.preventDefault();
    
    if (this.isLoading) return;

    // Validation
    if (!this.email || !this.password) {
      this.errorMessage = 'Please fill in all required fields';
      return;
    }

    if (this.args.requiresMunicipality && !this.selectedMunicipalityId) {
      this.errorMessage = 'Please select your municipality';
      return;
    }

    try {
      this.isLoading = true;
      this.errorMessage = '';

      const loginData = {
        email: this.email,
        password: this.password,
        userType: this.args.userType
      };

      // Add municipality for residential/municipal users
      if (this.args.requiresMunicipality && this.selectedMunicipalityId) {
        loginData.municipalityId = this.selectedMunicipalityId;
      }

      console.log('Universal sign-in attempt:', {
        userType: this.args.userType,
        requiresMunicipality: this.args.requiresMunicipality,
        municipalityId: this.selectedMunicipalityId
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
        throw new Error(result.message || 'Login failed');
      }

      console.log('Universal sign-in successful:', result);

      // Store auth info
      localStorage.setItem('auth_token', result.token);
      localStorage.setItem('user_type', result.user.userType);
      localStorage.setItem('user_id', result.user.id);
      localStorage.setItem('user_details', JSON.stringify(result.user));
      
      if (result.user.municipality) {
        localStorage.setItem('municipality_id', result.user.municipality.id);
        localStorage.setItem('municipality_name', result.user.municipality.name);
      }

      // Route based on user type
      if (result.user.userType === 'residential') {
        this.router.transitionTo('residential.dashboard');
      } else if (result.user.userType === 'municipal') {
        this.router.transitionTo('municipal.dashboard');
      }

    } catch (error) {
      console.error('Universal sign-in error:', error);
      this.errorMessage = error.message || 'Login failed. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }
}