import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class MunicipalRoute extends Route {
  @service router;
  
  beforeModel() {
    // Check for authentication token
    const token = localStorage.getItem('auth_token');
    console.log('Municipal route beforeModel - token exists:', !!token);
    
    if (!token) {
      console.log('No auth token found, redirecting to admin login');
      this.router.transitionTo('admin');
      return;
    }
    
    console.log('Auth token found, proceeding to municipal portal');
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
          'Authorization': `Bearer ${token}`
        }
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
      console.log('Loaded user data:', user);

      // Ensure user is municipal staff
      if (user.userType !== 'municipal') {
        throw new Error('Access denied: Not a municipal user');
      }

      // Check if we have a selected municipality (from portal flow)
      const currentMunicipalityId = localStorage.getItem('current_municipality_id');
      let municipality = user.municipality;

      if (currentMunicipalityId && currentMunicipalityId !== user.municipality._id) {
        // Fetch the selected municipality data
        try {
          const municipalityResponse = await fetch(`${config.APP.API_HOST}/api/municipalities/${currentMunicipalityId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (municipalityResponse.ok) {
            municipality = await municipalityResponse.json();
            console.log('Using selected municipality:', municipality.name);
          } else {
            console.warn('Failed to fetch selected municipality, using user default');
          }
        } catch (error) {
          console.warn('Error fetching selected municipality:', error);
        }
      }

      return {
        user: user,
        municipality: municipality
      };

    } catch (error) {
      console.error('Error loading municipal data:', error);
      
      // Redirect to login on error
      localStorage.removeItem('auth_token');
      this.router.transitionTo('admin');
      return;
    }
  }
}