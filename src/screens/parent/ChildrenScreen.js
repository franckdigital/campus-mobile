import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import parentService from '../../services/parent';
import studentService from '../../services/student';
import gradesService from '../../services/grades';
import attendanceService from '../../services/attendance';
import financeService from '../../services/finance';
import notificationsService from '../../services/notifications';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, radius } from '../../theme/colors';

const GRADIENT = ['#064E3B', '#065F46', '#059669'];

const TABS = [
  { key: 'resume',        label: 'Résumé',     icon: 'person-outline',        color: '#6366F1' },
  { key: 'paiements',     label: 'Paiements',  icon: 'wallet-outline',         color: '#059669' },
  { key: 'absences',      label: 'Absences',   icon: 'alert-circle-outline',   color: '#D97706' },
  { key: 'notes',         label: 'Notes',      icon: 'star-outline',           color: '#7C3AED' },
  { key: 'bulletins',     label: 'Bulletins',  icon: 'book-outline',           color: '#0891B2' },
  { key: 'analyse',       label: 'Analyse',    icon: 'analytics-outline',      color: '#0D9488' },
  { key: 'notifications', label: 'Notifs',     icon: 'notifications-outline',  color: '#0EA5E9' },
];

const RISK_INFO = {
  LOW:    { label: 'Faible', color: '#059669', bg: '#D1FAE5' },
  MEDIUM: { label: 'Moyen',  color: '#D97706', bg: '#FEF3C7' },
  HIGH:   { label: 'Élevé',  color: '#EF4444', bg: '#FEE2E2' },
};

const INVOICE_STATUS = {
  PAID:    { label: 'Payé',        color: '#059669', bg: '#D1FAE5' },
  PARTIAL: { label: 'Partiel',     color: '#D97706', bg: '#FEF3C7' },
  PENDING: { label: 'En attente',  color: '#6366F1', bg: '#EEF2FF' },
  OVERDUE: { label: 'En retard',   color: '#EF4444', bg: '#FEE2E2' },
};

const CARD_STATUS = {
  PASS:      { label: 'Admis',      color: '#059669', bg: '#D1FAE5' },
  FAIL:      { label: 'Ajourné',    color: '#EF4444', bg: '#FEE2E2' },
  PUBLISHED: { label: 'Publié',     color: '#6366F1', bg: '#EEF2FF' },
  GENERATED: { label: 'Généré',     color: '#0891B2', bg: '#E0F2FE' },
  DRAFT:     { label: 'Brouillon',  color: '#94A3B8', bg: '#F1F5F9' },
};

const NOTIF_TYPE = {
  PAYMENT:    { label: 'Paiement',  color: '#D97706', bg: '#FEF3C7', icon: 'card-outline'          },
  ATTENDANCE: { label: 'Présence',  color: '#14B8A6', bg: '#F0FDFA', icon: 'person-outline'         },
  GRADE:      { label: 'Note',      color: '#7C3AED', bg: '#F5F3FF', icon: 'star-outline'           },
  GENERAL:    { label: 'Général',   color: '#6366F1', bg: '#EEF2FF', icon: 'notifications-outline'  },
};

function scoreColor(score, max) {
  if (!max) return colors.textSecondary;
  const p = (parseFloat(score) / parseFloat(max)) * 100;
  if (p >= 75) return colors.success;
  if (p >= 50) return colors.warning;
  return colors.danger;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1)  return 'À l\'instant';
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h / 24)}j`;
}

export default function ParentChildrenScreen({ navigation, route }) {
  const [children, setChildren] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('resume');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingChild, setLoadingChild] = useState(false);
  const [siteFilter, setSiteFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'detail'

  // Per-tab data
  const [grades, setGrades] = useState([]);
  const [reportCards, setReportCards] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [kpiAnalysis, setKpiAnalysis] = useState(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState(false);

  const prevSelectedId = useRef(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const loadChild = useCallback(async (child) => {
    if (!child) return;
    setSelected(child);
    setKpiAnalysis(null);
    setKpiError(false);
    setLoadingChild(true);
    try {
      const [g, rc, att, abs, inv, notifs, fin] = await Promise.allSettled([
        gradesService.getGrades({ student: child.id, page_size: 200 }),
        gradesService.getReportCards({ student: child.id, is_published: true }),
        attendanceService.getRecords({ student: child.id }),
        attendanceService.getRecords({ student: child.id, status: 'ABSENT' }),
        financeService.getInvoices({ student: child.id }),
        notificationsService.getAll(),
        financeService.getStudentFinancialSummary(child.id),
      ]);
      if (g.status === 'fulfilled')      setGrades(g.value?.results || g.value || []);
      if (rc.status === 'fulfilled')     setReportCards(rc.value?.results || rc.value || []);
      if (att.status === 'fulfilled')    setAttendance(att.value?.results || att.value || []);
      if (abs.status === 'fulfilled')    setAbsences(abs.value?.results || abs.value || []);
      if (inv.status === 'fulfilled')    setInvoices(inv.value?.results || inv.value || []);
      if (notifs.status === 'fulfilled') setNotifications(notifs.value?.results || notifs.value || []);
      if (fin.status === 'fulfilled' && fin.value) {
        const s = fin.value;
        setSelected(prev =>
          prev?.id === child.id
            ? {
                ...prev,
                _tuition: s.tuition_fee,
                _paid: s.total_paid,
                _remaining: s.remaining_balance,
                _configured_tuition: s.configured_tuition_fee,
                _min_enrollment_payment: s.min_enrollment_payment,
                is_enrolled: s.is_enrolled,
                has_payment_schedule: s.has_payment_schedule,
                tuition_up_to_date: s.tuition_up_to_date,
                echeance_override: s.echeance_override,
              }
            : prev
        );
      }
    } catch (e) {
      console.log('loadChild', e.message);
    } finally {
      setLoadingChild(false);
    }
  }, []);

  // Tap a card in list mode → switch to detail
  const selectChild = useCallback(async (child) => {
    setTab('resume');
    setViewMode('detail');
    prevSelectedId.current = child.id;
    await loadChild(child);
  }, [loadChild]);

  // Back button in detail → return to list
  const backToList = () => {
    setViewMode('list');
    setSelected(null);
  };

  // Lazy-load the KPI/AI analysis only when the "Analyse" tab is first
  // opened — it's the most expensive call (LLM-backed), no need to fire it
  // for every child if the parent never looks at that tab.
  const loadKpiAnalysis = useCallback((child) => {
    if (!child) return;
    setKpiLoading(true);
    setKpiError(false);
    studentService.getKpiAnalysis(child.id)
      .then((data) => setKpiAnalysis(data))
      .catch((e) => { console.log('kpiAnalysis error:', e.message); setKpiError(true); })
      .finally(() => setKpiLoading(false));
  }, []);

  useEffect(() => {
    // kpiError gates this off once a request has failed, so a permanently
    // failing endpoint (e.g. backend not migrated yet) can't retry forever
    // in a loop — the user has to tap "Réessayer" to try again.
    if (tab !== 'analyse' || !selected || kpiAnalysis || kpiLoading || kpiError) return;
    loadKpiAnalysis(selected);
  }, [tab, selected, kpiAnalysis, kpiLoading, kpiError, loadKpiAnalysis]);

  const fetchChildren = useCallback(async () => {
    try {
      const res = await parentService.getMyStudents();
      const list = res?.results || res || [];
      // Enrich all children with financial summaries (for cards in list mode)
      const summaries = await Promise.allSettled(
        list.map(child => financeService.getStudentFinancialSummary(child.id))
      );
      const enriched = list.map((child, i) => {
        const s = summaries[i].status === 'fulfilled' ? summaries[i].value : null;
        return s ? {
          ...child,
          _tuition: s.tuition_fee,
          _paid: s.total_paid,
          _remaining: s.remaining_balance,
          _configured_tuition: s.configured_tuition_fee,
          _min_enrollment_payment: s.min_enrollment_payment,
          is_enrolled: s.is_enrolled,
          has_payment_schedule: s.has_payment_schedule,
          tuition_up_to_date: s.tuition_up_to_date,
          echeance_override: s.echeance_override,
        } : child;
      });
      setChildren(enriched);
      // Auto-open if navigated from Dashboard with a selectedId (optionally
      // jumping straight to a given tab, e.g. { selectedId, tab: 'analyse' })
      const targetId = route?.params?.selectedId;
      if (targetId && enriched.length > 0) {
        const target = enriched.find(c => c.id === targetId) || enriched[0];
        prevSelectedId.current = target.id;
        setTab(route?.params?.tab || 'resume');
        setViewMode('detail');
        await loadChild(target);
      }
    } catch (e) {
      console.log('fetchChildren', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadChild]);

  useEffect(() => { fetchChildren(); }, []);

  // Handle navigation from DashboardScreen with selectedId (optionally jumping
  // straight to a given tab, e.g. { selectedId, tab: 'analyse' })
  useEffect(() => {
    const nextId = route?.params?.selectedId;
    if (!nextId || nextId === prevSelectedId.current || !children.length) return;
    prevSelectedId.current = nextId;
    const target = children.find((c) => c.id === nextId);
    if (target) { setTab(route?.params?.tab || 'resume'); setViewMode('detail'); loadChild(target); }
  }, [route?.params?.selectedId, route?.params?.tab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (viewMode === 'detail' && selected) {
        await loadChild(selected);
      } else {
        await fetchChildren();
      }
    } finally {
      setRefreshing(false);
    }
  }, [viewMode, selected, loadChild, fetchChildren]);

  // ── PDF generation ────────────────────────────────────────────────────────
  const generatePDF = useCallback(async () => {
    if (!selected) return;
    setGeneratingPDF(true);
    try {
      const name = `${selected.user?.first_name || selected.first_name || ''} ${selected.user?.last_name || selected.last_name || ''}`.trim() || 'Étudiant';
      const mat  = selected.matricule || '—';
      const cls  = selected.class_name || selected.current_class || '—';
      const site = selected.site_name || '—';
      const acYear = selected.academic_year_name || selected.academic_year || '—';
      const now  = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

      // Financial
      const cfgTuition = parseFloat(selected._configured_tuition ?? 0);
      const allPaid    = parseFloat(selected._paid ?? 0);
      const scoPaid    = allPaid;
      const scoRem     = Math.max(0, cfgTuition - scoPaid);
      const scoPct     = cfgTuition > 0 ? Math.min(100, Math.round((scoPaid / cfgTuition) * 100)) : 0;
      const isEnrolledPdf = !!selected.is_enrolled;
      const minEnrollPdf  = parseFloat(selected._min_enrollment_payment ?? 0);
      const enrollGapPdf  = Math.max(0, minEnrollPdf - allPaid);
      const fmtF = (n) => n.toLocaleString('fr-FR') + ' F';

      // Absences
      const justAbs   = absences.filter(a => a.justified).length;
      const unjustAbs = absences.length - justAbs;

      // Grades rows
      const bySubject = grades.reduce((acc, g) => {
        const key = g.subject_name || g.subject || 'Inconnu';
        if (!acc[key]) acc[key] = { subject: key, items: [], total: 0, count: 0 };
        acc[key].items.push(g);
        acc[key].total += parseFloat(g.score || 0);
        acc[key].count += 1;
        return acc;
      }, {});
      const gradeRows = Object.values(bySubject).map(s => ({
        subject: s.subject,
        avg: s.count ? (s.total / s.count).toFixed(2) : '—',
        count: s.count,
      }));

      // Invoices rows
      const invRows = invoices.slice(0, 10).map(inv => ({
        ref:    inv.invoice_number || inv.reference || '—',
        label:  inv.description || inv.label || inv.notes || 'Facture',
        total:  parseFloat(inv.total || 0),
        paid:   parseFloat(inv.amount_paid || 0),
        status: inv.status || '—',
      }));

      const STATUS_FR = { PAID: 'Payé', PARTIAL: 'Partiel', PENDING: 'En attente', OVERDUE: 'En retard' };
      const STATUS_COLOR = { PAID: '#059669', PARTIAL: '#D97706', PENDING: '#6366F1', OVERDUE: '#EF4444' };

      const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #1E293B; background: #fff; }
  .page { padding: 32px 36px; }

  /* Header */
  .doc-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 3px solid #059669; padding-bottom:16px; margin-bottom:24px; }
  .doc-title { font-size:22px; font-weight:700; color:#065F46; }
  .doc-subtitle { font-size:12px; color:#64748B; margin-top:4px; }
  .doc-meta { text-align:right; font-size:11px; color:#64748B; line-height:1.6; }
  .doc-meta strong { color:#1E293B; font-size:13px; }

  /* Student card */
  .student-card { background:#F0FDF4; border:1px solid #A7F3D0; border-radius:10px; padding:18px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; }
  .student-avatar { width:52px; height:52px; border-radius:26px; background:#059669; color:#fff; font-size:20px; font-weight:700; display:flex; align-items:center; justify-content:center; line-height:52px; text-align:center; }
  .student-info { flex:1; padding-left:16px; }
  .student-name { font-size:18px; font-weight:700; color:#065F46; }
  .student-mat  { font-size:12px; color:#059669; margin-top:2px; }
  .student-badges { display:flex; gap:8px; margin-top:8px; }
  .badge { padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; }
  .badge-green { background:#D1FAE5; color:#065F46; }
  .badge-blue  { background:#DBEAFE; color:#1E40AF; }
  .student-kpis { display:flex; gap:20px; }
  .kpi { text-align:center; }
  .kpi-label { font-size:10px; color:#64748B; text-transform:uppercase; letter-spacing:0.5px; }
  .kpi-value { font-size:16px; font-weight:700; margin-top:2px; }
  .kpi-unit  { font-size:10px; color:#94A3B8; }

  /* Section */
  .section { margin-bottom:22px; }
  .section-title { font-size:14px; font-weight:700; color:#065F46; border-left:4px solid #059669; padding-left:10px; margin-bottom:12px; }

  /* Info grid */
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .info-cell { background:#F8FAFC; border:1px solid #E2E8F0; border-radius:7px; padding:10px 14px; }
  .info-label { font-size:10px; color:#64748B; text-transform:uppercase; letter-spacing:0.4px; margin-bottom:3px; }
  .info-value { font-size:13px; font-weight:600; color:#1E293B; }

  /* Finance */
  .finance-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; }
  .finance-card { background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:14px; }
  .finance-card-title { font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase; margin-bottom:8px; }
  .progress-bar { height:8px; background:#E2E8F0; border-radius:4px; overflow:hidden; margin:8px 0; }
  .progress-fill { height:100%; border-radius:4px; }
  .finance-row { display:flex; justify-content:space-between; font-size:12px; color:#64748B; margin-top:6px; }
  .finance-row strong { color:#1E293B; }

  /* Table */
  table { width:100%; border-collapse:collapse; font-size:12px; }
  thead th { background:#059669; color:#fff; padding:8px 10px; text-align:left; font-weight:600; font-size:11px; }
  tbody tr:nth-child(even) { background:#F0FDF4; }
  tbody td { padding:8px 10px; border-bottom:1px solid #E2E8F0; color:#374151; }
  .tag { display:inline-block; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:600; }

  /* Absences kpi */
  .abs-kpi-row { display:flex; gap:12px; margin-bottom:12px; }
  .abs-kpi-card { flex:1; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:14px; text-align:center; }
  .abs-kpi-value { font-size:22px; font-weight:700; margin:4px 0; }
  .abs-kpi-label { font-size:11px; color:#64748B; }

  /* Footer */
  .footer { margin-top:32px; padding-top:12px; border-top:1px solid #E2E8F0; display:flex; justify-content:space-between; font-size:10px; color:#94A3B8; }
</style>
</head>
<body>
<div class="page">

  <!-- DOC HEADER -->
  <div class="doc-header">
    <div>
      <div class="doc-title">Dossier Étudiant</div>
      <div class="doc-subtitle">Document officiel — Espace parent</div>
    </div>
    <div class="doc-meta">
      <strong>${name}</strong><br/>
      Matricule : ${mat}<br/>
      Généré le ${now}
    </div>
  </div>

  <!-- STUDENT CARD -->
  <div class="student-card">
    <div style="display:flex;align-items:center;flex:1;">
      <div class="student-avatar">${name.split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase()}</div>
      <div class="student-info">
        <div class="student-name">${name}</div>
        <div class="student-mat">#${mat}</div>
        <div class="student-badges">
          <span class="badge badge-green">${isEnrolledPdf ? 'Inscrit ✓' : 'Non inscrit'}</span>
          ${selected.status === 'ACTIVE' ? '<span class="badge badge-blue">Actif</span>' : ''}
        </div>
      </div>
    </div>
    <div class="student-kpis">
      <div class="kpi">
        <div class="kpi-label">Scolarité</div>
        <div class="kpi-value" style="color:rgba(6,95,70,0.8)">${cfgTuition > 0 ? (cfgTuition/1000).toFixed(0)+'k' : '—'}</div>
        <div class="kpi-unit">F</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Payé</div>
        <div class="kpi-value" style="color:#059669">${scoPaid > 0 ? (scoPaid/1000).toFixed(0)+'k' : '—'}</div>
        <div class="kpi-unit">F</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Reste</div>
        <div class="kpi-value" style="color:${scoRem > 0 ? '#EF4444' : '#059669'}">${(scoRem/1000).toFixed(0)}k</div>
        <div class="kpi-unit">F</div>
      </div>
    </div>
  </div>

  <!-- INFOS PERSONNELLES -->
  <div class="section">
    <div class="section-title">Informations personnelles</div>
    <div class="info-grid">
      <div class="info-cell"><div class="info-label">Nom complet</div><div class="info-value">${name}</div></div>
      <div class="info-cell"><div class="info-label">Matricule</div><div class="info-value">${mat}</div></div>
      <div class="info-cell"><div class="info-label">Classe</div><div class="info-value">${cls}</div></div>
      <div class="info-cell"><div class="info-label">Site</div><div class="info-value">${site}</div></div>
      <div class="info-cell"><div class="info-label">Année académique</div><div class="info-value">${acYear}</div></div>
      <div class="info-cell"><div class="info-label">Statut</div><div class="info-value">${isEnrolledPdf ? '✅ Inscrit' : '⚠️ Non inscrit'}</div></div>
    </div>
  </div>

  <!-- SITUATION FINANCIÈRE -->
  <div class="section">
    <div class="section-title">Situation financière</div>
    <div class="finance-grid">
      <div class="finance-card" style="border-left:4px solid ${isEnrolledPdf ? '#059669' : '#D97706'}">
        <div class="finance-card-title">Statut inscription</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${isEnrolledPdf ? 100 : 0}%;background:${isEnrolledPdf ? '#059669' : '#D97706'}"></div></div>
        <div class="finance-row">
          <span>${isEnrolledPdf ? '' : `Reste ${fmtF(enrollGapPdf)}`}</span>
          <strong style="color:${isEnrolledPdf ? '#059669' : '#D97706'}">${isEnrolledPdf ? 'Inscrit ✓' : 'Non inscrit'}</strong>
        </div>
      </div>
      <div class="finance-card" style="border-left:4px solid #2563EB">
        <div class="finance-card-title">Frais de scolarité — ${scoPct}%</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${scoPct}%;background:${scoPct===100?'#059669':'#2563EB'}"></div></div>
        <div class="finance-row">
          <span>${fmtF(scoPaid)} payé</span>
          <strong style="color:${scoRem > 0 ? '#EF4444' : '#059669'}">${scoRem > 0 ? 'Reste ' + fmtF(scoRem) : 'Soldé ✓'}</strong>
        </div>
      </div>
    </div>
    ${invRows.length > 0 ? `
    <table>
      <thead><tr><th>Réf.</th><th>Libellé</th><th>Total</th><th>Payé</th><th>Statut</th></tr></thead>
      <tbody>
        ${invRows.map(r => `
        <tr>
          <td>${r.ref}</td>
          <td>${r.label}</td>
          <td>${fmtF(r.total)}</td>
          <td>${fmtF(r.paid)}</td>
          <td><span class="tag" style="background:${STATUS_COLOR[r.status]||'#94A3B8'}22;color:${STATUS_COLOR[r.status]||'#94A3B8'}">${STATUS_FR[r.status]||r.status}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>` : '<p style="color:#94A3B8;font-size:12px;text-align:center;padding:12px">Aucune facture</p>'}
  </div>

  <!-- ABSENCES -->
  <div class="section">
    <div class="section-title">Présences & Absences</div>
    <div class="abs-kpi-row">
      <div class="abs-kpi-card">
        <div class="abs-kpi-value" style="color:#D97706">${absences.length}</div>
        <div class="abs-kpi-label">Total absences</div>
      </div>
      <div class="abs-kpi-card">
        <div class="abs-kpi-value" style="color:#059669">${justAbs}</div>
        <div class="abs-kpi-label">Justifiées</div>
      </div>
      <div class="abs-kpi-card">
        <div class="abs-kpi-value" style="color:#EF4444">${unjustAbs}</div>
        <div class="abs-kpi-label">Non justifiées</div>
      </div>
    </div>
    ${absences.length > 0 ? `
    <table>
      <thead><tr><th>Date</th><th>Matière</th><th>Enseignant</th><th>Heure</th><th>Statut</th></tr></thead>
      <tbody>
        ${absences.slice(0,10).map(a => {
          const d = a.date || a.session?.date || a.created_at;
          const dateLabel = d ? new Date(d).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '—';
          return `<tr>
            <td>${dateLabel}</td>
            <td>${a.subject_name || '—'}</td>
            <td>${a.teacher_name || '—'}</td>
            <td>${a.start_time || '—'}</td>
            <td><span class="tag" style="background:${a.justified?'#D1FAE5':'#FEE2E2'};color:${a.justified?'#065F46':'#991B1B'}">${a.justified?'Justifiée':'Non justifiée'}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>` : '<p style="color:#059669;font-size:12px;text-align:center;padding:12px">✅ Aucune absence enregistrée</p>'}
  </div>

  <!-- NOTES -->
  <div class="section">
    <div class="section-title">Notes & Résultats</div>
    ${gradeRows.length > 0 ? `
    <table>
      <thead><tr><th>Matière</th><th>Nb évaluations</th><th>Moyenne</th><th>Appréciation</th></tr></thead>
      <tbody>
        ${gradeRows.map(r => {
          const avg = parseFloat(r.avg);
          const color = isNaN(avg) ? '#94A3B8' : avg >= 15 ? '#059669' : avg >= 10 ? '#D97706' : '#EF4444';
          const appre = isNaN(avg) ? '—' : avg >= 15 ? 'Très bien' : avg >= 12 ? 'Bien' : avg >= 10 ? 'Passable' : 'Insuffisant';
          return `<tr>
            <td><strong>${r.subject}</strong></td>
            <td style="text-align:center">${r.count}</td>
            <td style="text-align:center;font-weight:700;color:${color}">${r.avg}</td>
            <td><span class="tag" style="background:${color}22;color:${color}">${appre}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>` : '<p style="color:#94A3B8;font-size:12px;text-align:center;padding:12px">Aucune note disponible</p>'}
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <span>Document généré le ${now} — Campus</span>
    <span>${name} · ${mat} · ${cls}</span>
  </div>

</div>
</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Dossier de ${name}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF généré', `Fichier enregistré : ${uri}`);
      }
    } catch (e) {
      console.log('PDF error:', e.message);
      // TEMPORAIRE — affiche le vrai message d'erreur pour diagnostiquer
      // pourquoi la génération échoue (à retirer une fois corrigé).
      Alert.alert('Erreur (debug)', `Impossible de générer le PDF.\n\n${e?.message || e}`);
    } finally {
      setGeneratingPDF(false);
    }
  }, [selected, absences, grades, invoices]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const isEnrolled  = !!selected?.is_enrolled;
  const totalPaid   = parseFloat(selected?._paid ?? selected?.total_paid ?? 0);
  // Header KPIs: show scolarité stats (consistent with list card)
  const tuition   = parseFloat(selected?._configured_tuition ?? 0);
  const paid      = totalPaid;
  const remaining = Math.max(0, tuition - paid);
  const pct = tuition > 0 ? Math.min(100, Math.round((paid / tuition) * 100)) : 0;
  const minEnrollmentPayment = selected?._min_enrollment_payment != null
    ? parseFloat(selected._min_enrollment_payment) : null;
  const enrollmentGap = minEnrollmentPayment != null ? Math.max(0, minEnrollmentPayment - totalPaid) : null;

  const fullName = selected
    ? `${selected.user?.first_name || selected.first_name || ''} ${selected.user?.last_name || selected.last_name || ''}`.trim()
    : '';
  const initials = fullName ? fullName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : '?';

  const sites = [...new Map(children.filter(c => c.site && c.site_name).map(c => [c.site, c.site_name])).entries()]
    .map(([id, name]) => ({ id, name }));
  const multiSite = sites.length > 1;
  const filteredChildren = siteFilter === 'all' ? children : children.filter(c => String(c.site) === siteFilter);

  const bySubject = grades.reduce((acc, g) => {
    const key = g.subject_name || g.subject || 'Inconnu';
    if (!acc[key]) acc[key] = { subject: key, items: [], total: 0, count: 0 };
    acc[key].items.push(g);
    acc[key].total += parseFloat(g.score || 0);
    acc[key].count += 1;
    return acc;
  }, {});
  const subjectGroups = Object.values(bySubject).map((s) => ({
    ...s,
    average: s.count ? (s.total / s.count).toFixed(1) : '--',
  }));

  const cardsByYear = reportCards.reduce((acc, c) => {
    const year = c.academic_year_name || c.semester_academic_year_name || 'Année inconnue';
    if (!acc[year]) acc[year] = [];
    acc[year].push(c);
    return acc;
  }, {});

  const justified = absences.filter((a) => a.justified).length;
  const unjustified = absences.length - justified;

  if (loading) {
    return (
      <LinearGradient colors={GRADIENT} style={styles.loadingCenter}>
        <ActivityIndicator color="#fff" size="large" />
      </LinearGradient>
    );
  }

  if (children.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <LinearGradient colors={GRADIENT} style={styles.headerSimple}>
          <SafeAreaView edges={['top']}>
            <Text style={styles.headerTitle}>Mes enfants</Text>
          </SafeAreaView>
        </LinearGradient>
        <EmptyState icon="people-outline" title="Aucun enfant lié" subtitle="Contactez l'administration pour lier vos enfants" />
      </View>
    );
  }

  // ── LIST MODE ─────────────────────────────────────────────────────────────
  if (viewMode === 'list') {
    return (
      <View style={styles.container}>
        <LinearGradient colors={GRADIENT} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <SafeAreaView edges={['top']}>
            <Text style={styles.headerTitle}>Mes enfants</Text>
            <Text style={styles.headerSub}>
              {filteredChildren.length} enfant{filteredChildren.length > 1 ? 's' : ''} · Appuyez pour voir le dossier
            </Text>

            {/* Site filter */}
            {multiSite && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingTop: 10, paddingBottom: 4, paddingHorizontal: 2 }}
              >
                {[{ id: 'all', name: 'Tous les sites' }, ...sites].map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.siteChip, siteFilter === s.id && styles.siteChipActive]}
                    onPress={() => setSiteFilter(s.id)}
                  >
                    <Ionicons name="location-outline" size={11} color={siteFilter === s.id ? '#fff' : 'rgba(255,255,255,0.65)'} />
                    <Text style={[styles.siteChipText, siteFilter === s.id && styles.siteChipTextActive]}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </SafeAreaView>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.success} />}
          showsVerticalScrollIndicator={false}
        >
          {filteredChildren.map((child) => (
            <ChildCard key={child.id} child={child} onPress={() => selectChild(child)} />
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    );
  }

  // ── DETAIL MODE ───────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Gradient Header */}
      <LinearGradient colors={GRADIENT} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          {/* Back row */}
          <View style={styles.backRow}>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }} onPress={backToList} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={18} color="#fff" />
              <Text style={styles.backText}>Mes enfants</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pdfBtn, generatingPDF && { opacity: 0.6 }]}
              onPress={generatePDF}
              disabled={generatingPDF}
              activeOpacity={0.75}
            >
              {generatingPDF
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Ionicons name="document-text-outline" size={15} color="#fff" /><Text style={styles.pdfBtnText}>PDF</Text></>
              }
            </TouchableOpacity>
          </View>

          {/* Selected child card */}
          {selected && (
            <View style={styles.childCard}>
              <View style={styles.childLeft}>
                <View style={styles.childAvatar}>
                  <Text style={styles.childAvatarText}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.childName} numberOfLines={1}>{fullName || 'Enfant'}</Text>
                  {selected.matricule && <Text style={styles.childMatricule}>#{selected.matricule}</Text>}
                  <View style={styles.childBadges}>
                    <View style={[styles.badge, isEnrolled ? styles.badgeGreen : styles.badgeOrange]}>
                      <Text style={[styles.badgeText, { color: isEnrolled ? '#065F46' : '#92400E' }]}>
                        {isEnrolled ? 'Inscrit' : 'Non inscrit'}
                      </Text>
                    </View>
                    {selected.status === 'ACTIVE' && (
                      <View style={[styles.badge, styles.badgeGreen]}>
                        <Text style={[styles.badgeText, { color: '#065F46' }]}>Actif</Text>
                      </View>
                    )}
                    {(selected.has_payment_schedule || selected.echeance_override) && (
                      <View style={[styles.badge, { backgroundColor: selected.echeance_override
                        ? 'rgba(147,197,253,0.35)'
                        : selected.tuition_up_to_date ? 'rgba(134,239,172,0.25)' : 'rgba(252,165,165,0.35)' }]}>
                        <Text style={[styles.badgeText, { color: selected.echeance_override
                          ? '#1E40AF'
                          : selected.tuition_up_to_date ? '#065F46' : '#991B1B' }]}>
                          {selected.echeance_override ? 'Admission autorisée' : (selected.tuition_up_to_date ? 'À jour' : 'Non à jour')}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              <View style={styles.kpiGroup}>
                {[
                  { label: 'Scolarité', value: tuition,   color: 'rgba(255,255,255,0.8)' },
                  { label: 'Payé',      value: paid,      color: '#86EFAC' },
                  { label: 'Reste',     value: remaining, color: remaining > 0 ? '#FCA5A5' : '#86EFAC' },
                ].map((k) => (
                  <View key={k.label} style={styles.kpiItem}>
                    <Text style={styles.kpiLabel}>{k.label}</Text>
                    <Text style={[styles.kpiValue, { color: k.color }]}>
                      {k.value > 0 ? `${(k.value / 1000).toFixed(0)}k` : '—'}
                    </Text>
                    <Text style={styles.kpiUnit}>F</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Tab bar */}
          <View style={styles.tabGrid}>
            {TABS.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.tab, tab === t.key && styles.tabActive]}
                onPress={() => setTab(t.key)}
              >
                <Ionicons name={t.icon} size={13} color={tab === t.key ? t.color : 'rgba(255,255,255,0.7)'} />
                <Text style={[styles.tabText, tab === t.key && { color: t.color }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Tab content */}
      {loadingChild ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.success} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.success} />}
          showsVerticalScrollIndicator={false}
        >
          {tab === 'resume'        && <TabResume selected={selected} tuition={tuition} paid={paid} remaining={remaining} pct={pct} isEnrolled={isEnrolled} invoices={invoices} enrollmentGap={enrollmentGap} minEnrollmentPayment={minEnrollmentPayment} />}
          {tab === 'paiements'     && <TabPaiements invoices={invoices} />}
          {tab === 'absences'      && <TabAbsences absences={absences} justified={justified} unjustified={unjustified} />}
          {tab === 'notes'         && <TabNotes subjectGroups={subjectGroups} />}
          {tab === 'bulletins'     && <TabBulletins cardsByYear={cardsByYear} />}
          {tab === 'analyse'       && <TabAnalyse data={kpiAnalysis} loading={kpiLoading} error={kpiError} onRetry={() => loadKpiAnalysis(selected)} />}
          {tab === 'notifications' && <TabNotifications notifications={notifications} />}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ── ChildCard (list mode) ─────────────────────────────────────────────────────

function ChildCard({ child, onPress }) {
  const name = child.user?.full_name ||
    `${child.user?.first_name || child.first_name || ''} ${child.user?.last_name || child.last_name || ''}`.trim() ||
    'Enfant';
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const paid            = parseFloat(child._paid ?? child.total_paid ?? 0);
  const isEnrolled      = !!child.is_enrolled;
  const configTuition   = parseFloat(child._configured_tuition ?? 0);
  const tuitionPaidCard = paid;
  const tuitionRemCard  = Math.max(0, configTuition - tuitionPaidCard);
  const tuitionPctCard  = configTuition > 0 ? Math.min(100, Math.round((tuitionPaidCard / configTuition) * 100)) : 0;

  return (
    <TouchableOpacity style={styles.listCard} onPress={onPress} activeOpacity={0.75}>
      {isEnrolled && <View style={styles.listCardAccent} />}

      <View style={styles.listCardTop}>
        <View style={styles.listAvatar}>
          <Text style={styles.listAvatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.listChildName} numberOfLines={1}>{name}</Text>
          {child.matricule && <Text style={styles.listChildMatricule}>#{child.matricule}</Text>}
          <View style={styles.listBadges}>
            {isEnrolled && (
              <View style={styles.listBadgeGreen}>
                <Ionicons name="checkmark" size={10} color="#059669" />
                <Text style={styles.listBadgeGreenText}>Inscrit</Text>
              </View>
            )}
            {child.status === 'ACTIVE' && (
              <View style={styles.listBadgeBlue}>
                <Text style={styles.listBadgeBlueText}>Actif</Text>
              </View>
            )}
            {(child.has_payment_schedule || child.echeance_override) && (
              <View style={[styles.listBadgeGreen, { backgroundColor: child.echeance_override
                ? 'rgba(59,130,246,0.12)'
                : child.tuition_up_to_date ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }]}>
                <Text style={[styles.listBadgeGreenText, { color: child.echeance_override
                  ? '#1D4ED8'
                  : child.tuition_up_to_date ? '#059669' : '#DC2626' }]}>
                  {child.echeance_override ? 'Admission autorisée' : (child.tuition_up_to_date ? 'À jour' : 'Non à jour')}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </View>

      <View style={styles.listFinance}>
        {/* Inscription status */}
        <View style={styles.listFinanceRow}>
          <Text style={styles.listFinanceLabel}>Inscription</Text>
          <Text style={[styles.listFinanceSub, { color: isEnrolled ? colors.success : '#D97706', fontWeight: '700' }]}>
            {isEnrolled ? 'Payée ✓' : 'En attente'}
          </Text>
        </View>
        {/* Tuition progress */}
        {configTuition > 0 && (
          <>
            <View style={[styles.listFinanceRow, { marginTop: 8 }]}>
              <Text style={styles.listFinanceLabel}>Scolarité payée</Text>
              <Text style={[styles.listFinancePct, { color: tuitionPctCard === 100 ? colors.success : tuitionPctCard >= 50 ? colors.warning : colors.danger }]}>
                {tuitionPctCard}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {
                width: `${tuitionPctCard}%`,
                backgroundColor: tuitionPctCard === 100 ? colors.success : tuitionPctCard >= 50 ? colors.warning : colors.danger,
              }]} />
            </View>
            <View style={styles.listFinanceRow}>
              <Text style={styles.listFinanceSub}>Payé : {tuitionPaidCard.toLocaleString('fr-FR')} F</Text>
              <Text style={[styles.listFinanceSub, { color: tuitionRemCard > 0 ? colors.danger : colors.success, fontWeight: '600' }]}>
                {tuitionRemCard > 0 ? `Reste ${tuitionRemCard.toLocaleString('fr-FR')} F` : '✓ Soldé'}
              </Text>
            </View>
          </>
        )}
      </View>

      {(child.current_class?.name || child.current_class?.academic_year || child.site_name) && (
        <View style={styles.listMeta}>
          {child.current_class?.name && (
            <View style={styles.listMetaItem}>
              <Text style={styles.listMetaLabel}>CLASSE</Text>
              <Text style={styles.listMetaValue}>{child.current_class.name}</Text>
            </View>
          )}
          {child.current_class?.academic_year && (
            <View style={styles.listMetaItem}>
              <Text style={styles.listMetaLabel}>ANNÉE</Text>
              <Text style={styles.listMetaValue}>{child.current_class.academic_year}</Text>
            </View>
          )}
          {child.site_name && (
            <View style={styles.listMetaItem}>
              <Text style={styles.listMetaLabel}>SITE</Text>
              <Text style={styles.listMetaValue} numberOfLines={1}>{child.site_name}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Résumé ────────────────────────────────────────────────────────────────────

function TabResume({ selected, isEnrolled, invoices, enrollmentGap, minEnrollmentPayment }) {
  const invList = (invoices || []).filter((inv) => inv.status !== 'CANCELLED');

  // Tuition amounts — aggregated from real invoices when available, falling
  // back to the configured amount (same as the list card).
  const tuitionConfigured = parseFloat(selected?._configured_tuition ?? 0);
  const tuitionTotal      = invList.length > 0
    ? invList.reduce((s, inv) => s + parseFloat(inv.total || 0), 0)
    : tuitionConfigured;
  const tuitionPaidInvoices = invList.reduce((s, inv) => s + parseFloat(inv.amount_paid || 0), 0);
  const totalAllPaid      = parseFloat(selected?._paid ?? 0);
  const tuitionPaidAmt    = invList.length > 0 ? tuitionPaidInvoices : totalAllPaid;
  const tuitionBalance    = Math.max(0, tuitionTotal - tuitionPaidAmt);
  const tuitionPct        = tuitionTotal > 0 ? Math.min(100, Math.round((tuitionPaidAmt / tuitionTotal) * 100)) : 0;

  return (
    <View style={{ gap: spacing.md }}>
      {/* Enrollment status */}
      <View style={[styles.enrollCard, isEnrolled ? styles.enrollCardGreen : styles.enrollCardOrange]}>
        <View style={[styles.enrollIcon, { backgroundColor: isEnrolled ? '#059669' : '#D97706' }]}>
          <Ionicons name={isEnrolled ? 'checkmark-circle' : 'alert-circle'} size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.enrollTitle, { color: isEnrolled ? '#065F46' : '#92400E' }]}>
            {isEnrolled ? 'Inscription validée' : 'Non inscrit'}
          </Text>
          <Text style={[styles.enrollSub, { color: isEnrolled ? '#047857' : '#B45309' }]}>
            {isEnrolled
              ? 'Votre enfant est inscrit et suit les cours.'
              : `Reste ${(enrollmentGap ?? 0).toLocaleString('fr-FR')} F${
                  minEnrollmentPayment != null ? ` (minimum ${minEnrollmentPayment.toLocaleString('fr-FR')} F)` : ''
                } pour valider l'inscription.`}
          </Text>
        </View>
      </View>

      {/* Échéancier de scolarité */}
      {(selected?.has_payment_schedule || selected?.echeance_override) && (
        <View style={[styles.enrollCard, selected?.echeance_override
          ? { backgroundColor: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.3)' }
          : selected?.tuition_up_to_date ? styles.enrollCardGreen : styles.enrollCardOrange]}>
          <View style={[styles.enrollIcon, { backgroundColor: selected?.echeance_override
            ? '#2563EB'
            : selected?.tuition_up_to_date ? '#059669' : '#DC2626' }]}>
            <Ionicons name={selected?.tuition_up_to_date || selected?.echeance_override ? 'checkmark-circle' : 'alert-circle'} size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.enrollTitle, { color: selected?.echeance_override
              ? '#1E40AF'
              : selected?.tuition_up_to_date ? '#065F46' : '#991B1B' }]}>
              {selected?.echeance_override ? 'Admission autorisée' : (selected?.tuition_up_to_date ? "À jour de l'échéancier" : "Non à jour de l'échéancier")}
            </Text>
            <Text style={[styles.enrollSub, { color: selected?.echeance_override
              ? '#1D4ED8'
              : selected?.tuition_up_to_date ? '#047857' : '#B91C1C' }]}>
              {selected?.echeance_override
                ? "Une autorisation spéciale a été accordée par l'administration."
                : selected?.tuition_up_to_date
                  ? 'Les échéances de scolarité sont réglées à ce jour.'
                  : 'Une échéance de scolarité est en retard — merci de régulariser la situation.'}
            </Text>
          </View>
        </View>
      )}

      {/* Frais de scolarité */}
      <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#2563EB' }]}>
        <View style={[styles.cardRow, { marginBottom: 10 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.kpiCardIcon, { backgroundColor: '#DBEAFE', width: 32, height: 32 }]}>
              <Ionicons name="wallet-outline" size={15} color="#2563EB" />
            </View>
            <Text style={[styles.cardTitle, { color: '#1E40AF' }]}>Frais de scolarité</Text>
          </View>
          <Text style={[styles.statusBadgeText, {
            color: tuitionTotal > 0 ? (tuitionPct === 100 ? '#059669' : '#2563EB') : '#94A3B8',
          }]}>
            {tuitionTotal > 0 ? `${tuitionPct}%` : '—'}
          </Text>
        </View>
        {tuitionTotal > 0 ? (
          <>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {
                width: `${tuitionPct}%`,
                backgroundColor: tuitionPct === 100 ? colors.success : '#2563EB',
              }]} />
            </View>
            <View style={[styles.cardRow, { marginTop: 6 }]}>
              <Text style={styles.cardSub}>{tuitionPaidAmt.toLocaleString('fr-FR')} F payé</Text>
              <Text style={[styles.cardSub, { fontWeight: '700', color: tuitionBalance > 0 ? '#EF4444' : '#059669' }]}>
                {tuitionBalance > 0 ? `Reste ${tuitionBalance.toLocaleString('fr-FR')} F` : 'Soldé ✓'}
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.cardSub}>Aucune facture de scolarité créée</Text>
        )}
        <View style={[styles.cardRow, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.divider }]}>
          <Text style={styles.cardSub}>Statut inscription</Text>
          <Text style={[styles.cardSub, { fontWeight: '700', color: isEnrolled ? '#059669' : '#D97706' }]}>
            {isEnrolled ? 'Inscrit ✓' : `Non inscrit — reste ${(enrollmentGap ?? 0).toLocaleString('fr-FR')} F`}
          </Text>
        </View>
      </View>

      {/* Academic info grid */}
      <View style={styles.card}>
        <Text style={[styles.cardTitle, { marginBottom: spacing.sm }]}>Informations académiques</Text>
        <View style={styles.infoGrid}>
          {[
            { label: 'Matricule',  value: selected?.matricule || '—' },
            { label: 'Admission',  value: selected?.admission_date ? new Date(selected.admission_date).toLocaleDateString('fr-FR') : '—' },
            { label: 'Classe',     value: selected?.current_class?.name || '—' },
            { label: 'Année',      value: selected?.current_class?.academic_year || '—' },
            { label: 'Statut',     value: selected?.status === 'ACTIVE' ? 'Actif' : selected?.status || '—' },
            { label: 'Site',       value: selected?.site_name || '—' },
          ].map((item) => (
            <View key={item.label} style={styles.infoCell}>
              <Text style={styles.infoCellLabel}>{item.label}</Text>
              <Text style={styles.infoCellValue} numberOfLines={1}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ── Paiements ────────────────────────────────────────────────────────────────

function TabPaiements({ invoices }) {
  if (invoices.length === 0) {
    return <EmptyState icon="wallet-outline" title="Aucune facture" subtitle="Les factures apparaîtront ici" />;
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {invoices.map((inv) => {
        const st = INVOICE_STATUS[inv.status] || INVOICE_STATUS.PENDING;
        const total = parseFloat(inv.total || 0);
        const amtPaid = parseFloat(inv.amount_paid || 0);
        const rest = total - amtPaid;
        const p = total > 0 ? Math.min(100, Math.round((amtPaid / total) * 100)) : 0;
        return (
          <View key={inv.id} style={[styles.invoiceCard, { borderLeftWidth: 3, borderLeftColor: '#2563EB' }]}>
            <View style={styles.invoiceTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.invoiceTitle} numberOfLines={1}>
                  {inv.invoice_number || `Facture #${String(inv.id).slice(0, 8)}`}
                </Text>
                <Text style={[styles.invoiceSub, { color: '#1E40AF', fontWeight: '600' }]} numberOfLines={1}>
                  Frais de scolarité
                  {inv.due_date ? ` · Échéance: ${new Date(inv.due_date).toLocaleDateString('fr-FR')}` : ''}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                <Text style={[styles.statusBadgeText, { color: st.color }]}>{st.label}</Text>
              </View>
            </View>
            <View style={styles.invoiceAmounts}>
              {[
                { l: 'Total', v: `${total.toLocaleString('fr-FR')} F`, c: '#2563EB' },
                { l: 'Payé',  v: `${amtPaid.toLocaleString('fr-FR')} F`, c: '#059669' },
                { l: 'Reste', v: `${rest.toLocaleString('fr-FR')} F`, c: rest > 0 ? '#EF4444' : '#059669' },
              ].map((x) => (
                <View key={x.l} style={styles.invoiceAmt}>
                  <Text style={styles.invoiceAmtLabel}>{x.l}</Text>
                  <Text style={[styles.invoiceAmtValue, { color: x.c }]}>{x.v}</Text>
                </View>
              ))}
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {
                width: `${p}%`,
                backgroundColor: p === 100 ? colors.success : colors.warning,
              }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Absences ─────────────────────────────────────────────────────────────────

function TabAbsences({ absences, justified, unjustified }) {
  const [expandedIds, setExpandedIds] = useState(new Set());

  const toggle = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {/* KPIs */}
      <View style={styles.absKpiRow}>
        {[
          { label: 'Total',           value: absences.length, color: '#D97706', bg: '#FEF3C7', icon: 'alert-circle' },
          { label: 'Justifiées',      value: justified,       color: '#059669', bg: '#D1FAE5', icon: 'checkmark-circle' },
          { label: 'Non justifiées',  value: unjustified,     color: '#EF4444', bg: '#FEE2E2', icon: 'close-circle' },
        ].map((k) => (
          <View key={k.label} style={[styles.absKpiCard, { flex: 1 }]}>
            <View style={[styles.absKpiIcon, { backgroundColor: k.bg }]}>
              <Ionicons name={k.icon} size={16} color={k.color} />
            </View>
            <Text style={[styles.absKpiValue, { color: k.color }]}>{k.value}</Text>
            <Text style={styles.absKpiLabel}>{k.label}</Text>
          </View>
        ))}
      </View>

      {absences.length === 0 ? (
        <EmptyState icon="checkmark-circle-outline" title="Aucune absence" subtitle="Aucune absence enregistrée" />
      ) : (
        absences.map((abs, i) => {
          const id = abs.id || i;
          const isExpanded = expandedIds.has(id);
          const rawDate = abs.date || abs.session?.date || abs.check_in_time || abs.created_at;
          const dateStr = rawDate
            ? new Date(rawDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
            : '—';
          // start_time is "HH:MM" string from the session (check_in_time is null for absent students)
          const timeStr = abs.start_time || abs.session?.start_time || null;
          const subject = abs.subject_name || abs.session?.subject_name || 'Matière inconnue';
          const teacher = abs.teacher_name || abs.session?.teacher_name || null;
          const room = abs.room_name || abs.session?.room_name || abs.session?.room || null;
          const isJustified = !!abs.justified;

          return (
            <View key={id} style={styles.absCard}>
              <View style={[styles.absAccent, { backgroundColor: isJustified ? colors.success : colors.danger }]} />
              <TouchableOpacity
                style={styles.absCardInner}
                onPress={() => toggle(id)}
                activeOpacity={0.75}
              >
                {/* Row: icon + main info + badge + chevron */}
                <View style={styles.absCardRow}>
                  <View style={[styles.absIcon, { backgroundColor: isJustified ? '#D1FAE5' : '#FEE2E2' }]}>
                    <Ionicons name="calendar-outline" size={18} color={isJustified ? '#059669' : '#EF4444'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.absTitle}>{dateStr}</Text>
                    <Text style={styles.absSub} numberOfLines={1}>{subject}</Text>
                  </View>
                  <View style={[styles.statusBadge, isJustified ? { backgroundColor: '#D1FAE5' } : { backgroundColor: '#FEE2E2' }]}>
                    <Text style={[styles.statusBadgeText, { color: isJustified ? '#065F46' : '#991B1B' }]}>
                      {isJustified ? 'Justifiée' : 'Non justifiée'}
                    </Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textSecondary}
                    style={{ marginLeft: 4 }}
                  />
                </View>

                {/* Expanded details */}
                {isExpanded && (
                  <View style={styles.absDetails}>
                    <View style={styles.absDetailsGrid}>
                      {[
                        { label: 'Date',     value: dateStr,    icon: 'calendar-outline' },
                        { label: 'Heure',    value: timeStr || '—', icon: 'time-outline' },
                        { label: 'Matière',  value: subject,    icon: 'book-outline' },
                        { label: 'Enseignant', value: teacher || '—', icon: 'person-outline' },
                        { label: 'Salle',    value: room || '—', icon: 'location-outline' },
                        { label: 'Statut',   value: isJustified ? 'Justifiée' : 'Non justifiée', icon: isJustified ? 'checkmark-circle-outline' : 'close-circle-outline' },
                      ].map((d) => (
                        <View key={d.label} style={styles.absDetailCell}>
                          <Ionicons name={d.icon} size={13} color={colors.textTertiary} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.absDetailLabel}>{d.label}</Text>
                            <Text style={styles.absDetailValue} numberOfLines={2}>{d.value}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                    {abs.reason && (
                      <View style={styles.absReasonBox}>
                        <Text style={styles.absReasonLabel}>Motif :</Text>
                        <Text style={styles.absReasonText}>{abs.reason}</Text>
                      </View>
                    )}
                    {abs.notes && (
                      <View style={[styles.absReasonBox, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}>
                        <Text style={[styles.absReasonLabel, { color: '#7C3AED' }]}>Note :</Text>
                        <Text style={[styles.absReasonText, { color: '#6D28D9' }]}>{abs.notes}</Text>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </View>
  );
}

// ── Notes ─────────────────────────────────────────────────────────────────────

function TabNotes({ subjectGroups }) {
  if (subjectGroups.length === 0) {
    return <EmptyState icon="star-outline" title="Aucune note disponible" subtitle="Les notes apparaîtront ici" />;
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {subjectGroups.map((s) => {
        const color = scoreColor(s.average, 20);
        return (
          <View key={s.subject} style={styles.subjectCard}>
            <View style={[styles.subjectAccent, { backgroundColor: color }]} />
            <View style={styles.subjectHeader}>
              <Text style={styles.subjectName}>{s.subject}</Text>
              <View style={[styles.avgChip, { backgroundColor: color + '20' }]}>
                <Text style={[styles.avgChipText, { color }]}>{s.average}/20</Text>
              </View>
            </View>
            {s.items.map((g, i) => (
              <View key={i} style={[styles.gradeRow, i < s.items.length - 1 && styles.gradeRowBorder]}>
                <Text style={styles.gradeDate} numberOfLines={1}>
                  {g.date ? new Date(g.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : g.evaluation_title || 'Évaluation'}
                  {g.category_name ? ` · ${g.category_name}` : ''}
                </Text>
                <Text style={[styles.gradeScore, { color: scoreColor(g.score, g.max_score) }]}>
                  {g.score}/{g.max_score}
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

// ── Bulletins ─────────────────────────────────────────────────────────────────

function buildBulletinHtml(card, st, avg) {
  const grades = card.grades || card.subject_grades || [];
  const gradesRows = grades.length
    ? grades.map((g) => `
        <tr>
          <td>${g.subject_name || g.subject || '—'}</td>
          <td style="text-align:center">${g.coefficient || 1}</td>
          <td style="text-align:center;font-weight:700;color:#2563EB">${g.average != null ? parseFloat(g.average).toFixed(2) : '—'}</td>
          <td style="text-align:center">${g.min != null ? parseFloat(g.min).toFixed(2) : '—'}</td>
          <td style="text-align:center">${g.max != null ? parseFloat(g.max).toFixed(2) : '—'}</td>
          <td>${g.teacher_comment || ''}</td>
        </tr>`).join('')
    : `<tr><td colspan="6" style="text-align:center;color:#94A3B8">Aucune matière</td></tr>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<style>
  body { font-family: Arial, sans-serif; margin: 24px; color: #1E293B; font-size: 13px; }
  h1 { font-size: 20px; margin: 0; color: #065F46; }
  .subtitle { color: #64748B; font-size: 12px; margin-top: 4px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 16px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; background: ${st.bg}; color: ${st.color}; }
  .stats { display: flex; gap: 20px; margin-bottom: 16px; }
  .stat { background: #F8FAFC; border-radius: 8px; padding: 10px 16px; text-align: center; flex: 1; }
  .stat-label { font-size: 9px; text-transform: uppercase; color: #94A3B8; font-weight: 700; letter-spacing: 0.5px; }
  .stat-value { font-size: 18px; font-weight: 800; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #F1F5F9; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px; text-align: left; color: #64748B; }
  td { padding: 8px; border-bottom: 1px solid #F1F5F9; }
  tr:nth-child(even) td { background: #FAFAFA; }
  .comment { padding: 10px 14px; border-radius: 8px; margin-bottom: 8px; }
  .comment-label { font-size: 11px; font-weight: 700; margin-bottom: 4px; }
  .footer { text-align: center; color: #94A3B8; font-size: 10px; margin-top: 24px; border-top: 1px solid #F1F5F9; padding-top: 10px; }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>Bulletin scolaire</h1>
    <p class="subtitle">${card.semester_name || 'Bulletin'} · ${card.class_name || ''}</p>
    <p class="subtitle">${card.student_name || ''} · ${card.academic_year_name || ''}</p>
  </div>
  <div>
    <span class="badge">${st.label}</span>
    ${card.generated_at ? `<p class="subtitle" style="margin-top:6px">Publié le ${new Date(card.generated_at).toLocaleDateString('fr-FR')}</p>` : ''}
  </div>
</div>

<div class="stats">
  <div class="stat">
    <div class="stat-label">Moyenne générale</div>
    <div class="stat-value" style="color:#6366F1">${avg ? `${avg}/20` : '—'}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Rang</div>
    <div class="stat-value" style="color:#0891B2">${card.rank ? `${card.rank}/${card.total_students}` : '—'}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Statut</div>
    <div class="stat-value" style="color:${st.color}">${st.label}</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Matière</th>
      <th style="text-align:center">Coeff.</th>
      <th style="text-align:center">Moyenne</th>
      <th style="text-align:center">Min</th>
      <th style="text-align:center">Max</th>
      <th>Appréciation</th>
    </tr>
  </thead>
  <tbody>${gradesRows}</tbody>
</table>

${card.teacher_comment ? `
<div class="comment" style="background:#F0F9FF;border-left:3px solid #0891B2">
  <div class="comment-label" style="color:#0284C7">Appréciation du professeur</div>
  <div>${card.teacher_comment}</div>
</div>` : ''}
${card.principal_comment ? `
<div class="comment" style="background:#F5F3FF;border-left:3px solid #7C3AED">
  <div class="comment-label" style="color:#7C3AED">Appréciation de la direction</div>
  <div style="color:#6D28D9">${card.principal_comment}</div>
</div>` : ''}

<div class="footer">Document généré par Campus Mobile · ${new Date().toLocaleDateString('fr-FR')}</div>
</body>
</html>`;
}

async function downloadBulletinPdf(card) {
  try {
    const st = CARD_STATUS[card.status] || CARD_STATUS.DRAFT;
    const avg = card.average != null ? parseFloat(card.average).toFixed(2) : null;
    const html = buildBulletinHtml(card, st, avg);
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Bulletin – ${card.semester_name || 'Bulletin'}`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('PDF généré', `Fichier enregistré:\n${uri}`);
    }
  } catch (e) {
    Alert.alert('Erreur', 'Impossible de générer le PDF. ' + e.message);
  }
}

function TabBulletins({ cardsByYear }) {
  const [downloading, setDownloading] = useState(null);
  const groups = Object.entries(cardsByYear);
  if (groups.length === 0) {
    return (
      <EmptyState
        icon="book-outline"
        title="Aucun bulletin publié"
        subtitle="Les bulletins seront disponibles après publication"
      />
    );
  }

  const handleDownload = async (card) => {
    setDownloading(card.id);
    await downloadBulletinPdf(card);
    setDownloading(null);
  };

  return (
    <View style={{ gap: spacing.md }}>
      {groups.map(([year, bulletins]) => (
        <View key={year}>
          <View style={styles.yearHeader}>
            <View style={styles.yearAccent} />
            <Text style={styles.yearLabel}>{year}</Text>
          </View>
          <View style={{ gap: spacing.sm }}>
            {bulletins.map((card) => {
              const st = CARD_STATUS[card.status] || CARD_STATUS.DRAFT;
              const avg = card.average != null ? parseFloat(card.average).toFixed(2) : null;
              const isLoading = downloading === card.id;
              return (
                <View key={card.id} style={styles.bulletinCard}>
                  <View style={[styles.bulletinAccent, { backgroundColor: st.color }]} />
                  <View style={styles.bulletinTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bulletinTitle}>{card.semester_name || 'Bulletin'}</Text>
                      <Text style={styles.bulletinClass}>{card.class_name || '—'}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>
                  <View style={styles.bulletinStats}>
                    {[
                      { label: 'Moyenne', value: avg ? `${avg}/20` : '—', color: '#6366F1' },
                      { label: 'Rang',    value: card.rank ? `${card.rank}/${card.total_students}` : '—', color: '#0891B2' },
                      { label: 'Statut',  value: st.label, color: st.color },
                    ].map((x) => (
                      <View key={x.label} style={styles.bulletinStat}>
                        <Text style={styles.bulletinStatLabel}>{x.label}</Text>
                        <Text style={[styles.bulletinStatValue, { color: x.color }]}>{x.value}</Text>
                      </View>
                    ))}
                  </View>
                  {card.teacher_comment && (
                    <View style={styles.commentBox}>
                      <Text style={styles.commentLabel}>Appréciation :</Text>
                      <Text style={styles.commentText}>{card.teacher_comment}</Text>
                    </View>
                  )}
                  {card.principal_comment && (
                    <View style={[styles.commentBox, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}>
                      <Text style={[styles.commentLabel, { color: '#7C3AED' }]}>Direction :</Text>
                      <Text style={[styles.commentText, { color: '#6D28D9' }]}>{card.principal_comment}</Text>
                    </View>
                  )}
                  <View style={styles.bulletinFooterRow}>
                    {card.generated_at && (
                      <Text style={styles.bulletinDate}>
                        Publié le {new Date(card.generated_at).toLocaleDateString('fr-FR')}
                      </Text>
                    )}
                    <TouchableOpacity
                      style={[styles.pdfBtn, isLoading && styles.pdfBtnLoading]}
                      onPress={() => handleDownload(card)}
                      disabled={isLoading}
                      activeOpacity={0.75}
                    >
                      {isLoading ? (
                        <ActivityIndicator size={14} color="#fff" />
                      ) : (
                        <Ionicons name="download-outline" size={14} color="#fff" />
                      )}
                      <Text style={styles.pdfBtnText}>{isLoading ? 'Génération...' : 'Télécharger PDF'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Analyse IA ────────────────────────────────────────────────────────────────

function TabAnalyse({ data, loading, error, onRetry }) {
  if (loading) {
    return (
      <View style={{ paddingVertical: 60, alignItems: 'center' }}>
        <ActivityIndicator color={colors.success} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="Impossible de charger l'analyse"
        subtitle="Vérifiez votre connexion et réessayez"
        action={(
          <TouchableOpacity onPress={onRetry} style={styles.retryBtn} activeOpacity={0.8}>
            <Ionicons name="refresh-outline" size={16} color="#fff" />
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        )}
      />
    );
  }

  if (!data?.kpis) {
    return (
      <EmptyState
        icon="analytics-outline"
        title="Analyse indisponible"
        subtitle="Aucune donnée n'est encore disponible pour le semestre en cours"
      />
    );
  }

  const { kpis, trend, risk, ai_summary, ai_generated_at } = data;
  const avg = kpis.grade_global_average;
  const riskInfo = RISK_INFO[risk?.level] || RISK_INFO.LOW;

  return (
    <View style={{ gap: spacing.sm }}>
      {/* Score cards */}
      <View style={styles.absKpiRow}>
        {[
          { label: 'Moyenne', value: avg != null ? `${avg.toFixed(2)}/20` : '—', color: avg != null && avg >= 10 ? '#059669' : '#EF4444', bg: '#D1FAE5', icon: 'school-outline' },
          { label: 'Présence', value: kpis.attendance_rate != null ? `${kpis.attendance_rate}%` : '—', color: '#2563EB', bg: '#DBEAFE', icon: 'checkmark-circle-outline' },
          { label: 'Ponctualité', value: kpis.late_rate != null ? `${(100 - kpis.late_rate).toFixed(1)}%` : '—', color: '#7C3AED', bg: '#EDE9FE', icon: 'time-outline' },
        ].map((k) => (
          <View key={k.label} style={[styles.absKpiCard, { flex: 1 }]}>
            <View style={[styles.absKpiIcon, { backgroundColor: k.bg }]}>
              <Ionicons name={k.icon} size={16} color={k.color} />
            </View>
            <Text style={[styles.absKpiValue, { color: k.color }]}>{k.value}</Text>
            <Text style={styles.absKpiLabel}>{k.label}</Text>
          </View>
        ))}
      </View>

      {/* Risk gauge */}
      {risk && (
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle}>Risque d'échec</Text>
            <View style={[styles.statusBadge, { backgroundColor: riskInfo.bg }]}>
              <Text style={[styles.statusBadgeText, { color: riskInfo.color }]}>
                {riskInfo.label} · {risk.score}/100
              </Text>
            </View>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${risk.score}%`, backgroundColor: riskInfo.color }]} />
          </View>
        </View>
      )}

      {/* Trend history */}
      {trend?.history?.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Progression par semestre</Text>
          {trend.history.map((h) => (
            <View key={h.semester_id} style={{ marginTop: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.cardSub} numberOfLines={1}>{h.semester_label}</Text>
                <Text style={[styles.cardSub, { fontWeight: '700', color: colors.text }]}>
                  {h.average != null ? `${h.average.toFixed(2)}/20` : '—'}
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, {
                  width: `${h.average != null ? (h.average / 20) * 100 : 0}%`,
                  backgroundColor: '#0D9488',
                }]} />
              </View>
            </View>
          ))}
          {trend.class_average != null && (
            <Text style={[styles.cardSub, { marginTop: spacing.sm }]}>
              Moyenne de la classe : {trend.class_average.toFixed(2)}/20
              {trend.class_rank ? ` · rang ${trend.class_rank}/${trend.class_total_students}` : ''}
            </Text>
          )}
        </View>
      )}

      {/* Weak subjects */}
      {kpis.weak_subjects?.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {kpis.weak_subjects.map((s, i) => (
            <View key={i} style={[styles.avgChip, { backgroundColor: '#FEE2E2' }]}>
              <Text style={[styles.avgChipText, { color: '#EF4444' }]}>{s.subject_name} · {s.average}/20</Text>
            </View>
          ))}
        </View>
      )}

      {/* AI narrative */}
      <View style={[styles.card, { backgroundColor: '#F0FDFA', borderColor: '#99F6E4', borderWidth: 1 }]}>
        <Text style={[styles.cardTitle, { color: '#0D9488' }]}>Synthèse et recommandations IA</Text>
        <Text style={styles.cardSub}>{ai_summary || 'Aucune analyse générée pour le moment.'}</Text>
        <Text style={[styles.cardSub, { marginTop: spacing.sm, fontSize: 11 }]}>
          {ai_generated_at ? `Généré ${timeAgo(ai_generated_at)}` : 'Pas encore généré'}
        </Text>
      </View>
    </View>
  );
}

// ── Notifications ─────────────────────────────────────────────────────────────

function TabNotifications({ notifications }) {
  if (notifications.length === 0) {
    return (
      <EmptyState
        icon="notifications-outline"
        title="Aucune notification"
        subtitle="Les notifications liées à votre enfant apparaîtront ici"
      />
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {notifications.map((notif) => {
        const meta = NOTIF_TYPE[notif.notification_type] || NOTIF_TYPE.GENERAL;
        const isRead = notif.is_read;
        return (
          <View
            key={notif.id}
            style={[styles.notifCard, isRead ? styles.notifCardRead : styles.notifCardUnread]}
          >
            <View style={[styles.notifIcon, { backgroundColor: meta.bg }]}>
              <Ionicons name={meta.icon} size={16} color={meta.color} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.notifTopRow}>
                <Text style={styles.notifTitle} numberOfLines={1}>{notif.title || notif.notification_type}</Text>
                {!isRead && <View style={styles.unreadDot} />}
              </View>
              {notif.body && <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text>}
              <View style={styles.notifMeta}>
                <View style={[styles.notifTypeBadge, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.notifTypeBadgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
                <Text style={styles.notifTime}>{timeAgo(notif.created_at)}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.success, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.md, marginTop: spacing.sm },
  retryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerSimple: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  header: { paddingHorizontal: spacing.lg, paddingBottom: 0 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', paddingTop: spacing.sm, paddingBottom: 2 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: spacing.sm },

  // List mode
  listContent: { padding: spacing.md },
  listCard: { backgroundColor: '#fff', borderRadius: 18, marginBottom: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3, overflow: 'hidden' },
  listCardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.success },
  listCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, paddingLeft: 20 },
  listAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  listAvatarText: { fontSize: 18, fontWeight: '700', color: colors.primary },
  listChildName: { fontSize: 16, fontWeight: '700', color: colors.text },
  listChildMatricule: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  listBadges: { flexDirection: 'row', gap: 6, marginTop: 4 },
  listBadgeGreen: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  listBadgeGreenText: { fontSize: 11, fontWeight: '700', color: '#059669' },
  listBadgeBlue: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  listBadgeBlueText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  listFinance: { paddingHorizontal: 20, paddingBottom: spacing.md, gap: 6 },
  listFinanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listFinanceLabel: { fontSize: 12, color: colors.textSecondary },
  listFinancePct: { fontSize: 13, fontWeight: '700' },
  listFinanceSub: { fontSize: 11, color: colors.textSecondary },
  listMeta: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.divider, paddingHorizontal: 20, paddingVertical: 10, gap: 16 },
  listMetaItem: { gap: 2 },
  listMetaLabel: { fontSize: 9, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  listMetaValue: { fontSize: 12, fontWeight: '600', color: colors.text },

  // Detail mode back button
  backRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, paddingBottom: spacing.sm },
  backText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },

  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  chipActive: { backgroundColor: '#fff' },
  chipText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  chipTextActive: { color: '#065F46' },

  siteChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  siteChipActive: { backgroundColor: 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.6)' },
  siteChipText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },
  siteChipTextActive: { color: '#fff' },

  childCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.lg, padding: spacing.sm, marginBottom: spacing.sm },
  childLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  childAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  childAvatarText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  childName: { fontSize: 14, fontWeight: '800', color: '#fff', flex: 1 },
  childMatricule: { fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  childBadges: { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  badgeGreen: { backgroundColor: 'rgba(134,239,172,0.25)' },
  badgeOrange: { backgroundColor: 'rgba(252,211,77,0.25)' },
  badgeText: { fontSize: 10, fontWeight: '700' },

  kpiGroup: { gap: 4 },
  kpiItem: { alignItems: 'center' },
  kpiLabel: { fontSize: 8, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '700' },
  kpiValue: { fontSize: 13, fontWeight: '800' },
  kpiUnit: { fontSize: 7, color: 'rgba(255,255,255,0.4)' },

  tabGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 4, paddingBottom: spacing.md },
  tab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.15)', width: '31.6%' },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.75)' },

  content: { padding: spacing.md },

  // Résumé
  enrollCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1.5 },
  enrollCardGreen: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  enrollCardOrange: { backgroundColor: '#FFF7ED', borderColor: '#FDE68A' },
  enrollIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  enrollTitle: { fontSize: 13, fontWeight: '700' },
  enrollSub: { fontSize: 12, marginTop: 2 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, gap: 4 },
  kpiCardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  kpiCardLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  kpiCardValue: { fontSize: 13, fontWeight: '800' },

  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  pctBold: { fontSize: 14, fontWeight: '800' },
  progressBar: { height: 8, backgroundColor: colors.divider, borderRadius: 4, overflow: 'hidden', marginVertical: 6 },
  progressFill: { height: '100%', borderRadius: 4 },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoCell: { width: '47%', backgroundColor: '#F8FAFC', borderRadius: radius.md, padding: 10 },
  infoCellLabel: { fontSize: 9, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoCellValue: { fontSize: 13, fontWeight: '600', color: colors.text },

  // Invoices
  invoiceCard: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, gap: 10 },
  invoiceTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  invoiceTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  invoiceSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  invoiceAmounts: { flexDirection: 'row', gap: 6 },
  invoiceAmt: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: radius.md, padding: 8, alignItems: 'center' },
  invoiceAmtLabel: { fontSize: 9, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  invoiceAmtValue: { fontSize: 11, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  // Absences
  absKpiRow: { flexDirection: 'row', gap: 8 },
  absKpiCard: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center', gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  absKpiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  absKpiValue: { fontSize: 20, fontWeight: '800' },
  absKpiLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center' },
  absCard: { backgroundColor: '#fff', borderRadius: radius.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1, overflow: 'hidden' },
  absAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  absCardInner: { paddingLeft: 12, paddingRight: spacing.sm, paddingVertical: spacing.sm },
  absCardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  absIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  absTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  absSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  absDetails: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.divider, gap: 6 },
  absDetailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  absDetailCell: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, width: '47%', backgroundColor: '#F8FAFC', borderRadius: radius.sm, padding: 7 },
  absDetailLabel: { fontSize: 9, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.3 },
  absDetailValue: { fontSize: 11, fontWeight: '600', color: colors.text, marginTop: 1 },
  absReasonBox: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FDE68A', borderRadius: radius.sm, padding: 8 },
  absReasonLabel: { fontSize: 11, fontWeight: '700', color: '#B45309', marginBottom: 2 },
  absReasonText: { fontSize: 12, color: '#92400E' },

  // Notes
  subjectCard: { backgroundColor: '#fff', borderRadius: radius.lg, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  subjectAccent: { height: 3 },
  subjectHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, paddingBottom: spacing.sm },
  subjectName: { fontSize: 14, fontWeight: '800', color: colors.text, flex: 1 },
  avgChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  avgChipText: { fontSize: 12, fontWeight: '700' },
  gradeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 8 },
  gradeRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  gradeDate: { flex: 1, fontSize: 12, color: colors.textSecondary },
  gradeScore: { fontSize: 13, fontWeight: '700' },

  // Bulletins
  yearHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  yearAccent: { width: 4, height: 20, borderRadius: 2, backgroundColor: '#6366F1' },
  yearLabel: { fontSize: 14, fontWeight: '800', color: colors.text },
  bulletinCard: { backgroundColor: '#fff', borderRadius: radius.lg, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  bulletinAccent: { height: 3 },
  bulletinTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: spacing.md, paddingBottom: 10 },
  bulletinTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  bulletinClass: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  bulletinStats: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: 6, paddingBottom: 10 },
  bulletinStat: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: radius.md, padding: 8, alignItems: 'center' },
  bulletinStatLabel: { fontSize: 9, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.3 },
  bulletinStatValue: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  commentBox: { marginHorizontal: spacing.md, padding: 10, borderRadius: radius.md, backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD', marginBottom: 8 },
  commentLabel: { fontSize: 11, fontWeight: '700', color: '#0284C7', marginBottom: 2 },
  commentText: { fontSize: 12, color: '#0369A1' },
  bulletinFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: 12, marginTop: 4 },
  bulletinDate: { fontSize: 10, color: colors.textTertiary },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  pdfBtnLoading: { backgroundColor: '#64748B' },
  pdfBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Notifications
  notifCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1.5 },
  notifCardRead: { backgroundColor: '#F8FAFC', borderColor: '#F1F5F9' },
  notifCardUnread: { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' },
  notifIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  notifTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  notifTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0EA5E9', marginTop: 4 },
  notifBody: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  notifMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  notifTypeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  notifTypeBadgeText: { fontSize: 10, fontWeight: '700' },
  notifTime: { fontSize: 11, color: colors.textTertiary },
});
