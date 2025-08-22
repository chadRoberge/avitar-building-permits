import Route from '@ember/routing/route';
import config from 'avitar-building-permits/config/environment';

export default class MunicipalPermitsIndexRoute extends Route {
  queryParams = {
    status: { refreshModel: true },
    search: { refreshModel: true }
  };

  async model(params) {
    const parentModel = this.modelFor('municipal');
    console.log('Municipal permits route - parent model:', parentModel);

    try {
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        throw new Error('No authentication token');
      }

      // Build query parameters (don't filter by status on server - we need all permits for the summary cards)
      const queryParams = new URLSearchParams();
      if (params.search) {
        queryParams.append('search', params.search);
      }

      const queryString = queryParams.toString();
      const url = `${config.APP.API_HOST}/api/permits/municipality/${parentModel.municipality._id}${queryString ? '?' + queryString : ''}`;

      // Fetch permits for this municipality
      console.log('Fetching permits from URL:', url);
      const permitsResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      let permits = [];
      if (permitsResponse.ok) {
        permits = await permitsResponse.json();
        console.log('Fetched permits:', permits.length, permits);
      } else {
        console.warn('Could not fetch permits:', permitsResponse.status);
        const errorText = await permitsResponse.text();
        console.warn('Error response:', errorText);
      }

      // Debug the filtering
      const submittedPermits = permits.filter(p => p.status === 'submitted');
      console.log('Submitted permits after filtering:', submittedPermits.length, submittedPermits);
      
      const permitsByStatus = {
        all: permits,
        submitted: submittedPermits,
        'under-review': permits.filter(p => p.status === 'under-review'),
        approved: permits.filter(p => p.status === 'approved'),
        active: permits.filter(p => p.status === 'active'),
        inspections: permits.filter(p => p.status === 'inspections'),
        completed: permits.filter(p => p.status === 'completed'),
        denied: permits.filter(p => p.status === 'denied'),
        expired: permits.filter(p => p.status === 'expired'),
      };
      
      console.log('All permits by status:', {
        all: permitsByStatus.all.length,
        submitted: permitsByStatus.submitted.length,
        'under-review': permitsByStatus['under-review'].length,
        approved: permitsByStatus.approved.length,
      });

      return {
        ...parentModel,
        permits: permitsByStatus,
        selectedStatus: params.status || 'all',
        searchTerm: params.search || ''
      };
    } catch (error) {
      console.error('Error loading municipal permits:', error);

      return {
        ...parentModel,
        permits: {
          all: [],
          submitted: [],
          'under-review': [],
          approved: [],
          active: [],
          inspections: [],
          completed: [],
          denied: [],
          expired: [],
        },
        selectedStatus: params.status || 'all',
        searchTerm: params.search || '',
        error: error.message
      };
    }
  }
}