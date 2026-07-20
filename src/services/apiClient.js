import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_BASE_URL from '../config/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

let refreshPromise = null;

const getTokens = async () => {
  const access = await AsyncStorage.getItem('access_token');
  const refresh = await AsyncStorage.getItem('refresh_token');
  return { access, refresh };
};

const setTokens = async (access, refresh) => {
  await AsyncStorage.setItem('access_token', access);
  if (refresh) await AsyncStorage.setItem('refresh_token', refresh);
};

const clearTokens = async () => {
  await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
};

const doRefresh = async () => {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const { refresh } = await getTokens();
      if (!refresh) return false;
      const res = await axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh });
      await setTokens(res.data.access, res.data.refresh || refresh);
      return true;
    } catch {
      await clearTokens();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
};

// Request interceptor — attach Bearer token
apiClient.interceptors.request.use(async (config) => {
  const { access } = await getTokens();
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

// Response interceptor — auto-refresh on 401
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshed = await doRefresh();
      if (refreshed) {
        const { access } = await getTokens();
        original.headers.Authorization = `Bearer ${access}`;
        return apiClient(original);
      }
    }
    return Promise.reject(error);
  }
);

export { getTokens, setTokens, clearTokens };
export default apiClient;
