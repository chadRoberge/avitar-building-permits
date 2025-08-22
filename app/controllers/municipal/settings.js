import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class MunicipalSettingsController extends Controller {
  @service router;
  @service permissions;

  @tracked activeTab = 'users';
  @tracked isSubmitting = false;
  @tracked errorMessage = '';
  @tracked successMessage = '';

  // User management
  @tracked showUserModal = false;
  @tracked editingUser = null;
  @tracked userFormData = {
    firstName: '',
    lastName: '',
    email: '',
    department: '',
    permissionLevel: 11, // Default to Municipal Basic User
    isActive: true
  };

  // Available permission levels for municipal users
  availablePermissionLevels = [
    { level: 11, name: 'Municipal Basic User', description: 'View permits and basic functions' },
    { level: 12, name: 'Municipal Viewer', description: 'Enhanced viewing and reporting' },
    { level: 13, name: 'Municipal Power User', description: 'Edit permits and advanced features' },
    { level: 14, name: 'Department Reviewer', description: 'Department-specific approvals' },
    { level: 15, name: 'Municipal Inspector', description: 'Schedule and conduct inspections' },
    { level: 16, name: 'Senior Inspector', description: 'Senior inspection responsibilities' },
    { level: 17, name: 'Department Supervisor', description: 'Supervise department activities' },
    { level: 18, name: 'Municipal Coordinator', description: 'Cross-department coordination' },
    { level: 19, name: 'Municipal Manager', description: 'Municipal management responsibilities' },
    { level: 20, name: 'Assistant Admin', description: 'Assistant administrative functions' },
    { level: 21, name: 'Municipal Admin', description: 'Full municipality administration' },
    { level: 22, name: 'Municipal System Admin', description: 'System configuration and integrations' },
    { level: 23, name: 'Municipality Super Admin', description: 'Complete municipal control' }
  ];

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

  get municipalUsers() {
    return this.model.users?.filter(user => user.userType === 'municipal') || [];
  }

  get canManageUsers() {
    return this.permissions.canManageUsers(this.model.currentUser);
  }

  get canConfigureSystem() {
    return this.permissions.canManageMunicipalitySettings(this.model.currentUser);
  }

  // Tab Management
  @action
  setActiveTab(tab) {
    this.activeTab = tab;
    this.clearMessages();
  }

  // User Management Actions
  @action
  openNewUserModal() {
    this.editingUser = null;
    this.userFormData = {
      firstName: '',
      lastName: '',
      email: '',
      department: '',
      permissionLevel: 11, // Default to Municipal Basic User
      isActive: true
    };
    this.showUserModal = true;
    this.clearMessages();
  }

  @action
  openEditUserModal(user) {
    this.editingUser = user;
    this.userFormData = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      department: user.department,
      permissionLevel: user.permissionLevel,
      isActive: user.isActive
    };
    this.showUserModal = true;
    this.clearMessages();
  }

  @action
  closeUserModal() {
    this.showUserModal = false;
    this.editingUser = null;
    this.clearMessages();
  }

  @action
  updateUserFormField(field, value) {
    this.userFormData = {
      ...this.userFormData,
      [field]: value
    };
  }

  @action
  async saveUser() {
    if (this.isSubmitting) return;

    this.isSubmitting = true;
    this.clearMessages();

    try {
      const token = localStorage.getItem('auth_token');
      const url = this.editingUser 
        ? `${config.APP.API_HOST}/api/users/${this.editingUser._id}`
        : `${config.APP.API_HOST}/api/users/municipal`;
      
      const method = this.editingUser ? 'PUT' : 'POST';
      
      const userData = {
        ...this.userFormData,
        userType: 'municipal',
        municipality: this.model.currentUser.municipality
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save user');
      }

      const savedUser = await response.json();
      
      if (this.editingUser) {
        // Update existing user in the list
        const index = this.model.users.findIndex(u => u._id === this.editingUser._id);
        if (index !== -1) {
          this.model.users[index] = savedUser;
        }
      } else {
        // Add new user to the list
        this.model.users.push(savedUser);
      }

      this.successMessage = `User ${this.editingUser ? 'updated' : 'created'} successfully!`;
      this.closeUserModal();
      
    } catch (error) {
      console.error('Error saving user:', error);
      this.errorMessage = error.message || 'Failed to save user';
    } finally {
      this.isSubmitting = false;
    }
  }

  @action
  async toggleUserStatus(user) {
    if (this.isSubmitting) return;

    this.isSubmitting = true;
    this.clearMessages();

    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`${config.APP.API_HOST}/api/users/${user._id}/toggle-status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to toggle user status');
      }

      const updatedUser = await response.json();
      
      // Update user in the list
      const index = this.model.users.findIndex(u => u._id === user._id);
      if (index !== -1) {
        this.model.users[index] = updatedUser;
      }

      this.successMessage = `User ${updatedUser.isActive ? 'activated' : 'deactivated'} successfully!`;
      
    } catch (error) {
      console.error('Error toggling user status:', error);
      this.errorMessage = error.message || 'Failed to toggle user status';
    } finally {
      this.isSubmitting = false;
    }
  }

  // Helper Methods
  clearMessages() {
    this.errorMessage = '';
    this.successMessage = '';
  }

  getDepartmentName(departmentId) {
    const dept = this.availableDepartments.find(d => d.id === departmentId);
    return dept ? dept.name : departmentId;
  }

  getPermissionLevelName(level) {
    return this.permissions.getRoleName(level);
  }
}