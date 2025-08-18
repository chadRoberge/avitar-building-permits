import Route from '@ember/routing/route';
import config from 'avitar-building-permits/config/environment';

export default class ResidentialPermitsNewRoute extends Route {
  async model() {
    const parentModel = this.modelFor('residential');
    
    try {
      const token = localStorage.getItem('auth_token');
      const municipalityId = localStorage.getItem('municipality_id');
      
      // Fetch available permit types for this municipality
      const permitTypesResponse = await fetch(`${config.APP.API_HOST}/api/permit-types?municipality=${municipalityId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      let permitTypes = [];
      if (permitTypesResponse.ok) {
        permitTypes = await permitTypesResponse.json();
        // Filter for active permit types only
        permitTypes = permitTypes.filter(type => type.isActive);
      } else {
        console.warn('Could not fetch permit types:', permitTypesResponse.status);
      }

      return {
        ...parentModel,
        permitTypes: permitTypes
      };
      
    } catch (error) {
      console.error('Error loading permit application data:', error);
      
      // Return basic model with empty data
      return {
        ...parentModel,
        permitTypes: []
      };
    }
  }
}