import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class ResidentialRoute extends Route {
  @service router;
  @service currentProperty;

  beforeModel() {
    // Check for authentication token
    const token = localStorage.getItem('auth_token');
    const userType = localStorage.getItem('user_type');

    console.log(
      'Residential route beforeModel - token exists:',
      !!token,
      'userType:',
      userType,
    );

    if (!token) {
      console.log('No auth token found, redirecting to home');
      this.router.transitionTo('home');
      return;
    }

    // Ensure user is residential
    if (userType !== 'residential') {
      console.log('User is not residential type, redirecting to home');
      this.router.transitionTo('home');
      return;
    }

    console.log('Auth token found for residential user, proceeding');
  }

  async model() {
    try {
      // Get auth token
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token');
      }

      // Fetch current user data from API
      const response = await fetch(`${config.APP.API_HOST}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch user data, status:', response.status);
        if (response.status === 401) {
          // Token is invalid/expired, clear it and redirect
          localStorage.clear();
          throw new Error('Authentication token expired');
        }
        throw new Error(`Failed to fetch user data: ${response.status}`);
      }

      const { user } = await response.json();
      console.log('Loaded residential user data:', user);

      // Ensure user is residential
      if (user.userType !== 'residential') {
        throw new Error('Access denied: Not a residential user');
      }

      // Initialize current property service
      await this.currentProperty.initialize(user._id);

      // Get municipality data - first try from user, then from current property
      let municipality = user.municipality;
      if (!municipality && this.currentProperty.currentMunicipality) {
        municipality = this.currentProperty.currentMunicipality;
      }

      return {
        user: user,
        municipality: municipality,
        property: this.currentProperty.currentProperty,
      };
    } catch (error) {
      console.error('Error loading residential data:', error);

      // Redirect to home on error
      localStorage.removeItem('auth_token');
      this.router.transitionTo('home');
      return;
    }
  }
}
