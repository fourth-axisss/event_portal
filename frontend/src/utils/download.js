import api from '../api/client';

export async function downloadFile(url, fileName) {
  const res = await api.get(url, { responseType: 'blob' });
  const href = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}