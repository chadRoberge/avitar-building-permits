import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class MunicipalPortalController extends Controller {
  @service router;

  @action
  selectUserType(userType) {
    console.log('Selecting user type:', userType, 'for municipality:', this.model.id, this.model.name);
    
    // Store municipality info in localStorage for the auth process
    localStorage.setItem('selected_municipality_id', this.model.id);
    localStorage.setItem('selected_municipality_name', this.model.name);
    
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
