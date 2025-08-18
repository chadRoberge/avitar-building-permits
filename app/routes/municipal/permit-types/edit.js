import Route from '@ember/routing/route';
import config from 'avitar-building-permits/config/environment';

export default class MunicipalPermitTypesEditRoute extends Route {
  async model(params) {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        this.router.transitionTo('admin');
        return null;
      }

      const response = await fetch(`${config.APP.API_HOST}/api/permit-types/${params.permit_type_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error('Failed to load permit type, status:', response.status);
        throw new Error(`Failed to load permit type: ${response.status}`);
      }

      const permitType = await response.json();
      console.log('Loaded permit type:', permitType);
      return { permitType };
    } catch (error) {
      console.error('Error loading permit type:', error);
      this.router.transitionTo('municipal.permit-types.index');
      return null;
    }
  }

  setupController(controller, model) {
    super.setupController(controller, model);
    
    // Initialize the form with the loaded permit type data
    if (model && model.permitType) {
      console.log('Setting up controller with permit type:', model.permitType);
      controller.initializeForm(model.permitType);
    } else {
      console.error('No permit type data available in setupController');
    }
  }
}