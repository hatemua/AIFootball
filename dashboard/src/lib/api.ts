import axios, { AxiosError, type AxiosInstance } from 'axios';

const baseURL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

export const api: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30_000,
});

// Attach JWT from localStorage on every client-side request.
// (For server-side calls, pass the token explicitly via { headers }.)
api.interceptors.request.use((cfg) => {
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('jwt');
    if (token) {
      cfg.headers.Authorization = `Bearer ${token}`;
    }
  }
  return cfg;
});

// On 401, kick the user back to /login.
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      window.localStorage.removeItem('jwt');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);
