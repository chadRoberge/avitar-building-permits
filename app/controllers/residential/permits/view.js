import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class ResidentialPermitsViewController extends Controller {
  @service router;

  @action
  goBack() {
    this.router.transitionTo('residential.permits.index');
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
}
