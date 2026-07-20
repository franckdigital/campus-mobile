import apiClient from './apiClient';

const q = (params = {}) => {
  const s = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return s ? `?${s}` : '';
};

export const studentService = {
  getMe: () => apiClient.get('/students/me/').then((r) => r.data),
  getDossier: (id) => apiClient.get(`/students/${id}/dossier/`).then((r) => r.data),
  getKpiAnalysis: (id, params) => apiClient.get(`/students/${id}/kpi-analysis/${q(params)}`).then((r) => r.data),
  getFinancialSummary: (id) => apiClient.get(`/students/${id}/financial-summary/`).then((r) => r.data),
  getEnrollments: (id) => apiClient.get(`/students/${id}/enrollments/`).then((r) => r.data),
  getFiles: (id) => apiClient.get(`/students/${id}/files/`).then((r) => r.data),
  getCard: (id, academicYearId = null) => {
    const params = academicYearId ? `?academic_year_id=${academicYearId}` : '';
    return apiClient.get(`/students/${id}/card/${params}`).then((r) => r.data);
  },
  generateCard: (id, data) => apiClient.post(`/students/${id}/generate-card/`, data).then((r) => r.data),
  prepareInvoices: (id) => apiClient.post(`/students/${id}/prepare-invoices/`).then((r) => r.data),
  list: (params) => apiClient.get(`/students/${q(params)}`).then((r) => r.data),
};

export default studentService;
