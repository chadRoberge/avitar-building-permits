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

      console.log('Residential dashboard loading - user:', userId, 'token exists:', !!token);

      if (!token || !userId) {
        throw new Error('Missing authentication credentials');
      }

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
        console.log('Loaded permits:', permits.length, 'for user:', userId, 'property:', currentPropertyId);
      } else {
        console.warn('Could not fetch permits:', permitsResponse.status);
        const errorText = await permitsResponse.text();
        console.warn('Error response:', errorText);
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
        console.log('Loaded contractors:', contractors.length);
      } else {
        console.warn(
          'Could not fetch contractors:',
          contractorsResponse.status,
        );
        contractors = [];
      }

      // Standardized permit status filtering to match permits index structure
      const pending = permits.filter((p) => 
        ['pending', 'submitted', 'under-review'].includes(p.status)
      );
      const approved = permits.filter((p) => p.status === 'approved');
      const active = permits.filter((p) => 
        ['active', 'inspections'].includes(p.status)
      );
      const completed = permits.filter((p) => 
        ['completed', 'closed', 'finalized'].includes(p.status)
      );
      const denied = permits.filter((p) => p.status === 'denied');
      const expired = permits.filter((p) => p.status === 'expired');

      console.log('Permit status breakdown:', {
        total: permits.length,
        pending: pending.length,
        approved: approved.length,
        active: active.length,
        completed: completed.length,
        denied: denied.length,
        expired: expired.length,
        rawStatuses: permits.map(p => p.status)
      });

      return {
        ...parentModel,
        permits: {
          all: permits,
          pending,
          approved,
          active,
          completed,
          denied,
          expired,
        },
        contractors: contractors,
        summary: {
          totalPermits: permits.length,
          activePermits: approved.length + active.length, // Combined active permits
          pendingPermits: pending.length,
          totalContractors: contractors.length,
        },
        isLoaded: true,
        loadError: null,
      };
    } catch (error) {
      console.error('Error loading dashboard data:', error);

      // Return basic model with empty data and error info
      return {
        ...parentModel,
        permits: { all: [], pending: [], approved: [], active: [], completed: [], denied: [], expired: [] },
        contractors: [],
        summary: {
          totalPermits: 0,
          activePermits: 0,
          pendingPermits: 0,
          totalContractors: 0,
        },
        isLoaded: false,
        loadError: error.message,
      };
    }
  }
}
