import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class CommercialProfileController extends Controller {
  @service router;

  // Edit states
  @tracked isEditingPersonal = false;
  @tracked isEditingBusiness = false;
  @tracked isChangingPassword = false;

  // Loading states
  @tracked isUpdatingPersonal = false;
  @tracked isUpdatingBusiness = false;
  @tracked isUpdatingPassword = false;

  // Messages
  @tracked successMessage = '';
  @tracked errorMessage = '';

  // Form data
  @tracked personalForm = {
    firstName: '',
    lastName: '',
    email: ''
  };

  @tracked businessForm = {
    businessName: '',
    businessType: '',
    licenseNumber: ''
  };

  @tracked passwordForm = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  get currentUser() {
    return this.model?.currentUser || {};
  }

  // Personal Information Actions
  @action
  togglePersonalEdit() {
    if (this.isEditingPersonal) {
      this.isEditingPersonal = false;
      this.resetPersonalForm();
    } else {
      this.isEditingPersonal = true;
      this.initPersonalForm();
    }
  }

  @action
  updatePersonalField(field, event) {
    this.personalForm[field] = event.target.value;
  }

  @action
  async updatePersonalInfo(event) {
    event.preventDefault();
    this.isUpdatingPersonal = true;
    this.clearMessages();

    try {
      const authToken = localStorage.getItem('auth_token');
      
      const response = await fetch(`${config.APP.API_HOST}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: this.personalForm.firstName,
          lastName: this.personalForm.lastName,
          email: this.personalForm.email
        })
      });

      if (response.ok) {
        const updatedUser = await response.json();
        
        // Update localStorage
        localStorage.setItem('user_details', JSON.stringify(updatedUser));
        
        // Update model
        this.model.currentUser = updatedUser;
        
        this.successMessage = 'Personal information updated successfully!';
        this.isEditingPersonal = false;
      } else {
        const error = await response.json();
        this.errorMessage = error.message || 'Failed to update personal information';
      }
    } catch (error) {
      console.error('Error updating personal information:', error);
      this.errorMessage = 'An error occurred while updating your information';
    } finally {
      this.isUpdatingPersonal = false;
    }
  }

  // Business Information Actions
  @action
  toggleBusinessEdit() {
    if (this.isEditingBusiness) {
      this.isEditingBusiness = false;
      this.resetBusinessForm();
    } else {
      this.isEditingBusiness = true;
      this.initBusinessForm();
    }
  }

  @action
  updateBusinessField(field, event) {
    this.businessForm[field] = event.target.value;
  }

  @action
  async updateBusinessInfo(event) {
    event.preventDefault();
    this.isUpdatingBusiness = true;
    this.clearMessages();

    try {
      const authToken = localStorage.getItem('auth_token');
      
      const response = await fetch(`${config.APP.API_HOST}/api/users/business`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessInfo: {
            businessName: this.businessForm.businessName,
            businessType: this.businessForm.businessType,
            licenseNumber: this.businessForm.licenseNumber
          }
        })
      });

      if (response.ok) {
        const updatedUser = await response.json();
        
        // Update localStorage
        localStorage.setItem('user_details', JSON.stringify(updatedUser));
        
        // Update model
        this.model.currentUser = updatedUser;
        
        this.successMessage = 'Business information updated successfully!';
        this.isEditingBusiness = false;
      } else {
        const error = await response.json();
        this.errorMessage = error.message || 'Failed to update business information';
      }
    } catch (error) {
      console.error('Error updating business information:', error);
      this.errorMessage = 'An error occurred while updating your business information';
    } finally {
      this.isUpdatingBusiness = false;
    }
  }

  // Password Change Actions
  @action
  togglePasswordChange() {
    if (this.isChangingPassword) {
      this.isChangingPassword = false;
      this.resetPasswordForm();
    } else {
      this.isChangingPassword = true;
    }
  }

  @action
  updatePasswordField(field, event) {
    this.passwordForm[field] = event.target.value;
  }

  @action
  async changePassword(event) {
    event.preventDefault();
    this.clearMessages();

    // Validate passwords match
    if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
      this.errorMessage = 'New passwords do not match';
      return;
    }

    // Validate password length
    if (this.passwordForm.newPassword.length < 8) {
      this.errorMessage = 'New password must be at least 8 characters long';
      return;
    }

    this.isUpdatingPassword = true;

    try {
      const authToken = localStorage.getItem('auth_token');
      
      const response = await fetch(`${config.APP.API_HOST}/api/users/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: this.passwordForm.currentPassword,
          newPassword: this.passwordForm.newPassword
        })
      });

      if (response.ok) {
        this.successMessage = 'Password changed successfully!';
        this.isChangingPassword = false;
        this.resetPasswordForm();
      } else {
        const error = await response.json();
        this.errorMessage = error.message || 'Failed to change password';
      }
    } catch (error) {
      console.error('Error changing password:', error);
      this.errorMessage = 'An error occurred while changing your password';
    } finally {
      this.isUpdatingPassword = false;
    }
  }

  // Message Actions
  @action
  clearSuccessMessage() {
    this.successMessage = '';
  }

  @action
  clearErrorMessage() {
    this.errorMessage = '';
  }

  clearMessages() {
    this.successMessage = '';
    this.errorMessage = '';
  }

  // Form Helpers
  initPersonalForm() {
    const user = this.currentUser;
    this.personalForm = {
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || ''
    };
  }

  resetPersonalForm() {
    this.personalForm = {
      firstName: '',
      lastName: '',
      email: ''
    };
  }

  initBusinessForm() {
    const businessInfo = this.currentUser.businessInfo || {};
    this.businessForm = {
      businessName: businessInfo.businessName || '',
      businessType: businessInfo.businessType || '',
      licenseNumber: businessInfo.licenseNumber || ''
    };
  }

  resetBusinessForm() {
    this.businessForm = {
      businessName: '',
      businessType: '',
      licenseNumber: ''
    };
  }

  resetPasswordForm() {
    this.passwordForm = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    };
  }

  // Billing Actions
  @action
  manageBilling() {
    this.router.transitionTo('commercial.billing');
  }

  @action
  setupBilling() {
    this.router.transitionTo('commercial.billing');
  }

  @action
  async changePlan(plan) {
    this.clearMessages();

    try {
      const authToken = localStorage.getItem('auth_token');
      
      const response = await fetch(`${config.APP.API_HOST}/api/billing/change-plan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stripePriceId: plan.stripePriceId
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.redirectUrl) {
          // Stripe checkout URL - redirect to Stripe
          window.location.href = result.redirectUrl;
        } else {
          // Plan changed successfully
          this.successMessage = `Successfully changed to ${plan.name} plan!`;
          // Refresh the page to show updated billing info
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } else {
        const error = await response.json();
        this.errorMessage = error.message || 'Failed to change plan';
      }
    } catch (error) {
      console.error('Error changing plan:', error);
      this.errorMessage = 'An error occurred while changing your plan';
    }
  }
}