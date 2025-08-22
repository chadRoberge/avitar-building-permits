import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { getOwner } from '@ember/application';
import config from 'avitar-building-permits/config/environment';

export default class MunicipalProfileController extends Controller {
  @service router;
  @service permissions;

  @tracked activeTab = 'profile';
  @tracked isEditing = false;
  @tracked isSubmitting = false;
  @tracked errorMessage = '';
  @tracked successMessage = '';

  // Track model data separately to avoid mutation issues
  @tracked userProfileData = {};
  @tracked userActivityData = {};

  // Profile form data
  @tracked profileFormData = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    department: ''
  };

  // Password change data
  @tracked passwordFormData = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  // Available departments
  availableDepartments = [
    { id: 'building', name: 'Building Department' },
    { id: 'planning', name: 'Planning Department' },
    { id: 'fire', name: 'Fire Department' },
    { id: 'health', name: 'Health Department' },
    { id: 'engineering', name: 'Engineering Department' },
    { id: 'zoning', name: 'Zoning Department' },
    { id: 'environmental', name: 'Environmental Department' },
    { id: 'finance', name: 'Finance Department' },
    { id: 'admin', name: 'Administration' }
  ];

  // Initialize tracked data from model
  @action
  initializeData() {
    if (this.model) {
      this.userProfileData = this.model.userProfile || {};
      this.userActivityData = this.model.userActivity || {};
    }
  }

  get userProfile() {
    return this.userProfileData || {};
  }

  get userActivity() {
    return this.userActivityData || {};
  }

  get canEditProfile() {
    // All users can edit their own profile
    return true;
  }

  get memberSince() {
    if (!this.userProfile.createdAt) return 'Unknown';
    const date = new Date(this.userProfile.createdAt);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long' 
    });
  }

  get departmentName() {
    const dept = this.availableDepartments.find(d => d.id === this.userProfile.department);
    return dept ? dept.name : this.userProfile.department || 'Not assigned';
  }

  get userInitials() {
    const firstName = this.userProfile.firstName || '';
    const lastName = this.userProfile.lastName || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
  }

  get municipalityName() {
    return this.model?.municipality?.name || 'Unknown Municipality';
  }

  get canEditDepartment() {
    if (!this.permissions) return false;
    return this.permissions.canEditDepartment(this.userProfile);
  }

  get hasSystemPermissions() {
    if (!this.permissions) return false;
    return this.permissions.hasSystemPermissions(this.userProfile);
  }

  get userPermissions() {
    if (!this.permissions) return [];
    return this.permissions.getUserPermissions(this.userProfile);
  }

  formatLastLogin(dateString) {
    if (!dateString) return 'Never';
    
    const loginDate = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - loginDate) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return loginDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  }

  // Tab Management
  @action
  setActiveTab(tab) {
    this.activeTab = tab;
    this.clearMessages();
    if (tab !== 'profile') {
      this.cancelEdit();
    }
  }

  // Profile Editing
  @action
  startEditProfile() {
    this.profileFormData = {
      firstName: this.userProfile.firstName || '',
      lastName: this.userProfile.lastName || '',
      email: this.userProfile.email || '',
      phone: this.userProfile.phone || '',
      department: this.userProfile.department || ''
    };
    this.isEditing = true;
    this.clearMessages();
  }

  @action
  cancelEdit() {
    this.isEditing = false;
    this.profileFormData = {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      department: ''
    };
    this.clearMessages();
  }

  @action
  updateProfileField(field, value) {
    this.profileFormData = {
      ...this.profileFormData,
      [field]: value
    };
  }

  @action
  async saveProfile() {
    if (this.isSubmitting) return;

    this.isSubmitting = true;
    this.clearMessages();

    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`${config.APP.API_HOST}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(this.profileFormData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }

      const updatedProfile = await response.json();
      
      // Update the tracked data
      this.userProfileData = updatedProfile;
      
      // Update localStorage
      localStorage.setItem('user_details', JSON.stringify(updatedProfile));

      this.successMessage = 'Profile updated successfully!';
      this.isEditing = false;
      
    } catch (error) {
      console.error('Error updating profile:', error);
      this.errorMessage = error.message || 'Failed to update profile';
    } finally {
      this.isSubmitting = false;
    }
  }

  // Password Management
  @action
  updatePasswordField(field, value) {
    this.passwordFormData = {
      ...this.passwordFormData,
      [field]: value
    };
  }

  @action
  async changePassword() {
    if (this.isSubmitting) return;

    // Validate passwords
    if (!this.passwordFormData.currentPassword) {
      this.errorMessage = 'Current password is required';
      return;
    }

    if (!this.passwordFormData.newPassword) {
      this.errorMessage = 'New password is required';
      return;
    }

    if (this.passwordFormData.newPassword !== this.passwordFormData.confirmPassword) {
      this.errorMessage = 'New passwords do not match';
      return;
    }

    if (this.passwordFormData.newPassword.length < 6) {
      this.errorMessage = 'New password must be at least 6 characters';
      return;
    }

    this.isSubmitting = true;
    this.clearMessages();

    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`${config.APP.API_HOST}/api/users/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: this.passwordFormData.currentPassword,
          newPassword: this.passwordFormData.newPassword
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to change password');
      }

      this.successMessage = 'Password changed successfully!';
      this.passwordFormData = {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      };
      
    } catch (error) {
      console.error('Error changing password:', error);
      this.errorMessage = error.message || 'Failed to change password';
    } finally {
      this.isSubmitting = false;
    }
  }

  // Helper Methods
  @action
  preventSubmit(event) {
    event.preventDefault();
  }

  clearMessages() {
    this.errorMessage = '';
    this.successMessage = '';
  }

  formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  get currentUserRoleName() {
    const level = this.userProfile?.permissionLevel || 11;
    return this.permissions.getRoleName(level);
  }

  getRoleName(permissionLevel) {
    return this.permissions.getRoleName(permissionLevel);
  }
}