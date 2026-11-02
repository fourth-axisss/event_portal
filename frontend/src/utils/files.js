// Labels and limits for event files (must match backend/middleware/upload.js)

export const MAX_FILE_MB = 5;
export const FILE_ACCEPT = '.pdf,.docx,.pptx,.xlsx,.jpg,.jpeg,.png';

const TYPE_LABELS = {
  'application/pdf': 'PDF',
  'image/jpeg': 'Image',
  'image/png': 'Image',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
};

// Office files sometimes arrive as a generic type, so fall back to the file extension
export function fileTypeLabel(file) {
  if (TYPE_LABELS[file.mime_type]) return TYPE_LABELS[file.mime_type];
  const ext = (file.original_name || '').split('.').pop().toLowerCase();
  return { docx: 'Word', pptx: 'PowerPoint', xlsx: 'Excel' }[ext] || 'File';
}

// 248000 → '242 KB', 3400000 → '3.2 MB'
export function formatFileSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
