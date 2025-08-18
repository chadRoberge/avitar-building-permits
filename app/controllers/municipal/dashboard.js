import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class MunicipalDashboardController extends Controller {
  @tracked isLoading = true;
  @tracked dashboardData = null;

  constructor() {
    super(...arguments);
    this.loadDashboardData();
  }

  get currentYear() {
    return new Date().getFullYear();
  }

  async loadDashboardData() {
    this.isLoading = true;

    try {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.dashboardData = {
        totalPermits: 247,
        permitGrowth: 15.3,
        pendingInspections: 23,
        overdueInspections: 5,
        pendingApprovals: 12,
        avgApprovalTime: 3.2,
        permitRevenue: 125780,
        revenueGrowth: 22.1,
        totalProjectValue: 8456000,
        completionRate: 94.2,

        statusBreakdown: {
          submitted: 12,
          reviewing: 8,
          approved: 23,
          active: 45,
          completed: 159,
        },

        recentActivity: [
          {
            id: 1,
            type: 'submitted',
            title: 'New permit application submitted',
            permitType: 'Residential Addition',
            applicant: 'John & Jane Doe',
            timeAgo: '2 hours ago',
            permitId: 'P2024-001',
          },
          {
            id: 2,
            type: 'approved',
            title: 'Permit approved',
            permitType: 'Deck Construction',
            applicant: 'Smith Family',
            timeAgo: '4 hours ago',
            permitId: 'P2024-002',
          },
          {
            id: 3,
            type: 'inspection',
            title: 'Inspection completed',
            permitType: 'Kitchen Renovation',
            applicant: 'Mike Johnson',
            timeAgo: '1 day ago',
            permitId: 'P2024-003',
          },
          {
            id: 4,
            type: 'completed',
            title: 'Project completed',
            permitType: 'Garage Construction',
            applicant: 'Wilson Construction',
            timeAgo: '2 days ago',
            permitId: 'P2024-004',
          },
        ],

        monthlyTrends: [
          { name: 'Jan', count: 18, percentage: 45 },
          { name: 'Feb', count: 22, percentage: 55 },
          { name: 'Mar', count: 28, percentage: 70 },
          { name: 'Apr', count: 35, percentage: 87.5 },
          { name: 'May', count: 40, percentage: 100 },
          { name: 'Jun', count: 32, percentage: 80 },
          { name: 'Jul', count: 29, percentage: 72.5 },
          { name: 'Aug', count: 26, percentage: 65 },
          { name: 'Sep', count: 17, percentage: 42.5 },
        ],
      };
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Handle error state
    } finally {
      this.isLoading = false;
    }
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
}
