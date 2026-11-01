// 'http://localhost:5000/api' → 'http://localhost:5000'
const API_ORIGIN = import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '');

// 'posters/abc.jpg' → 'http://localhost:5000/uploads/posters/abc.jpg'   (null stays null)
export function uploadUrl(relativePath) {
  return relativePath ? `${API_ORIGIN}/uploads/${relativePath}` : null;
}