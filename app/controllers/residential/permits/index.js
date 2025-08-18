import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class ResidentialPermitsIndexController extends Controller {
  @service router;

  @action
  applyForPermit() {
    this.router.transitionTo('residential.permits.new');
  }

  @action
  viewPermit(permitId) {
    // Navigate to the permit detail view
    this.router.transitionTo('residential.permits.view', permitId);
  }
}