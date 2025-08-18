const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();
const auth = require('../middleware/auth');
const PermitFile = require('../models/PermitFile');
const Permit = require('../models/Permit');

// Configure multer for file uploads - memory storage for Vercel serverless
let storage;
let uploadsDir;

if (process.env.VERCEL) {
  // Use memory storage for serverless (files won't persist)
  console.log('Using memory storage for Vercel serverless');
  storage = multer.memoryStorage();
} else {
  // Use disk storage for local development
  uploadsDir = path.join(__dirname, '../uploads/permit-files');
  fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);
  
  storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
      // Generate unique filename: timestamp-random-originalname
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext);
      cb(null, `${name}-${uniqueSuffix}${ext}`);
    },
  });
}

// File filter for security
const fileFilter = (req, file, cb) => {
  // Allowed file types for building permits
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Allowed: images, PDF, Word, Excel, text, ZIP',
      ),
      false,
    );
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5, // Maximum 5 files at once
  },
  fileFilter: fileFilter,
});

// Get all files for a permit
router.get('/:permitId/files', auth, async (req, res) => {
  try {
    console.log('Loading files for permit:', req.params.permitId);
    const { permitId } = req.params;
    const { fileType, status } = req.query;

    // Verify permit exists and user has access
    const permit = await Permit.findById(permitId);
    if (!permit) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    // Check authorization (owner, municipality users, or involved contractors)
    if (
      req.user.userType === 'residential' &&
      permit.applicant.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const options = {};
    if (fileType) options.fileType = fileType;
    if (status) options.status = status;

    const files = await PermitFile.getByPermit(permitId, options);
    const publicFiles = files.map((file) => file.toPublic());

    res.json(publicFiles);
  } catch (error) {
    console.error('Error fetching permit files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Upload files to a permit
router.post(
  '/:permitId/files/upload',
  auth,
  upload.array('files', 5),
  async (req, res) => {
    try {
      const { permitId } = req.params;
      const { fileType = 'other', description = '' } = req.body;

      // Verify permit exists and user has access
      const permit = await Permit.findById(permitId);
      if (!permit) {
        // Clean up uploaded files
        if (req.files) {
          req.files.forEach((file) => {
            fs.unlink(file.path).catch(console.error);
          });
        }
        return res.status(404).json({ error: 'Permit not found' });
      }

      // Check authorization
      if (
        req.user.userType === 'residential' &&
        permit.applicant.toString() !== req.user._id.toString()
      ) {
        // Clean up uploaded files
        if (req.files) {
          req.files.forEach((file) => {
            fs.unlink(file.path).catch(console.error);
          });
        }
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const savedFiles = [];

      // Process each uploaded file
      for (const file of req.files) {
        try {
          const permitFile = new PermitFile({
            permitId: permitId,
            uploadedBy: req.user._id,
            originalName: file.originalname,
            filename: file.filename,
            mimetype: file.mimetype,
            size: file.size,
            fileType: fileType,
            description: description,
            path: file.path,
          });

          await permitFile.save();

          // Populate user info for response
          await permitFile.populate(
            'uploadedBy',
            'firstName lastName email userType',
          );

          savedFiles.push(permitFile.toPublic());
        } catch (error) {
          console.error('Error saving file:', error);
          // Clean up file if database save failed
          fs.unlink(file.path).catch(console.error);
        }
      }

      if (savedFiles.length === 0) {
        return res.status(500).json({ error: 'Failed to save any files' });
      }

      // Update permit's updated date
      permit.updatedAt = new Date();
      await permit.save();

      res.status(201).json({
        message: `${savedFiles.length} file(s) uploaded successfully`,
        files: savedFiles,
      });
    } catch (error) {
      console.error('Error uploading files:', error);

      // Clean up uploaded files on error
      if (req.files) {
        req.files.forEach((file) => {
          fs.unlink(file.path).catch(console.error);
        });
      }

      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res
            .status(400)
            .json({ error: 'File too large. Maximum size is 10MB.' });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
          return res
            .status(400)
            .json({ error: 'Too many files. Maximum is 5 files at once.' });
        }
      }

      res
        .status(500)
        .json({ error: 'File upload failed', details: error.message });
    }
  },
);

// Download/view a specific file
router.get('/:permitId/files/:fileId/download', auth, async (req, res) => {
  try {
    const { permitId, fileId } = req.params;

    // Find the file
    const permitFile = await PermitFile.findOne({
      _id: fileId,
      permitId: permitId,
    });

    if (!permitFile) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Verify permit access
    const permit = await Permit.findById(permitId);
    if (!permit) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    // Check authorization
    if (
      req.user.userType === 'residential' &&
      permit.applicant.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file exists on disk
    try {
      await fs.access(permitFile.path);
    } catch (error) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', permitFile.mimetype);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${permitFile.originalName}"`,
    );

    // Stream the file
    res.sendFile(path.resolve(permitFile.path));
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Delete a file
router.delete('/:permitId/files/:fileId', auth, async (req, res) => {
  try {
    const { permitId, fileId } = req.params;

    // Find the file
    const permitFile = await PermitFile.findOne({
      _id: fileId,
      permitId: permitId,
    });

    if (!permitFile) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check authorization (only uploader or municipal users can delete)
    if (
      req.user.userType === 'residential' &&
      permitFile.uploadedBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete file from disk
    try {
      await fs.unlink(permitFile.path);
    } catch (error) {
      console.warn('File not found on disk:', permitFile.path);
    }

    // Remove from database
    await PermitFile.deleteOne({ _id: fileId });

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Get file statistics for a permit
router.get('/:permitId/files/stats', auth, async (req, res) => {
  try {
    const { permitId } = req.params;

    // Verify permit access
    const permit = await Permit.findById(permitId);
    if (!permit) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    const stats = await PermitFile.getFileStats(permitId);

    // Calculate totals
    const totals = stats.reduce(
      (acc, stat) => {
        acc.totalFiles += stat.count;
        acc.totalSize += stat.totalSize;
        return acc;
      },
      { totalFiles: 0, totalSize: 0 },
    );

    res.json({
      ...totals,
      byType: stats,
    });
  } catch (error) {
    console.error('Error fetching file stats:', error);
    res.status(500).json({ error: 'Failed to fetch file statistics' });
  }
});

module.exports = router;
