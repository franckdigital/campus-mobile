import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import apiClient from './apiClient';
import { getTokens } from './apiClient';
import API_BASE_URL from '../config/api';

const q = (params = {}) => {
  const s = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return s ? `?${s}` : '';
};

export const gradesService = {
  getGrades: (params) => apiClient.get(`/grades/${q(params)}`).then((r) => r.data),
  getReportCards: (params) => apiClient.get(`/report-cards/${q(params)}`).then((r) => r.data),
  getReportCardById: (id) => apiClient.get(`/report-cards/${id}/`).then((r) => r.data),

  getEvaluations: (params) => apiClient.get(`/evaluations/${q(params)}`).then((r) => r.data),
  createEvaluation: (data) => apiClient.post('/evaluations/', data).then((r) => r.data),
  getEvaluationGrades: (id) => apiClient.get(`/evaluations/${id}/students-grades/`).then((r) => r.data),
  enterGrades: (id, grades) => apiClient.post(`/evaluations/${id}/enter-grades/`, { grades }).then((r) => r.data),
  getStudentsGrades: (id) => apiClient.get(`/evaluations/${id}/students-grades/`).then((r) => r.data),
  lockEvaluation: (id) => apiClient.post(`/evaluations/${id}/lock/`).then((r) => r.data),

  createGrade: (data) => apiClient.post('/grades/', data).then((r) => r.data),
  updateGrade: (id, data) => apiClient.patch(`/grades/${id}/`, data).then((r) => r.data),

  generateReportCards: (data) => apiClient.post('/report-cards/generate/', data).then((r) => r.data),
  publishReportCard: (id) => apiClient.post(`/report-cards/${id}/publish/`).then((r) => r.data),

  downloadReportCardPdf: async (id, label = 'bulletin') => {
    const { access } = await getTokens();
    if (!access) throw new Error('Non authentifié');

    const url = `${API_BASE_URL}/report-cards/${id}/pdf/`;
    const fileUri = `${FileSystem.cacheDirectory}bulletin_${id}.pdf`;

    const result = await FileSystem.downloadAsync(url, fileUri, {
      headers: { Authorization: `Bearer ${access}` },
    });

    if (result.status !== 200) {
      throw new Error(`Erreur serveur ${result.status}`);
    }

    const info = await FileSystem.getInfoAsync(result.uri);
    if (!info.exists || info.size === 0) {
      throw new Error('Le fichier téléchargé est vide');
    }

    const available = await Sharing.isAvailableAsync();
    if (!available) throw new Error('Le partage n\'est pas disponible sur cet appareil');

    await Sharing.shareAsync(result.uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Bulletin ${label}`,
      UTI: 'com.adobe.pdf',
    });

    return result.uri;
  },
};

export default gradesService;
