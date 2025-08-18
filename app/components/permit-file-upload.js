import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import config from 'avitar-building-permits/config/environment';

export default class PermitFileUploadComponent extends Component {
  @tracked files = [];
  @tracked isUploading = false;
  @tracked uploadError = null;
  @tracked uploadSuccess = null;
  @tracked selectedFileType = 'other';
  @tracked fileDescription = '';
  @tracked isDragOver = false;

  fileTypes = [
    { value: 'plans', label: 'Plans & Drawings' },
    { value: 'specifications', label: 'Specifications' },
    { value: 'calculations', label: 'Calculations' },
    { value: 'photos', label: 'Photos' },
    { value: 'reports', label: 'Reports' },
    { value: 'correspondence', label: 'Correspondence' },
    { value: 'certificates', label: 'Certificates' },
    { value: 'surveys', label: 'Surveys' },
    { value: 'other', label: 'Other' }
  ];

  get allowedFileTypes() {
    return [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'application/zip',
      'application/x-zip-compressed'
    ];
  }

  get allowedExtensions() {
    return '.jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip';
  }

  get hasSelectedFiles() {
    return this.files.length > 0;
  }

  get canUpload() {
    return this.hasSelectedFiles && !this.isUploading;
  }

  @action
  handleFileSelect(event) {
    const selectedFiles = Array.from(event.target.files);
    this.validateAndAddFiles(selectedFiles);
  }

  @action
  handleDragOver(event) {
    event.preventDefault();
    this.isDragOver = true;
  }

  @action
  handleDragLeave(event) {
    event.preventDefault();
    this.isDragOver = false;
  }

  @action
  handleDrop(event) {
    event.preventDefault();
    this.isDragOver = false;
    
    const droppedFiles = Array.from(event.dataTransfer.files);
    this.validateAndAddFiles(droppedFiles);
  }

  @action
  validateAndAddFiles(newFiles) {
    this.uploadError = null;
    const validFiles = [];
    const errors = [];

    // Check file count limit (5 files max)
    if (this.files.length + newFiles.length > 5) {
      this.uploadError = 'Maximum 5 files allowed at once.';
      return;
    }

    for (const file of newFiles) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        errors.push(`${file.name}: File too large (max 10MB)`);
        continue;
      }

      // Check file type
      if (!this.allowedFileTypes.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type`);
        continue;
      }

      // Check for duplicates
      if (this.files.find(f => f.name === file.name && f.size === file.size)) {
        errors.push(`${file.name}: File already selected`);
        continue;
      }

      validFiles.push({
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        id: Math.random().toString(36).substr(2, 9)
      });
    }

    if (errors.length > 0) {
      this.uploadError = errors.join(', ');
    }

    this.files = [...this.files, ...validFiles];
  }

  @action
  removeFile(fileId) {
    this.files = this.files.filter(f => f.id !== fileId);
    this.uploadError = null;
  }

  @action
  updateFileType(event) {
    this.selectedFileType = event.target.value;
  }

  @action
  updateDescription(event) {
    this.fileDescription = event.target.value;
  }

  @action
  clearFiles() {
    this.files = [];
    this.uploadError = null;
    this.uploadSuccess = null;
    this.fileDescription = '';
  }

  @action
  async uploadFiles() {
    if (!this.canUpload) return;

    this.isUploading = true;
    this.uploadError = null;
    this.uploadSuccess = null;

    try {
      const token = localStorage.getItem('auth_token');
      const formData = new FormData();

      // Add files to form data
      this.files.forEach(fileObj => {
        formData.append('files', fileObj.file);
      });

      // Add metadata
      formData.append('fileType', this.selectedFileType);
      formData.append('description', this.fileDescription);

      const response = await fetch(`${config.APP.API_HOST}/api/permits/${this.args.permitId}/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      this.uploadSuccess = result.message;
      this.clearFiles();

      // Notify parent component of successful upload
      if (this.args.onUploadSuccess) {
        this.args.onUploadSuccess(result.files);
      }

    } catch (error) {
      console.error('Upload error:', error);
      this.uploadError = error.message;
    } finally {
      this.isUploading = false;
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}