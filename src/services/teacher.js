import apiClient, { getTokens } from './apiClient';
import API_BASE_URL from '../config/api';

const q = (params = {}) => {
  const s = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return s ? `?${s}` : '';
};

export const teacherService = {
  getMe: () => apiClient.get('/teachers/me/').then((r) => r.data),
  list: (params) => apiClient.get(`/teachers/${q(params)}`).then((r) => r.data),
  getClasses: (params) => apiClient.get(`/classes/${q(params)}`).then((r) => r.data),
  getClassStudents: (classId) => apiClient.get(`/classes/${classId}/students/`).then((r) => r.data),
  getClassSchedule: (classId) => apiClient.get(`/classes/${classId}/schedule/`).then((r) => r.data),
  getSessions: (params) => apiClient.get(`/sessions/${q(params)}`).then((r) => r.data),
  getTeacherSessions: (id, params) => apiClient.get(`/teachers/${id}/sessions/${q(params)}`).then((r) => r.data),

  // ── E-Learning module: which classes/subjects this teacher may create content for ──
  getClassSubjects: (teacherId) =>
    apiClient.get(`/class-subject-teachers/${q({ teacher: teacherId, is_active: true })}`).then((r) => r.data),
  getSubjects: (params) => apiClient.get(`/subjects/${q(params)}`).then((r) => r.data),
  getRooms: (params) => apiClient.get(`/rooms/${q(params)}`).then((r) => r.data),
  getSemesters: (params) => apiClient.get(`/semesters/${q(params)}`).then((r) => r.data),

  // ── Profile (Mon profil) ──────────────────────────────────────────
  getTeacherProfil: (id) => apiClient.get(`/teachers/${id}/profil/`).then((r) => r.data),
  updateTeacher: (id, data) => apiClient.patch(`/teachers/${id}/`, data).then((r) => r.data),
  getTeacherFicheUrl: async (id) => {
    const { access } = await getTokens();
    return `${API_BASE_URL}/teachers/${id}/fiche/?token=${access || ''}`;
  },

  getTeacherExperiences: (id) => apiClient.get(`/teachers/${id}/experiences/`).then((r) => r.data),
  addTeacherExperience: (id, data) => apiClient.post(`/teachers/${id}/experiences/`, data).then((r) => r.data),
  deleteTeacherExperience: (id, expId) => apiClient.delete(`/teachers/${id}/experiences/${expId}/`).then((r) => r.data),

  getTeacherDocuments: (id) => apiClient.get(`/teachers/${id}/documents/`).then((r) => r.data),
  uploadTeacherDocument: (id, formData) =>
    apiClient.post(`/teachers/${id}/documents/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  deleteTeacherDocument: (id, docId) => apiClient.delete(`/teachers/${id}/documents/${docId}/`).then((r) => r.data),
};

export default teacherService;
