import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class MunicipalPortalController extends Controller {
  @service router;

  @action
  selectUserType(userType) {
    // Navigate to auth page with municipality and user type
    this.router.transitionTo('auth', {
      queryParams: {
        municipality_id: this.model.id,
        user_type: userType,
      },
    });
  }

  @action
  goToMunicipalStaffPortal() {
    // Store the selected municipality for the staff portal
    localStorage.setItem('selected_municipality_id', this.model.id);

    // Navigate to admin portal
    this.router.transitionTo('admin');
  }
}
