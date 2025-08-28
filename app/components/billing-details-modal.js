import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import config from 'avitar-building-permits/config/environment';

export default class BillingDetailsModalComponent extends Component {
  @tracked billingData = null;
  @tracked availablePlans = null;
  @tracked billingHistory = [];
  @tracked isLoading = false;
  @tracked isUpdatingPlan = false;
  @tracked errorMessage = '';

  constructor() {
    super(...arguments);
    if (this.args.isVisible) {
      this.loadAllData();
    }
  }

  // React to argument changes - trigger loading without returning display value
  get reactiveLoader() {
    if (this.args.isVisible && !this.billingData && !this.isLoading) {
      // Use setTimeout to avoid infinite loops
      setTimeout(() => this.loadAllData(), 0);
    }
    return null; // Don't return anything that would display
  }

  @action
  async loadAllData() {
    if (!this.args.isVisible) return;
    
    this.isLoading = true;
    this.errorMessage = '';

    try {
      // Load all data in parallel - catch individual errors to prevent blocking
      const results = await Promise.allSettled([
        this.loadBillingData(),
        this.loadAvailablePlans(), 
        this.loadBillingHistory()
      ]);
      
      // Check for any rejected promises and log them
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const methods = ['loadBillingData', 'loadAvailablePlans', 'loadBillingHistory'];
          console.warn(`Failed to ${methods[index]}:`, result.reason);
        }
      });
      
      // Mark current plan and filter out from upgrade options
      this.markCurrentPlan();
      
    } catch (error) {
      console.error('Error loading billing modal data:', error);
      this.errorMessage = 'Failed to load billing information';
    } finally {
      this.isLoading = false;
    }
  }

  async loadBillingData() {
    if (!this.args.isVisible) return;

    const token = localStorage.getItem('auth_token');

    const response = await fetch(`${config.APP.API_HOST}/api/billing`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to load billing information');
    }

    this.billingData = await response.json();
  }

  async loadAvailablePlans() {
    if (!this.args.isVisible) return;

    const token = localStorage.getItem('auth_token');

    const response = await fetch(`${config.APP.API_HOST}/api/billing/plans`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      this.availablePlans = await response.json();
    } else {
      // Set empty plans object on failure to prevent blocking
      this.availablePlans = {};
    }
  }

  async loadBillingHistory() {
    if (!this.args.isVisible) return;

    const token = localStorage.getItem('auth_token');

    const response = await fetch(`${config.APP.API_HOST}/api/billing/history`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      this.billingHistory = await response.json();
    } else {
      // Set empty history array on failure to prevent blocking
      this.billingHistory = [];
    }
  }

  @action
  stopPropagation(event) {
    event.stopPropagation();
  }

  @action
  closeModal() {
    this.args.onClose();
  }

  @action
  async selectPlan(planKey) {
    if (this.isUpdatingPlan) return;

    this.isUpdatingPlan = true;
    this.errorMessage = '';

    try {
      const token = localStorage.getItem('auth_token');
      const plan = this.availablePlans[planKey];
      
      const requestData = {
        planType: planKey.toLowerCase(),
        planKey: planKey
      };

      // If we have a Stripe price ID, use it directly
      if (plan?.priceId) {
        requestData.priceId = plan.priceId;
        requestData.productId = plan.id;
      }

      // Create Stripe checkout session
      const response = await fetch(
        `${config.APP.API_HOST}/api/stripe/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestData),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();

      // Redirect to Stripe checkout
      window.location.href = url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      this.errorMessage = error.message || 'Failed to start checkout process';
    } finally {
      this.isUpdatingPlan = false;
    }
  }

  @action
  async openBillingPortal() {
    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch(
        `${config.APP.API_HOST}/api/stripe/create-portal-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to open billing portal');
      }

      const { url } = await response.json();

      // Open in new tab
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error opening billing portal:', error);
      this.errorMessage = error.message || 'Failed to open billing portal';
    }
  }

  // Helper methods for formatting
  formatPrice(cents) {
    if (!cents || cents === 0) return '0.00';
    return (cents / 100).toFixed(2);
  }

  formatPlanPrice(cents) {
    if (!cents || cents === 0) return '0';
    return (cents / 100).toFixed(0);
  }

  formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }


  // Mark current plan and filter out from upgrade options  
  markCurrentPlan() {
    if (!this.availablePlans || !this.billingData) return;

    const currentPlanName = this.billingData.planName;
    
    // For free users, the plan name is "Free Forever" 
    // For paid users, it would match a Stripe plan name
    
    // Mark current plan and filter out free plan for free users
    const filteredPlans = {};
    
    Object.keys(this.availablePlans).forEach(planKey => {
      const plan = this.availablePlans[planKey];
      
      // Check if this is the current plan
      const isCurrentPlan = (
        plan.name === currentPlanName ||
        (currentPlanName === 'Free Forever' && planKey === 'free') ||
        (currentPlanName === 'Free Forever' && plan.price === 0)
      );
      
      if (isCurrentPlan) {
        // Mark as current but don't include in filtered plans (hide from upgrades)
        plan.current = true;
      } else {
        // Include in upgrade options
        filteredPlans[planKey] = { ...plan, current: false };
      }
    });
    
    // Replace availablePlans with filtered plans (excluding current plan)
    this.availablePlans = filteredPlans;
  }
}