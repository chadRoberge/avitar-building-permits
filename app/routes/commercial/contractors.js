import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class CommercialContractorsRoute extends Route {
  @service router;

  async model() {
    const authToken = localStorage.getItem('auth_token');
    const userType = localStorage.getItem('user_type');

    if (!authToken || userType !== 'commercial') {
      this.router.transitionTo('home');
      return;
    }

    try {
      // Load municipalities for contractor lookup
      const municipalitiesResponse = await fetch(`${config.APP.API_HOST}/api/municipalities`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      let municipalities = [];
      if (municipalitiesResponse.ok) {
        municipalities = await municipalitiesResponse.json();
        console.log('Loaded municipalities for contractor lookup:', municipalities.length);
      } else {
        console.error('Failed to load municipalities:', municipalitiesResponse.status);
      }

      return {
        municipalities: municipalities,
        currentUser: this.getCurrentUser()
      };
    } catch (error) {
      console.error('Error loading contractor lookup page:', error);
      return {
        municipalities: [],
        currentUser: this.getCurrentUser(),
        error: error.message
      };
    }
  }

  getCurrentUser() {
    const userDetails = localStorage.getItem('user_details');
    return userDetails ? JSON.parse(userDetails) : {};
  }
}