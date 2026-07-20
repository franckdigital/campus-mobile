import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  ScrollView, Platform,
} from 'react-native';
import Alert from '../../utils/appAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import attendanceService from '../../services/attendance';
import studentService from '../../services/student';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, radius } from '../../theme/colors';

const FILTERS = [
  { key: 'ALL',     label: 'Tout',    icon: 'list-outline',           color: colors.primary,    bg: '#EEF2FF' },
  { key: 'PRESENT', label: 'Présent', icon: 'checkmark-circle-outline', color: '#059669',        bg: '#D1FAE5' },
  { key: 'ABSENT',  label: 'Absent',  icon: 'close-circle-outline',   color: '#EF4444',         bg: '#FEE2E2' },
  { key: 'LATE',    label: 'Retard',  icon: 'time-outline',           color: '#D97706',         bg: '#FEF3C7' },
  { key: 'EXCUSED', label: 'Excusé',  icon: 'shield-checkmark-outline', color: '#0EA5E9',       bg: '#E0F2FE' },
];

const STATUS_CFG = {
  PRESENT: { label: 'Présent', color: '#059669', bg: '#D1FAE5', icon: 'checkmark-circle' },
  ABSENT:  { label: 'Absent',  color: '#EF4444', bg: '#FEE2E2', icon: 'close-circle'     },
  LATE:    { label: 'Retard',  color: '#D97706', bg: '#FEF3C7', icon: 'time'              },
  EXCUSED: { label: 'Excusé',  color: '#0EA5E9', bg: '#E0F2FE', icon: 'shield-checkmark' },
};

/* ── QR Scanner Modal ─────────────────────────────────────────────────────── */
function ScanQRModal({ visible, onClose, onSuccess }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);

  useEffect(() => {
    if (visible) { setScanned(false); setResult(null); }
  }, [visible]);

  const handleScan = async ({ data }) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);
    try {
      // QR contient un JSON {"type":"attendance","code":"<uuid>","session_id":"...","date":"..."}
      let qrCode = data;
      try {
        const parsed = JSON.parse(data);
        if (parsed?.code) qrCode = parsed.code;
      } catch { /* données brutes, on utilise telles quelles */ }
      await attendanceService.scanQR({ qr_code: qrCode });
      setResult({ success: true, message: 'Votre présence a été enregistrée avec succès.' });
      onSuccess?.();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.response?.data?.error || 'QR invalide ou expiré. Demandez à l\'enseignant de renouveler le code.';
      setResult({ success: false, message: msg });
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  if (!permission) {
    return (
      <Modal visible animationType="slide">
        <View style={scanSt.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible animationType="slide">
        <SafeAreaView style={scanSt.permView}>
          <View style={[scanSt.resultIcon, { backgroundColor: '#EEF2FF', marginBottom: 4 }]}>
            <Ionicons name="camera-outline" size={48} color={colors.primary} />
          </View>
          <Text style={scanSt.permTitle}>Accès caméra requis</Text>
          <Text style={scanSt.permSub}>
            Pour scanner le QR code de présence affiché par l'enseignant, autorisez l'accès à votre caméra.
          </Text>
          <TouchableOpacity style={scanSt.btn} onPress={requestPermission}>
            <Text style={scanSt.btnText}>Autoriser l'accès</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[scanSt.btn, { backgroundColor: '#f1f5f9', marginTop: 8 }]} onPress={onClose}>
            <Text style={[scanSt.btnText, { color: '#64748b' }]}>Annuler</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {!scanned ? (
          <View style={{ flex: 1 }}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleScan}
            />
            {/* Overlay */}
            <SafeAreaView style={scanSt.overlay}>
              <TouchableOpacity style={scanSt.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={scanSt.frameWrap}>
                <View style={scanSt.frame}>
                  <View style={[scanSt.corner, scanSt.cornerTL]} />
                  <View style={[scanSt.corner, scanSt.cornerTR]} />
                  <View style={[scanSt.corner, scanSt.cornerBL]} />
                  <View style={[scanSt.corner, scanSt.cornerBR]} />
                </View>
              </View>
              <View style={scanSt.hintBox}>
                <Text style={scanSt.hint}>Pointez vers le QR code affiché par l'enseignant</Text>
              </View>
            </SafeAreaView>
          </View>
        ) : (
          <View style={scanSt.resultView}>
            {loading ? (
              <>
                <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: 16 }} />
                <Text style={scanSt.resultSub}>Enregistrement en cours…</Text>
              </>
            ) : result ? (
              <>
                <View style={[scanSt.resultIcon, { backgroundColor: result.success ? '#D1FAE5' : '#FEE2E2' }]}>
                  <Ionicons
                    name={result.success ? 'checkmark-circle' : 'close-circle'}
                    size={64}
                    color={result.success ? '#059669' : '#EF4444'}
                  />
                </View>
                <Text style={[scanSt.resultTitle, { color: result.success ? '#059669' : '#EF4444' }]}>
                  {result.success ? 'Présence confirmée !' : 'Erreur de scan'}
                </Text>
                <Text style={scanSt.resultSub}>{result.message}</Text>
                {result.success ? (
                  <TouchableOpacity style={[scanSt.btn, { backgroundColor: '#059669', marginTop: 20 }]} onPress={onClose}>
                    <Text style={scanSt.btnText}>Fermer</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ gap: 8, width: '100%', marginTop: 20 }}>
                    <TouchableOpacity style={[scanSt.btn, { backgroundColor: colors.primary }]}
                      onPress={() => { setScanned(false); setResult(null); }}>
                      <Text style={scanSt.btnText}>Réessayer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[scanSt.btn, { backgroundColor: '#f1f5f9' }]} onPress={onClose}>
                      <Text style={[scanSt.btnText, { color: '#64748b' }]}>Annuler</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : null}
          </View>
        )}
      </View>
    </Modal>
  );
}

const scanSt = StyleSheet.create({
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  permView:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, backgroundColor: '#fff' },
  permTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  permSub:   { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 21 },
  btn:       { width: '100%', backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center' },
  btnText:   { fontSize: 15, fontWeight: '800', color: '#fff' },

  overlay:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between', paddingVertical: 24, paddingHorizontal: 20 },
  closeBtn:  { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', marginTop: 8 },
  frameWrap: { alignItems: 'center', justifyContent: 'center' },
  frame:     { width: 260, height: 260, position: 'relative' },
  corner:    { position: 'absolute', width: 32, height: 32, borderColor: '#fff', borderWidth: 3 },
  cornerTL:  { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 8 },
  cornerTR:  { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 8 },
  cornerBL:  { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR:  { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 8 },
  hintBox:   { alignSelf: 'stretch', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 14, padding: 14, marginBottom: 8 },
  hint:      { fontSize: 14, color: '#fff', textAlign: 'center', fontWeight: '600', lineHeight: 20 },

  resultView:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 32, gap: 12 },
  resultIcon:  { width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  resultTitle: { fontSize: 24, fontWeight: '900', textAlign: 'center' },
  resultSub:   { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 21 },
});

export default function StudentAttendanceScreen({ navigation }) {
  const [records, setRecords] = useState([]);
  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState('records');
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [absenceReason, setAbsenceReason] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [studentId, setStudentId] = useState(null);
  const [showScanner, setShowScanner] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const me = await studentService.getMe();
      setStudentId(me.id);
      const [rec, req] = await Promise.allSettled([
        attendanceService.getRecords({ student: me.id }),
        attendanceService.getAbsenceRequests({ student: me.id }),
      ]);
      if (rec.status === 'fulfilled') setRecords(rec.value?.results || rec.value || []);
      if (req.status === 'fulfilled') setRequests(req.value?.results || req.value || []);
    } catch (e) {
      console.log('Attendance error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refetch on every focus, not just once at mount — this is a bottom-tab
  // screen that stays mounted across tab switches (see FinanceScreen.js).
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const totalPresent = records.filter((r) => r.status === 'PRESENT').length;
  const totalAbsent  = records.filter((r) => r.status === 'ABSENT').length;
  const totalLate    = records.filter((r) => r.status === 'LATE').length;
  const totalExcused = records.filter((r) => r.status === 'EXCUSED').length;
  const attendanceRate = records.length
    ? (((totalPresent + totalExcused) / records.length) * 100).toFixed(0)
    : '--';
  const rateNum = parseFloat(attendanceRate);
  const rateLow = !isNaN(rateNum) && rateNum < 80;

  const filteredRecords = filter === 'ALL'
    ? records
    : records.filter((r) => r.status === filter);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) setAttachment(result.assets[0]);
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le sélecteur de fichiers.');
    }
  };

  const resetModal = () => {
    setShowModal(false);
    setAbsenceReason('');
    setDateStart('');
    setDateEnd('');
    setAttachment(null);
  };

  const submitAbsenceRequest = async () => {
    if (!absenceReason || !dateStart || !dateEnd) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }
    setSubmitting(true);
    try {
      if (attachment) {
        const formData = new FormData();
        formData.append('student', String(studentId));
        formData.append('reason', absenceReason);
        formData.append('date_start', dateStart);
        formData.append('date_end', dateEnd);
        formData.append('supporting_document', {
          uri: attachment.uri,
          name: attachment.name,
          type: attachment.mimeType || 'application/octet-stream',
        });
        await attendanceService.createAbsenceRequestWithFile(formData);
      } else {
        await attendanceService.createAbsenceRequest({
          student: studentId,
          reason: absenceReason,
          date_start: dateStart,
          date_end: dateEnd,
        });
      }
      resetModal();
      fetchData();
      Alert.alert('Succès', 'Demande d\'absence envoyée.');
    } catch (e) {
      Alert.alert('Erreur', e?.response?.data?.detail || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const STAT_CHIPS = [
    { label: 'Présent', value: totalPresent, color: '#059669', bg: '#D1FAE5', icon: 'checkmark-circle', status: 'PRESENT' },
    { label: 'Absent',  value: totalAbsent,  color: '#EF4444', bg: '#FEE2E2', icon: 'close-circle',     status: 'ABSENT'  },
    { label: 'Retard',  value: totalLate,    color: '#D97706', bg: '#FEF3C7', icon: 'time',              status: 'LATE'    },
    { label: 'Excusé',  value: totalExcused, color: '#0EA5E9', bg: '#E0F2FE', icon: 'shield-checkmark', status: 'EXCUSED' },
  ];

  const RecordsListHeader = (
    <View style={styles.listHeaderBox}>
      {/* Low attendance warning */}
      {rateLow && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={18} color="#92400E" />
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>Taux de présence insuffisant</Text>
            <Text style={styles.warningSub}>
              Votre taux ({attendanceRate}%) est en dessous du seuil de 80% requis.
            </Text>
          </View>
        </View>
      )}

      {/* Clickable stat cards */}
      <View style={styles.statCards}>
        {STAT_CHIPS.map((s) => (
          <TouchableOpacity
            key={s.status}
            style={[styles.statCard, filter === s.status && { borderWidth: 2, borderColor: s.color }]}
            onPress={() => setFilter(filter === s.status ? 'ALL' : s.status)}
            activeOpacity={0.7}
          >
            <View style={[styles.statCardIcon, { backgroundColor: s.bg }]}>
              <Ionicons name={s.icon} size={16} color={s.color} />
            </View>
            <Text style={[styles.statCardVal, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statCardLbl}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = f.key === 'ALL' ? records.length
            : records.filter((r) => r.status === f.key).length;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.pill, active && { backgroundColor: f.color }]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.pillText, active && { color: '#fff' }]}>
                {f.label}
              </Text>
              <View style={[styles.pillBadge, active ? { backgroundColor: 'rgba(255,255,255,0.3)' } : { backgroundColor: f.bg }]}>
                <Text style={[styles.pillBadgeText, active ? { color: '#fff' } : { color: f.color }]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#3730A3', '#4F46E5', '#6D28D9']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Mes présences</Text>
              <Text style={styles.headerSub}>{records.length} enregistrement{records.length !== 1 ? 's' : ''}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowScanner(true)}>
                <Ionicons name="qr-code-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowModal(true)}>
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Rate + 4 stats */}
          <View style={styles.statsRow}>
            <View style={styles.rateBlock}>
              <Text style={[styles.rateValue, rateLow && { color: '#FCA5A5' }]}>{attendanceRate}%</Text>
              <Text style={styles.rateLabel}>Taux de{'\n'}présence</Text>
            </View>
            <View style={styles.rateDivider} />
            <View style={styles.statsCols}>
              {[
                { label: 'Présent', value: totalPresent, color: '#86EFAC' },
                { label: 'Absent',  value: totalAbsent,  color: '#FCA5A5' },
                { label: 'Retard',  value: totalLate,    color: '#FDE68A' },
                { label: 'Excusé',  value: totalExcused, color: '#BAE6FD' },
              ].map((s) => (
                <View key={s.label} style={styles.statCol}>
                  <View style={[styles.statDot, { backgroundColor: s.color }]} />
                  <Text style={styles.statVal}>{s.value}</Text>
                  <Text style={styles.statLbl}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {[
              { key: 'records',  label: 'Présences', count: records.length },
              { key: 'requests', label: 'Demandes',  count: requests.length },
            ].map((t) => (
              <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
                <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
                {t.count > 0 && (
                  <View style={[styles.tabBadge, tab === t.key && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, tab === t.key && { color: colors.primary }]}>{t.count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : tab === 'records' ? (
        <FlatList
          data={filteredRecords}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={RecordsListHeader}
          ListEmptyComponent={
            <EmptyState
              icon={filter === 'ALL' ? 'calendar-outline' : 'filter-outline'}
              title={filter === 'ALL' ? 'Aucun enregistrement' : `Aucun enregistrement "${FILTERS.find(f => f.key === filter)?.label}"`}
              subtitle={filter !== 'ALL' ? 'Modifiez le filtre ci-dessus' : undefined}
            />
          }
          renderItem={({ item, index }) => {
            const cfg = STATUS_CFG[item.status] || STATUS_CFG.PRESENT;
            const rawDate = item.session?.date || item.session?.start_time || item.check_in_time || item.date || item.created_at;
            const dateStr = rawDate
              ? new Date(rawDate).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
              : null;
            const subject = item.subject_name || item.session?.subject_name || item.session_subject || item.course_name || null;
            const classInfo = item.session?.class_name || item.class_name || null;
            const title = subject || (dateStr ? `Séance du ${dateStr}` : `Séance N°${index + 1}`);
            const sub = [classInfo, subject ? dateStr : null].filter(Boolean).join(' · ');
            return (
              <View style={styles.recCard}>
                <View style={[styles.recAccent, { backgroundColor: cfg.color }]} />
                <View style={[styles.recIconWrap, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={20} color={cfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recTitle}>{title}</Text>
                  {sub ? <Text style={styles.recSub}>{sub}</Text>
                    : dateStr ? <Text style={styles.recSub}>{dateStr}</Text> : null}
                  {item.notes && <Text style={styles.recNotes} numberOfLines={1}>{item.notes}</Text>}
                </View>
                <View style={[styles.recBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.recBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <TouchableOpacity style={styles.addReqBtn} onPress={() => setShowModal(true)}>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.addReqText}>Nouvelle demande d'absence</Text>
            </TouchableOpacity>
          }
          ListEmptyComponent={<EmptyState icon="document-outline" title="Aucune demande d'absence" subtitle="Appuyez sur le bouton ci-dessus" />}
          renderItem={({ item }) => {
            const REQ_STATUS = {
              PENDING:  { label: 'En attente', color: '#D97706', bg: '#FEF3C7' },
              APPROVED: { label: 'Approuvée',  color: '#059669', bg: '#D1FAE5' },
              REJECTED: { label: 'Refusée',    color: '#EF4444', bg: '#FEE2E2' },
            };
            const st = REQ_STATUS[item.status] || REQ_STATUS.PENDING;
            return (
              <View style={styles.reqCard}>
                <View style={styles.reqTop}>
                  <View style={styles.reqIconBox}>
                    <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reqDate}>{item.date_start} → {item.date_end}</Text>
                    <Text style={styles.reqReason} numberOfLines={2}>{item.reason}</Text>
                  </View>
                  <View style={[styles.recBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.recBadgeText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
                {item.supporting_document && (
                  <View style={styles.reqFile}>
                    <Ionicons name="attach-outline" size={13} color={colors.textTertiary} />
                    <Text style={styles.reqFileText}>Justificatif joint</Text>
                  </View>
                )}
                {item.rejection_reason && (
                  <View style={styles.rejectionBox}>
                    <Ionicons name="information-circle-outline" size={13} color={colors.danger} />
                    <Text style={styles.rejectionText}>{item.rejection_reason}</Text>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* QR Scanner Modal */}
      <ScanQRModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onSuccess={fetchData}
      />

      {/* Absence request modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Demande d'absence</Text>
            <Text style={styles.modalDesc}>Votre demande sera envoyée à l'administration pour approbation.</Text>

            <View style={styles.datesRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Date de début *</Text>
                <TextInput style={styles.modalInput} value={dateStart} onChangeText={setDateStart} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Date de fin *</Text>
                <TextInput style={styles.modalInput} value={dateEnd} onChangeText={setDateEnd} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} keyboardType="numeric" />
              </View>
            </View>

            <Text style={styles.modalLabel}>Motif *</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              value={absenceReason}
              onChangeText={setAbsenceReason}
              placeholder="Décrivez la raison de votre absence..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Text style={styles.modalLabel}>Justificatif (optionnel)</Text>
            <TouchableOpacity style={styles.filePicker} onPress={pickDocument}>
              {attachment ? (
                <View style={styles.fileRow}>
                  <Ionicons name="document-attach" size={18} color={colors.primary} />
                  <Text style={styles.fileName} numberOfLines={1}>{attachment.name}</Text>
                  <TouchableOpacity onPress={() => setAttachment(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.fileRow}>
                  <Ionicons name="cloud-upload-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.filePlaceholder}>Joindre un fichier (PDF, image)</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={resetModal}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSubmit, submitting && { opacity: 0.7 }]} onPress={submitAbsenceRequest} disabled={submitting}>
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : (
                    <>
                      <Ionicons name="send" size={15} color="#fff" />
                      <Text style={styles.modalSubmitText}>Envoyer</Text>
                    </>
                  )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.lg, paddingBottom: 0 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: spacing.sm, paddingBottom: spacing.md },
  iconBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 },

  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  rateBlock: { alignItems: 'center', paddingRight: 12 },
  rateValue: { fontSize: 30, fontWeight: '800', color: '#fff' },
  rateLabel: { fontSize: 10, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 14 },
  rateDivider: { width: 1, height: 44, backgroundColor: 'rgba(255,255,255,0.2)', marginRight: 12 },
  statsCols: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  statCol: { flex: 1, alignItems: 'center', gap: 3 },
  statDot: { width: 7, height: 7, borderRadius: 4 },
  statVal: { fontSize: 18, fontWeight: '800', color: '#fff' },
  statLbl: { fontSize: 8, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },

  tabs: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.md },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.15)' },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  tabTextActive: { color: colors.primary },
  tabBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  tabBadgeActive: { backgroundColor: '#EEF2FF' },
  tabBadgeText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },

  // List header content
  listHeaderBox: { paddingBottom: spacing.sm, gap: spacing.sm },
  warningBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FEF3C7', borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: '#FDE68A', marginBottom: 2 },
  warningTitle: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  warningSub: { fontSize: 12, color: '#B45309', marginTop: 2 },

  statCards: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: radius.lg, padding: 10, alignItems: 'center', gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  statCardIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statCardVal: { fontSize: 18, fontWeight: '800' },
  statCardLbl: { fontSize: 9, color: colors.textSecondary, textAlign: 'center', fontWeight: '600' },

  pills: { gap: 8, paddingBottom: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  pillBadge: { borderRadius: 8, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  pillBadgeText: { fontSize: 10, fontWeight: '700' },

  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 32 },

  // Record card
  recCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.sm, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  recAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  recIconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  recTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  recSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  recNotes: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  recBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  recBadgeText: { fontSize: 11, fontWeight: '700' },

  // Add request button
  addReqBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EEF2FF', borderRadius: radius.lg, padding: 14, marginBottom: spacing.md, borderWidth: 1.5, borderColor: '#C7D2FE', borderStyle: 'dashed' },
  addReqText: { fontSize: 14, fontWeight: '700', color: colors.primary },

  // Request card
  reqCard: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  reqTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reqIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  reqDate: { fontSize: 13, fontWeight: '700', color: colors.text },
  reqReason: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  reqFile: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.divider },
  reqFileText: { fontSize: 11, color: colors.textTertiary },
  rejectionBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, backgroundColor: '#FEE2E2', borderRadius: radius.sm, padding: 8 },
  rejectionText: { flex: 1, fontSize: 12, color: colors.danger },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === 'ios' ? 36 : 24, gap: 10 },
  modalHandle: { width: 36, height: 4, backgroundColor: colors.divider, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 19, fontWeight: '800', color: colors.text },
  modalDesc: { fontSize: 13, color: colors.textSecondary },
  modalLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  datesRow: { flexDirection: 'row', gap: 12 },
  modalInput: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: colors.text, marginTop: 4 },
  modalTextarea: { height: 80, textAlignVertical: 'top' },
  filePicker: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, borderStyle: 'dashed', padding: 12, marginTop: 4 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filePlaceholder: { flex: 1, fontSize: 14, color: colors.textSecondary },
  fileName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.primary },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalCancel: { flex: 1, padding: 14, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  modalSubmit: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, borderRadius: radius.md, backgroundColor: colors.primary },
  modalSubmitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
