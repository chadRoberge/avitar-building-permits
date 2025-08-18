import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class ResidentialPermitsViewController extends Controller {
  @service router;

  @action
  goBack() {
    this.router.transitionTo('residential.permits.index');
  }
}