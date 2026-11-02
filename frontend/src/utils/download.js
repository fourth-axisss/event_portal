import api from '../api/client';

// Fetch a protected file (our API needs the login token, so a plain <a href> won't work)
async function fetchBlob(url, mimeType) {
  const res = await api.get(url, { responseType: 'blob' });
  return mimeType ? new Blob([res.data], { type: mimeType }) : res.data;
}

export async function downloadFile(url, fileName) {
  const blob = await fetchBlob(url);
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

// Types the browser can show by itself; anything else (Word, PowerPoint, Excel) is downloaded
const VIEWABLE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export function canOpenInBrowser(mimeType) {
  return VIEWABLE_TYPES.includes(mimeType);
}

// Open a PDF or image in a new tab; other types are downloaded
export async function openFile(url, fileName, mimeType) {
  if (!canOpenInBrowser(mimeType)) return downloadFile(url, fileName);

  // Open the tab right away, while the click still counts: browsers block tabs opened after a wait
  const tab = window.open('', '_blank');
  if (tab) tab.document.write('<p style="font-family: sans-serif; color: #555">Opening file…</p>');

  try {
    const href = URL.createObjectURL(await fetchBlob(url, mimeType));
    if (tab) tab.location.href = href;
    else window.location.assign(href); // pop-up blocked: open it in this tab instead
    setTimeout(() => URL.revokeObjectURL(href), 60_000); // free the memory once it has loaded
  } catch (err) {
    tab?.close();
    throw err;
  }
}
