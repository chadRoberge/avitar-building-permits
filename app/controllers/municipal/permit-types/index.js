import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import config from 'avitar-building-permits/config/environment';

export default class MunicipalPermitTypesIndexController extends Controller {
  @service router;
  @service permissions;

  @tracked permitTypes = [];
  @tracked isLoading = true;
  @tracked errorMessage = '';
  @tracked showDeleteModal = false;
  @tracked permitTypeToDelete = null;

  get currentUser() {
    return JSON.parse(localStorage.getItem('user_details') || '{}');
  }

  get canManagePermitTypes() {
    return this.permissions.canManagePermitTypes(this.currentUser);
  }

  async loadPermitTypes() {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${config.APP.API_HOST}/api/permit-types`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to load permit types');
      }

      const permitTypes = await response.json();

      // Transform data for display
      this.permitTypes = permitTypes.map((permitType) => {
        const formFields = permitType.applicationFields || [];
        return {
          id: permitType._id,
          name: permitType.name,
          code: permitType.code,
          description: permitType.description,
          category: permitType.category,
          baseFee:
            permitType.fees && permitType.fees.length > 0
              ? permitType.fees[0].amount
              : 0,
          processingTime: permitType.estimatedProcessingTime || 14,
          isActive: permitType.isActive,
          requiresInspection:
            permitType.requiredInspections &&
            permitType.requiredInspections.length > 0,
          formFields: formFields,
          previewFields: formFields.slice(0, 3),
          questionsCount: formFields.length,
          additionalQuestionsCount: Math.max(0, formFields.length - 3),
          applicationsCount: permitType.applicationsCount || 0,
          icon: this.getCategoryIcon(permitType.category),
          createdAt: permitType.createdAt,
          updatedAt: permitType.updatedAt,
        };
      });
    } catch (error) {
      console.error('Error loading permit types:', error);
      this.errorMessage =
        error.message || 'An error occurred while loading permit types';
    } finally {
      this.isLoading = false;
    }
  }

  getCategoryIcon(category) {
    const iconMap = {
      building: '🏗️',
      zoning: '📋',
      electrical: '⚡',
      plumbing: '🔧',
      mechanical: '🌡️',
      specialized: '🛠️',
      custom: '🔧',
    };
    return iconMap[category] || '📄';
  }

  @action
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  }

  @action
  async togglePermitType(permitType) {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(
        `${config.APP.API_HOST}/api/permit-types/${permitType.id}/toggle`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update permit type');
      }

      // Update local state
      permitType.isActive = !permitType.isActive;
    } catch (error) {
      console.error('Error toggling permit type:', error);
      this.errorMessage =
        error.message || 'An error occurred while updating the permit type';
    }
  }

  @action
  deletePermitType(permitType) {
    this.permitTypeToDelete = permitType;
    this.showDeleteModal = true;
  }

  @action
  closeDeleteModal() {
    this.showDeleteModal = false;
    this.permitTypeToDelete = null;
  }

  @action
  stopPropagation(event) {
    event.stopPropagation();
  }

  @action
  async confirmDelete() {
    if (!this.permitTypeToDelete) return;

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(
        `${config.APP.API_HOST}/api/permit-types/${this.permitTypeToDelete.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete permit type');
      }

      // Remove from local state
      this.permitTypes = this.permitTypes.filter(
        (pt) => pt.id !== this.permitTypeToDelete.id,
      );
      this.closeDeleteModal();
    } catch (error) {
      console.error('Error deleting permit type:', error);
      this.errorMessage =
        error.message || 'An error occurred while deleting the permit type';
      this.closeDeleteModal();
    }
  }

  @action
  editPermitType(permitTypeId) {
    this.router.transitionTo('municipal.permit-types.edit', permitTypeId);
  }
}
