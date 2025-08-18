import Route from '@ember/routing/route';
import { service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class ResidentialBillingRoute extends Route {
  @service router;

  async beforeModel(transition) {
    // Verify authentication and user type
    const token = localStorage.getItem('auth_token');
    const userType = localStorage.getItem('user_type');
    
    if (!token || userType !== 'residential') {
      this.router.transitionTo('auth');
      return;
    }

    try {
      // Verify token is still valid
      const response = await fetch(`${config.APP.API_HOST}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const userData = await response.json();
      if (userData.userType !== 'residential') {
        this.router.transitionTo('auth');
        return;
      }

    } catch (error) {
      console.error('Authentication check failed:', error);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_type');
      this.router.transitionTo('auth');
    }
  }

  async model() {
    // The billing-management component will handle loading its own data
    return {};
  }
}