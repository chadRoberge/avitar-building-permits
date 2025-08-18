import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import config from 'avitar-building-permits/config/environment';

export default class PermitFilesDisplayComponent extends Component {
  @tracked files = [];
  @tracked isLoading = true;
  @tracked loadError = null;
  @tracked expandedFiles = new Set();

  constructor() {
    super(...arguments);
    this.loadFiles();

    // Notify parent component that this component is ready
    if (this.args.onMount) {
      this.args.onMount(this);
    }
  }

  get hasFiles() {
    return this.files.length > 0;
  }

  get totalFileCount() {
    return this.files.length;
  }

  get totalFileSize() {
    return this.files.reduce((total, file) => total + (file.size || 0), 0);
  }

  @action
  async loadFiles() {
    this.isLoading = true;
    this.loadError = null;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${config.APP.API_HOST}/api/permits/${this.args.permitId}/files`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error('Failed to load files');
      }

      this.files = await response.json();
    } catch (error) {
      console.error('Error loading files:', error);
      this.loadError = error.message;
    } finally {
      this.isLoading = false;
    }
  }

  @action
  toggleFileDetails(fileId) {
    if (this.expandedFiles.has(fileId)) {
      this.expandedFiles.delete(fileId);
    } else {
      this.expandedFiles.add(fileId);
    }
    // Trigger reactivity
    this.expandedFiles = new Set(this.expandedFiles);
  }

  isFileExpanded = (fileId) => {
    return this.expandedFiles.has(fileId);
  };

  @action
  async downloadFile(file) {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(file.downloadUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download file: ' + error.message);
    }
  }

  @action
  async deleteFile(file) {
    if (!confirm(`Are you sure you want to delete "${file.originalName}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${config.APP.API_HOST}/api/permits/${this.args.permitId}/files/${file._id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete file');
      }

      // Remove from local list
      this.files = this.files.filter((f) => f._id !== file._id);

      // Notify parent component
      if (this.args.onFileDeleted) {
        this.args.onFileDeleted(file);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete file: ' + error.message);
    }
  }

  @action
  handleFileUploaded(newFiles) {
    // Add new files to the list
    this.files = [...this.files, ...newFiles];
  }

  formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return (
      date.toLocaleDateString() +
      ' ' +
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  };

  getFileIcon = (mimetype) => {
    if (!mimetype) return '📄';

    if (mimetype.startsWith('image/')) return '🖼️';
    if (mimetype === 'application/pdf') return '📕';
    if (mimetype.includes('word')) return '📘';
    if (mimetype.includes('excel') || mimetype.includes('spreadsheet'))
      return '📗';
    if (mimetype.includes('zip')) return '📦';
    if (mimetype.startsWith('text/')) return '📄';

    return '📎';
  };

  canDeleteFile(file) {
    // For now, allow deletion if user uploaded the file
    // In the future, could check user permissions
    return true;
  }
}
