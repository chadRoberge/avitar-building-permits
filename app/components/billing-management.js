import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import config from 'avitar-building-permits/config/environment';

export default class BillingManagementComponent extends Component {
  @tracked billingData = null;
  @tracked availablePlans = null;
  @tracked billingHistory = [];
  @tracked isLoading = true;
  @tracked isUpdatingPlan = false;
  @tracked errorMessage = '';
  @tracked showPlanComparison = false;
  @tracked showCancelConfirmation = false;

  constructor() {
    super(...arguments);
    this.loadBillingData();
    this.loadAvailablePlans();
    this.loadBillingHistory();
  }

  async loadBillingData() {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`${config.APP.API_HOST}/api/billing`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load billing information');
      }

      this.billingData = await response.json();
      
    } catch (error) {
      console.error('Error loading billing data:', error);
      this.errorMessage = 'Failed to load billing information';
    } finally {
      this.isLoading = false;
    }
  }

  async loadAvailablePlans() {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`${config.APP.API_HOST}/api/billing/plans`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        this.availablePlans = await response.json();
      }
      
    } catch (error) {
      console.error('Error loading available plans:', error);
    }
  }

  async loadBillingHistory() {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`${config.APP.API_HOST}/api/billing/history`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        this.billingHistory = await response.json();
      }
      
    } catch (error) {
      console.error('Error loading billing history:', error);
    }
  }

  @action
  togglePlanComparison() {
    this.showPlanComparison = !this.showPlanComparison;
  }

  @action
  async updateSubscriptionPlan(planName) {
    if (this.isUpdatingPlan) return;

    this.isUpdatingPlan = true;
    this.errorMessage = '';

    try {
      const token = localStorage.getItem('auth_token');
      const municipalityId = this.billingData.municipalityId;
      
      // Create Stripe checkout session for municipal users
      const response = await fetch(`${config.APP.API_HOST}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          planType: planName.toLowerCase(),
          municipalityId: municipalityId
        })
      });

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
  showCancelDialog() {
    this.showCancelConfirmation = true;
  }

  @action
  hideCancelDialog() {
    this.showCancelConfirmation = false;
  }

  @action
  async cancelSubscription(cancelAtPeriodEnd = true) {
    try {
      const token = localStorage.getItem('auth_token');
      const municipalityId = this.billingData.municipalityId;
      
      // Create Stripe customer portal session for subscription management
      const response = await fetch(`${config.APP.API_HOST}/api/stripe/create-portal-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          municipalityId: municipalityId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to open billing portal');
      }

      const { url } = await response.json();
      
      // Redirect to Stripe customer portal
      window.location.href = url;
      
    } catch (error) {
      console.error('Error opening billing portal:', error);
      this.errorMessage = error.message || 'Failed to open billing portal';
    }
  }

  @action
  async reactivateSubscription() {
    try {
      const token = localStorage.getItem('auth_token');
      const municipalityId = this.billingData.municipalityId;
      
      // Create Stripe customer portal session for subscription management
      const response = await fetch(`${config.APP.API_HOST}/api/stripe/create-portal-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          municipalityId: municipalityId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to open billing portal');
      }

      const { url } = await response.json();
      
      // Redirect to Stripe customer portal
      window.location.href = url;
      
    } catch (error) {
      console.error('Error opening billing portal:', error);
      this.errorMessage = error.message || 'Failed to open billing portal';
    }
  }

  get isMunicipalUser() {
    return this.billingData?.userType === 'municipal';
  }

  get isFreeUser() {
    return this.billingData?.userType === 'residential' || this.billingData?.userType === 'commercial';
  }

  get currentPlan() {
    return this.billingData?.subscription?.plan;
  }

  get subscriptionStatus() {
    return this.billingData?.subscription?.status;
  }

  get isSubscriptionActive() {
    return this.billingData?.subscription?.isActive;
  }

  get renewalDate() {
    if (!this.billingData?.subscription?.currentPeriodEnd) return null;
    return new Date(this.billingData.subscription.currentPeriodEnd);
  }

  get formattedRenewalDate() {
    if (!this.renewalDate) return 'N/A';
    return this.renewalDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  get daysUntilRenewal() {
    return this.billingData?.subscription?.daysUntilRenewal || 0;
  }

  get usageData() {
    return this.billingData?.usage;
  }

  get planLimits() {
    return this.billingData?.subscription?.limits;
  }

  get formattedPrice() {
    if (!this.planLimits?.price) return 'Custom';
    return `$${(this.planLimits.price / 100).toFixed(2)}`;
  }

  get isOverLimit() {
    return this.usageData && !this.usageData.isWithinLimits;
  }

  get canUpgrade() {
    return this.currentPlan === 'basic' && this.availablePlans?.professional;
  }

  get canDowngrade() {
    return this.currentPlan === 'professional' && this.availablePlans?.basic;
  }

  get willCancelAtPeriodEnd() {
    return this.billingData?.subscription?.cancelAtPeriodEnd;
  }
}