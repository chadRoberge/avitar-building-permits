import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class MunicipalController extends Controller {
  @service router;

  @action
  logout() {
    // Clear authentication
    localStorage.removeItem('auth_token');

    // Redirect to home
    this.router.transitionTo('home');
  }
}
