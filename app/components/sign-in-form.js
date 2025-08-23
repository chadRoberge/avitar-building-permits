import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class SignInFormComponent extends Component {
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
      console.log('Sign in attempt:', {
        email: this.email,
        userType: this.args.userType,
        municipality: this.args.municipality.name,
      });

      const selectedMunicipalityId = localStorage.getItem('selected_municipality_id') || this.args.municipality.id || this.args.municipality._id;
      
      console.log('Signing in with municipality:', selectedMunicipalityId, this.args.municipality.name);
      
      const response = await fetch(`${config.APP.API_HOST}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: this.email,
          password: this.password,
          userType: this.args.userType,
          municipality: selectedMunicipalityId,
          municipalityName: this.args.municipality.name,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Sign in failed');
      }

      // Verify user type matches
      if (result.user.userType !== this.args.userType) {
        throw new Error(
          `This account is not registered as a ${this.args.userType} user.`,
        );
      }

      // Store authentication data
      localStorage.setItem('auth_token', result.token);
      localStorage.setItem('user_type', result.user.userType);
      localStorage.setItem('user_id', result.user._id);
      localStorage.setItem('user_details', JSON.stringify(result.user));
      
      // Store municipality information
      const municipalityData = result.user.municipality || {
        _id: selectedMunicipalityId,
        name: this.args.municipality.name,
        city: this.args.municipality.city,
        state: this.args.municipality.state,
        zip: this.args.municipality.zip
      };
      
      localStorage.setItem('municipality_id', municipalityData._id || municipalityData.id);
      localStorage.setItem('municipality_data', JSON.stringify(municipalityData));

      console.log('Sign in successful:', result);

      // Redirect to appropriate dashboard based on user type
      alert(
        `Welcome back ${result.user.firstName}! You are now signed in to the ${this.args.municipality.name} portal.`,
      );

      if (result.user.userType === 'residential') {
        this.router.transitionTo('residential.dashboard');
      } else if (result.user.userType === 'municipal') {
        this.router.transitionTo('municipal.dashboard');
      } else {
        // For commercial or other types, redirect to home for now
        this.router.transitionTo('home');
      }
    } catch (error) {
      console.error('Sign in error:', error);
      this.errorMessage =
        error.message ||
        'Failed to sign in. Please check your credentials and try again.';
    } finally {
      this.isLoading = false;
    }
  }
}
