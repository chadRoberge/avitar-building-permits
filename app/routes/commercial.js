import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class CommercialRoute extends Route {
  @service router;

  // Check authentication for all commercial routes
  beforeModel() {
    const authToken = localStorage.getItem('auth_token');
    const userType = localStorage.getItem('user_type');

    if (!authToken || userType !== 'commercial') {
      this.router.transitionTo('home');
      return;
    }
  }

  async model() {
    const authToken = localStorage.getItem('auth_token');
    const userDetails = localStorage.getItem('user_details');
    
    try {
      // Load municipalities for the dropdown
      const municipalitiesResponse = await fetch(`${config.APP.API_HOST}/api/municipalities`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      let municipalities = [];
      if (municipalitiesResponse.ok) {
        municipalities = await municipalitiesResponse.json();
        console.log('Loaded municipalities for commercial app:', municipalities.length);
      } else {
        console.error('Failed to load municipalities:', municipalitiesResponse.status);
      }

      return {
        currentUser: userDetails ? JSON.parse(userDetails) : {},
        municipalities: municipalities
      };
    } catch (error) {
      console.error('Error loading commercial app data:', error);
      return {
        currentUser: userDetails ? JSON.parse(userDetails) : {},
        municipalities: [],
        error: error.message
      };
    }
  }

  setupController(controller, model) {
    super.setupController(controller, model);
    
    // Auto-select municipality after model is set
    setTimeout(() => {
      controller.autoSelectMunicipality();
    }, 100);
  }
}