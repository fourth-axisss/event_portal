const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { PUBLIC_DIR } = require('../services/fileStorage');

const OFFICE_FALLBACK = 'application/octet-stream'; // some browsers send this for Office files

const IMAGE_TYPES = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
};

const DOCUMENT_TYPES = {
  ...IMAGE_TYPES,
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', OFFICE_FALLBACK],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', OFFICE_FALLBACK],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', OFFICE_FALLBACK],
};

// dir set   → the file is written to that folder (req.file.path)
// dir unset → the file is kept in memory (req.file.buffer), e.g. to store it in the database
function makeUploader({ dir, field, types, maxMb, typeLabel }) {
  let storage = multer.memoryStorage();
  if (dir) {
    fs.mkdirSync(dir, { recursive: true }); // create the folder if it does not exist yet
    storage = multer.diskStorage({
      destination: dir,
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${crypto.randomUUID()}${ext}`);
      },
    });
  }

  const upload = multer({
    storage,
    limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const allowed = types[ext];
      if (allowed && allowed.includes(file.mimetype)) return cb(null, true);
      const err = new Error(`Only ${typeLabel} files are allowed`);
      err.uploadRejected = true;
      cb(err);
    },
  }).single(field);

  // Run multer, turning its errors into clean 400 replies
  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          const message = err.code === 'LIMIT_FILE_SIZE' ? `File is too large (max ${maxMb} MB)` : err.message;
          return res.status(400).json({ message });
        }
        if (err.uploadRejected) return res.status(400).json({ message: err.message });
        return next(err);
      }
      if (!req.file) return res.status(400).json({ message: `Choose a file to upload (form field "${field}")` });
      next();
    });
  };
}

const posterUpload = makeUploader({
  dir: path.join(PUBLIC_DIR, 'posters'),
  field: 'poster',
  types: IMAGE_TYPES,
  maxMb: 2,
  typeLabel: 'JPG or PNG',
});

const logoUpload = makeUploader({
  dir: path.join(PUBLIC_DIR, 'logos'),
  field: 'logo',
  types: IMAGE_TYPES,
  maxMb: 2,
  typeLabel: 'JPG or PNG',
});

// Event files are kept in memory and saved into MySQL (event_files.data), because the
// free hosting's disk is wiped on every restart. 5 MB keeps the database small.
const documentUpload = makeUploader({
  field: 'file',
  types: DOCUMENT_TYPES,
  maxMb: 5,
  typeLabel: 'PDF, Word, PowerPoint, Excel, JPG or PNG',
});

module.exports = { posterUpload, logoUpload, documentUpload };