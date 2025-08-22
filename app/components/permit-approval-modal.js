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
  
  get permitType() {
    return this.args.permit?.type || 'residential';
  }
  
  get checklistItems() {
    const department = this.userDepartment;
    const permitType = this.permitType;
    
    // Define department-specific checklist items based on permit type
    const checklists = {
      building: {
        residential: [
          { id: 'plans_provided', label: 'Building plans provided and complete', required: true },
          { id: 'structural_review', label: 'Structural elements reviewed and approved', required: true },
          { id: 'code_compliance', label: 'Building code compliance verified', required: true },
          { id: 'setback_requirements', label: 'Property setback requirements met', required: true },
          { id: 'foundation_specs', label: 'Foundation specifications adequate', required: true },
          { id: 'electrical_layout', label: 'Electrical layout reviewed (basic)', required: false },
          { id: 'plumbing_layout', label: 'Plumbing layout reviewed (basic)', required: false }
        ],
        commercial: [
          { id: 'plans_provided', label: 'Architectural and engineering plans provided', required: true },
          { id: 'structural_review', label: 'Structural engineering review completed', required: true },
          { id: 'code_compliance', label: 'Commercial building code compliance verified', required: true },
          { id: 'accessibility', label: 'ADA accessibility requirements met', required: true },
          { id: 'occupancy_load', label: 'Occupancy load calculations verified', required: true },
          { id: 'fire_ratings', label: 'Fire rating requirements for materials verified', required: true },
          { id: 'seismic_requirements', label: 'Seismic design requirements met', required: true }
        ]
      },
      fire: {
        residential: [
          { id: 'egress_routes', label: 'Emergency egress routes adequate', required: true },
          { id: 'smoke_detectors', label: 'Smoke detector placement planned', required: true },
          { id: 'fire_separation', label: 'Fire separation between units (if applicable)', required: false },
          { id: 'sprinkler_system', label: 'Sprinkler system requirements reviewed', required: false }
        ],
        commercial: [
          { id: 'fire_suppression', label: 'Fire suppression system design approved', required: true },
          { id: 'egress_routes', label: 'Emergency egress routes and capacity verified', required: true },
          { id: 'fire_alarm_system', label: 'Fire alarm system design reviewed', required: true },
          { id: 'sprinkler_coverage', label: 'Sprinkler system coverage adequate', required: true },
          { id: 'fire_lanes', label: 'Fire department access lanes verified', required: true },
          { id: 'hazmat_storage', label: 'Hazardous materials storage compliance', required: false }
        ]
      },
      health: {
        residential: [
          { id: 'septic_system', label: 'Septic system design adequate (if applicable)', required: false },
          { id: 'water_supply', label: 'Water supply source approved', required: true },
          { id: 'waste_management', label: 'Waste management plan reviewed', required: false }
        ],
        commercial: [
          { id: 'food_service', label: 'Food service facilities comply with health codes', required: false },
          { id: 'water_supply', label: 'Commercial water supply adequate', required: true },
          { id: 'waste_management', label: 'Commercial waste management plan approved', required: true },
          { id: 'ventilation', label: 'HVAC and ventilation systems adequate', required: true },
          { id: 'restroom_facilities', label: 'Restroom facilities meet requirements', required: true }
        ]
      },
      planning: {
        residential: [
          { id: 'zoning_compliance', label: 'Zoning requirements compliance verified', required: true },
          { id: 'lot_coverage', label: 'Lot coverage limits not exceeded', required: true },
          { id: 'height_restrictions', label: 'Building height restrictions met', required: true },
          { id: 'neighbor_notification', label: 'Neighbor notification completed (if required)', required: false }
        ],
        commercial: [
          { id: 'zoning_compliance', label: 'Commercial zoning compliance verified', required: true },
          { id: 'parking_requirements', label: 'Parking space requirements met', required: true },
          { id: 'traffic_impact', label: 'Traffic impact assessment reviewed', required: true },
          { id: 'landscaping', label: 'Landscaping requirements met', required: true },
          { id: 'signage_approval', label: 'Signage plans approved', required: false },
          { id: 'environmental_impact', label: 'Environmental impact assessed', required: false }
        ]
      },
      engineering: {
        residential: [
          { id: 'site_drainage', label: 'Site drainage plan adequate', required: true },
          { id: 'utility_connections', label: 'Utility connection plans reviewed', required: true },
          { id: 'grading_plan', label: 'Site grading plan approved', required: false }
        ],
        commercial: [
          { id: 'site_drainage', label: 'Stormwater management plan approved', required: true },
          { id: 'utility_connections', label: 'All utility connections designed properly', required: true },
          { id: 'traffic_engineering', label: 'Traffic engineering review completed', required: true },
          { id: 'soil_analysis', label: 'Geotechnical soil analysis reviewed', required: true },
          { id: 'grading_plan', label: 'Site grading and excavation plan approved', required: true }
        ]
      }
    };
    
    return checklists[department]?.[permitType] || checklists[department]?.residential || [];
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