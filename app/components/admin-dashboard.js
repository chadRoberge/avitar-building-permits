import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from '../config/environment';

export default class AdminDashboardComponent extends Component {
  @service router;

  @tracked dashboardData = null;
  @tracked isLoading = true;
  @tracked error = null;

  constructor() {
    super(...arguments);
    this.loadDashboardData();
  }

  @action
  async loadDashboardData() {
    this.isLoading = true;
    this.error = null;

    try {
      const response = await fetch(`${config.APP.API_HOST}/api/admin/dashboard`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load dashboard: ${response.status}`);
      }

      this.dashboardData = await response.json();
    } catch (error) {
      console.error('Error loading dashboard:', error);
      this.error = error.message;
    } finally {
      this.isLoading = false;
    }
  }

  @action
  navigateToMunicipalities() {
    this.router.transitionTo('admin.municipalities');
  }

  @action
  navigateToUsers() {
    this.router.transitionTo('admin.users');
  }

  @action
  navigateToSettings() {
    this.router.transitionTo('admin.settings');
  }

  get overviewCards() {
    if (!this.dashboardData) return [];

    const { overview } = this.dashboardData;
    return [
      {
        title: 'Total Municipalities',
        value: overview.totalMunicipalities,
        icon: '🏛️',
        color: 'blue',
        action: this.navigateToMunicipalities
      },
      {
        title: 'Active Municipalities',
        value: overview.activeMunicipalities,
        icon: '✅',
        color: 'green'
      },
      {
        title: 'Total Users',
        value: overview.totalUsers,
        icon: '👥',
        color: 'purple',
        action: this.navigateToUsers
      },
      {
        title: 'Total Permits',
        value: overview.totalPermits,
        icon: '📋',
        color: 'orange'
      }
    ];
  }

  get userTypeChart() {
    if (!this.dashboardData?.analytics.usersByType) return [];

    return Object.entries(this.dashboardData.analytics.usersByType).map(([type, count]) => ({
      label: this.formatUserType(type),
      value: count,
      percentage: Math.round((count / this.dashboardData.overview.totalUsers) * 100)
    }));
  }

  get permitStatusChart() {
    if (!this.dashboardData?.analytics.permitsByStatus) return [];

    return Object.entries(this.dashboardData.analytics.permitsByStatus).map(([status, count]) => ({
      label: this.formatStatus(status),
      value: count,
      percentage: Math.round((count / this.dashboardData.overview.totalPermits) * 100)
    }));
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

  formatStatus(status) {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }
}