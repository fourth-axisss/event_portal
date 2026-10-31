import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const isLoginRequest = error.config?.url === '/auth/login';
    if (status === 401 && !isLoginRequest && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error) {
  const data = error.response?.data;
  if (data?.errors?.length) return data.errors[0].msg;
  if (data?.message) return data.message;
  return 'Could not reach the server. Is the backend running?';
}

export default api;