import apiClient, { setTokens, clearTokens } from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const authService = {
  login: async (email, password) => {
    const res = await apiClient.post('/auth/login/', { email, password });
    const { access, refresh, user: nestedUser, ...rest } = res.data;
    // Backend returns { access, refresh, user: {...} } — fall back to flat if no nested user
    const user = nestedUser || rest;
    await setTokens(access, refresh);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    return { user, access, refresh };
  },

  logout: async () => {
    try {
      const refresh = await AsyncStorage.getItem('refresh_token');
      if (refresh) await apiClient.post('/auth/logout/', { refresh });
    } finally {
      await clearTokens();
    }
  },

  getProfile: () => apiClient.get('/auth/me/').then((r) => r.data),

  updateProfile: (data) => apiClient.patch('/auth/me/', data).then((r) => r.data),

  changePassword: (data) => apiClient.post('/auth/change-password/', data).then((r) => r.data),

  getCachedUser: async () => {
    const raw = await AsyncStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  },
};

export default authService;
