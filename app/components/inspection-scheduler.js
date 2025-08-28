import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from '../config/environment';

export default class InspectionSchedulerComponent extends Component {
  @service router;
  
  @tracked selectedInspectionType = '';
  @tracked selectedDate = '';
  @tracked selectedTimeSlot = '';
  @tracked availableTimeSlots = [];
  @tracked inspectionNotes = '';
  @tracked isLoadingSlots = false;
  @tracked isScheduling = false;
  @tracked error = null;
  @tracked success = false;

  get permit() {
    return this.args.permit;
  }

  get canScheduleInspections() {
    // Can schedule inspections if permit is paid and approved/active
    return this.permit.paymentStatus === 'paid' &&
           ['approved', 'active', 'inspections'].includes(this.permit.status);
  }

  get requiredInspections() {
    // Get required inspections from permit type or default list
    const permitType = this.permit.permitType;
    if (permitType?.requiredInspections?.length) {
      return permitType.requiredInspections.filter(inspection => inspection.required);
    }
    
    // Default inspections based on permit type
    const defaultInspections = {
      'building': [
        { name: 'Foundation Inspection', type: 'foundation-inspection' },
        { name: 'Framing Inspection', type: 'framing-inspection' },
        { name: 'Final Inspection', type: 'final-inspection' }
      ],
      'electrical': [
        { name: 'Rough Electrical Inspection', type: 'electrical-rough' },
        { name: 'Final Electrical Inspection', type: 'electrical-final' }
      ],
      'plumbing': [
        { name: 'Rough Plumbing Inspection', type: 'plumbing-rough' },
        { name: 'Final Plumbing Inspection', type: 'plumbing-final' }
      ],
      'mechanical': [
        { name: 'HVAC Rough Inspection', type: 'mechanical-rough' },
        { name: 'HVAC Final Inspection', type: 'mechanical-final' }
      ]
    };

    const category = this.permit.permitType?.category || 'building';
    return defaultInspections[category] || defaultInspections.building;
  }

  get scheduledInspections() {
    return this.permit.inspections?.filter(inspection => 
      ['scheduled', 'completed', 'passed', 'failed'].includes(inspection.status)
    ) || [];
  }

  get availableInspections() {
    // Return inspections that haven't been scheduled yet
    const scheduledTypes = this.scheduledInspections.map(i => i.type);
    return this.requiredInspections.filter(inspection => 
      !scheduledTypes.includes(inspection.type)
    );
  }

  @action
  selectInspectionType(type) {
    this.selectedInspectionType = type;
    this.selectedDate = '';
    this.selectedTimeSlot = '';
    this.availableTimeSlots = [];
  }

  @action
  handleInspectionTypeChange(event) {
    this.selectInspectionType(event.target.value);
  }

  @action
  async selectDate(event) {
    const date = event.target.value;
    this.selectedDate = date;
    this.selectedTimeSlot = '';
    
    if (date) {
      await this.loadAvailableTimeSlots(date);
    }
  }

  @action
  selectTimeSlot(timeSlot) {
    this.selectedTimeSlot = timeSlot;
  }

  @action
  updateNotes(event) {
    this.inspectionNotes = event.target.value;
  }

  async loadAvailableTimeSlots(date) {
    if (!date || !this.selectedInspectionType) return;

    this.isLoadingSlots = true;
    this.error = null;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${config.APP.API_HOST}/api/inspections/available-slots?date=${date}&type=${this.selectedInspectionType}&municipality=${this.permit.municipality}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        this.availableTimeSlots = data.availableSlots || [];
      } else {
        throw new Error('Failed to load available time slots');
      }
    } catch (error) {
      console.error('Error loading time slots:', error);
      this.error = 'Failed to load available time slots. Please try again.';
      // Provide default time slots as fallback
      this.availableTimeSlots = [
        '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
        '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'
      ];
    } finally {
      this.isLoadingSlots = false;
    }
  }

  @action
  async scheduleInspection() {
    if (!this.selectedInspectionType || !this.selectedDate || !this.selectedTimeSlot) {
      this.error = 'Please select inspection type, date, and time slot.';
      return;
    }

    this.isScheduling = true;
    this.error = null;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.APP.API_HOST}/api/permits/${this.permit.id}/schedule-inspection`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inspectionType: this.selectedInspectionType,
          scheduledDate: this.selectedDate,
          scheduledTime: this.selectedTimeSlot,
          notes: this.inspectionNotes
        })
      });

      if (response.ok) {
        const result = await response.json();
        this.success = true;
        
        // Reset form
        this.selectedInspectionType = '';
        this.selectedDate = '';
        this.selectedTimeSlot = '';
        this.inspectionNotes = '';
        this.availableTimeSlots = [];

        // Notify parent component if callback provided
        if (this.args.onInspectionScheduled) {
          this.args.onInspectionScheduled(result);
        }

        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          this.success = false;
        }, 3000);

      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to schedule inspection');
      }
    } catch (error) {
      console.error('Error scheduling inspection:', error);
      this.error = error.message || 'Failed to schedule inspection. Please try again.';
    } finally {
      this.isScheduling = false;
    }
  }

  @action
  clearError() {
    this.error = null;
  }

  // Helper to get minimum date (tomorrow)
  get minDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  // Helper to get maximum date (30 days from now)
  get maxDate() {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    return maxDate.toISOString().split('T')[0];
  }
}