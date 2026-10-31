const fs = require('fs');
const path = require('path');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const PUBLIC_DIR = path.join(UPLOAD_ROOT, 'public');
const PRIVATE_FILES_DIR = path.join(UPLOAD_ROOT, 'private', 'files');

// 'posters/abc.jpg' → full path inside uploads/public
function publicFilePath(relativePath) {
  return path.join(PUBLIC_DIR, relativePath);
}

// Delete a stored file; a missing file is fine, other problems are only logged
async function removeFile(fullPath) {
  try {
    await fs.promises.unlink(fullPath);
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Could not delete file', fullPath, err.message);
  }
}

module.exports = { UPLOAD_ROOT, PUBLIC_DIR, PRIVATE_FILES_DIR, publicFilePath, removeFile };