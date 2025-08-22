import Route from '@ember/routing/route';
import { tracked } from '@glimmer/tracking';
import config from 'avitar-building-permits/config/environment';

export default class MunicipalProfileRoute extends Route {
  async model() {
    const parentModel = this.modelFor('municipal');
    
    try {
      const token = localStorage.getItem('auth_token');
      const userId = localStorage.getItem('user_id');
      
      if (!token || !userId) {
        throw new Error('Authentication required');
      }

      // Fetch current user profile details
      const userResponse = await fetch(`${config.APP.API_HOST}/api/users/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      let userProfile = {};
      if (userResponse.ok) {
        userProfile = await userResponse.json();
        console.log('Loaded fresh user profile:', userProfile);
        
        // Update localStorage with fresh data
        localStorage.setItem('user_details', JSON.stringify(userProfile));
      } else {
        console.warn('Could not fetch user profile:', userResponse.status);
        // Fallback to local storage data
        const storedData = localStorage.getItem('user_details');
        userProfile = storedData ? JSON.parse(storedData) : {};
        
        // If no stored data, try to get from auth response
        if (!userProfile.email && parentModel?.user) {
          userProfile = parentModel.user;
        }
        
        // Ensure we have a valid permission level for fallback
        if (!userProfile.permissionLevel) {
          userProfile.permissionLevel = 11; // Default to Municipal Basic User
          console.warn('No permission level found, defaulting to 11');
        }
        
        console.log('Using fallback user profile:', userProfile);
      }

      // Create mock user activity data based on user level
      // TODO: Implement real activity tracking API endpoint
      let userActivity = {
        permitReviews: 0,
        inspectionCount: 0,
        departmentReviews: 0,
        recentActivity: []
      };

      // Provide realistic mock data based on permission level
      if (userProfile.permissionLevel >= 15) {
        userActivity.permitReviews = Math.floor(Math.random() * 50) + 10;
        userActivity.inspectionCount = Math.floor(Math.random() * 30) + 5;
      }
      if (userProfile.permissionLevel >= 17) {
        userActivity.departmentReviews = Math.floor(Math.random() * 20) + 3;
      }

      console.log('Generated user activity:', userActivity);

      return {
        ...parentModel,
        userProfile,
        userActivity
      };
    } catch (error) {
      console.error('Error loading municipal profile:', error);
      
      // Provide fallback data
      let fallbackProfile = JSON.parse(localStorage.getItem('user_details') || '{}');
      if (!fallbackProfile.permissionLevel) {
        fallbackProfile.permissionLevel = 11; // Default to Municipal Basic User
        console.warn('No permission level in fallback, defaulting to 11');
      }
      
      return {
        ...this.modelFor('municipal'),
        userProfile: fallbackProfile,
        userActivity: {
          permitReviews: 0,
          inspectionCount: 0,
          departmentReviews: 0,
          recentActivity: []
        }
      };
    }
  }
}