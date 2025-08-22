import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class SystemAdminNavigationComponent extends Component {
  @service router;

  @tracked isCollapsed = false;
  @tracked isMobileMenuOpen = false;

  get isMobile() {
    return window.innerWidth <= 768;
  }

  get currentUser() {
    return JSON.parse(localStorage.getItem('user') || '{}');
  }

  get userInitials() {
    const user = this.currentUser;
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || 'SA';
  }

  get userRoleName() {
    return 'System Administrator';
  }

  get userDepartment() {
    return 'System Administration';
  }

  get navigationItems() {
    return [
      {
        route: 'system-admin.dashboard',
        label: 'Dashboard',
        icon: '📊',
        description: 'System overview and metrics'
      },
      {
        route: 'system-admin.municipalities',
        label: 'Municipalities',
        icon: '🏛️',
        description: 'Manage municipalities'
      },
      {
        route: 'system-admin.users',
        label: 'Users',
        icon: '👥',
        description: 'System-wide user management'
      },
      {
        route: 'system-admin.settings',
        label: 'Settings',
        icon: '⚙️',
        description: 'Global system configuration'
      }
    ];
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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('auth_expiration');

    // Clear any other auth-related keys
    Object.keys(localStorage).forEach((key) => {
      if (
        key.includes('auth') ||
        key.includes('admin') ||
        key.includes('user')
      ) {
        localStorage.removeItem(key);
      }
    });

    console.log('System admin logged out, all auth data cleared');

    // Redirect to system admin login
    this.router.transitionTo('system-admin.login');
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