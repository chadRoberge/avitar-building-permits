import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from '../config/environment';

export default class MunicipalDashboardComponent extends Component {
  @service router;

  @tracked dashboardData = null;
  @tracked isLoading = true;
  @tracked error = null;

  constructor() {
    super(...arguments);
    this.loadDashboardData();
  }

  get currentYear() {
    return new Date().getFullYear();
  }

  get municipality() {
    return this.args.municipality;
  }

  async loadDashboardData() {
    this.isLoading = true;
    this.error = null;

    try {
      if (!this.municipality?._id) {
        throw new Error('Municipality data not available');
      }

      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token');
      }

      // Fetch dashboard statistics from API
      const response = await fetch(`${config.APP.API_HOST}/api/dashboard/stats/${this.municipality._id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load dashboard data: ${response.status}`);
      }

      const stats = await response.json();
      
      // Calculate monthly trend percentages
      const maxCount = Math.max(...stats.monthlyTrends.map(m => m.count));
      stats.monthlyTrends = stats.monthlyTrends.map(trend => ({
        ...trend,
        percentage: maxCount > 0 ? Math.max((trend.count / maxCount) * 100, 5) : 5 // Minimum 5% for visibility
      }));

      // Map status breakdown to match template expectations
      this.dashboardData = {
        ...stats,
        statusBreakdown: {
          submitted: stats.statusBreakdown.submitted || 0,
          reviewing: stats.statusBreakdown['under-review'] || 0,
          approved: stats.statusBreakdown.approved || 0,
          active: stats.statusBreakdown.active || stats.statusBreakdown.inspections || 0,
          completed: stats.statusBreakdown.completed || 0,
        }
      };

      console.log('Municipal dashboard data loaded:', this.dashboardData);

    } catch (error) {
      console.error('Error loading municipal dashboard data:', error);
      this.error = error.message;
      
      // Fallback to basic empty state
      this.dashboardData = {
        totalPermits: 0,
        permitGrowth: 0,
        pendingInspections: 0,
        overdueInspections: 0,
        pendingApprovals: 0,
        avgApprovalTime: 0,
        permitRevenue: 0,
        revenueGrowth: 0,
        totalProjectValue: 0,
        completionRate: 0,
        statusBreakdown: {
          submitted: 0,
          reviewing: 0,
          approved: 0,
          active: 0,
          completed: 0,
        },
        recentActivity: [],
        monthlyTrends: Array.from({ length: 12 }, (_, i) => {
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return {
            name: monthNames[i],
            count: 0,
            percentage: 5
          };
        })
      };
    } finally {
      this.isLoading = false;
    }
  }

  @action
  async retryLoadDashboard() {
    await this.loadDashboardData();
  }

  @action
  formatCurrency(amount) {
    if (!amount) return '0';
    return new Intl.NumberFormat('en-US').format(amount);
  }

  @action
  getStatusPercentage(status) {
    if (!this.dashboardData) return 0;

    const total = Object.values(this.dashboardData.statusBreakdown).reduce(
      (sum, count) => sum + count,
      0,
    );
    const count = this.dashboardData.statusBreakdown[status] || 0;

    return total > 0 ? Math.round((count / total) * 100) : 0;
  }

  // Quick action methods
  @action
  reviewPendingPermits() {
    this.router.transitionTo('municipal.permits', { queryParams: { status: 'under-review' } });
  }

  @action
  scheduleInspections() {
    this.router.transitionTo('municipal.permits', { queryParams: { status: 'inspections' } });
  }

  @action
  addPermitType() {
    this.router.transitionTo('municipal.permit-types.new');
  }

  @action
  manageSettings() {
    this.router.transitionTo('municipal.settings');
  }

  @action
  viewPermit(permitId) {
    this.router.transitionTo('municipal.permits.view', permitId);
  }
}