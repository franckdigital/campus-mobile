import apiClient, { getTokens } from './apiClient';
import * as FileSystem from 'expo-file-system';
import API_BASE_URL from '../config/api';

const q = (params = {}) => {
  const s = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return s ? `?${s}` : '';
};

export const attendanceService = {
  getSessions: (params) => apiClient.get(`/attendance-sessions/${q(params)}`).then((r) => r.data),
  getSessionById: (id) => apiClient.get(`/attendance-sessions/${id}/`).then((r) => r.data),
  getSessionRecords: (id) => apiClient.get(`/attendance-sessions/${id}/records/`).then((r) => r.data),
  openSession: (data) => apiClient.post('/attendance/open/', data).then((r) => r.data),
  closeSession: (id) => apiClient.post(`/attendance-sessions/${id}/close/`).then((r) => r.data),

  // Refresh QR code for a session (generates a new token, invalidates old one)
  refreshSessionQR: (id) => apiClient.post(`/attendance-sessions/${id}/refresh-qr/`).then((r) => r.data),

  // Fetch QR code image as base64 data URI using expo-file-system
  getSessionQRBase64: async (sessionId) => {
    const { access } = await getTokens();
    const url = `${API_BASE_URL}/attendance-sessions/${sessionId}/qr/`;
    const dest = FileSystem.cacheDirectory + `qr_${sessionId}_${Date.now()}.png`;
    const result = await FileSystem.downloadAsync(url, dest, {
      headers: { ...(access ? { Authorization: `Bearer ${access}` } : {}) },
    });
    const base64 = await FileSystem.readAsStringAsync(result.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    // Clean up cache file
    FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => {});
    return `data:image/png;base64,${base64}`;
  },

  getRecords: (params) => apiClient.get(`/attendance-records/${q(params)}`).then((r) => r.data),
  markAttendance: (data) => apiClient.post('/attendance-records/mark/', data).then((r) => r.data),
  bulkMark: (data) => apiClient.post('/attendance-records/bulk-mark/', data).then((r) => r.data),
  scanQR: (data) => apiClient.post('/attendance/scan/', data).then((r) => r.data),
  getStudentStats: (params) => apiClient.get(`/attendance-records/student-stats/${q(params)}`).then((r) => r.data),

  getAbsenceRequests: (params) => apiClient.get(`/absence-requests/${q(params)}`).then((r) => r.data),
  createAbsenceRequest: (data) => apiClient.post('/absence-requests/', data).then((r) => r.data),
  createAbsenceRequestWithFile: (formData) =>
    apiClient.post('/absence-requests/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
  approveAbsenceRequest: (id, data) => apiClient.post(`/absence-requests/${id}/approve/`, data).then((r) => r.data),
  rejectAbsenceRequest: (id, data) => apiClient.post(`/absence-requests/${id}/reject/`, data).then((r) => r.data),

  postponeSession: (data) => apiClient.post('/attendance/postpone-session/', data).then((r) => r.data),
  cancelPostponement: (data) => apiClient.delete('/attendance/postpone-session/', { data }).then((r) => r.data),
};

export default attendanceService;
