import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import config from 'avitar-building-permits/config/environment';

export default class CurrentPropertyService extends Service {
  @tracked currentProperty = null;
  @tracked userProperties = [];
  @tracked isLoading = false;
  @tracked error = null;

  // Initialize the service by loading user's properties
  async initialize(userId) {
    if (this.isLoading) return;
    
    this.isLoading = true;
    this.error = null;

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Get current municipality ID to filter properties
      let municipalityId = localStorage.getItem('municipality_id');
      
      // Handle case where municipality_id might be stored as an object
      if (municipalityId && municipalityId.startsWith('[object')) {
        console.warn('municipality_id appears to be an object, clearing it');
        localStorage.removeItem('municipality_id');
        municipalityId = null;
      }
      const url = municipalityId 
        ? `${config.APP.API_HOST}/api/properties/user/${userId}?municipalityId=${municipalityId}`
        : `${config.APP.API_HOST}/api/properties/user/${userId}`;

      // Fetch user properties (filtered by municipality if available)
      const propertiesResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!propertiesResponse.ok) {
        throw new Error('Failed to fetch properties');
      }

      this.userProperties = await propertiesResponse.json();

      // Set current property based on priority:
      // 1. Previously selected property (from localStorage)
      // 2. Primary property 
      // 3. First available property
      const savedPropertyId = localStorage.getItem('current_property_id');
      let selectedProperty = null;
      
      if (savedPropertyId) {
        selectedProperty = this.userProperties.find(p => p._id === savedPropertyId);
      }
      
      if (!selectedProperty) {
        const primaryProperty = this.userProperties.find(p => p.isPrimary);
        selectedProperty = primaryProperty || this.userProperties[0] || null;
      }
      
      this.currentProperty = selectedProperty;

      // Store current property ID in localStorage for persistence
      if (this.currentProperty) {
        localStorage.setItem('current_property_id', this.currentProperty._id);
      }

    } catch (error) {
      console.error('Error initializing properties:', error);
      this.error = error.message;
      
      // Fallback: try to load from existing user data
      await this._createPropertyFromUserData(userId);
    } finally {
      this.isLoading = false;
    }
  }

  // Create a property from existing user data (migration helper)
  async _createPropertyFromUserData(userId) {
    try {
      const token = localStorage.getItem('auth_token');
      let municipalityId = localStorage.getItem('municipality_id');
      
      // Handle case where municipality_id might be stored as an object
      if (municipalityId && municipalityId.startsWith('[object')) {
        console.warn('municipality_id appears to be an object, clearing it');
        localStorage.removeItem('municipality_id');
        municipalityId = null;
      }
      
      // Get user data to extract property address
      const userResponse = await fetch(`${config.APP.API_HOST}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        
        if (userData.propertyAddress && userData.propertyAddress.street) {
          // Create property from user's property address
          const propertyData = {
            displayName: userData.propertyAddress.street,
            address: userData.propertyAddress,
            municipalityId: municipalityId,
            propertyType: 'residential',
            isPrimary: true
          };

          const createResponse = await fetch(`${config.APP.API_HOST}/api/properties`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(propertyData)
          });

          if (createResponse.ok) {
            const result = await createResponse.json();
            this.currentProperty = result.property;
            this.userProperties = [result.property];
            localStorage.setItem('current_property_id', result.property._id);
          }
        }
      }
    } catch (error) {
      console.error('Error creating property from user data:', error);
    }
  }

  // Switch to a different property
  @action
  async switchProperty(propertyId) {
    const property = this.userProperties.find(p => p._id === propertyId);
    if (property) {
      this.currentProperty = property;
      localStorage.setItem('current_property_id', propertyId);
      
      // Emit event for other parts of the app to react to property change
      window.dispatchEvent(new CustomEvent('property-changed', { 
        detail: { property: this.currentProperty } 
      }));
    }
  }

  // Add a new property
  @action
  async addProperty(propertyData) {
    this.isLoading = true;
    this.error = null;

    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`${config.APP.API_HOST}/api/properties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(propertyData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add property');
      }

      const result = await response.json();
      
      // Add to properties list
      this.userProperties = [...this.userProperties, result.property];
      
      // If this is set as primary or it's the first property, make it current
      if (result.property.isPrimary || this.userProperties.length === 1) {
        this.currentProperty = result.property;
        localStorage.setItem('current_property_id', result.property._id);
      }

      return result;

    } catch (error) {
      console.error('Error adding property:', error);
      this.error = error.message;
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Set a property as primary
  @action
  async setPrimary(propertyId) {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`${config.APP.API_HOST}/api/properties/${propertyId}/set-primary`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to set primary property');
      }

      const result = await response.json();
      
      // Update properties list
      this.userProperties = this.userProperties.map(p => ({
        ...p,
        isPrimary: p._id === propertyId
      }));
      
      // Set as current property
      this.currentProperty = result.property;
      localStorage.setItem('current_property_id', propertyId);

      return result;

    } catch (error) {
      console.error('Error setting primary property:', error);
      this.error = error.message;
      throw error;
    }
  }

  // Get formatted address for display
  get currentPropertyAddress() {
    if (!this.currentProperty) return 'No Property Selected';
    
    const addr = this.currentProperty.address;
    return `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`;
  }

  // Get short address for navigation display
  get currentPropertyShort() {
    if (!this.currentProperty) return 'Select Property';
    
    return this.currentProperty.displayName || this.currentProperty.address.street;
  }

  // Check if user has multiple properties
  get hasMultipleProperties() {
    return this.userProperties.length > 1;
  }

  // Get current property ID
  get currentPropertyId() {
    return this.currentProperty?._id;
  }

  // Get current municipality
  get currentMunicipality() {
    return this.currentProperty?.municipality;
  }
}