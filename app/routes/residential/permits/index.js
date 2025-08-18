import Route from '@ember/routing/route';
import config from 'avitar-building-permits/config/environment';

export default class ResidentialPermitsIndexRoute extends Route {
  async model() {
    const parentModel = this.modelFor('residential');

    try {
      const token = localStorage.getItem('auth_token');
      const userId = localStorage.getItem('user_id');

      // Fetch permits for this user
      const permitsResponse = await fetch(
        `${config.APP.API_HOST}/api/permits/user/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      let permits = [];
      if (permitsResponse.ok) {
        permits = await permitsResponse.json();
      } else {
        console.warn('Could not fetch permits:', permitsResponse.status);
      }

      return {
        ...parentModel,
        permits: {
          all: permits,
          pending: permits.filter(
            (p) => p.status === 'pending' || p.status === 'submitted',
          ),
          approved: permits.filter((p) => p.status === 'approved'),
          active: permits.filter((p) => p.status === 'active'),
          completed: permits.filter(
            (p) => p.status === 'completed' || p.status === 'closed',
          ),
          denied: permits.filter((p) => p.status === 'denied'),
          expired: permits.filter((p) => p.status === 'expired'),
        },
      };
    } catch (error) {
      console.error('Error loading permits:', error);

      return {
        ...parentModel,
        permits: {
          all: [],
          pending: [],
          approved: [],
          active: [],
          completed: [],
          denied: [],
          expired: [],
        },
      };
    }
  }
}
