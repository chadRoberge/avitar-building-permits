import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class AuthRoute extends Route {
  @service router;
  queryParams = {
    municipality_id: {
      refreshModel: true,
    },
    user_type: {
      refreshModel: true,
    },
  };

  async model(params, transition) {
    const { municipality_id, user_type } = transition.to.queryParams;

    if (!municipality_id) {
      // Redirect back to home if no municipality selected
      this.router.transitionTo('home');
      return;
    }

    try {
      // Fetch municipality data from backend API
      const response = await fetch(
        `${config.APP.API_HOST}/api/municipalities/${municipality_id}`,
      );

      if (!response.ok) {
        throw new Error(`Failed to load municipality: ${response.status}`);
      }

      const municipality = await response.json();
      console.log('Loaded municipality for auth:', municipality);

      return {
        municipality: {
          id: municipality._id,
          name: municipality.name,
          city: municipality.address.city,
          state: municipality.address.state,
          zip: municipality.address.zip,
          type: municipality.type,
          population: municipality.population,
          fullMunicipality: municipality,
        },
        userType: user_type || 'residential',
      };
    } catch (error) {
      console.error('Error loading municipality for auth:', error);

      // Redirect back to home on error
      this.router.transitionTo('home');
      return;
    }
  }
}
