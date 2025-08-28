const { Storage } = require('@google-cloud/storage');
const fs = require('fs').promises;
const path = require('path');

class FileStorageService {
  constructor() {
    this.storageType = process.env.STORAGE_TYPE || 'local';
    this.init();
  }

  init() {
    if (this.storageType === 'gcs') {
      this.initGCS();
    } else {
      this.initLocal();
    }
  }

  initGCS() {
    try {
      let storageConfig = {
        projectId: process.env.GCS_PROJECT_ID,
      };

      // Use service account key file if available
      if (process.env.GCS_KEY_FILE_PATH && fs.existsSync) {
        try {
          require('fs').accessSync(process.env.GCS_KEY_FILE_PATH);
          storageConfig.keyFilename = process.env.GCS_KEY_FILE_PATH;
        } catch (error) {
          console.log('GCS key file not found, trying base64 key...');
        }
      }

      // Use base64 encoded service account key as fallback
      if (!storageConfig.keyFilename && process.env.GCS_SERVICE_ACCOUNT_KEY_BASE64) {
        try {
          const serviceAccountKey = JSON.parse(
            Buffer.from(process.env.GCS_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8')
          );
          storageConfig.credentials = serviceAccountKey;
        } catch (error) {
          console.error('Failed to parse GCS service account key:', error);
        }
      }

      this.gcsStorage = new Storage(storageConfig);
      this.gcsBucket = this.gcsStorage.bucket(process.env.GCS_BUCKET_NAME);
      
      console.log('✅ Google Cloud Storage initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Google Cloud Storage:', error);
      console.log('Falling back to local storage...');
      this.storageType = 'local';
      this.initLocal();
    }
  }

  initLocal() {
    this.localUploadDir = path.join(__dirname, '../uploads/permit-files');
    // Create directory if it doesn't exist
    fs.mkdir(this.localUploadDir, { recursive: true }).catch(console.error);
    console.log('✅ Local file storage initialized');
  }

  /**
   * Generate organized file path: State/Municipality/BuildingPermits/filename
   * @param {string} filename - The file name
   * @param {Object} organizationData - Contains state and municipality info
   * @returns {string} - Organized file path
   */
  generateOrganizedPath(filename, organizationData = {}) {
    const { state, municipality } = organizationData;
    
    // Sanitize path components (remove special characters, spaces become underscores)
    const sanitize = (str) => {
      if (!str) return 'Unknown';
      return str.toString()
        .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/-+/g, '_') // Replace hyphens with underscores
        .substring(0, 50); // Limit length
    };
    
    const stateFolder = sanitize(state || 'Unknown_State');
    const municipalityFolder = sanitize(municipality || 'Unknown_Municipality');
    
    return `${stateFolder}/${municipalityFolder}/BuildingPermits/${filename}`;
  }

  /**
   * Upload a file buffer to storage
   * @param {Buffer} buffer - File buffer
   * @param {string} filename - Unique filename
   * @param {string} mimetype - File MIME type
   * @param {Object} metadata - Additional metadata (should include state, municipality)
   * @returns {Promise<Object>} - Storage result with path/url
   */
  async uploadFile(buffer, filename, mimetype, metadata = {}) {
    // Generate organized path
    const organizedFilename = this.generateOrganizedPath(filename, {
      state: metadata.state,
      municipality: metadata.municipality
    });
    
    if (this.storageType === 'gcs') {
      return this.uploadToGCS(buffer, organizedFilename, mimetype, metadata);
    } else {
      return this.uploadToLocal(buffer, organizedFilename, mimetype, metadata);
    }
  }

  async uploadToGCS(buffer, filename, mimetype, metadata) {
    try {
      const file = this.gcsBucket.file(filename);
      
      const stream = file.createWriteStream({
        metadata: {
          contentType: mimetype,
          metadata: {
            ...metadata,
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      return new Promise((resolve, reject) => {
        stream.on('error', (error) => {
          console.error('GCS upload error:', error);
          reject(error);
        });

        stream.on('finish', async () => {
          try {
            // Make file accessible with signed URL (optional, for private access)
            const [signedUrl] = await file.getSignedUrl({
              action: 'read',
              expires: Date.now() + 60 * 60 * 1000, // 1 hour
            });

            resolve({
              path: `gs://${process.env.GCS_BUCKET_NAME}/${filename}`,
              url: signedUrl,
              gcsPath: filename,
              storageType: 'gcs',
            });
          } catch (error) {
            reject(error);
          }
        });

        stream.end(buffer);
      });
    } catch (error) {
      console.error('Error uploading to GCS:', error);
      throw error;
    }
  }

  async uploadToLocal(buffer, filename, mimetype, metadata) {
    try {
      // Create directory structure for organized path
      const fullPath = path.join(this.localUploadDir, filename);
      const dir = path.dirname(fullPath);
      
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(fullPath, buffer);
      
      // Extract path components for URL generation
      const pathParts = filename.split('/');
      const urlPath = pathParts.map(part => encodeURIComponent(part)).join('/');
      
      return {
        path: fullPath,
        url: `/api/permits/files/local/${urlPath}`,
        localPath: fullPath,
        storageType: 'local',
      };
    } catch (error) {
      console.error('Error uploading to local storage:', error);
      throw error;
    }
  }

  /**
   * Download a file from storage
   * @param {string} filePath - Storage path (local path or GCS path)
   * @returns {Promise<Buffer>} - File buffer
   */
  async downloadFile(filePath) {
    if (this.storageType === 'gcs' && filePath.startsWith('gs://')) {
      return this.downloadFromGCS(filePath);
    } else {
      return this.downloadFromLocal(filePath);
    }
  }

  async downloadFromGCS(gcsPath) {
    try {
      // Extract filename from gs://bucket/filename format
      const filename = gcsPath.replace(`gs://${process.env.GCS_BUCKET_NAME}/`, '');
      const file = this.gcsBucket.file(filename);
      
      const [buffer] = await file.download();
      return buffer;
    } catch (error) {
      console.error('Error downloading from GCS:', error);
      throw error;
    }
  }

  async downloadFromLocal(localPath) {
    try {
      return await fs.readFile(localPath);
    } catch (error) {
      console.error('Error downloading from local storage:', error);
      throw error;
    }
  }

  /**
   * Delete a file from storage
   * @param {string} filePath - Storage path (local path or GCS path)
   * @returns {Promise<boolean>} - Success status
   */
  async deleteFile(filePath) {
    if (this.storageType === 'gcs' && filePath.startsWith('gs://')) {
      return this.deleteFromGCS(filePath);
    } else {
      return this.deleteFromLocal(filePath);
    }
  }

  async deleteFromGCS(gcsPath) {
    try {
      const filename = gcsPath.replace(`gs://${process.env.GCS_BUCKET_NAME}/`, '');
      const file = this.gcsBucket.file(filename);
      await file.delete();
      return true;
    } catch (error) {
      console.error('Error deleting from GCS:', error);
      return false;
    }
  }

  async deleteFromLocal(localPath) {
    try {
      await fs.unlink(localPath);
      return true;
    } catch (error) {
      console.error('Error deleting from local storage:', error);
      return false;
    }
  }

  /**
   * Check if file exists
   * @param {string} filePath - Storage path
   * @returns {Promise<boolean>} - File exists status
   */
  async fileExists(filePath) {
    if (this.storageType === 'gcs' && filePath.startsWith('gs://')) {
      return this.fileExistsGCS(filePath);
    } else {
      return this.fileExistsLocal(filePath);
    }
  }

  async fileExistsGCS(gcsPath) {
    try {
      const filename = gcsPath.replace(`gs://${process.env.GCS_BUCKET_NAME}/`, '');
      const file = this.gcsBucket.file(filename);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      return false;
    }
  }

  async fileExistsLocal(localPath) {
    try {
      await fs.access(localPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate a signed URL for secure access (GCS only)
   * @param {string} gcsPath - GCS path
   * @param {number} expirationMs - Expiration time in milliseconds
   * @returns {Promise<string>} - Signed URL
   */
  async generateSignedUrl(gcsPath, expirationMs = 60 * 60 * 1000) {
    if (this.storageType !== 'gcs') {
      throw new Error('Signed URLs only available for GCS storage');
    }

    try {
      const filename = gcsPath.replace(`gs://${process.env.GCS_BUCKET_NAME}/`, '');
      const file = this.gcsBucket.file(filename);
      
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expirationMs,
      });

      return signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw error;
    }
  }

  /**
   * Get storage type
   * @returns {string} - Storage type ('local' or 'gcs')
   */
  getStorageType() {
    return this.storageType;
  }
}

// Export singleton instance
module.exports = new FileStorageService();