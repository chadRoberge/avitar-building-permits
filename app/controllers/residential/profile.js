import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class ResidentialProfileController extends Controller {
  @service router;
  @service('current-property') currentProperty;

  @tracked showEditModal = false;

  @action
  openEditModal() {
    this.showEditModal = true;
  }

  @action
  closeEditModal() {
    this.showEditModal = false;
  }

  @action
  handleProfileUpdated(updatedUser, emailChanged) {
    // Update the model with the new user data
    this.model.user = updatedUser;

    // If email was changed, we might want to refresh the page or show a message
    if (emailChanged) {
      // Optionally refresh the current route to get updated data
      this.router.refresh();
    }

    // The success message is handled by the modal component
    // Modal will close automatically after showing success
  }
}