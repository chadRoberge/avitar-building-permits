import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class SystemAdminRoute extends Route {
  @service router;
  
  // Redirect to login if not authenticated, otherwise to dashboard
  beforeModel() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
      return this.router.transitionTo('system-admin.login');
    }
    
    try {
      const userData = JSON.parse(user);
      if (userData.userType === 'system_admin') {
        return this.router.transitionTo('system-admin.dashboard');
      } else {
        // Not a system admin, redirect to login
        return this.router.transitionTo('system-admin.login');
      }
    } catch (error) {
      // Invalid user data, redirect to login
      return this.router.transitionTo('system-admin.login');
    }
  }
}