import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class ResidentialController extends Controller {
  @service router;
  @service currentProperty;

  @tracked showPropertyDropdown = false;
  @tracked showAddPropertyModal = false;

  get isPermitsActive() {
    const currentRoute = this.router.currentRouteName;
    return currentRoute && currentRoute.startsWith('residential.permits');
  }

  get isDashboardActive() {
    return this.router.currentRouteName === 'residential.dashboard';
  }

  get isProfileActive() {
    return this.router.currentRouteName === 'residential.profile';
  }

  @action
  togglePropertyDropdown() {
    this.showPropertyDropdown = !this.showPropertyDropdown;
  }

  @action
  async selectProperty(propertyId) {
    this.showPropertyDropdown = false;
    await this.currentProperty.switchProperty(propertyId);

    // Refresh the current route to update data with new property
    this.router.refresh();
  }

  @action
  showAddProperty() {
    this.showPropertyDropdown = false;
    this.showAddPropertyModal = true;
  }

  @action
  closeAddPropertyModal() {
    this.showAddPropertyModal = false;
  }

  @action
  logout() {
    // Clear all authentication and session data
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_type');
    localStorage.removeItem('user_id');
    localStorage.removeItem('municipality_id');
    localStorage.removeItem('current_municipality_id');
    localStorage.removeItem('selected_municipality_id');
    localStorage.removeItem('current_property_id');
    localStorage.removeItem('remember_me');
    localStorage.removeItem('auth_expiration');

    console.log('Residential user logged out');

    // Redirect to home
    this.router.transitionTo('home');
  }
}
