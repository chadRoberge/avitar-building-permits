import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class CommercialController extends Controller {
  @service router;
  
  @tracked selectedMunicipality = null;
  @tracked showMunicipalityDropdown = false;

  get currentUser() {
    return this.model?.currentUser || {};
  }

  get userInitials() {
    const user = this.currentUser;
    if (user.firstName && user.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    }
    return 'CU'; // Commercial User fallback
  }

  get isDashboardActive() {
    return this.router.currentRouteName === 'commercial.dashboard';
  }

  get isPermitsActive() {
    return this.router.currentRouteName?.startsWith('commercial.permits');
  }

  get isContractorsActive() {
    return this.router.currentRouteName === 'commercial.contractors';
  }

  @action
  toggleMunicipalityDropdown() {
    this.showMunicipalityDropdown = !this.showMunicipalityDropdown;
  }

  @action
  selectMunicipality(municipality) {
    this.selectedMunicipality = municipality;
    this.showMunicipalityDropdown = false;
    
    // Store selected municipality for the session
    sessionStorage.setItem('selected_municipality', JSON.stringify(municipality));
    
    // Notify child routes/controllers about municipality change (with error handling)
    try {
      this.send('municipalityChanged', municipality);
    } catch (error) {
      // Silently handle if child controller doesn't have the action
      console.debug('Child controller does not handle municipalityChanged action');
    }
  }

  @action
  clearMunicipality() {
    this.selectedMunicipality = null;
    this.showMunicipalityDropdown = false;
    sessionStorage.removeItem('selected_municipality');
    
    // Notify child routes/controllers about municipality change (with error handling)
    try {
      this.send('municipalityChanged', null);
    } catch (error) {
      // Silently handle if child controller doesn't have the action
      console.debug('Child controller does not handle municipalityChanged action');
    }
  }

  @action
  showMunicipalitySelector() {
    // For now, just open the dropdown to select a municipality
    this.showMunicipalityDropdown = true;
  }

  @action
  logout() {
    // Clear all authentication and session data
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_type');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_details');
    sessionStorage.removeItem('selected_municipality');

    // For extra safety, clear any other auth-related keys
    Object.keys(localStorage).forEach((key) => {
      if (
        key.includes('auth') ||
        key.includes('user') ||
        key.includes('municipality')
      ) {
        localStorage.removeItem(key);
      }
    });

    console.log('Commercial user logged out, all auth data cleared');

    // Redirect to home page
    this.router.transitionTo('home');
  }

  constructor() {
    super(...arguments);
    
    // Check if there's a previously selected municipality
    const savedMunicipality = sessionStorage.getItem('selected_municipality');
    if (savedMunicipality) {
      try {
        this.selectedMunicipality = JSON.parse(savedMunicipality);
      } catch (error) {
        console.error('Error parsing saved municipality:', error);
        sessionStorage.removeItem('selected_municipality');
      }
    }
  }

  @action
  autoSelectMunicipality() {
    // Auto-select municipality if none selected and municipalities are available
    if (!this.selectedMunicipality && this.model?.municipalities?.length > 0) {
      // Check for previously saved municipality first
      const savedMunicipality = sessionStorage.getItem('selected_municipality');
      if (savedMunicipality) {
        try {
          const parsed = JSON.parse(savedMunicipality);
          // Verify the saved municipality still exists in the current list
          const exists = this.model.municipalities.find(m => m.id === parsed.id);
          if (exists) {
            this.selectedMunicipality = parsed;
            return;
          }
        } catch (error) {
          console.error('Error parsing saved municipality:', error);
          sessionStorage.removeItem('selected_municipality');
        }
      }
      
      // If no valid saved municipality, select the first one
      this.selectMunicipality(this.model.municipalities[0]);
    }
  }
}