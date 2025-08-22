import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import config from 'avitar-building-permits/config/environment';

export default class ResidentialPermitsViewController extends Controller {
  @service router;

  @tracked requestType = null;
  @tracked preferredDate = null;
  @tracked inspectionNotes = '';
  @tracked isSubmittingInspection = false;
  @tracked showInspectionForm = false;

  @action
  goBack() {
    this.router.transitionTo('residential.permits.index');
  }

  @action
  toggleInspectionRequest() {
    this.showInspectionForm = !this.showInspectionForm;
    // Reset form when closing
    if (!this.showInspectionForm) {
      this.requestType = null;
      this.preferredDate = null;
      this.inspectionNotes = '';
    }
  }

  @action
  handleFileUploaded(uploadedFiles) {
    // Files have been uploaded successfully
    console.log('Files uploaded:', uploadedFiles);

    // Update the files display component with the new files
    if (this.filesDisplayComponent) {
      this.filesDisplayComponent.handleFileUploaded(uploadedFiles);
    }
  }

  @action
  setFilesDisplayComponent(component) {
    this.filesDisplayComponent = component;
  }

  @action
  handleFileDeleted(deletedFile) {
    // File has been deleted successfully
    console.log('File deleted:', deletedFile);

    // The PermitFilesDisplay component handles removing the file from its local list
  }

  @action
  setRequestType(event) {
    this.requestType = event.target.value;
    if (this.requestType !== 'specific_date') {
      this.preferredDate = null;
    }
  }

  @action
  setPreferredDate(event) {
    this.preferredDate = event.target.value;
  }

  @action
  setInspectionNotes(event) {
    this.inspectionNotes = event.target.value;
  }

  @action
  async requestInspection() {
    if (!this.requestType || this.isSubmittingInspection) return;

    this.isSubmittingInspection = true;

    try {
      const token = localStorage.getItem('auth_token');
      const requestData = {
        permitId: this.model.permit.id,
        requestType: this.requestType,
        inspectionType: 'Final Inspection',
        notes: this.inspectionNotes.trim() || undefined
      };

      if (this.requestType === 'specific_date' && this.preferredDate) {
        requestData.preferredDate = this.preferredDate;
      }

      const response = await fetch(`${config.APP.API_HOST}/api/inspection-requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Request failed: ${response.status}`);
      }

      const inspectionRequest = await response.json();
      
      alert('Inspection request submitted successfully! You will be notified when it is scheduled.');
      
      // Reset form and close dropdown
      this.requestType = null;
      this.preferredDate = null;
      this.inspectionNotes = '';
      this.showInspectionForm = false;
      
      // Refresh the page to update permit status
      window.location.reload();

    } catch (error) {
      console.error('Error requesting inspection:', error);
      alert(error.message || 'Failed to request inspection. Please try again.');
    } finally {
      this.isSubmittingInspection = false;
    }
  }
}
