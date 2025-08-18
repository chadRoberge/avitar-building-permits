import Route from '@ember/routing/route';
import config from 'avitar-building-permits/config/environment';

export default class MunicipalPortalRoute extends Route {
  async model(params) {
    try {
      // Fetch municipality data from backend API
      const response = await fetch(
        `${config.APP.API_HOST}/api/municipalities/${params.municipality_id}`,
      );

      if (!response.ok) {
        throw new Error(`Failed to load municipality: ${response.status}`);
      }

      const municipality = await response.json();
      console.log('Loaded municipality for portal:', municipality);

      return {
        id: municipality._id,
        name: municipality.name,
        city: municipality.address.city,
        state: municipality.address.state,
        zip: municipality.address.zip,
        type: municipality.type,
        population: municipality.population,
        fullMunicipality: municipality,
      };
    } catch (error) {
      console.error('Error loading municipality:', error);

      // Fallback to default if API fails
      return {
        id: params.municipality_id,
        name: 'Municipality',
        city: 'Unknown',
        state: 'NH',
        zip: '00000',
        error: true,
      };
    }
  }
}
