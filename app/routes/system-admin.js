import Route from '@ember/routing/route';

export default class SystemAdminRoute extends Route {
  // Redirect to login if not authenticated, otherwise to dashboard
  beforeModel() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
      this.transitionTo('system-admin.login');
      return;
    }
    
    try {
      const userData = JSON.parse(user);
      if (userData.userType === 'system_admin') {
        this.transitionTo('system-admin.dashboard');
      } else {
        // Not a system admin, redirect to login
        this.transitionTo('system-admin.login');
      }
    } catch (error) {
      // Invalid user data, redirect to login
      this.transitionTo('system-admin.login');
    }
  }
}