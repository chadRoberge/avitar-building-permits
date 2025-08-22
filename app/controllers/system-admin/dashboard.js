import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class AdminDashboardController extends Controller {
  @service router;

  @tracked showDashboardView = true;
  @tracked showMunicipalitiesView = false;
  @tracked showUsersView = false;
  @tracked showSettingsView = false;

  @action
  showDashboard(event) {
    event?.preventDefault();
    this.resetViews();
    this.showDashboardView = true;
  }

  @action
  showMunicipalities(event) {
    event?.preventDefault();
    this.resetViews();
    this.showMunicipalitiesView = true;
  }

  @action
  showUsers(event) {
    event?.preventDefault();
    this.resetViews();
    this.showUsersView = true;
  }

  @action
  showSettings(event) {
    event?.preventDefault();
    this.resetViews();
    this.showSettingsView = true;
  }

  @action
  logout() {
    // Clear stored authentication
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Navigate back to system admin login
    this.router.transitionTo('system-admin.login');
  }

  resetViews() {
    this.showDashboardView = false;
    this.showMunicipalitiesView = false;
    this.showUsersView = false;
    this.showSettingsView = false;
  }
}