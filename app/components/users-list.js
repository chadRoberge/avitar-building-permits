import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import config from '../config/environment';

export default class UsersListComponent extends Component {
  @tracked users = [];
  @tracked isLoading = true;
  @tracked error = null;
  @tracked currentPage = 1;
  @tracked totalPages = 1;
  @tracked totalUsers = 0;
  @tracked selectedUserType = 'all';

  limit = 25;

  constructor() {
    super(...arguments);
    this.loadUsers();
  }

  get userTypeOptions() {
    return [
      { value: 'all', label: 'All Users' },
      { value: 'system_admin', label: 'System Admins' },
      { value: 'municipal', label: 'Municipal Staff' },
      { value: 'residential', label: 'Residential' },
      { value: 'commercial', label: 'Commercial' }
    ];
  }

  @action
  async loadUsers() {
    this.isLoading = true;
    this.error = null;

    try {
      const params = new URLSearchParams({
        page: this.currentPage,
        limit: this.limit,
      });

      if (this.selectedUserType && this.selectedUserType !== 'all') {
        params.append('userType', this.selectedUserType);
      }

      const response = await fetch(`${config.APP.API_HOST}/api/admin/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load users: ${response.status}`);
      }

      const data = await response.json();
      this.users = data.users.map(user => ({
        ...user,
        initials: this.getInitials(user.firstName, user.lastName)
      }));
      this.totalUsers = data.total;
      this.totalPages = data.totalPages;
    } catch (error) {
      console.error('Error loading users:', error);
      this.error = error.message;
    } finally {
      this.isLoading = false;
    }
  }

  @action
  async filterByUserType(event) {
    this.selectedUserType = event.target.value;
    this.currentPage = 1;
    await this.loadUsers();
  }

  @action
  async goToPage(page) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      await this.loadUsers();
    }
  }

  @action
  async nextPage() {
    if (this.currentPage < this.totalPages) {
      await this.goToPage(this.currentPage + 1);
    }
  }

  @action
  async prevPage() {
    if (this.currentPage > 1) {
      await this.goToPage(this.currentPage - 1);
    }
  }

  get userTypeOptions() {
    return [
      { value: 'all', label: 'All Users' },
      { value: 'system_admin', label: 'System Admins' },
      { value: 'municipal', label: 'Municipal Staff' },
      { value: 'residential', label: 'Residential' },
      { value: 'commercial', label: 'Commercial' }
    ];
  }

  formatUserType(type) {
    const types = {
      'municipal': 'Municipal',
      'residential': 'Residential',
      'commercial': 'Commercial',
      'system_admin': 'System Admin'
    };
    return types[type] || type;
  }

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
  }

  getInitials(firstName, lastName) {
    const first = firstName ? firstName.charAt(0).toUpperCase() : '';
    const last = lastName ? lastName.charAt(0).toUpperCase() : '';
    return first + last;
  }

  getUserTypeColor(type) {
    const colors = {
      'system_admin': 'red',
      'municipal': 'blue',
      'residential': 'green',
      'commercial': 'purple'
    };
    return colors[type] || 'gray';
  }

  @action
  async deactivateUser(user) {
    if (!confirm(`Are you sure you want to deactivate ${user.firstName} ${user.lastName}?`)) {
      return;
    }

    try {
      const response = await fetch(`${config.APP.API_HOST}/api/admin/users/${user._id}/deactivate`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to deactivate user: ${response.status}`);
      }

      // Update the user in the local array
      const userIndex = this.users.findIndex(u => u._id === user._id);
      if (userIndex !== -1) {
        this.users[userIndex].isActive = false;
        this.users = [...this.users]; // Trigger reactivity
      }

      alert(`${user.firstName} ${user.lastName} has been deactivated.`);
    } catch (error) {
      console.error('Error deactivating user:', error);
      alert(`Error deactivating user: ${error.message}`);
    }
  }

  @action
  async activateUser(user) {
    try {
      const response = await fetch(`${config.APP.API_HOST}/api/admin/users/${user._id}/activate`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to activate user: ${response.status}`);
      }

      // Update the user in the local array
      const userIndex = this.users.findIndex(u => u._id === user._id);
      if (userIndex !== -1) {
        this.users[userIndex].isActive = true;
        this.users = [...this.users]; // Trigger reactivity
      }

      alert(`${user.firstName} ${user.lastName} has been activated.`);
    } catch (error) {
      console.error('Error activating user:', error);
      alert(`Error activating user: ${error.message}`);
    }
  }

  @action
  async resetPassword(user) {
    if (!confirm(`Are you sure you want to reset the password for ${user.firstName} ${user.lastName}? They will receive an email with a temporary password.`)) {
      return;
    }

    try {
      const response = await fetch(`${config.APP.API_HOST}/api/admin/users/${user._id}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to reset password: ${response.status}`);
      }

      const result = await response.json();
      alert(`Password reset successful! ${result.message || 'User will receive an email with their new temporary password.'}`);
    } catch (error) {
      console.error('Error resetting password:', error);
      alert(`Error resetting password: ${error.message}`);
    }
  }
}