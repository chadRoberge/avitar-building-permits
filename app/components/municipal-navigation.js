import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class MunicipalNavigationComponent extends Component {
  @service router;
  @service permissions;

  @tracked isCollapsed = false;
  @tracked isMobileMenuOpen = false;

  get isMobile() {
    return window.innerWidth <= 768;
  }

  get currentUser() {
    return JSON.parse(localStorage.getItem('user_details') || '{}');
  }

  get userInitials() {
    const user = this.currentUser;
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || 'UN';
  }

  get userRoleName() {
    const level = this.currentUser.permissionLevel || 11;
    return this.permissions.getRoleName(level);
  }

  get userDepartment() {
    const departmentMap = {
      'building': 'Building Dept.',
      'planning': 'Planning Dept.',
      'fire': 'Fire Dept.',
      'health': 'Health Dept.',
      'engineering': 'Engineering Dept.',
      'zoning': 'Zoning Dept.',
      'environmental': 'Environmental Dept.',
      'finance': 'Finance Dept.',
      'admin': 'Administration'
    };
    const dept = this.currentUser.department;
    return departmentMap[dept] || dept || 'Unassigned';
  }

  get navigationItems() {
    const userPermissionLevel = this.currentUser.permissionLevel || 11; // Default to municipal basic
    
    const baseItems = [
      {
        route: 'municipal.dashboard',
        label: 'Dashboard',
        icon: '📊',
        description: 'Overview and statistics',
      },
      {
        route: 'municipal.permits.index',
        label: 'Permits',
        icon: '📋',
        description: 'Manage permit applications',
      },
    ];

    // Municipal power users and above can manage permit types
    if (this.permissions.canManagePermitTypes(this.currentUser)) {
      baseItems.push({
        route: 'municipal.permit-types.index',
        label: 'Permit Types',
        icon: '⚙️',
        description: 'Configure permit categories',
      });
    }

    // Admin users can access billing and settings
    if (this.permissions.canManageUsers(this.currentUser)) {
      baseItems.push({
        route: 'municipal.billing',
        label: 'Billing & Subscription',
        icon: '💳',
        description: 'Manage subscription and billing',
      });

      baseItems.push({
        route: 'municipal.settings',
        label: 'Settings',
        icon: '🔧',
        description: 'User management & configuration',
      });
    }

    return baseItems;
  }

  @action
  toggleSidebar() {
    if (this.isMobile) {
      this.isMobileMenuOpen = !this.isMobileMenuOpen;
    } else {
      this.isCollapsed = !this.isCollapsed;
    }
  }

  @action
  closeMobileMenu() {
    if (this.isMobile) {
      this.isMobileMenuOpen = false;
    }
  }

  @action
  handleResize() {
    // Close mobile menu when switching to desktop
    if (!this.isMobile && this.isMobileMenuOpen) {
      this.isMobileMenuOpen = false;
    }
  }

  @action
  logout() {
    // Clear all authentication and session data
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_type');
    localStorage.removeItem('user_id');
    localStorage.removeItem('municipality_id');
    localStorage.removeItem('current_municipality_id');
    localStorage.removeItem('selected_municipality_id');
    localStorage.removeItem('remember_me');
    localStorage.removeItem('auth_expiration');

    // For extra safety, clear any other auth-related keys
    Object.keys(localStorage).forEach((key) => {
      if (
        key.includes('auth') ||
        key.includes('municipal') ||
        key.includes('user')
      ) {
        localStorage.removeItem(key);
      }
    });

    console.log('User logged out, all auth data cleared');

    // Redirect to admin login
    this.router.transitionTo('admin');
  }

  constructor() {
    super(...arguments);

    // Add resize listener for mobile detection
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.handleResize);

      // Set initial state based on screen size
      if (this.isMobile) {
        this.isCollapsed = false;
        this.isMobileMenuOpen = false;
      }
    }
  }

  willDestroy() {
    super.willDestroy(...arguments);
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleResize);
    }
  }
}
