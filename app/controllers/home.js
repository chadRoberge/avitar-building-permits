import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class HomeController extends Controller {
  @service router;

  // Auth flow state
  @tracked showSignIn = true;
  @tracked showSignUp = false;

  // User type selection
  @tracked selectedUserType = null; // For sign in
  @tracked selectedSignUpType = null; // For sign up

  // Data
  @tracked municipalities = [];
  @tracked isLoading = false;
  @tracked errorMessage = '';

  constructor() {
    super(...arguments);
    this.loadMunicipalities();
  }

  async loadMunicipalities() {
    try {
      this.isLoading = true;
      this.errorMessage = '';

      const response = await fetch(`${config.APP.API_HOST}/api/municipalities`);
      
      if (!response.ok) {
        throw new Error(`Failed to load municipalities: ${response.status}`);
      }

      this.municipalities = await response.json();
      console.log('Loaded municipalities for unified home:', this.municipalities);
    } catch (error) {
      console.error('Error loading municipalities:', error);
      this.errorMessage = error.message;
    } finally {
      this.isLoading = false;
    }
  }

  // Auth toggle actions
  @action
  showSignInForm() {
    this.showSignIn = true;
    this.showSignUp = false;
    this.selectedUserType = null;
    this.selectedSignUpType = null;
  }

  @action
  showSignUpForm() {
    this.showSignIn = false;
    this.showSignUp = true;
    this.selectedUserType = null;
    this.selectedSignUpType = null;
  }

  // User type selection actions
  @action
  selectUserType(userType) {
    this.selectedUserType = userType;
  }

  @action
  selectSignUpType(userType) {
    this.selectedSignUpType = userType;
  }

  @action
  clearUserType() {
    this.selectedUserType = null;
  }

  @action
  clearSignUpType() {
    this.selectedSignUpType = null;
  }

  // Legacy actions (for municipality registration)
  @action
  showMunicipalityRegistration() {
    this.router.transitionTo('register-municipality');
  }
}