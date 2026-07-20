import apiClient from './apiClient';
import { getTokens } from './apiClient';
import API_BASE_URL from '../config/api';

const q = (params = {}) => {
  const s = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return s ? `?${s}` : '';
};

export const financeService = {
  getInvoices: (params) => apiClient.get(`/invoices/${q(params)}`).then((r) => r.data),
  getInvoiceById: (id) => apiClient.get(`/invoices/${id}/`).then((r) => r.data),

  getPayments: (params) => apiClient.get(`/payments/${q(params)}`).then((r) => r.data),
  createPayment: (data) => apiClient.post('/payments/', data).then((r) => r.data),
  validatePayment: (id) => apiClient.post(`/payments/${id}/validate/`).then((r) => r.data),

  getPaymentMethods: () => apiClient.get('/payment-methods/').then((r) => r.data),

  // Admin-configured, institution-wide settings (apps.core.SystemConfig,
  // AllowAny) — used here for the Mobile Money receiving number set in
  // Settings > Finance on the admin web app.
  getPublicConfigs: () => apiClient.get('/configs/public/').then((r) => r.data),

  getStudentFinancialSummary: (studentId) =>
    apiClient.get(`/students/${studentId}/financial-summary/`).then((r) => r.data),

  downloadInvoicePdf: async (id) => {
    const { access } = await getTokens();
    const response = await fetch(`${API_BASE_URL}/invoices/${id}/pdf/`, {
      headers: { Authorization: `Bearer ${access}` },
    });
    if (!response.ok) throw new Error(`Erreur ${response.status}`);
    return response.blob();
  },

  downloadReceiptPdf: async (paymentId) => {
    const { access } = await getTokens();
    const response = await fetch(`${API_BASE_URL}/payments/${paymentId}/receipt/`, {
      headers: { Authorization: `Bearer ${access}` },
    });
    if (!response.ok) throw new Error(`Erreur ${response.status}`);
    return response.blob();
  },

  // CinetPay — kept fully wired server-side, just no longer invoked from
  // the mobile UI (replaced by the manual Mobile Money flow below).
  initiateCinetPay: (data) => apiClient.post('/payments/cinetpay/initiate/', data).then((r) => r.data),
  checkCinetPayStatus: (txId) =>
    apiClient.get(`/payments/cinetpay/${txId}/status/`).then((r) => r.data),
  demoPay: (transactionId) =>
    apiClient.post('/payments/cinetpay/demo-pay/', { transaction_id: transactionId }).then((r) => r.data),

  // Manual Mobile Money — semi-automatic: the student/parent submits proof
  // (photo/document) + phone numbers + declared date, an admin validates it.
  submitManualMobileMoney: (formData) =>
    apiClient.post('/payments/mobile-money/submit/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),

  getEcheancier: (studentId) =>
    apiClient.get(`/students/${studentId}/echeancier/`).then((r) => r.data),
};

export default financeService;
