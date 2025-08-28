import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class CommercialProfileRoute extends Route {
  @service router;

  async model() {
    const authToken = localStorage.getItem('auth_token');
    const userType = localStorage.getItem('user_type');

    if (!authToken || userType !== 'commercial') {
      this.router.transitionTo('home');
      return;
    }

    try {
      // Fetch user profile, billing info, and available plans in parallel
      const [userResponse, billingResponse, plansResponse, historyResponse] = await Promise.all([
        fetch(`${config.APP.API_HOST}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${config.APP.API_HOST}/api/billing`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${config.APP.API_HOST}/api/billing/public-plans/commercial`, {
          headers: {
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${config.APP.API_HOST}/api/billing/history`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        })
      ]);

      let currentUser = JSON.parse(localStorage.getItem('user_details') || '{}');
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        // API returns { user: userObject }, so extract the user
        currentUser = userData.user || userData;
      }
      
      let billingInfo = null;
      if (billingResponse.ok) {
        billingInfo = await billingResponse.json();
      }

      let availablePlans = [];
      if (plansResponse.ok) {
        availablePlans = await plansResponse.json();
      }

      let billingHistory = [];
      if (historyResponse.ok) {
        billingHistory = await historyResponse.json();
      }

      // Update localStorage with fresh user data
      localStorage.setItem('user_details', JSON.stringify(currentUser));

      return {
        currentUser,
        billingInfo,
        availablePlans,
        billingHistory
      };
    } catch (error) {
      console.error('Error loading profile data:', error);
      
      // Fallback to localStorage data
      return {
        currentUser: JSON.parse(localStorage.getItem('user_details') || '{}'),
        billingInfo: null,
        availablePlans: [],
        billingHistory: [],
        error: error.message
      };
    }
  }
}