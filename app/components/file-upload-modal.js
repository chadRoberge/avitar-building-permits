import Component from '@glimmer/component';
import { action } from '@ember/object';

export default class FileUploadModalComponent extends Component {
  @action
  close() {
    if (this.args.onClose) {
      this.args.onClose();
    }
  }

  @action
  handleOverlayClick() {
    // Close modal when clicking on overlay
    this.close();
  }

  @action
  stopPropagation(event) {
    // Prevent modal from closing when clicking inside the modal
    event.stopPropagation();
  }

  @action
  handleUploadSuccess(uploadedFiles) {
    // Pass upload success to parent component
    if (this.args.onUploadSuccess) {
      this.args.onUploadSuccess(uploadedFiles);
    }
    
    // Close modal after successful upload
    this.close();
  }
}