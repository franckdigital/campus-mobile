import apiClient from './apiClient';

export const notificationsService = {
  getAll: (params) => apiClient.get('/notifications/').then((r) => r.data),
  getUnread: () => apiClient.get('/notifications/unread/').then((r) => r.data),
  getUnreadCount: () => apiClient.get('/notifications/unread-count/').then((r) => r.data),
  markRead: (id) => apiClient.post(`/notifications/${id}/read/`).then((r) => r.data),
  markAllRead: () => apiClient.post('/notifications/mark-all-read/').then((r) => r.data),
  registerDeviceToken: (token, platform = 'EXPO') =>
    apiClient.post('/notifications/register-device/', { token, platform }).then((r) => r.data),
  unregisterDeviceToken: (token) =>
    apiClient.delete('/notifications/register-device/', { data: { token } }).then((r) => r.data),
};

export default notificationsService;
