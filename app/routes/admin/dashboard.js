import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class AdminDashboardRoute extends Route {
  @service router;

  beforeModel() {
    // Check if user is authenticated and is admin
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
      this.router.transitionTo('admin.login');
      return;
    }

    const userData = JSON.parse(user);
    if (userData.userType !== 'system_admin') {
      this.router.transitionTo('admin.login');
      return;
    }
  }

  model() {
    return {
      user: JSON.parse(localStorage.getItem('user'))
    };
  }
}