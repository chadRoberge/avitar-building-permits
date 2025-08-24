import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class EditProfileModalComponent extends Component {
  @service router;

  @tracked firstName = '';
  @tracked lastName = '';
  @tracked email = '';
  @tracked phone = '';
  @tracked department = '';
  @tracked propertyNickname = '';
  
  @tracked propertyAddress = {
    street: '',
    city: '',
    state: '',
    zip: ''
  };

  @tracked isUpdating = false;
  @tracked errorMessage = '';
  @tracked successMessage = '';
  @tracked errors = {};

  constructor() {
    super(...arguments);
    this.populateFormData();
  }

  populateFormData() {
    if (this.args.user) {
      this.firstName = this.args.user.firstName || '';
      this.lastName = this.args.user.lastName || '';
      this.email = this.args.user.email || '';
      this.phone = this.args.user.phone || '';
      this.department = this.args.user.department || '';
      
      if (this.args.user.propertyAddress) {
        this.propertyAddress = {
          street: this.args.user.propertyAddress.street || '',
          city: this.args.user.propertyAddress.city || '',
          state: this.args.user.propertyAddress.state || '',
          zip: this.args.user.propertyAddress.zip || ''
        };
      }
    }

    // Get property nickname from current property if available
    if (this.args.currentProperty) {
      this.propertyNickname = this.args.currentProperty.displayName || '';
    }
  }

  @action
  stopPropagation(event) {
    event.stopPropagation();
  }

  @action
  closeModal() {
    this.resetForm();
    this.args.onClose();
  }

  @action
  updateDepartment(event) {
    this.department = event.target.value;
  }

  @action
  resetForm() {
    this.errorMessage = '';
    this.successMessage = '';
    this.errors = {};
    this.isUpdating = false;
    this.populateFormData(); // Reset to original values
  }

  validateForm() {
    const errors = {};

    // Required field validation
    if (!this.firstName.trim()) {
      errors.firstName = 'First name is required';
    }

    if (!this.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }

    if (!this.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!this.isValidEmail(this.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Phone number validation (if provided)
    if (this.phone && !this.isValidPhone(this.phone)) {
      errors.phone = 'Please enter a valid phone number';
    }

    // Property address validation for residential users
    if (this.args.user?.userType === 'residential') {
      if (this.propertyAddress.state && this.propertyAddress.state.length !== 2) {
        errors.state = 'State must be 2 characters (e.g., NH)';
      }

      if (this.propertyAddress.zip && !this.isValidZipCode(this.propertyAddress.zip)) {
        errors.zip = 'Please enter a valid ZIP code';
      }
    }

    this.errors = errors;
    return Object.keys(errors).length === 0;
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidPhone(phone) {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    // Valid if it's 10 or 11 digits (with country code)
    return digitsOnly.length === 10 || digitsOnly.length === 11;
  }

  isValidZipCode(zip) {
    const zipRegex = /^\d{5}(-\d{4})?$/;
    return zipRegex.test(zip);
  }

  @action
  async updateProfile(event) {
    event.preventDefault();

    if (this.isUpdating) return;

    // Clear previous messages
    this.errorMessage = '';
    this.successMessage = '';

    // Validate form
    if (!this.validateForm()) {
      this.errorMessage = 'Please fix the errors below and try again.';
      return;
    }

    this.isUpdating = true;

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Prepare update data
      const updateData = {
        firstName: this.firstName.trim(),
        lastName: this.lastName.trim(),
        email: this.email.trim().toLowerCase(),
        phone: this.phone.trim() || null
      };

      // Add department if user is municipal admin
      if (this.args.user?.userType === 'municipal' && this.args.user?.permissionLevel >= 21) {
        updateData.department = this.department;
      }

      // Add property address for residential users
      if (this.args.user?.userType === 'residential') {
        updateData.propertyAddress = {
          street: this.propertyAddress.street.trim(),
          city: this.propertyAddress.city.trim(),
          state: this.propertyAddress.state.trim().toUpperCase(),
          zip: this.propertyAddress.zip.trim()
        };
      }

      // Make API request to update user profile
      const response = await fetch(`${config.APP.API_HOST}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      const updatedUser = await response.json();

      // Update property nickname if it was changed and user is residential
      if (this.args.user?.userType === 'residential' && this.args.currentProperty && 
          this.propertyNickname !== (this.args.currentProperty.displayName || '')) {
        
        try {
          const propertyResponse = await fetch(`${config.APP.API_HOST}/api/properties/${this.args.currentProperty._id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              displayName: this.propertyNickname.trim() || null
            }),
          });

          if (!propertyResponse.ok) {
            const propertyError = await propertyResponse.json();
            console.warn('Property update failed:', propertyError.error);
            // Don't throw error for property update failure - user profile was still updated
          }
        } catch (propertyError) {
          console.warn('Property update error:', propertyError);
          // Don't throw error for property update failure
        }
      }

      this.successMessage = 'Profile updated successfully!';

      // Check if email was changed
      const emailChanged = this.args.user.email !== updateData.email;

      // Call parent component's callback with updated user data
      if (this.args.onUpdated) {
        this.args.onUpdated(updatedUser, emailChanged);
      }

      // Close modal after brief delay to show success message
      setTimeout(() => {
        if (emailChanged) {
          // If email changed, show warning and potentially log out
          alert('Your email has been updated. You may need to log in again with your new email address.');
          // Optionally force logout here
          // localStorage.removeItem('auth_token');
          // this.router.transitionTo('auth');
        }
        this.closeModal();
      }, 1500);

    } catch (error) {
      console.error('Error updating profile:', error);
      this.errorMessage = error.message || 'Failed to update profile. Please try again.';
    } finally {
      this.isUpdating = false;
    }
  }
}