import apiClient from './apiClient';

const documentsService = {
  getStudentDocuments: (params = {}) => apiClient.get('/ged/documents/', { params }).then((r) => r.data),
  getStudentFiles: (params = {}) => apiClient.get('/students/files/', { params }).then((r) => r.data),
  downloadDocument: (id) => apiClient.get(`/ged/documents/${id}/download/`).then((r) => r.data),
  getDocumentTypes: () => apiClient.get('/ged/document-types/').then((r) => r.data),
  uploadStudentFile: (data) => apiClient.post('/students/files/', data, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
};

export default documentsService;
