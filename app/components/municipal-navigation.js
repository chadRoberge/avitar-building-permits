import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class MunicipalNavigationComponent extends Component {
  @service router;

  @tracked isCollapsed = false;
  @tracked isMobileMenuOpen = false;

  get isMobile() {
    return window.innerWidth <= 768;
  }

  get navigationItems() {
    return [
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
      {
        route: 'municipal.permit-types.index',
        label: 'Permit Types',
        icon: '⚙️',
        description: 'Configure permit categories',
      },
      {
        route: 'municipal.billing',
        label: 'Billing & Subscription',
        icon: '💳',
        description: 'Manage subscription and billing',
      },
      {
        route: 'municipal.settings',
        label: 'Settings',
        icon: '🔧',
        description: 'Portal configuration',
      },
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
