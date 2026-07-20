import apiClient from './apiClient';

const messagesService = {
  getConversations: (params = {}) => apiClient.get('/messaging/conversations/', { params }).then((r) => r.data),
  getMessages: (conversationId, params = {}) => apiClient.get(`/messaging/conversations/${conversationId}/messages/`, { params }).then((r) => r.data),
  sendMessage: (conversationId, data) => apiClient.post(`/messaging/conversations/${conversationId}/messages/`, data).then((r) => r.data),
  createConversation: (data) => apiClient.post('/messaging/conversations/', data).then((r) => r.data),
  markRead: (conversationId) => apiClient.post(`/messaging/conversations/${conversationId}/mark_read/`).then((r) => r.data),
  getUnreadCount: () => apiClient.get('/messaging/unread-count/').then((r) => r.data),
};

export default messagesService;
