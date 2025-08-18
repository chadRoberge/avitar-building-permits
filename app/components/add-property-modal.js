import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class AddPropertyModalComponent extends Component {
  @service currentProperty;

  @tracked displayName = '';
  @tracked street = '';
  @tracked city = '';
  @tracked state = '';
  @tracked zip = '';
  @tracked isPrimary = false;
  @tracked propertyType = 'residential';
  
  @tracked isLoading = false;
  @tracked errorMessage = '';
  @tracked successMessage = '';

  // Get current municipality from the service or args
  get currentMunicipality() {
    return this.currentProperty.currentMunicipality || this.args.municipality;
  }

  get municipalityId() {
    // First try to get from the passed municipality argument
    if (this.args.municipality && this.args.municipality._id) {
      const id = this.args.municipality._id;
      return typeof id === 'string' ? id : id.toString();
    }
    
    // Then try from the current property service
    const municipality = this.currentProperty.currentMunicipality;
    if (municipality && municipality._id) {
      const id = municipality._id;
      return typeof id === 'string' ? id : id.toString();
    }
    
    // Finally fall back to localStorage
    let municipalityId = localStorage.getItem('municipality_id');
    
    // Handle case where municipality_id might be stored as an object
    if (municipalityId && municipalityId.startsWith('[object')) {
      console.warn('municipality_id appears to be an object, clearing it');
      localStorage.removeItem('municipality_id');
      return null;
    }
    
    return municipalityId;
  }

  @action
  updateField(field, event) {
    this[field] = event.target.value;
    this.errorMessage = '';
    this.successMessage = '';
  }

  @action
  updateCheckbox(field, event) {
    this[field] = event.target.checked;
  }

  @action
  async handleSubmit(event) {
    event.preventDefault();
    
    if (!this.validateForm()) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const propertyData = {
        displayName: this.displayName,
        address: {
          street: this.street,
          city: this.city,
          state: this.state,
          zip: this.zip
        },
        municipalityId: this.municipalityId,
        propertyType: this.propertyType,
        isPrimary: this.isPrimary
      };

      await this.currentProperty.addProperty(propertyData);
      
      this.successMessage = 'Property added successfully!';
      
      // Reset form after success
      setTimeout(() => {
        this.resetForm();
        this.args.onClose?.();
      }, 1500);

    } catch (error) {
      console.error('Error adding property:', error);
      this.errorMessage = error.message || 'Failed to add property. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  @action
  handleCancel() {
    this.resetForm();
    this.args.onClose?.();
  }

  @action
  handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      this.handleCancel();
    }
  }


  resetForm() {
    this.displayName = '';
    this.street = '';
    this.city = '';
    this.state = '';
    this.zip = '';
    this.isPrimary = false;
    this.propertyType = 'residential';
    this.errorMessage = '';
    this.successMessage = '';
  }

  validateForm() {
    if (!this.displayName.trim()) {
      this.errorMessage = 'Property name is required';
      return false;
    }

    if (!this.street.trim()) {
      this.errorMessage = 'Street address is required';
      return false;
    }

    if (!this.city.trim()) {
      this.errorMessage = 'City is required';
      return false;
    }

    if (!this.state.trim()) {
      this.errorMessage = 'State is required';
      return false;
    }

    if (!this.zip.trim()) {
      this.errorMessage = 'ZIP code is required';
      return false;
    }

    const zipRegex = /^\d{5}(-\d{4})?$/;
    if (!zipRegex.test(this.zip.trim())) {
      this.errorMessage = 'Please enter a valid ZIP code';
      return false;
    }

    if (!this.municipalityId) {
      this.errorMessage = 'Municipality information is missing. Please try refreshing the page.';
      return false;
    }

    // Validate that the property city matches the current municipality
    const municipality = this.currentMunicipality;
    if (municipality && municipality.address && municipality.address.city) {
      const municipalityCity = municipality.address.city.toLowerCase().trim();
      const propertyCity = this.city.toLowerCase().trim();
      
      if (municipalityCity !== propertyCity) {
        this.errorMessage = `Property city must be ${municipality.address.city} to match the current municipality.`;
        return false;
      }
    }

    return true;
  }
}