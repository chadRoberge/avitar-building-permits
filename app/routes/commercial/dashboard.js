import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class CommercialDashboardRoute extends Route {
  @service router;

  // Check authentication
  beforeModel() {
    const authToken = localStorage.getItem('auth_token');
    const userType = localStorage.getItem('user_type');

    if (!authToken || userType !== 'commercial') {
      this.router.transitionTo('home');
      return;
    }
  }

  async model() {
    try {
      const authToken = localStorage.getItem('auth_token');
      
      // Fetch user profile and municipalities in parallel
      const [userResponse, municipalitiesResponse] = await Promise.all([
        fetch(`${config.APP.API_HOST}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${config.APP.API_HOST}/api/municipalities`, {
          headers: {
            'Content-Type': 'application/json',
          },
        })
      ]);

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user data');
      }

      const user = await userResponse.json();
      let municipalities = [];

      if (municipalitiesResponse.ok) {
        municipalities = await municipalitiesResponse.json();
      }

      // Store user details in localStorage
      localStorage.setItem('user_details', JSON.stringify(user));

      return {
        user,
        municipalities,
        selectedMunicipality: null,
        permits: [],
        stats: {
          totalPermits: 0,
          pendingPermits: 0,
          approvedPermits: 0,
          activeProjects: 0,
        },
      };
    } catch (error) {
      console.error('Error loading commercial dashboard data:', error);
      
      // Fallback data
      return {
        user: JSON.parse(localStorage.getItem('user_details') || '{}'),
        municipalities: [],
        selectedMunicipality: null,
        permits: [],
        stats: {
          totalPermits: 0,
          pendingPermits: 0,
          approvedPermits: 0,
          activeProjects: 0,
        },
        error: error.message,
      };
    }
  }

  setupController(controller, model) {
    super.setupController(controller, model);
    
    // Initialize municipality selection after model is loaded
    setTimeout(() => {
      controller.onModelLoaded();
    }, 100);
  }
}