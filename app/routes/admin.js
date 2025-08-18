import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class AdminRoute extends Route {
  @service router;

  beforeModel() {
    // Check if user is already logged in as municipal staff
    const token = localStorage.getItem('auth_token');
    const userType = localStorage.getItem('user_type');

    if (token && userType === 'municipal') {
      // Already logged in, redirect to dashboard
      this.router.transitionTo('municipal.dashboard');
    }
  }

  model() {
    // Get list of municipalities for dropdown (optional)
    return {
      municipalities: [
        { id: '1', name: 'Town of Hanover', state: 'NH' },
        { id: '2', name: 'City of Manchester', state: 'NH' },
        { id: '3', name: 'City of Nashua', state: 'NH' },
        { id: '4', name: 'City of Concord', state: 'NH' },
        { id: '5', name: 'Town of Portsmouth', state: 'NH' },
        { id: '6', name: 'Town of Dover', state: 'NH' },
      ],
    };
  }
}
