import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from '../config/environment';

export default class PermitApprovalModalComponent extends Component {
  @service permissions;
  
  @tracked isSubmitting = false;
  @tracked reviewNotes = '';
  @tracked checkedItems = new Set();
  
  get currentUser() {
    // Use passed currentUser argument, fallback to localStorage
    if (this.args.currentUser) {
      return this.args.currentUser;
    }
    
    // Fallback to localStorage with multiple keys (same as controller)
    const userDetailsStr = localStorage.getItem('user_details') || 
                          localStorage.getItem('user') ||
                          localStorage.getItem('current_user') ||
                          '{}';
    return JSON.parse(userDetailsStr);
  }
  
  get userDepartment() {
    return this.currentUser?.department || 'building';
  }
  
  get permitTypeData() {
    return this.args.permit?.permitType || null;
  }
  
  get checklistItems() {
    const department = this.userDepartment;
    const permitTypeData = this.permitTypeData;
    
    // Get checklist from permit type configuration
    if (permitTypeData?.departmentChecklists?.[department]) {
      return permitTypeData.departmentChecklists[department]
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    
    // Fallback to default checklists if permit type doesn't have custom ones
    const defaultChecklists = {
      building: [
        { id: 'plans_provided', label: 'Building plans provided and complete', required: true },
        { id: 'code_compliance', label: 'Building code compliance verified', required: true },
        { id: 'structural_review', label: 'Structural elements reviewed and approved', required: true },
      ],
      fire: [
        { id: 'fire_safety', label: 'Fire safety requirements met', required: true },
        { id: 'egress_routes', label: 'Emergency egress routes adequate', required: true },
      ],
      health: [
        { id: 'health_compliance', label: 'Health code compliance verified', required: true },
      ],
      planning: [
        { id: 'zoning_compliance', label: 'Zoning requirements compliance verified', required: true },
      ],
      engineering: [
        { id: 'site_plan', label: 'Site engineering plan approved', required: true },
      ],
      zoning: [
        { id: 'zoning_requirements', label: 'Zoning requirements met', required: true },
      ],
      environmental: [
        { id: 'environmental_impact', label: 'Environmental impact assessed', required: true },
      ],
      finance: [
        { id: 'fee_calculation', label: 'Fees calculated correctly', required: true },
      ]
    };
    
    return defaultChecklists[department] || [];
  }
  
  get requiredItems() {
    return this.checklistItems.filter(item => item.required);
  }
  
  get optionalItems() {
    return this.checklistItems.filter(item => !item.required);
  }
  
  get allRequiredItemsChecked() {
    return this.requiredItems.every(item => this.checkedItems.has(item.id));
  }
  
  get canApprove() {
    return this.allRequiredItemsChecked && !this.isSubmitting;
  }
  
  @action
  toggleChecklistItem(itemId) {
    if (this.checkedItems.has(itemId)) {
      this.checkedItems.delete(itemId);
    } else {
      this.checkedItems.add(itemId);
    }
    // Force reactivity update
    this.checkedItems = new Set(this.checkedItems);
  }
  
  @action
  updateReviewNotes(event) {
    this.reviewNotes = event.target.value;
  }
  
  @action
  closeModal() {
    this.args.onClose?.();
  }
  
  @action
  preventModalClose(event) {
    event.stopPropagation();
  }
  
  @action
  async approvePermit() {
    if (!this.canApprove) return;
    
    this.isSubmitting = true;
    
    try {
      const token = localStorage.getItem('auth_token');
      
      // Prepare checklist data
      const checklistData = this.checklistItems.map(item => ({
        id: item.id,
        label: item.label,
        required: item.required,
        checked: this.checkedItems.has(item.id)
      }));
      
      const requestData = {
        status: 'approved',
        notes: this.reviewNotes
      };
      
      console.log('Submitting approval with data:', JSON.stringify(requestData, null, 2));
      console.log('Current user:', JSON.stringify(this.currentUser, null, 2));
      console.log('User department:', this.userDepartment);
      console.log('Permit status:', this.args.permit.status);
      console.log('Permit has approvedDate:', !!this.args.permit.approvedDate);
      console.log('Permit has completedDate:', !!this.args.permit.completedDate);
      console.log('API URL:', `${config.APP.API_HOST}/api/permits/${this.args.permit.id}/department-review`);
      
      const response = await fetch(`${config.APP.API_HOST}/api/permits/${this.args.permit.id}/department-review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit approval');
      }
      
      this.args.onApproval?.();
      this.closeModal();
      
    } catch (error) {
      console.error('Error submitting approval:', error);
      alert(error.message || 'Failed to submit approval. Please try again.');
    } finally {
      this.isSubmitting = false;
    }
  }
  
  @action
  async rejectPermit() {
    if (!this.reviewNotes.trim()) {
      alert('Please provide notes explaining the rejection.');
      return;
    }
    
    this.isSubmitting = true;
    
    try {
      const token = localStorage.getItem('auth_token');
      
      // Prepare checklist data
      const checklistData = this.checklistItems.map(item => ({
        id: item.id,
        label: item.label,
        required: item.required,
        checked: this.checkedItems.has(item.id)
      }));
      
      const requestData = {
        status: 'rejected',
        notes: this.reviewNotes
      };
      
      console.log('Submitting rejection with data:', JSON.stringify(requestData, null, 2));
      console.log('Current user:', JSON.stringify(this.currentUser, null, 2));
      console.log('User department:', this.userDepartment);
      
      const response = await fetch(`${config.APP.API_HOST}/api/permits/${this.args.permit.id}/department-review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit rejection');
      }
      
      this.args.onRejection?.();
      this.closeModal();
      
    } catch (error) {
      console.error('Error submitting rejection:', error);
      alert(error.message || 'Failed to submit rejection. Please try again.');
    } finally {
      this.isSubmitting = false;
    }
  }
}