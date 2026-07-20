import apiClient from './apiClient';

export const scheduleService = {
  createSession: (data) => apiClient.post('/sessions/', data).then((r) => r.data),
  updateSession: (id, data) => apiClient.patch(`/sessions/${id}/`, data).then((r) => r.data),
  deleteSession: (id) => apiClient.delete(`/sessions/${id}/`).then((r) => r.data),
};

export default scheduleService;
