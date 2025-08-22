import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class ResidentialDashboardController extends Controller {
  @service router;

  @tracked activeTab = 'overview';

  get currentYear() {
    return new Date().getFullYear();
  }

  get propertyAddress() {
    if (!this.model.property || !this.model.property.address) {
      return 'No property selected for this municipality';
    }

    const address = this.model.property.address;
    return `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
  }

  get recentPermits() {
    return this.model.permits.all
      .sort(
        (a, b) =>
          new Date(b.submittedDate || b.createdAt) -
          new Date(a.submittedDate || a.createdAt),
      )
      .slice(0, 5);
  }

  get recentContractors() {
    return this.model.contractors
      .sort((a, b) => new Date(b.lastWorked) - new Date(a.lastWorked))
      .slice(0, 5);
  }

  @action
  setActiveTab(tab) {
    this.activeTab = tab;
  }

  @action
  viewPermit(permitId) {
    this.router.transitionTo('residential.permits.view', permitId);
  }

  @action
  applyForPermit() {
    this.router.transitionTo('residential.permits.new');
  }

  @action
  viewAllPermits() {
    this.router.transitionTo('residential.permits.index');
  }

  @action
  editProfile() {
    this.router.transitionTo('residential.profile');
  }

  @action
  addProperty() {
    // Send the action up to the parent residential controller
    this.send('showAddProperty');
  }

  @action
  refresh() {
    // Refresh the route to reload the data
    this.router.refresh();
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
    localStorage.removeItem('remember_me');
    localStorage.removeItem('auth_expiration');

    console.log('Residential user logged out');

    // Redirect to home
    this.router.transitionTo('home');
  }
}
