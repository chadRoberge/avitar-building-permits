import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class ResidentialDashboardRoute extends Route {
  @service currentProperty;

  async model() {
    const parentModel = this.modelFor('residential');

    try {
      const token = localStorage.getItem('auth_token');
      const userId = localStorage.getItem('user_id');

      // Get current property ID for filtering
      const currentPropertyId = this.currentProperty.currentPropertyId;

      // Fetch permits for this user - if property selected, filter by property
      let permitsUrl = `${config.APP.API_HOST}/api/permits/user/${userId}`;
      if (currentPropertyId) {
        permitsUrl += `?propertyId=${currentPropertyId}`;
      }

      const permitsResponse = await fetch(permitsUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      let permits = [];
      if (permitsResponse.ok) {
        permits = await permitsResponse.json();
      } else {
        console.warn('Could not fetch permits:', permitsResponse.status);
      }

      // Fetch commercial contractors who have worked at this property
      let contractorsUrl = `${config.APP.API_HOST}/api/contractors/property/${userId}`;
      if (currentPropertyId) {
        contractorsUrl = `${config.APP.API_HOST}/api/contractors/property/${currentPropertyId}`;
      }

      const contractorsResponse = await fetch(contractorsUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      let contractors = [];
      if (contractorsResponse.ok) {
        contractors = await contractorsResponse.json();
      } else {
        console.warn(
          'Could not fetch contractors:',
          contractorsResponse.status,
        );
        // For now, create some mock data
        contractors = [];
      }

      return {
        ...parentModel,
        permits: {
          all: permits,
          pending: permits.filter(
            (p) => p.status === 'pending' || p.status === 'submitted',
          ),
          current: permits.filter(
            (p) => p.status === 'approved' || p.status === 'active',
          ),
          completed: permits.filter(
            (p) => p.status === 'completed' || p.status === 'closed',
          ),
        },
        contractors: contractors,
        summary: {
          totalPermits: permits.length,
          activePermits: permits.filter((p) =>
            ['approved', 'active'].includes(p.status),
          ).length,
          pendingPermits: permits.filter((p) =>
            ['pending', 'submitted'].includes(p.status),
          ).length,
          totalContractors: contractors.length,
        },
      };
    } catch (error) {
      console.error('Error loading dashboard data:', error);

      // Return basic model with empty data
      return {
        ...parentModel,
        permits: { all: [], pending: [], current: [], completed: [] },
        contractors: [],
        summary: {
          totalPermits: 0,
          activePermits: 0,
          pendingPermits: 0,
          totalContractors: 0,
        },
      };
    }
  }
}
