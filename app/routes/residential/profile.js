import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class ResidentialProfileRoute extends Route {
  @service router;
  @service('current-property') currentProperty;

  async beforeModel(transition) {
    // Verify authentication and user type
    const token = localStorage.getItem('auth_token');
    const userType = localStorage.getItem('user_type');

    if (!token || userType !== 'residential') {
      this.router.transitionTo('home');
      return;
    }

    try {
      // Verify token is still valid
      const response = await fetch(`${config.APP.API_HOST}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const { user } = await response.json();
      if (user.userType !== 'residential') {
        this.router.transitionTo('home');
        return;
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_type');
      this.router.transitionTo('home');
    }
  }

  async model() {
    const token = localStorage.getItem('auth_token');

    try {
      // Fetch user profile data
      const userResponse = await fetch(`${config.APP.API_HOST}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error('Failed to load user profile');
      }

      const { user } = await userResponse.json();

      // Also fetch properties for the profile
      const properties = this.currentProperty.userProperties || [];

      return {
        user: user,
        properties: properties,
        municipality: this.currentProperty.currentMunicipality,
      };
    } catch (error) {
      console.error('Error loading profile data:', error);
      return {
        user: null,
        properties: [],
        municipality: null,
        error: error.message,
      };
    }
  }
}
