import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class ResidentialPermitsIndexRoute extends Route {
  @service currentProperty;

  async model() {
    const parentModel = this.modelFor('residential');

    try {
      const token = localStorage.getItem('auth_token');
      const userId = localStorage.getItem('user_id');

      console.log('Permits index loading - user:', userId, 'token exists:', !!token);

      // Get current property ID for filtering (same as dashboard)
      const currentPropertyId = this.currentProperty.currentPropertyId;
      console.log('Current property ID:', currentPropertyId);

      // Fetch permits for this user - if property selected, filter by property
      let permitsUrl = `${config.APP.API_HOST}/api/permits/user/${userId}`;
      if (currentPropertyId) {
        permitsUrl += `?propertyId=${currentPropertyId}`;
      }

      console.log('Fetching permits from URL:', permitsUrl);

      const permitsResponse = await fetch(permitsUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      let permits = [];
      if (permitsResponse.ok) {
        permits = await permitsResponse.json();
        console.log('PERMITS INDEX: Successfully loaded permits:', permits.length, 'for user:', userId);
        console.log('PERMITS INDEX: Raw permits data:', permits);
      } else {
        console.warn('PERMITS INDEX: Could not fetch permits:', permitsResponse.status);
        const errorText = await permitsResponse.text();
        console.warn('PERMITS INDEX: Error response:', errorText);
      }

      // Enhanced permit status filtering to match the actual statuses from the API
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

      console.log('PERMITS INDEX: Permit status breakdown:', {
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
