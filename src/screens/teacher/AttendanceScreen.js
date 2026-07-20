import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput, Image,
  ScrollView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import attendanceService from '../../services/attendance';
import teacherService from '../../services/teacher';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, radius } from '../../theme/colors';

const DAY_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DOW_NUM  = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE'];
const DOW_EN   = { MONDAY:'LUNDI', TUESDAY:'MARDI', WEDNESDAY:'MERCREDI', THURSDAY:'JEUDI', FRIDAY:'VENDREDI', SATURDAY:'SAMEDI', SUNDAY:'DIMANCHE' };
const TODAY_STR = DAY_FULL[new Date().getDay()]?.toUpperCase();

function normDay(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return DOW_NUM[raw] ?? null;
  const up = String(raw).toUpperCase();
  return DOW_EN[up] ?? up;
}

function statusColor(s) {
  return { PRESENT: colors.success, ABSENT: colors.danger, LATE: colors.warning, EXCUSED: '#8B5CF6' }[s] || colors.textSecondary;
}

function getInitial(name) {
  if (!name) return '?';
  return name.trim()[0].toUpperCase();
}

/* ── Custom Alert ─────────────────────────────────────────────────────────── */
function CustomAlert({ visible, type = 'info', title, message, onClose }) {
  const cfg = {
    success: { icon: 'checkmark-circle', color: '#059669', gradient: ['#059669', '#10B981'] },
    error:   { icon: 'close-circle',     color: '#DC2626', gradient: ['#DC2626', '#EF4444'] },
    info:    { icon: 'information-circle', color: '#0891B2', gradient: ['#0891B2', '#06B6D4'] },
    warning: { icon: 'warning',           color: '#D97706', gradient: ['#D97706', '#F59E0B'] },
  }[type];
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={alertSt.backdrop}>
        <View style={alertSt.card}>
          <LinearGradient colors={cfg.gradient} style={alertSt.iconWrap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Ionicons name={cfg.icon} size={32} color="#fff" />
          </LinearGradient>
          <Text style={alertSt.title}>{title}</Text>
          {message ? <Text style={alertSt.message}>{message}</Text> : null}
          <TouchableOpacity style={[alertSt.btn, { backgroundColor: cfg.color }]} onPress={onClose} activeOpacity={0.85}>
            <Text style={alertSt.btnText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const alertSt = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', gap: 12, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 12 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  message: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  btn: { paddingHorizontal: 40, paddingVertical: 12, borderRadius: 12, marginTop: 4 },
  btnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

/* ── QR Modal ─────────────────────────────────────────────────────────────── */
function QRModal({ visible, activeSession, onClose, onRefresh }) {
  const [qrUri, setQrUri]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expiry, setExpiry]     = useState(null);
  const timerRef = useRef(null);
  const [countdown, setCountdown] = useState('');

  const loadQR = useCallback(async (sess) => {
    if (!sess) return;
    setLoading(true);
    try {
      const uri = await attendanceService.getSessionQRBase64(sess.id);
      setQrUri(uri);
      if (sess.qr_expiry) setExpiry(new Date(sess.qr_expiry));
    } catch { setQrUri(null); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (visible && activeSession) loadQR(activeSession);
    else if (!visible) { setQrUri(null); setExpiry(null); }
  }, [visible, activeSession, loadQR]);

  // Countdown timer
  useEffect(() => {
    if (!expiry) { setCountdown(''); return; }
    const tick = () => {
      const diff = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      const m = Math.floor(diff / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      setCountdown(diff > 0 ? `${m}:${s}` : 'Expiré');
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [expiry]);

  const handleRefresh = async () => {
    if (!activeSession) return;
    setRefreshing(true);
    try {
      const updated = await attendanceService.refreshSessionQR(activeSession.id);
      if (updated.qr_expiry) setExpiry(new Date(updated.qr_expiry));
      const uri = await attendanceService.getSessionQRBase64(activeSession.id);
      setQrUri(uri);
      onRefresh?.(updated);
    } catch { /* silently ignore */ }
    setRefreshing(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={qrSt.backdrop}>
        <View style={qrSt.sheet}>
          {/* Header */}
          <LinearGradient colors={['#4C1D95', '#8B5CF6']} style={qrSt.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={qrSt.headerTitle}>QR Code de présence</Text>
            <TouchableOpacity onPress={onClose} style={qrSt.closeBtn}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView contentContainerStyle={qrSt.body} showsVerticalScrollIndicator={false}>
            {/* Info */}
            <View style={qrSt.infoBanner}>
              <Ionicons name="information-circle-outline" size={16} color="#0891b2" />
              <Text style={qrSt.infoText}>
                Montrez ce QR code aux étudiants.{'\n'}
                Générez un nouveau code à chaque cours pour éviter la fraude.
              </Text>
            </View>

            {/* Session details */}
            {activeSession && (
              <View style={qrSt.sessionRow}>
                <Ionicons name="book-outline" size={15} color={colors.warning} />
                <Text style={qrSt.sessionText} numberOfLines={1}>
                  {activeSession.session?.subject_name || 'Cours'} · {activeSession.date}
                </Text>
              </View>
            )}

            {/* QR Image */}
            <View style={qrSt.qrBox}>
              {loading ? (
                <ActivityIndicator size="large" color={colors.warning} style={{ margin: 40 }} />
              ) : qrUri ? (
                <Image source={{ uri: qrUri }} style={qrSt.qrImage} resizeMode="contain" />
              ) : (
                <View style={qrSt.qrPlaceholder}>
                  <Ionicons name="qr-code-outline" size={64} color={colors.border} />
                  <Text style={{ color: colors.textTertiary, marginTop: 8, fontSize: 13 }}>
                    Impossible de charger le QR
                  </Text>
                </View>
              )}
            </View>

            {/* Countdown */}
            {countdown ? (
              <View style={[qrSt.countdownRow, countdown === 'Expiré' && { backgroundColor: '#FEE2E2' }]}>
                <Ionicons
                  name={countdown === 'Expiré' ? 'warning-outline' : 'time-outline'}
                  size={16}
                  color={countdown === 'Expiré' ? '#DC2626' : '#059669'}
                />
                <Text style={[qrSt.countdownText, countdown === 'Expiré' && { color: '#DC2626' }]}>
                  {countdown === 'Expiré' ? 'QR Code expiré — générez-en un nouveau' : `Expire dans ${countdown}`}
                </Text>
              </View>
            ) : null}

            {/* Refresh button */}
            <TouchableOpacity
              style={[qrSt.refreshBtn, refreshing && { opacity: 0.6 }]}
              onPress={handleRefresh}
              disabled={refreshing}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#4C1D95', '#8B5CF6']} style={qrSt.refreshGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {refreshing
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Ionicons name="refresh-outline" size={18} color="#fff" />}
                <Text style={qrSt.refreshText}>
                  {refreshing ? 'Génération…' : 'Nouveau QR Code'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={qrSt.hint}>
              Chaque nouveau QR invalide le précédent (anti-fraude).
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const qrSt = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 18 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  body: { padding: 20, gap: 16, paddingBottom: 36 },
  infoBanner: { flexDirection: 'row', gap: 10, backgroundColor: '#E0F2FE', borderRadius: 12, padding: 12, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 13, color: '#0c4a6e', lineHeight: 19 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF7ED', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FED7AA' },
  sessionText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#92400E' },
  qrBox: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, minHeight: 240 },
  qrImage: { width: 220, height: 220 },
  qrPlaceholder: { alignItems: 'center', padding: 32 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#BBF7D0' },
  countdownText: { fontSize: 14, fontWeight: '700', color: '#059669' },
  refreshBtn: { borderRadius: 16, overflow: 'hidden' },
  refreshGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, paddingHorizontal: 24 },
  refreshText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  hint: { fontSize: 12, color: colors.textTertiary, textAlign: 'center', lineHeight: 18 },
});

/* ══════════════════════════════════════════════════════════════════════════ */
export default function TeacherAttendanceScreen({ navigation, route }) {
  const preloadedSession = route?.params?.session;

  const [classes, setClasses]             = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [classSessions, setClassSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [students, setStudents]           = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [records, setRecords]             = useState({});
  const [loading, setLoading]             = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [saving, setSaving]               = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const [search, setSearch]               = useState('');
  const [showQR, setShowQR]               = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);

  const [alert, setAlert] = useState({ visible: false, type: 'info', title: '', message: '' });
  const showAlert = (type, title, message) => setAlert({ visible: true, type, title, message });
  const closeAlert = () => setAlert((p) => ({ ...p, visible: false }));

  const [postponeModal, setPostponeModal] = useState({ visible: false, session: null });
  const [postponeReason, setPostponeReason] = useState('');
  const [postponing, setPostponing] = useState(false);
  const [postponedIds, setPostponedIds] = useState(new Set());

  const handlePostpone = async () => {
    if (!postponeModal.session) return;
    setPostponing(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await attendanceService.postponeSession({
        session_id: postponeModal.session.id,
        date: today,
        reason: postponeReason.trim(),
      });
      setPostponedIds((prev) => new Set([...prev, postponeModal.session.id]));
      setPostponeModal({ visible: false, session: null });
      setPostponeReason('');
      showAlert('success', 'Cours ajourné', 'Les étudiants ont été notifiés. Personne ne sera marqué absent.');
    } catch (e) {
      showAlert('error', 'Erreur', e?.response?.data?.detail || e.message);
    } finally { setPostponing(false); }
  };

  const handleSessionQR = async (sess) => {
    // Reset active session if switching to a different course
    if (selectedSession?.id !== sess.id) setActiveSession(null);
    setSelectedSession(sess);
    if (activeSession && selectedSession?.id === sess.id) {
      setShowQR(true);
      return;
    }
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const opened = await attendanceService.openSession({ session_id: sess.id, date: today });
      setActiveSession(opened);
      setShowQR(true);
    } catch (e) {
      showAlert('error', 'Erreur', e?.response?.data?.detail || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelPostponement = async (sess) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      await attendanceService.cancelPostponement({ session_id: sess.id, date: today });
      setPostponedIds((prev) => { const s = new Set(prev); s.delete(sess.id); return s; });
      showAlert('success', 'Ajournement annulé', 'La séance est réouverte.');
    } catch (e) {
      showAlert('error', 'Erreur', e?.response?.data?.detail || e.message);
    }
  };

  const loadStudents = useCallback(async (cls) => {
    try {
      const res = await teacherService.getClassStudents(cls.id);
      const list = res?.results || res || [];
      setStudents(list);
      const init = {};
      list.forEach((e) => { init[e.student] = 'PRESENT'; });
      setRecords(init);
    } catch (e) { console.log('Class students error:', e.message); }
  }, []);

  const loadTodaySessions = useCallback(async (cls) => {
    setLoadingSessions(true);
    try {
      const [schedRes, sessRes] = await Promise.allSettled([
        teacherService.getClassSchedule(cls.id),
        teacherService.getSessions({ class_id: cls.id }),
      ]);
      const schedList = schedRes.status === 'fulfilled' ? (schedRes.value?.results || schedRes.value || []) : [];
      const sessList  = sessRes.status  === 'fulfilled' ? (sessRes.value?.results  || sessRes.value  || []) : [];
      const seen = new Set();
      const all = [...schedList, ...sessList].filter((s) => {
        if (seen.has(s.id)) return false; seen.add(s.id); return true;
      });
      // Sessions of the day first; if none, fall back to all sessions of the class
      const todaySess = all.filter((s) => normDay(s.day_of_week) === TODAY_STR)
        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
      const displaySess = todaySess.length > 0 ? todaySess : all.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
      setClassSessions(displaySess);
      if (preloadedSession) {
        setSelectedSession(displaySess.find((s) => s.id === preloadedSession.id) || displaySess[0] || preloadedSession);
      } else {
        setSelectedSession(displaySess.length === 1 ? displaySess[0] : null);
      }
    } catch (e) { console.log('Load sessions error:', e.message); setClassSessions([]); }
    finally { setLoadingSessions(false); }
  }, [preloadedSession]);

  const selectClass = useCallback(async (cls) => {
    setShowClassPicker(false);
    setSelectedClass(cls);
    setSelectedSession(null);
    setActiveSession(null);
    setStudents([]);
    setRecords({});
    setSearch('');
    setLoading(true);
    await loadTodaySessions(cls);
    setLoading(false);
  }, [loadTodaySessions]);

  // Charge les étudiants uniquement quand un cours est sélectionné
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!selectedSession) { setStudents([]); setRecords({}); return; }
    if (selectedClass) loadStudents(selectedClass);
  }, [selectedSession]);

  const fetchClasses = useCallback(async () => {
    try {
      // Get teacher ID then filter sessions by teacher to build class list
      const me = await teacherService.getMe().catch(() => null);
      const teacherId = me?.id;
      const sessRes = await teacherService.getSessions(teacherId ? { teacher_id: teacherId } : {});
      const sessions = sessRes?.results || sessRes || [];
      // Unique classes extracted from teacher's sessions
      const classMap = {};
      sessions.forEach((s) => {
        const cid = s.class_obj;
        if (cid && !classMap[cid]) classMap[cid] = { id: cid, name: s.class_name || String(cid) };
      });
      const list = Object.values(classMap);
      setClasses(list);
      if (list.length > 0) {
        const cls = preloadedSession
          ? list.find((c) => c.id === (preloadedSession.class_obj || preloadedSession.class_id)) || list[0]
          : list[0];
        if (cls) await selectClass(cls);
      }
    } catch (e) { console.log('Attendance classes error:', e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [selectClass, preloadedSession]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const openSession = async () => {
    if (!selectedSession) { showAlert('warning', 'Cours requis', 'Sélectionnez un cours du jour.'); return; }
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const sess = await attendanceService.openSession({ session_id: selectedSession.id, date: today });
      setActiveSession(sess);
      showAlert('success', 'Session ouverte', `Séance démarrée · ${selectedSession.subject_name || selectedClass?.name}`);
    } catch (e) { showAlert('error', 'Erreur', e?.response?.data?.detail || e.message); }
    finally { setSaving(false); }
  };

  const saveAttendance = async () => {
    if (!activeSession) { showAlert('warning', 'Session requise', 'Ouvrez d\'abord une session.'); return; }
    setSaving(true);
    try {
      const entries = Object.entries(records).map(([student, status]) => ({
        student, status, attendance_session: activeSession.id,
      }));
      await attendanceService.bulkMark({ attendance_session: activeSession.id, records: entries });
      showAlert('success', 'Présences enregistrées', 'Toutes les présences ont été sauvegardées.');
    } catch (e) { showAlert('error', 'Erreur', e?.response?.data?.detail || e.message); }
    finally { setSaving(false); }
  };

  // Mark a single student directly (for manual marking without phone)
  const markStudent = async (studentId, newStatus) => {
    // Optimistic UI update first
    setRecords((p) => ({ ...p, [studentId]: newStatus }));

    let session = activeSession;

    // Auto-open session on first mark if not already open
    if (!session) {
      if (!selectedSession) {
        showAlert('warning', 'Cours requis', 'Sélectionnez un cours avant de marquer les présences.');
        setRecords((p) => ({ ...p, [studentId]: records[studentId] || 'PRESENT' }));
        return;
      }
      try {
        const today = new Date().toISOString().split('T')[0];
        session = await attendanceService.openSession({ session_id: selectedSession.id, date: today });
        setActiveSession(session);
      } catch (e) {
        showAlert('error', 'Erreur', e?.response?.data?.detail || 'Impossible d\'ouvrir la session.');
        setRecords((p) => ({ ...p, [studentId]: records[studentId] || 'PRESENT' }));
        return;
      }
    }

    try {
      await attendanceService.markAttendance({
        attendance_session: session.id,
        student: studentId,
        status: newStatus,
      });
    } catch {
      // Revert on error
      setRecords((p) => ({ ...p, [studentId]: records[studentId] || 'PRESENT' }));
      showAlert('error', 'Erreur', 'Impossible d\'enregistrer la présence.');
    }
  };

  const presentCount = Object.values(records).filter((s) => s === 'PRESENT').length;
  const absentCount  = Object.values(records).filter((s) => s === 'ABSENT').length;
  const lateCount    = Object.values(records).filter((s) => s === 'LATE').length;

  const filteredStudents = students.filter((item) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      (item.student_name || '').toLowerCase().includes(q) ||
      (item.student_matricule || '').toLowerCase().includes(q)
    );
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#4C1D95', '#6D28D9', '#8B5CF6']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Feuille de présence</Text>
            {/* QR Code button */}
            {activeSession ? (
              <TouchableOpacity style={styles.qrBtn} onPress={() => setShowQR(true)}>
                <Ionicons name="qr-code-outline" size={20} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 38 }} />
            )}
          </View>

          {/* Class selector dropdown */}
          <Text style={styles.sectionLabel}>Classe</Text>
          <TouchableOpacity
            style={styles.classSelector}
            onPress={() => setShowClassPicker((p) => !p)}
            activeOpacity={0.85}
          >
            <Ionicons name="people-outline" size={14} color="rgba(255,255,255,0.85)" />
            <Text style={styles.classSelectorText} numberOfLines={1}>
              {selectedClass?.name || 'Choisir une classe'}
            </Text>
            <Ionicons
              name={showClassPicker ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="rgba(255,255,255,0.85)"
            />
          </TouchableOpacity>

          {showClassPicker && (
            <View style={styles.classPickerList}>
              {classes.map((item, idx) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.classPickerItem,
                    selectedClass?.id === item.id && styles.classPickerItemActive,
                    idx === classes.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => { selectClass(item); setShowClassPicker(false); }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.classPickerItemText, selectedClass?.id === item.id && styles.classPickerItemTextActive]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {selectedClass?.id === item.id && (
                    <Ionicons name="checkmark-circle" size={16} color="#6D28D9" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Session chips */}
          {selectedClass && (
            <>
              <View style={styles.sessionLabelRow}>
                <Text style={styles.sectionLabel}>
                  {classSessions.some((s) => normDay(s.day_of_week) === TODAY_STR)
                    ? 'Cours du jour'
                    : classSessions.length > 0 ? 'Cours disponibles' : 'Cours du jour'}
                </Text>
                {loadingSessions && <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" style={{ marginLeft: 6, marginBottom: 4 }} />}
              </View>
              {!loadingSessions && classSessions.length === 0 ? (
                <View style={styles.noSessionRow}>
                  <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.55)" />
                  <Text style={styles.noSessionText}>Aucun cours dans cette classe</Text>
                </View>
              ) : (
                <ScrollView
                  style={{ maxHeight: 168 }}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={classSessions.length > 3}
                  contentContainerStyle={{ gap: 6, paddingBottom: 8 }}
                >
                  {classSessions.map((sess) => {
                    const isActive    = selectedSession?.id === sess.id;
                    const isPostponed = postponedIds.has(sess.id) || sess.is_postponed;
                    return (
                      <View key={sess.id} style={styles.sessChipRow}>
                        <TouchableOpacity
                          style={[styles.sessChip, isActive && styles.sessChipActive, isPostponed && styles.sessChipPostponed]}
                          onPress={() => {
                            if (isPostponed) return;
                            if (selectedSession?.id !== sess.id) setActiveSession(null);
                            setSelectedSession(sess);
                          }}
                          disabled={isPostponed}
                        >
                          <Ionicons
                            name={isPostponed ? 'ban-outline' : 'book-outline'}
                            size={11}
                            color={isPostponed ? '#B91C1C' : isActive ? '#92400E' : 'rgba(255,255,255,0.8)'}
                          />
                          <Text
                            style={[styles.sessChipText, isActive && styles.sessChipTextActive, isPostponed && styles.sessChipTextPostponed]}
                            numberOfLines={1}
                          >
                            {sess.subject_name || sess.subject || 'Cours'}
                          </Text>
                          {isPostponed ? (
                            <View style={styles.postponedTag}>
                              <Text style={styles.postponedTagText}>Ajourné</Text>
                            </View>
                          ) : sess.start_time ? (
                            <View style={[styles.timeTag, isActive && { backgroundColor: '#FDE68A' }]}>
                              <Text style={[styles.timeTagText, isActive && { color: '#92400E' }]}>
                                {sess.start_time.slice(0, 5)}
                              </Text>
                            </View>
                          ) : null}
                        </TouchableOpacity>

                        {!isPostponed && (
                          <TouchableOpacity style={styles.qrChipBtn} onPress={() => handleSessionQR(sess)}>
                            <Ionicons name="qr-code-outline" size={13} color="#fff" />
                          </TouchableOpacity>
                        )}
                        {isPostponed ? (
                          <TouchableOpacity style={styles.cancelPostponeBtn} onPress={() => handleCancelPostponement(sess)}>
                            <Ionicons name="refresh-outline" size={13} color="#fff" />
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.postponeBtn}
                            onPress={() => { setPostponeModal({ visible: true, session: sess }); setPostponeReason(''); }}
                          >
                            <Ionicons name="pause-circle-outline" size={13} color="#fff" />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </>
          )}
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.warning} size="large" /></View>
      ) : !selectedClass ? (
        <EmptyState icon="people-outline" title="Choisissez une classe" />
      ) : (
        <>
          {/* Summary bar */}
          <View style={styles.summaryBar}>
            <CountItem label="Présents"  value={presentCount} color={colors.success} />
            <View style={styles.divider} />
            <CountItem label="Absents"   value={absentCount}  color={colors.danger} />
            <View style={styles.divider} />
            <CountItem label="Retards"   value={lateCount}    color={colors.warning} />
            <View style={styles.divider} />
            <CountItem label="Total"     value={students.length} color={colors.text} />
            <TouchableOpacity
              style={[
                styles.actionBtn,
                activeSession && styles.actionBtnSave,
                saving && { opacity: 0.6 },
              ]}
              onPress={activeSession ? saveAttendance : openSession}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Ionicons name={activeSession ? 'save-outline' : 'play-outline'} size={14} color="#fff" />
                  <Text style={styles.actionBtnText}>{activeSession ? 'Sauv.' : 'Ouvrir'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Session status banner */}
          {activeSession ? (
            <View style={[styles.banner, styles.bannerGreen]}>
              <Ionicons name="checkmark-circle" size={15} color="#059669" />
              <Text style={styles.bannerTextGreen} numberOfLines={1}>
                Session ouverte · {selectedSession?.subject_name || ''}{selectedSession?.start_time ? ` · ${selectedSession.start_time.slice(0, 5)}` : ''}
              </Text>
              <TouchableOpacity onPress={() => setShowQR(true)} style={styles.qrBannerBtn}>
                <Ionicons name="qr-code-outline" size={14} color="#059669" />
                <Text style={styles.qrBannerText}>QR</Text>
              </TouchableOpacity>
            </View>
          ) : !selectedSession && classSessions.length > 0 ? (
            <View style={[styles.banner, styles.bannerOrange]}>
              <Ionicons name="warning-outline" size={15} color="#D97706" />
              <Text style={styles.bannerTextOrange}>Sélectionnez un cours ci-dessus pour ouvrir</Text>
            </View>
          ) : null}

          {/* Quick actions — visibles seulement quand un cours est sélectionné */}
          {selectedSession && (
            <View style={styles.quickRow}>
              <TouchableOpacity style={styles.quickBtn} onPress={() => {
                const all = {}; students.forEach((e) => { all[e.student] = 'PRESENT'; }); setRecords(all);
              }}>
                <Ionicons name="checkmark-done-outline" size={14} color={colors.success} />
                <Text style={[styles.quickText, { color: colors.success }]}>Tous présents</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickBtn} onPress={() => {
                const all = {}; students.forEach((e) => { all[e.student] = 'ABSENT'; }); setRecords(all);
              }}>
                <Ionicons name="close-circle-outline" size={14} color={colors.danger} />
                <Text style={[styles.quickText, { color: colors.danger }]}>Tous absents</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Search field — visible seulement quand un cours est sélectionné */}
          {selectedSession && (
            <>
              <View style={styles.searchRow}>
                <Ionicons name="search-outline" size={16} color={colors.textTertiary} style={{ position: 'absolute', left: 28, zIndex: 1 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher un étudiant (nom, matricule)…"
                  placeholderTextColor={colors.textTertiary}
                  value={search}
                  onChangeText={setSearch}
                  clearButtonMode="while-editing"
                />
              </View>
              {search.trim() !== '' && (
                <Text style={styles.searchHint}>
                  {filteredStudents.length} résultat{filteredStudents.length !== 1 ? 's' : ''} · cliquez sur P / A pour marquer
                </Text>
              )}
            </>
          )}

          {/* Student list — visible seulement quand un cours est sélectionné */}
          <FlatList
            data={selectedSession ? filteredStudents : []}
            keyExtractor={(i) => String(i.id)}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchClasses(); }} tintColor={colors.warning} />
            }
            ListEmptyComponent={
              search.trim()
                ? <EmptyState icon="search-outline" title="Aucun étudiant trouvé" subtitle={`Essayez "${search}" avec d'autres termes`} />
                : !selectedSession
                ? <EmptyState icon="book-outline" title="Sélectionnez un cours" subtitle="Choisissez un cours ci-dessus pour afficher la liste des étudiants" />
                : <EmptyState icon="people-outline" title="Aucun étudiant inscrit" subtitle="Aucun étudiant n'est inscrit dans ce cours" />
            }
            renderItem={({ item }) => {
              const studentId = item.student;
              const st  = records[studentId] || 'PRESENT';
              const col = statusColor(st);
              const name = item.student_name || '';
              return (
                <View style={[styles.card, { borderLeftColor: col, borderLeftWidth: 4 }]}>
                  {/* Avatar */}
                  <View style={[styles.avatar, { backgroundColor: col + '22' }]}>
                    <Text style={[styles.avatarText, { color: col }]}>{getInitial(name)}</Text>
                  </View>

                  {/* Name + matricule + status label */}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.studentName} numberOfLines={2}>{name || 'Étudiant'}</Text>
                    <View style={styles.matriculeRow}>
                      <Text style={styles.matricule}>{item.student_matricule || ''}</Text>
                      <View style={[styles.statusPill, { backgroundColor: col + '18', borderColor: col + '40' }]}>
                        <Text style={[styles.statusPillText, { color: col }]}>
                          {{ PRESENT: 'Présent', ABSENT: 'Absent', LATE: 'Retard', EXCUSED: 'Excusé' }[st] || st}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Status buttons — icônes uniquement, plus compactes */}
                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      style={[styles.markBtn, st === 'PRESENT' && styles.markBtnPresent]}
                      onPress={() => markStudent(studentId, 'PRESENT')}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="checkmark" size={16} color={st === 'PRESENT' ? '#fff' : colors.success} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.markBtn, st === 'LATE' && styles.markBtnLate]}
                      onPress={() => markStudent(studentId, 'LATE')}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="time-outline" size={16} color={st === 'LATE' ? '#fff' : colors.warning} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.markBtn, st === 'ABSENT' && styles.markBtnAbsent]}
                      onPress={() => markStudent(studentId, 'ABSENT')}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="close" size={16} color={st === 'ABSENT' ? '#fff' : colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        </>
      )}

      {/* QR Code Modal */}
      <QRModal
        visible={showQR}
        activeSession={activeSession}
        onClose={() => setShowQR(false)}
        onRefresh={(updated) => setActiveSession((prev) => ({ ...prev, ...updated }))}
      />

      {/* Postpone Modal */}
      <Modal visible={postponeModal.visible} transparent animationType="slide">
        <View style={alertSt.backdrop}>
          <View style={[alertSt.card, { gap: 14 }]}>
            <View style={[alertSt.iconWrap, { backgroundColor: '#F59E0B' }]}>
              <Ionicons name="pause-circle" size={32} color="#fff" />
            </View>
            <Text style={alertSt.title}>Ajourner ce cours ?</Text>
            <Text style={[alertSt.message, { textAlign: 'left' }]}>
              {postponeModal.session?.subject_name || 'Ce cours'} · {postponeModal.session?.start_time?.slice(0, 5)}
              {'\n'}Les étudiants seront notifiés et personne ne sera marqué absent.
            </Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Raison (optionnel)…"
              placeholderTextColor="#94A3B8"
              value={postponeReason}
              onChangeText={setPostponeReason}
              multiline
              numberOfLines={2}
            />
            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <TouchableOpacity
                style={[alertSt.btn, { flex: 1, backgroundColor: colors.border }]}
                onPress={() => setPostponeModal({ visible: false, session: null })}
              >
                <Text style={[alertSt.btnText, { color: colors.textSecondary }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[alertSt.btn, { flex: 1, backgroundColor: '#D97706' }]}
                onPress={handlePostpone}
                disabled={postponing}
              >
                {postponing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={alertSt.btnText}>Ajourner</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <CustomAlert
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={closeAlert}
      />
    </View>
  );
}

function CountItem({ label, value, color }) {
  return (
    <View style={styles.countItem}>
      <Text style={[styles.countValue, { color }]}>{value}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, paddingBottom: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  qrBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  sectionLabel: { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  sessionLabelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },

  classSelector: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 6 },
  classSelectorText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#fff' },
  classPickerList: { backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 12, marginBottom: 6, overflow: 'hidden' },
  classPickerItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  classPickerItemActive: { backgroundColor: 'rgba(255,255,255,0.92)' },
  classPickerItemText: { flex: 1, fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  classPickerItemTextActive: { color: '#6D28D9' },

  sessChipRow: { flexDirection: 'row', alignItems: 'center', gap: 4, width: '100%' },
  sessChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', flex: 1 },
  sessChipActive: { backgroundColor: '#fff' },
  sessChipPostponed: { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)' },
  sessChipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)', flexShrink: 1 },
  sessChipTextActive: { color: '#92400E' },
  sessChipTextPostponed: { color: '#FCA5A5', textDecorationLine: 'line-through' },
  timeTag: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  timeTagText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  postponedTag: { backgroundColor: 'rgba(239,68,68,0.3)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  postponedTagText: { fontSize: 9, fontWeight: '800', color: '#FCA5A5' },
  qrChipBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(37,99,235,0.75)', alignItems: 'center', justifyContent: 'center' },
  postponeBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(245,158,11,0.7)', alignItems: 'center', justifyContent: 'center' },
  cancelPostponeBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(16,185,129,0.7)', alignItems: 'center', justifyContent: 'center' },

  noSessionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 4 },
  noSessionText: { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  summaryBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: spacing.md, marginBottom: 8, borderRadius: radius.lg, padding: spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  countItem: { flex: 1, alignItems: 'center' },
  countValue: { fontSize: 20, fontWeight: '800' },
  countLabel: { fontSize: 10, color: colors.textSecondary, marginTop: 1, fontWeight: '600' },
  divider: { width: 1, height: 32, backgroundColor: colors.divider },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.warning, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, marginLeft: 8 },
  actionBtnSave: { backgroundColor: colors.success },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.md, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.md, borderWidth: 1 },
  bannerGreen: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  bannerOrange: { backgroundColor: '#FFF7ED', borderColor: '#FDE68A' },
  bannerTextGreen: { flex: 1, fontSize: 12, fontWeight: '700', color: '#065F46' },
  bannerTextOrange: { flex: 1, fontSize: 12, fontWeight: '600', color: '#92400E' },
  qrBannerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  qrBannerText: { fontSize: 11, fontWeight: '800', color: '#059669' },

  quickRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, marginBottom: 8 },
  quickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, padding: 9, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  quickText: { fontSize: 12, fontWeight: '700' },

  searchRow: { marginHorizontal: spacing.md, marginBottom: 6 },
  searchInput: { backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingLeft: 40, paddingRight: 14, paddingVertical: 10, fontSize: 13, color: colors.text },
  searchHint: { fontSize: 11, color: colors.textTertiary, paddingHorizontal: spacing.md, marginBottom: 6, fontStyle: 'italic' },

  list: { paddingHorizontal: spacing.md, paddingBottom: 24, gap: 6 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 15, fontWeight: '800' },
  studentName: { fontSize: 13, fontWeight: '700', color: colors.text, lineHeight: 17 },
  matriculeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' },
  matricule: { fontSize: 11, color: colors.textSecondary },
  statusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  statusPillText: { fontSize: 10, fontWeight: '700' },

  btnRow: { flexDirection: 'row', gap: 5, flexShrink: 0 },
  markBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#F8FAFC' },
  markBtnPresent: { backgroundColor: colors.success, borderColor: colors.success },
  markBtnAbsent:  { backgroundColor: colors.danger,  borderColor: colors.danger },
  markBtnLate:    { backgroundColor: colors.warning,  borderColor: colors.warning },
  markBtnText: { fontSize: 11, fontWeight: '800' },

  reasonInput: { width: '100%', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontSize: 13, color: colors.text, minHeight: 56, textAlignVertical: 'top' },
});
