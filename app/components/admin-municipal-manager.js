import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from '../config/environment';

export default class AdminMunicipalManagerComponent extends Component {
  @service router;
  @service permissions;

  @tracked municipalities = [];
  @tracked selectedMunicipality = null;
  @tracked isLoading = true;
  @tracked error = null;
  @tracked showPaymentConfig = false;
  @tracked paymentConfigForm = {};

  // Municipal editing
  @tracked showMunicipalForm = false;
  
  // Actions dropdown
  @tracked activeDropdownUserId = null;
  @tracked municipalForm = {
    name: '',
    type: '',
    population: '',
    website: '',
    portalUrl: '',
    address: {
      street: '',
      city: '',
      state: '',
      zip: '',
      county: ''
    }
  };

  // Search and filtering
  @tracked searchTerm = '';
  @tracked statusFilter = 'all';
  @tracked planFilter = 'all';

  // Webhook form
  @tracked showWebhookForm = false;
  @tracked editingWebhook = null;
  @tracked webhookForm = {
    name: '',
    url: '',
    events: '',
    active: true
  };

  // User management
  @tracked municipalityUsers = [];
  @tracked usersLoading = false;
  @tracked userTypeFilter = 'all';
  @tracked showUserForm = false;
  @tracked editingUser = null;
  @tracked userForm = {
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    userType: 'residential',
    password: '',
    department: 'building', // Default to building department for municipal users
    permissionLevel: 11,
    businessInfo: {
      businessName: '',
      businessType: ''
    },
    propertyAddress: {
      street: '',
      city: '',
      state: '',
      zip: ''
    }
  };

  // Available departments for municipal users
  availableDepartments = [
    { id: 'building', name: 'Building Department' },
    { id: 'planning', name: 'Planning Department' },
    { id: 'fire', name: 'Fire Department' },
    { id: 'health', name: 'Health Department' },
    { id: 'engineering', name: 'Engineering Department' },
    { id: 'zoning', name: 'Zoning Department' },
    { id: 'environmental', name: 'Environmental Department' },
    { id: 'finance', name: 'Finance Department' },
    { id: 'admin', name: 'Administration' }
  ];

  // Permission levels for municipal users
  get availablePermissionLevels() {
    return [
      { level: 11, name: this.permissions.getRoleName(11), description: 'Basic municipal access' },
      { level: 12, name: this.permissions.getRoleName(12), description: 'View permits and data' },
      { level: 13, name: this.permissions.getRoleName(13), description: 'Manage permit types and categories' },
      { level: 14, name: this.permissions.getRoleName(14), description: 'Review permits for department' },
      { level: 15, name: this.permissions.getRoleName(15), description: 'Conduct inspections' },
      { level: 16, name: this.permissions.getRoleName(16), description: 'Senior inspection duties' },
      { level: 17, name: this.permissions.getRoleName(17), description: 'Supervise department operations' },
      { level: 18, name: this.permissions.getRoleName(18), description: 'Coordinate municipal activities' },
      { level: 19, name: this.permissions.getRoleName(19), description: 'Manage municipal operations' },
      { level: 20, name: this.permissions.getRoleName(20), description: 'Assistant administrative duties' },
      { level: 21, name: this.permissions.getRoleName(21), description: 'Full administrative access' },
      { level: 22, name: this.permissions.getRoleName(22), description: 'System administration' },
      { level: 23, name: this.permissions.getRoleName(23), description: 'Complete municipality control' }
    ];
  }

  constructor() {
    super(...arguments);
    this.loadMunicipalities();
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
  }

  willDestroy() {
    super.willDestroy();
    document.removeEventListener('click', this.handleDocumentClick);
  }

  handleDocumentClick(event) {
    // Close dropdown if clicking outside
    if (!event.target.closest('.actions-dropdown')) {
      this.activeDropdownUserId = null;
    }
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
      
      // Load users for this municipality
      this.loadMunicipalityUsers();
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

  getInitials(firstName, lastName) {
    const first = firstName ? firstName.charAt(0).toUpperCase() : '';
    const last = lastName ? lastName.charAt(0).toUpperCase() : '';
    return first + last;
  }

  getUserInitials(firstName, lastName) {
    const first = firstName ? firstName.charAt(0).toUpperCase() : '';
    const last = lastName ? lastName.charAt(0).toUpperCase() : '';
    return first + last || 'U';
  }

  @action
  toggleUserActions(userId) {
    if (this.activeDropdownUserId === userId) {
      this.activeDropdownUserId = null;
      document.removeEventListener('click', this.handleDocumentClick);
    } else {
      this.activeDropdownUserId = userId;
      // Add click listener when dropdown opens
      document.addEventListener('click', this.handleDocumentClick);
    }
  }

  @action
  preventDropdownClose(event) {
    event.stopPropagation();
  }

  @action
  editMunicipalitySettings() {
    if (this.selectedMunicipality) {
      if (this.showMunicipalForm) {
        // Cancel editing
        this.closeMunicipalForm();
      } else {
        // Start editing
        this.populateMunicipalForm();
        this.showMunicipalForm = true;
      }
    }
  }

  @action
  closeMunicipalForm() {
    this.showMunicipalForm = false;
    this.resetMunicipalForm();
  }

  @action
  updateMunicipalField(field, event) {
    const keys = field.split('.');
    if (keys.length === 2) {
      if (!this.municipalForm[keys[0]]) {
        this.municipalForm[keys[0]] = {};
      }
      this.municipalForm[keys[0]][keys[1]] = event.target.value;
    } else {
      this.municipalForm[field] = event.target.value;
    }
  }

  @action
  async saveMunicipalSettings(event) {
    event.preventDefault();
    
    if (!this.selectedMunicipality) return;

    try {
      const response = await fetch(`${config.APP.API_HOST}/api/admin/municipalities/${this.selectedMunicipality.municipality._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: this.municipalForm.name.trim(),
          type: this.municipalForm.type,
          population: parseInt(this.municipalForm.population) || 0,
          website: this.municipalForm.website.trim(),
          address: this.municipalForm.address,
          settings: {
            portalUrl: this.municipalForm.portalUrl.trim(),
            website: this.municipalForm.website.trim()
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update municipality');
      }

      const updatedData = await response.json();
      
      // Update the selected municipality data
      this.selectedMunicipality.municipality = updatedData.municipality;
      this.selectedMunicipality.settings = updatedData.settings;
      
      // Update the municipality in the list as well
      const index = this.municipalities.findIndex(m => m._id === this.selectedMunicipality.municipality._id);
      if (index !== -1) {
        this.municipalities[index] = { ...this.municipalities[index], ...updatedData.municipality };
        this.municipalities = [...this.municipalities]; // Trigger reactivity
      }

      this.showMunicipalForm = false;
      alert('Municipality information updated successfully!');

    } catch (error) {
      console.error('Error updating municipality:', error);
      alert(`Error: ${error.message}`);
    }
  }

  populateMunicipalForm() {
    if (!this.selectedMunicipality) return;

    const municipality = this.selectedMunicipality.municipality;
    const settings = this.selectedMunicipality.settings || {};

    this.municipalForm = {
      name: municipality.name || '',
      type: municipality.type || '',
      population: municipality.population || '',
      website: municipality.website || '',
      portalUrl: settings.portalUrl || '',
      address: {
        street: municipality.address?.street || '',
        city: municipality.address?.city || '',
        state: municipality.address?.state || '',
        zip: municipality.address?.zip || '',
        county: municipality.address?.county || ''
      }
    };
  }

  resetMunicipalForm() {
    this.municipalForm = {
      name: '',
      type: '',
      population: '',
      website: '',
      portalUrl: '',
      address: {
        street: '',
        city: '',
        state: '',
        zip: '',
        county: ''
      }
    };
  }

  @action
  toggleWebhookForm() {
    this.showWebhookForm = !this.showWebhookForm;
    if (!this.showWebhookForm) {
      this.resetWebhookForm();
    }
  }

  @action
  updateWebhookField(field, event) {
    this.webhookForm[field] = event.target.value;
  }

  @action
  updateWebhookBoolean(field, event) {
    this.webhookForm[field] = event.target.checked;
  }

  @action
  saveWebhook(event) {
    event.preventDefault();
    
    if (!this.selectedMunicipality) return;

    const webhookData = {
      id: this.editingWebhook?.id || Date.now().toString(),
      name: this.webhookForm.name.trim(),
      url: this.webhookForm.url.trim(),
      events: this.webhookForm.events.split(',').map(e => e.trim()).filter(e => e),
      active: this.webhookForm.active,
      createdAt: this.editingWebhook?.createdAt || new Date(),
      updatedAt: new Date()
    };

    if (!this.selectedMunicipality.webhooks) {
      this.selectedMunicipality.webhooks = [];
    }

    if (this.editingWebhook) {
      // Update existing webhook
      const index = this.selectedMunicipality.webhooks.findIndex(w => w.id === this.editingWebhook.id);
      if (index !== -1) {
        this.selectedMunicipality.webhooks[index] = webhookData;
      }
    } else {
      // Add new webhook
      this.selectedMunicipality.webhooks.push(webhookData);
    }

    this.selectedMunicipality = { ...this.selectedMunicipality }; // Trigger reactivity
    this.resetWebhookForm();
    alert(`Webhook ${this.editingWebhook ? 'updated' : 'created'} successfully!`);
  }

  @action
  cancelWebhookForm() {
    this.resetWebhookForm();
  }

  resetWebhookForm() {
    this.showWebhookForm = false;
    this.editingWebhook = null;
    this.webhookForm = {
      name: '',
      url: '',
      events: '',
      active: true
    };
  }

  @action
  editWebhook(webhook) {
    this.editingWebhook = webhook;
    this.webhookForm = {
      name: webhook.name || '',
      url: webhook.url || '',
      events: Array.isArray(webhook.events) ? webhook.events.join(', ') : webhook.events || '',
      active: webhook.active !== undefined ? webhook.active : true
    };
    this.showWebhookForm = true;
  }

  @action
  removeWebhook(webhook) {
    if (confirm(`Are you sure you want to remove webhook ${webhook.url}?`)) {
      const index = this.selectedMunicipality.webhooks.findIndex(w => w.id === webhook.id);
      if (index !== -1) {
        this.selectedMunicipality.webhooks.splice(index, 1);
        this.selectedMunicipality = { ...this.selectedMunicipality }; // Trigger reactivity
        
        alert('Webhook removed successfully!');
      }
    }
  }

  @action
  testWebhook(webhook) {
    alert(`Testing webhook ${webhook.url}...\n\nIn a real application, this would send a test payload to verify the webhook is working correctly.`);
  }

  @action
  async regenerateApiKey() {
    if (!this.selectedMunicipality) return;

    const confirmed = confirm(
      'Are you sure you want to regenerate the API key?\n\n' +
      'This will invalidate the current key and any external software using it will need to be updated.'
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${config.APP.API_HOST}/api/admin/municipalities/${this.selectedMunicipality.municipality._id}/regenerate-api-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate API key');
      }

      const data = await response.json();
      
      // Update the selected municipality with new API key data
      this.selectedMunicipality.apiKey = data.apiKey;
      this.selectedMunicipality = { ...this.selectedMunicipality }; // Trigger reactivity

      alert('API key regenerated successfully!');
    } catch (error) {
      console.error('Error regenerating API key:', error);
      alert(`Error: ${error.message}`);
    }
  }

  @action
  copyApiKey() {
    if (!this.selectedMunicipality?.apiKey?.key) return;

    navigator.clipboard.writeText(this.selectedMunicipality.apiKey.key).then(() => {
      alert('API key copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy API key:', err);
      alert('Failed to copy API key to clipboard');
    });
  }

  // User management methods
  @action
  async loadMunicipalityUsers() {
    if (!this.selectedMunicipality) return;

    this.usersLoading = true;
    try {
      const queryParams = new URLSearchParams({
        userType: this.userTypeFilter,
        limit: 50
      });

      const response = await fetch(`${config.APP.API_HOST}/api/admin/municipalities/${this.selectedMunicipality.municipality._id}/users?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load users: ${response.status}`);
      }

      const data = await response.json();
      this.municipalityUsers = data.users;
    } catch (error) {
      console.error('Error loading municipality users:', error);
      this.error = error.message;
    } finally {
      this.usersLoading = false;
    }
  }

  @action
  updateUserTypeFilter(event) {
    this.userTypeFilter = event.target.value;
    this.loadMunicipalityUsers();
  }

  @action
  toggleUserForm() {
    this.showUserForm = !this.showUserForm;
    if (!this.showUserForm) {
      this.resetUserForm();
    }
  }

  @action
  updateUserField(field, event) {
    const keys = field.split('.');
    if (keys.length === 2) {
      if (!this.userForm[keys[0]]) {
        this.userForm[keys[0]] = {};
      }
      this.userForm[keys[0]][keys[1]] = event.target.value;
      // Trigger reactivity by reassigning the entire object
      this.userForm = { ...this.userForm };
    } else {
      // Create a new object to trigger reactivity
      this.userForm = { ...this.userForm, [field]: event.target.value };
    }
    
  }

  @action
  async saveUser(event) {
    event.preventDefault();
    
    if (!this.selectedMunicipality) return;

    // Validate municipal user requirements
    if (this.userForm.userType === 'municipal') {
      if (!this.userForm.department || this.userForm.department === '') {
        alert('Please select a department for municipal users.');
        return;
      }
      if (!this.userForm.permissionLevel) {
        alert('Please select a permission level for municipal users.');
        return;
      }
    }

    try {
      const url = this.editingUser 
        ? `${config.APP.API_HOST}/api/admin/municipalities/${this.selectedMunicipality.municipality._id}/users/${this.editingUser._id}`
        : `${config.APP.API_HOST}/api/admin/municipalities/${this.selectedMunicipality.municipality._id}/users`;
      
      const method = this.editingUser ? 'PUT' : 'POST';

      const userData = {
        email: this.userForm.email.trim(),
        firstName: this.userForm.firstName.trim(),
        lastName: this.userForm.lastName.trim(),
        phone: this.userForm.phone.trim(),
        userType: this.userForm.userType
      };

      // Add password for new users
      if (!this.editingUser && this.userForm.password) {
        userData.password = this.userForm.password;
      }

      // Add municipal-specific data
      if (this.userForm.userType === 'municipal') {
        userData.department = this.userForm.department;
        userData.permissionLevel = parseInt(this.userForm.permissionLevel);
      }

      // Add type-specific data
      if (this.userForm.userType === 'commercial') {
        userData.businessInfo = this.userForm.businessInfo;
        userData.permissionLevel = 5; // Default commercial level
      } else if (this.userForm.userType === 'residential') {
        userData.propertyAddress = this.userForm.propertyAddress;
        userData.permissionLevel = 1; // Default residential level
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save user');
      }

      const data = await response.json();
      
      // Show password for new users
      if (!this.editingUser && data.tempPassword) {
        alert(`User ${this.editingUser ? 'updated' : 'created'} successfully!\n\nTemporary Password: ${data.tempPassword}\n\nPlease share this password with the user securely.`);
      } else {
        alert(`User ${this.editingUser ? 'updated' : 'created'} successfully!`);
      }

      this.resetUserForm();
      this.loadMunicipalityUsers();

    } catch (error) {
      console.error('Error saving user:', error);
      alert(`Error: ${error.message}`);
    }
  }

  @action
  editUser(user) {
    this.activeDropdownUserId = null; // Close dropdown
    this.editingUser = user;
    this.userForm = {
      email: user.email || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      phone: user.phone || '',
      userType: user.userType || 'residential',
      password: '', // Don't populate existing password
      department: user.department || '',
      permissionLevel: user.permissionLevel || 11,
      businessInfo: {
        businessName: user.businessInfo?.businessName || '',
        businessType: user.businessInfo?.businessType || ''
      },
      propertyAddress: {
        street: user.propertyAddress?.street || '',
        city: user.propertyAddress?.city || '',
        state: user.propertyAddress?.state || '',
        zip: user.propertyAddress?.zip || ''
      }
    };
    this.showUserForm = true;
  }

  @action
  async toggleUserStatus(user) {
    this.activeDropdownUserId = null; // Close dropdown
    try {
      const response = await fetch(`${config.APP.API_HOST}/api/admin/municipalities/${this.selectedMunicipality.municipality._id}/users/${user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          isActive: !user.isActive
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update user status');
      }

      // Update local data
      const userIndex = this.municipalityUsers.findIndex(u => u._id === user._id);
      if (userIndex !== -1) {
        this.municipalityUsers[userIndex].isActive = !user.isActive;
        this.municipalityUsers = [...this.municipalityUsers]; // Trigger reactivity
      }

      alert(`User ${!user.isActive ? 'activated' : 'deactivated'} successfully!`);

    } catch (error) {
      console.error('Error updating user status:', error);
      alert(`Error: ${error.message}`);
    }
  }

  resetUserForm() {
    this.showUserForm = false;
    this.editingUser = null;
    this.userForm = {
      email: '',
      firstName: '',
      lastName: '',
      phone: '',
      userType: 'residential',
      password: '',
      department: 'building', // Default to building department for municipal users
      permissionLevel: 11,
      businessInfo: {
        businessName: '',
        businessType: ''
      },
      propertyAddress: {
        street: '',
        city: '',
        state: '',
        zip: ''
      }
    };
  }

  @action
  async sendUserInvitation(user) {
    if (!user || !this.selectedMunicipality) return;
    
    this.activeDropdownUserId = null; // Close dropdown

    const confirmed = confirm(
      `Send login invitation to ${user.firstName} ${user.lastName} (${user.email})?\n\n` +
      'This will send them an email with login instructions and password setup information.'
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${config.APP.API_HOST}/api/admin/municipalities/${this.selectedMunicipality.municipality._id}/users/${user._id}/send-invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send invitation');
      }

      const data = await response.json();
      alert(`Invitation sent successfully to ${user.email}!\n\n${data.message || 'The user will receive login instructions via email.'}`);

    } catch (error) {
      console.error('Error sending user invitation:', error);
      alert(`Error: ${error.message}`);
    }
  }
}