import Route from '@ember/routing/route';
import config from 'avitar-building-permits/config/environment';

export default class MunicipalSettingsRoute extends Route {
  async model() {
    const parentModel = this.modelFor('municipal');
    
    try {
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        throw new Error('No authentication token');
      }

      // Check if current user has admin permissions
      const currentUser = JSON.parse(localStorage.getItem('user_details') || '{}');
      if (!currentUser.permissionLevel || currentUser.permissionLevel < 21) {
        // Redirect non-admin users to dashboard
        this.router.transitionTo('municipal.dashboard');
        return;
      }

      // Fetch users for this municipality
      const usersResponse = await fetch(`${config.APP.API_HOST}/api/users/municipality`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      let users = [];
      if (usersResponse.ok) {
        users = await usersResponse.json();
        console.log('Loaded municipal users:', users.length);
      } else {
        console.warn('Could not fetch municipal users:', usersResponse.status);
      }

      // Fetch municipality settings/configuration
      const settingsResponse = await fetch(`${config.APP.API_HOST}/api/municipalities/settings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      let municipalitySettings = {};
      if (settingsResponse.ok) {
        municipalitySettings = await settingsResponse.json();
        console.log('Loaded municipality settings:', municipalitySettings);
      } else {
        console.warn('Could not fetch municipality settings:', settingsResponse.status);
      }

      return {
        ...parentModel,
        users,
        municipalitySettings,
        currentUser
      };
    } catch (error) {
      console.error('Error loading municipal settings:', error);
      throw error;
    }
  }
}