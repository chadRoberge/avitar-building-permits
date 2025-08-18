import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class ResidentialPermitsViewRoute extends Route {
  @service currentProperty;

  async model(params) {
    const parentModel = this.modelFor('residential');
    
    try {
      const token = localStorage.getItem('auth_token');
      const { permit_id } = params;
      
      // Fetch the specific permit details
      const permitResponse = await fetch(`${config.APP.API_HOST}/api/permits/${permit_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!permitResponse.ok) {
        if (permitResponse.status === 404) {
          throw new Error('Permit not found');
        }
        throw new Error('Failed to load permit details');
      }
      
      const permit = await permitResponse.json();
      
      return {
        ...parentModel,
        permit: permit
      };
      
    } catch (error) {
      console.error('Error loading permit details:', error);
      
      // Return basic model with error
      return {
        ...parentModel,
        permit: null,
        error: error.message
      };
    }
  }
}