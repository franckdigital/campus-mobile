import apiClient from './apiClient';

export const parentService = {
  getMe: () => apiClient.get('/parents/me/').then((r) => r.data),
  getMyStudents: () => apiClient.get('/parents/me/students/').then((r) => r.data),
  getStudentDossier: (studentId) => apiClient.get(`/students/${studentId}/dossier/`).then((r) => r.data),
  getStudentFinancialSummary: (studentId) => apiClient.get(`/students/${studentId}/financial-summary/`).then((r) => r.data),
};

export default parentService;
