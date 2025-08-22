import Route from '@ember/routing/route';
import config from 'avitar-building-permits/config/environment';

export default class MunicipalPermitsViewRoute extends Route {
  async model(params) {
    const parentModel = this.modelFor('municipal');

    try {
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        throw new Error('No authentication token');
      }

      console.log('Loading permit details for:', params.permit_id);

      // Fetch current user data
      const userResponse = await fetch(`${config.APP.API_HOST}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      let currentUser = {};
      if (userResponse.ok) {
        const userData = await userResponse.json();
        currentUser = userData.user;
        console.log('Loaded current user for permits view:', currentUser);
      } else {
        console.warn('Could not fetch current user:', userResponse.status);
      }

      // Fetch permit details
      const permitResponse = await fetch(`${config.APP.API_HOST}/api/permits/${params.permit_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (!permitResponse.ok) {
        throw new Error(`Failed to load permit: ${permitResponse.status}`);
      }

      const permit = await permitResponse.json();
      console.log('Loaded permit:', permit);

      // Fetch permit messages/chat
      const messagesResponse = await fetch(`${config.APP.API_HOST}/api/permit-messages/${params.permit_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      let messages = [];
      if (messagesResponse.ok) {
        messages = await messagesResponse.json();
        console.log('Loaded messages:', messages.length);
      } else {
        console.warn('Could not fetch messages:', messagesResponse.status);
      }

      // Fetch permit files
      const filesResponse = await fetch(`${config.APP.API_HOST}/api/permits/${params.permit_id}/files`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      let files = [];
      if (filesResponse.ok) {
        files = await filesResponse.json();
        console.log('Loaded files:', files.length);
      } else {
        console.warn('Could not fetch files:', filesResponse.status);
      }

      // Fetch department reviews
      const departmentReviewsResponse = await fetch(`${config.APP.API_HOST}/api/permits/${params.permit_id}/department-reviews`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      let departmentReviews = null;
      if (departmentReviewsResponse.ok) {
        departmentReviews = await departmentReviewsResponse.json();
        console.log('Loaded department reviews:', departmentReviews);
      } else {
        console.warn('Could not fetch department reviews:', departmentReviewsResponse.status);
        // Set empty department reviews structure as fallback
        departmentReviews = {
          departmentReviews: [],
          requiredDepartments: [],
          pendingDepartments: [],
          approvedDepartments: [],
          canCurrentUserReview: false
        };
      }

      return {
        ...parentModel,
        user: currentUser,
        permit,
        messages,
        files,
        departmentReviews,
        isReviewMode: true
      };
    } catch (error) {
      console.error('Error loading municipal permit view:', error);
      throw error;
    }
  }
}