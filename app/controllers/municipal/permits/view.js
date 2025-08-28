import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class MunicipalPermitsViewController extends Controller {
  @service router;
  @service permissions;

  @tracked internalMessage = '';
  @tracked publicMessage = '';
  @tracked isSubmitting = false;
  @tracked departmentReviewNotes = '';
  @tracked showEditModal = false;
  @tracked editingStatus = '';
  @tracked editingNotes = '';
  @tracked selectedDepartmentsToReset = [];
  @tracked showApprovalModal = false;

  get departmentReviews() {
    // Use department reviews from model if available, otherwise return null
    return this.model?.departmentReviews || null;
  }

  get currentUserId() {
    return localStorage.getItem('user_id');
  }

  get internalMessages() {
    if (!this.model?.messages) return [];
    return this.model.messages.filter(msg => msg.isInternal === true);
  }

  get publicMessages() {
    if (!this.model?.messages) return [];
    return this.model.messages.filter(msg => msg.isInternal !== true);
  }

  get currentUser() {
    // Try to get user from model first, then localStorage as fallback
    if (this.model?.user) {
      return this.model.user;
    }
    
    // Try multiple localStorage keys that might contain user data
    const userDetailsStr = localStorage.getItem('user_details') || 
                          localStorage.getItem('user') ||
                          localStorage.getItem('current_user') ||
                          '{}';
    
    const userData = JSON.parse(userDetailsStr);
    console.log('currentUser fallback from localStorage:', userData);
    return userData;
  }

  get canUserReviewPermit() {
    const user = this.currentUser;
    
    if (!user?.department || user?.userType !== 'municipal') {
      return false;
    }
    
    // Check if user has review permissions for their permission level
    if (!this.permissions.canReviewPermits(user)) {
      return false;
    }
    
    const departmentReview = this.departmentReviews?.departmentReviews?.find(
      review => review.department === user.department
    );
    
    return departmentReview && departmentReview.status === 'pending';
  }

  get userDepartmentReview() {
    const user = this.currentUser;
    if (!user?.department) return null;
    
    return this.departmentReviews?.departmentReviews?.find(
      review => review.department === user.department
    );
  }

  get availableStatuses() {
    return [
      { value: 'draft', label: 'Draft', description: 'Return to draft for applicant editing' },
      { value: 'submitted', label: 'Submitted', description: 'Submitted for municipal review' },
      { value: 'under-review', label: 'Under Review', description: 'Currently being reviewed by departments' },
      { value: 'additional-info', label: 'Additional Info Required', description: 'Waiting for additional information from applicant' },
      { value: 'approved', label: 'Approved', description: 'Approved and ready for work to begin' },
      { value: 'active', label: 'Active', description: 'Work is in progress' },
      { value: 'inspections', label: 'Inspections', description: 'Undergoing required inspections' },
      { value: 'completed', label: 'Completed', description: 'All work and inspections complete' },
      { value: 'denied', label: 'Denied', description: 'Application has been denied' },
      { value: 'expired', label: 'Expired', description: 'Permit has expired' }
    ];
  }

  get departmentReviewsToReset() {
    if (!this.departmentReviews?.departmentReviews || !Array.isArray(this.departmentReviews.departmentReviews)) return [];
    
    return this.departmentReviews.departmentReviews.filter(review => 
      review.status !== 'pending'
    );
  }

  // Navigation Actions
  @action
  goBack() {
    this.router.transitionTo('municipal.permits.index');
  }

  // Permit Review Actions
  @action
  async approvePermit() {
    // If permit is submitted, start the review process
    if (this.model.permit.status === 'submitted') {
      if (confirm('Start the department review process for this permit?')) {
        await this.updatePermitStatus('under-review', 'Permit moved to department review');
      }
    } else {
      // For other statuses, attempt direct approval
      if (confirm('Are you sure you want to approve this permit?')) {
        await this.updatePermitStatus('approved', 'Permit approved by municipal reviewer');
      }
    }
  }

  async checkForAutoApproval() {
    // Only attempt auto-approval for permits under review
    if (this.model.permit.status !== 'under-review') {
      return;
    }

    try {
      // Reload department reviews to get latest status
      await this.loadDepartmentReviews();
      
      const departmentReviews = this.model.departmentReviews;
      if (!departmentReviews || !departmentReviews.departmentReviews) {
        return;
      }

      const pendingDepartments = departmentReviews.pendingDepartments || [];
      const rejectedReviews = departmentReviews.departmentReviews.filter(review => review.status === 'rejected');
      
      if (rejectedReviews.length > 0) {
        // Don't auto-approve if any department rejected
        console.log('Auto-approval blocked: Some departments have rejected the permit');
        return;
      }

      if (pendingDepartments.length === 0) {
        // All departments have completed their reviews, auto-approve
        console.log('All departments have completed reviews, auto-approving permit');
        await this.updatePermitStatus('approved', 'Permit automatically approved - all department reviews completed');
      } else {
        // Still have pending departments, show status
        const departmentNames = pendingDepartments.map(dept => this.formatDepartmentName(dept)).join(', ');
        console.log(`Waiting for reviews from: ${departmentNames}`);
        
        // Optional: Show a brief status message to user
        const statusElement = document.querySelector('.approval-status-message');
        if (statusElement) {
          statusElement.textContent = `Pending reviews from: ${departmentNames}`;
          statusElement.style.display = 'block';
          setTimeout(() => {
            statusElement.style.display = 'none';
          }, 3000);
        }
      }
    } catch (error) {
      console.error('Error checking for auto-approval:', error);
    }
  }

  @action
  async denyPermit() {
    const reason = prompt('Please provide a reason for denial:');
    if (reason) {
      await this.updatePermitStatus('denied', `Permit denied: ${reason}`);
    }
  }

  @action
  async requestChanges() {
    const changes = prompt('Please describe the required changes:');
    if (changes) {
      await this.updatePermitStatus('pending-corrections', `Changes requested: ${changes}`);
    }
  }

  @action
  async sendToInspections() {
    if (confirm('Send this permit to inspections department?')) {
      await this.updatePermitStatus('inspections', 'Permit sent to inspections department');
    }
  }

  @action
  async markCompleted() {
    if (confirm('Mark this permit as completed?')) {
      await this.updatePermitStatus('completed', 'Permit marked as completed');
    }
  }

  @action
  async scheduleInspection() {
    const scheduledDate = prompt('Enter the scheduled inspection date (YYYY-MM-DD):');
    if (!scheduledDate) return;

    const inspector = prompt('Inspector name (optional):');
    
    try {
      // First, get pending inspection requests for this permit
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.APP.API_HOST}/api/inspection-requests/permit/${this.model.permit.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch inspection requests');
      }

      const inspectionRequests = await response.json();
      const pendingRequest = inspectionRequests.find(req => req.status === 'pending');

      if (!pendingRequest) {
        alert('No pending inspection requests found for this permit.');
        return;
      }

      // Schedule the inspection
      const scheduleResponse = await fetch(`${config.APP.API_HOST}/api/inspection-requests/${pendingRequest._id}/schedule`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scheduledDate: scheduledDate,
          inspector: inspector || undefined
        })
      });

      if (!scheduleResponse.ok) {
        const errorData = await scheduleResponse.json();
        throw new Error(errorData.message || 'Failed to schedule inspection');
      }

      alert('Inspection scheduled successfully!');
      window.location.reload();

    } catch (error) {
      console.error('Error scheduling inspection:', error);
      alert(error.message || 'Failed to schedule inspection. Please try again.');
    }
  }

  @action
  async passInspection() {
    if (confirm('Mark inspection as passed?')) {
      await this.updatePermitStatus('completed', 'All inspections passed - permit completed');
    }
  }

  @action
  async editPermit() {
    this.editingStatus = this.model.permit.status;
    this.editingNotes = '';
    this.selectedDepartmentsToReset = [];
    
    // Department reviews should already be loaded from the route, but refresh if needed
    if (!this.departmentReviews || !this.departmentReviews.departmentReviews) {
      await this.loadDepartmentReviews();
    }
    
    this.showEditModal = true;
  }

  @action
  closeEditModal() {
    this.showEditModal = false;
    this.editingStatus = '';
    this.editingNotes = '';
    this.selectedDepartmentsToReset = [];
  }

  @action
  preventModalClose(event) {
    event.stopPropagation();
  }

  @action
  updateEditingStatus(event) {
    this.editingStatus = event.target.value;
  }

  @action
  updateEditingNotes(event) {
    this.editingNotes = event.target.value;
  }

  @action
  toggleDepartmentForReset(department) {
    if (this.selectedDepartmentsToReset.includes(department)) {
      this.selectedDepartmentsToReset = this.selectedDepartmentsToReset.filter(d => d !== department);
    } else {
      this.selectedDepartmentsToReset = [...this.selectedDepartmentsToReset, department];
    }
  }

  @action
  selectAllDepartments() {
    this.selectedDepartmentsToReset = this.departmentReviewsToReset.map(review => review.department);
  }

  @action
  clearDepartmentSelection() {
    this.selectedDepartmentsToReset = [];
  }

  @action
  async savePermitChanges() {
    if (this.isSubmitting) return;

    this.isSubmitting = true;
    try {
      const token = localStorage.getItem('auth_token');

      // Update permit status if changed
      if (this.editingStatus !== this.model.permit.status) {
        const statusResponse = await fetch(`${config.APP.API_HOST}/api/permits/${this.model.permit.id}/status`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status: this.editingStatus,
            comment: this.editingNotes || `Status changed to ${this.editingStatus} by municipal staff`
          })
        });

        if (!statusResponse.ok) {
          const errorData = await statusResponse.json();
          throw new Error(errorData.error || 'Failed to update permit status');
        }
      }

      // Reset selected department reviews
      if (this.selectedDepartmentsToReset.length > 0) {
        const resetResponse = await fetch(`${config.APP.API_HOST}/api/permits/${this.model.permit.id}/reset-department-reviews`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            departments: this.selectedDepartmentsToReset,
            notes: this.editingNotes || 'Department reviews reset by municipal staff'
          })
        });

        if (!resetResponse.ok) {
          const errorData = await resetResponse.json();
          throw new Error(errorData.error || 'Failed to reset department reviews');
        }
      }

      // Add note about changes if provided
      if (this.editingNotes) {
        await this.sendMessage(this.editingNotes, true);
      }

      alert('Permit updated successfully!');
      this.closeEditModal();
      
      // Reload department reviews and refresh page
      await this.loadDepartmentReviews();
      window.location.reload();

    } catch (error) {
      console.error('Error updating permit:', error);
      alert(error.message || 'Failed to update permit. Please try again.');
    } finally {
      this.isSubmitting = false;
    }
  }

  // Department Review Actions (legacy methods kept for backward compatibility if needed)

  @action
  updateDepartmentReviewNotes(event) {
    this.departmentReviewNotes = event.target.value;
  }

  // Approval Modal Actions
  @action
  openApprovalModal() {
    this.showApprovalModal = true;
  }

  @action
  closeApprovalModal() {
    this.showApprovalModal = false;
  }

  @action
  async handleApproval() {
    // Reload department reviews and check for auto-approval
    await this.loadDepartmentReviews();
    await this.checkForAutoApproval();
    window.location.reload();
  }

  @action
  async handleRejection() {
    // Reload department reviews and refresh page
    await this.loadDepartmentReviews();
    window.location.reload();
  }

  @action
  async loadDepartmentReviews() {
    try {
      const token = localStorage.getItem('auth_token');
      console.log('Reloading department reviews for permit:', this.model.permit.id);
      
      const response = await fetch(`${config.APP.API_HOST}/api/permits/${this.model.permit.id}/department-reviews`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Department reviews response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Department reviews error response:', errorText);
        throw new Error(`Failed to load department reviews: ${response.status} - ${errorText}`);
      }

      const reviewData = await response.json();
      console.log('Department reviews reloaded:', reviewData);
      // Update the model data directly
      this.model.departmentReviews = reviewData;
      
      // Show current review status when data loads
      this.showCurrentReviewStatus();
    } catch (error) {
      console.error('Error loading department reviews:', error);
      // Set empty department reviews to prevent template errors
      this.model.departmentReviews = {
        departmentReviews: [],
        requiredDepartments: [],
        pendingDepartments: [],
        approvedDepartments: [],
        canCurrentUserReview: false
      };
    }
  }

  showCurrentReviewStatus() {
    const departmentReviews = this.model.departmentReviews;
    if (!departmentReviews || this.model.permit.status !== 'under-review') {
      return;
    }

    const pendingDepartments = departmentReviews.pendingDepartments || [];
    const approvedDepartments = departmentReviews.approvedDepartments || [];
    const rejectedReviews = departmentReviews.departmentReviews?.filter(review => review.status === 'rejected') || [];
    
    const statusElement = document.querySelector('.approval-status-message');
    if (!statusElement) return;

    if (rejectedReviews.length > 0) {
      const rejectedDepartmentNames = rejectedReviews.map(review => this.formatDepartmentName(review.department)).join(', ');
      statusElement.innerHTML = `<strong>⚠️ Rejected by:</strong> ${rejectedDepartmentNames}`;
      statusElement.style.background = '#f8d7da';
      statusElement.style.borderColor = '#f5c6cb';
      statusElement.style.color = '#721c24';
      statusElement.style.display = 'block';
    } else if (pendingDepartments.length === 0 && approvedDepartments.length > 0) {
      statusElement.innerHTML = `<strong>✅ All departments approved!</strong> Permit will be automatically approved.`;
      statusElement.style.background = '#d1edff';
      statusElement.style.borderColor = '#b8daff';
      statusElement.style.color = '#004085';
      statusElement.style.display = 'block';
    } else if (pendingDepartments.length > 0) {
      const pendingNames = pendingDepartments.map(dept => this.formatDepartmentName(dept)).join(', ');
      const approvedNames = approvedDepartments.map(dept => this.formatDepartmentName(dept)).join(', ');
      let message = `<strong>📋 Pending reviews:</strong> ${pendingNames}`;
      if (approvedNames) {
        message += `<br><strong>✅ Approved by:</strong> ${approvedNames}`;
      }
      statusElement.innerHTML = message;
      statusElement.style.background = '#fff3cd';
      statusElement.style.borderColor = '#ffeaa7';
      statusElement.style.color = '#856404';
      statusElement.style.display = 'block';
    }
  }

  // Chat/Message Actions
  @action
  updateInternalMessage(event) {
    this.internalMessage = event.target.value;
  }

  @action
  updatePublicMessage(event) {
    this.publicMessage = event.target.value;
  }

  @action
  handleInternalKeyup(event) {
    if (event.key === 'Enter' && this.internalMessage.trim()) {
      this.sendInternalMessage();
    }
  }

  @action
  handlePublicKeyup(event) {
    if (event.key === 'Enter' && this.publicMessage.trim()) {
      this.sendPublicMessage();
    }
  }

  @action
  async sendInternalMessage() {
    if (!this.internalMessage.trim() || this.isSubmitting) return;

    this.isSubmitting = true;
    try {
      await this.sendMessage(this.internalMessage, true);
      this.internalMessage = '';
    } catch (error) {
      console.error('Error sending internal message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      this.isSubmitting = false;
    }
  }

  @action
  async sendPublicMessage() {
    if (!this.publicMessage.trim() || this.isSubmitting) return;

    this.isSubmitting = true;
    try {
      await this.sendMessage(this.publicMessage, false);
      this.publicMessage = '';
    } catch (error) {
      console.error('Error sending public message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      this.isSubmitting = false;
    }
  }

  @action
  async downloadFile(fileId) {
    try {
      const token = localStorage.getItem('auth_token');
      const url = `${config.APP.API_HOST}/api/permits/${this.model.permit.id}/files/${fileId}/download`;
      
      // Open file in new tab
      window.open(url + `?token=${encodeURIComponent(token)}`, '_blank');
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file. Please try again.');
    }
  }

  // Helper Methods
  async submitDepartmentReview(status, notes) {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`${config.APP.API_HOST}/api/permits/${this.model.permit.id}/department-review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: status,
          notes: notes
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit department review');
      }

      alert('Department review submitted successfully!');
      this.departmentReviewNotes = '';
      
      // Reload department reviews and refresh page
      await this.loadDepartmentReviews();
      window.location.reload();
      
    } catch (error) {
      console.error('Error submitting department review:', error);
      alert(error.message || 'Failed to submit department review. Please try again.');
    }
  }

  async updatePermitStatus(newStatus, comment) {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`${config.APP.API_HOST}/api/permits/${this.model.permit.id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: newStatus,
          comment: comment
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update permit status: ${response.status}`);
      }

      // Add status change message
      if (comment) {
        await this.sendMessage(comment, true);
      }

      // Refresh the page to show updated status
      window.location.reload();
      
    } catch (error) {
      console.error('Error updating permit status:', error);
      alert('Failed to update permit status. Please try again.');
    }
  }

  async sendMessage(content, isInternal) {
    const token = localStorage.getItem('auth_token');
    
    const response = await fetch(`${config.APP.API_HOST}/api/permit-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        permitId: this.model.permit.id,
        content: content,
        isInternal: isInternal
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status}`);
    }

    const newMessage = await response.json();
    
    // Add the new message to the appropriate list
    if (isInternal) {
      this.model.messages = [...(this.model.messages || []), newMessage];
    } else {
      this.model.messages = [...(this.model.messages || []), newMessage];
    }

    // Scroll to bottom of chat
    this.scrollToBottom(isInternal ? 'internal-messages' : 'public-messages');
  }

  scrollToBottom(elementId) {
    setTimeout(() => {
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    }, 100);
  }

  // Timeline Status Helpers
  getTimelineItemClass(step, currentStatus) {
    switch (step) {
      case 'submitted':
        return currentStatus !== 'submitted' ? 'completed' : 'active';
      case 'under-review':
        if (currentStatus === 'under-review') return 'active';
        if (currentStatus !== 'submitted') return 'completed';
        return '';
      case 'approved':
        if (currentStatus === 'approved') return 'active';
        if (currentStatus === 'inspection-requested' || currentStatus === 'inspections' || currentStatus === 'completed') return 'completed';
        return '';
      case 'inspections':
        if (currentStatus === 'inspection-requested') return 'active';
        if (currentStatus === 'inspections') return 'active';
        if (currentStatus === 'completed') return 'completed';
        return '';
      case 'completed':
        return currentStatus === 'completed' ? 'completed' : '';
      default:
        return '';
    }
  }

  // Formatting Helpers
  formatStatus(status) {
    const statusMap = {
      'submitted': 'Submitted',
      'under-review': 'Under Review',
      'approved': 'Approved',
      'active': 'Active',
      'inspection-requested': 'Inspection Requested',
      'inspections': 'Inspections',
      'completed': 'Completed',
      'denied': 'Denied',
      'expired': 'Expired',
      'pending-corrections': 'Pending Corrections'
    };
    return statusMap[status] || status;
  }

  formatDateTime(date) {
    if (!date) return '-';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(date));
  }

  formatCurrency(amount) {
    if (!amount) return '0';
    return new Intl.NumberFormat('en-US').format(amount);
  }

  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatDepartmentName(department) {
    const departmentMap = {
      'building': 'Building',
      'planning': 'Planning',
      'fire': 'Fire',
      'health': 'Health',
      'engineering': 'Engineering',
      'zoning': 'Zoning',
      'environmental': 'Environmental',
      'finance': 'Finance',
      'admin': 'Administration'
    };
    return departmentMap[department] || department;
  }

  formatReviewStatus(status) {
    const statusMap = {
      'pending': 'Pending Review',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'changes-requested': 'Changes Requested'
    };
    return statusMap[status] || status;
  }

  getReviewStatusClass(status) {
    const classMap = {
      'pending': 'text-warning',
      'approved': 'text-success',
      'rejected': 'text-danger',
      'changes-requested': 'text-info'
    };
    return classMap[status] || 'text-muted';
  }
}