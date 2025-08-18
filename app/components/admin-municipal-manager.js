import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from '../config/environment';

export default class AdminMunicipalManagerComponent extends Component {
  @service router;

  @tracked municipalities = [];
  @tracked selectedMunicipality = null;
  @tracked isLoading = true;
  @tracked error = null;
  @tracked showPaymentConfig = false;
  @tracked paymentConfigForm = {};

  // Search and filtering
  @tracked searchTerm = '';
  @tracked statusFilter = 'all';
  @tracked planFilter = 'all';

  constructor() {
    super(...arguments);
    this.loadMunicipalities();
  }

  @action
  async loadMunicipalities() {
    this.isLoading = true;
    this.error = null;

    try {
      const queryParams = new URLSearchParams({
        search: this.searchTerm,
        status: this.statusFilter === 'all' ? '' : this.statusFilter,
        plan: this.planFilter === 'all' ? '' : this.planFilter,
        limit: 50
      });

      const response = await fetch(`${config.APP.API_HOST}/api/admin/municipalities?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load municipalities: ${response.status}`);
      }

      const data = await response.json();
      this.municipalities = data.municipalities;
    } catch (error) {
      console.error('Error loading municipalities:', error);
      this.error = error.message;
    } finally {
      this.isLoading = false;
    }
  }

  @action
  async selectMunicipality(municipality) {
    try {
      const response = await fetch(`${config.APP.API_HOST}/api/admin/municipalities/${municipality._id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load municipality details');
      }

      const data = await response.json();
      this.selectedMunicipality = data;
      this.paymentConfigForm = { ...data.municipality.paymentConfig };
    } catch (error) {
      console.error('Error loading municipality details:', error);
      this.error = error.message;
    }
  }

  @action
  closeDetails() {
    this.selectedMunicipality = null;
    this.showPaymentConfig = false;
    this.paymentConfigForm = {};
  }

  @action
  async toggleMunicipalityStatus(municipality) {
    try {
      const response = await fetch(`${config.APP.API_HOST}/api/admin/municipalities/${municipality._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          isActive: !municipality.isActive
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update municipality status');
      }

      // Update the municipality in the list
      const updatedMunicipality = await response.json();
      const index = this.municipalities.findIndex(m => m._id === municipality._id);
      if (index !== -1) {
        this.municipalities[index] = { ...this.municipalities[index], isActive: !municipality.isActive };
        this.municipalities = [...this.municipalities]; // Trigger reactivity
      }

      // Update selected municipality if it's the same one
      if (this.selectedMunicipality && this.selectedMunicipality.municipality._id === municipality._id) {
        this.selectedMunicipality.municipality.isActive = !municipality.isActive;
      }
    } catch (error) {
      console.error('Error updating municipality status:', error);
      alert(`Error: ${error.message}`);
    }
  }

  @action
  showPaymentConfiguration() {
    this.showPaymentConfig = true;
  }

  @action
  hidePaymentConfiguration() {
    this.showPaymentConfig = false;
    // Reset form to original values
    if (this.selectedMunicipality) {
      this.paymentConfigForm = { ...this.selectedMunicipality.municipality.paymentConfig };
    }
  }

  @action
  updatePaymentConfigField(section, field, event) {
    if (!this.paymentConfigForm[section]) {
      this.paymentConfigForm[section] = {};
    }
    this.paymentConfigForm[section][field] = event.target.value;
    this.paymentConfigForm = { ...this.paymentConfigForm }; // Trigger reactivity
  }

  @action
  updatePaymentConfigBoolean(section, field, event) {
    if (!this.paymentConfigForm[section]) {
      this.paymentConfigForm[section] = {};
    }
    this.paymentConfigForm[section][field] = event.target.checked;
    this.paymentConfigForm = { ...this.paymentConfigForm }; // Trigger reactivity
  }

  @action
  async savePaymentConfiguration() {
    try {
      const response = await fetch(`${config.APP.API_HOST}/api/admin/municipalities/${this.selectedMunicipality.municipality._id}/payment-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          paymentConfig: this.paymentConfigForm
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save payment configuration');
      }

      // Update the selected municipality
      this.selectedMunicipality.municipality.paymentConfig = this.paymentConfigForm;
      this.showPaymentConfig = false;

      alert('Payment configuration saved successfully!');
    } catch (error) {
      console.error('Error saving payment configuration:', error);
      alert(`Error: ${error.message}`);
    }
  }

  @action
  updateSearch(event) {
    this.searchTerm = event.target.value;
  }

  @action
  updateStatusFilter(event) {
    this.statusFilter = event.target.value;
    this.loadMunicipalities();
  }

  @action
  updatePlanFilter(event) {
    this.planFilter = event.target.value;
    this.loadMunicipalities();
  }

  @action
  performSearch() {
    this.loadMunicipalities();
  }

  get filteredMunicipalities() {
    return this.municipalities;
  }

  formatSubscriptionPlan(plan) {
    const plans = {
      basic: 'Basic',
      professional: 'Professional',
      enterprise: 'Enterprise'
    };
    return plans[plan] || plan;
  }

  formatSubscriptionStatus(status) {
    const statuses = {
      active: 'Active',
      past_due: 'Past Due',
      canceled: 'Canceled',
      trialing: 'Trialing'
    };
    return statuses[status] || status;
  }
}