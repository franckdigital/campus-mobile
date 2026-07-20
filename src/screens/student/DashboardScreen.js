import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, StatusBar, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import studentService from '../../services/student';
import financeService from '../../services/finance';
import gradesService from '../../services/grades';
import notificationsService from '../../services/notifications';
import usePushNotifications from '../../hooks/usePushNotifications';
import { colors, spacing, radius } from '../../theme/colors';

const HEADER_GRADIENT = ['#1E3A8A', '#1D4ED8', '#2563EB'];

const REG_FEE_RE     = /inscri|regist/i;
const TUITION_FEE_RE = /tuition|scolarit/i;

const fmtN = (v) => (v != null ? parseFloat(v).toLocaleString('fr-FR') : '--');

function FinStat({ label, value, paid, danger }) {
  const vc = danger ? '#FCA5A5' : paid ? '#86EFAC' : '#fff';
  return (
    <View style={styles.finStat}>
      <Text style={styles.finStatLabel}>{label}</Text>
      <Text style={[styles.finStatValue, { color: vc }]}>{value}</Text>
      <Text style={styles.finStatUnit}>FCFA</Text>
    </View>
  );
}

// Same aggregation as the Finance screen — sums ALL non-cancelled invoices
// matching a fee-type regex, so the dashboard's split figures always agree
// with what "Voir tout" shows, instead of relying on the summary's scalar
// registration_fee/tuition_fee_only fields (which can drift from the real
// invoiced amounts when a student has more than one invoice per fee type).
function aggregateInvoices(invoicesList, feeTypeRe) {
  const list = (invoicesList || []).filter(
    (inv) => inv.status !== 'CANCELLED' && (inv.fee_type_codes || []).some((c) => feeTypeRe.test(c))
  );
  return {
    list,
    total:   list.reduce((s, inv) => s + parseFloat(inv.total || 0), 0),
    paid:    list.reduce((s, inv) => s + parseFloat(inv.amount_paid || 0), 0),
    balance: list.reduce((s, inv) => s + parseFloat(inv.balance || 0), 0),
  };
}

const STATUS_LABELS = {
  ACTIVE:      { label: 'Actif',     color: '#86EFAC', bg: 'rgba(16,185,129,0.2)' },
  GRADUATED:   { label: 'Diplômé',   color: '#C4B5FD', bg: 'rgba(124,58,237,0.2)' },
  SUSPENDED:   { label: 'Suspendu',  color: '#FCA5A5', bg: 'rgba(239,68,68,0.2)' },
  WITHDRAWN:   { label: 'Retiré',    color: '#CBD5E1', bg: 'rgba(100,116,139,0.2)' },
  TRANSFERRED: { label: 'Transféré', color: '#FDE68A', bg: 'rgba(217,119,6,0.2)' },
};

const SERVICES = [
  { label: 'E-Learning', desc: 'Cours & classes',  icon: 'school-outline',     screen: 'ELearning', color: '#DB2777', bg: '#FDF2F8', border: '#FBCFE8', elearningOnly: true },
  { label: 'Notes',     desc: 'Mes résultats',   icon: 'bar-chart-outline',   screen: 'Notes',     color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  { label: 'Présences', desc: 'Mes absences',    icon: 'checkbox-outline',    screen: 'Présence',  color: '#059669', bg: '#ECFDF5', border: '#86EFAC' },
  { label: 'Planning',  desc: 'Emploi du temps', icon: 'calendar-outline',    screen: 'Planning',  color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { label: 'Finances',  desc: 'Paiements',       icon: 'wallet-outline',      screen: 'Finance',   color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { label: 'Documents', desc: 'Mes fichiers',    icon: 'folder-open-outline', screen: 'Documents', color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC' },
  { label: 'Messages',  desc: 'Notifications',   icon: 'chatbubbles-outline', screen: 'Messages',  color: '#0EA5E9', bg: '#F0F9FF', border: '#BAE6FD' },
];

export default function StudentDashboardScreen({ navigation }) {
  const { user, logout, studentModality } = useAuth();
  const [student, setStudent] = useState(null);
  const [financialSummary, setFinancialSummary] = useState(null);
  const [dossier, setDossier] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [grades, setGrades] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const me = await studentService.getMe();
      setStudent(me);

      const [dos, enroll, gr, notifs, count, finSum, inv] = await Promise.allSettled([
        studentService.getDossier(me.id),
        studentService.getEnrollments(me.id),
        gradesService.getGrades({ student: me.id, page_size: 50 }),
        notificationsService.getAll(),
        notificationsService.getUnreadCount(),
        financeService.getStudentFinancialSummary(me.id),
        financeService.getInvoices({ student: me.id }),
      ]);

      if (dos.status === 'fulfilled') setDossier(dos.value);
      if (finSum.status === 'fulfilled') setFinancialSummary(finSum.value);
      if (inv.status === 'fulfilled') setInvoices(inv.value?.results || inv.value || []);
      if (enroll.status === 'fulfilled') {
        const list = enroll.value?.results || enroll.value || [];
        setEnrollments(list);
      }
      if (gr.status === 'fulfilled') {
        const list = gr.value?.results || gr.value || [];
        setGrades(list);
      }
      if (notifs.status === 'fulfilled') setNotifications(notifs.value?.results?.slice(0, 4) || []);
      if (count.status === 'fulfilled') setUnreadCount(count.value?.count || 0);
    } catch (e) {
      console.log('Dashboard error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Same reasoning as FinanceScreen: refetch on every focus, not just once
  // at mount, since bottom-tab screens stay mounted across tab switches.
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  usePushNotifications(fetchData);

  const studentUser = student?.user;
  const fullName =
    studentUser?.full_name ||
    (studentUser?.first_name ? `${studentUser.first_name} ${studentUser.last_name || ''}`.trim() : null) ||
    user?.full_name ||
    `${user?.first_name || ''} ${user?.last_name || ''}`.trim() ||
    user?.username ||
    'Étudiant';
  const initials = fullName !== 'Étudiant'
    ? fullName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'E';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  // Prefer dynamic financial_summary (computes registration_fee_paid from invoice balance)
  const tuition   = parseFloat(financialSummary?.tuition_fee      ?? student?.tuition_fee      ?? 0);
  const paid      = parseFloat(financialSummary?.total_paid        ?? student?.total_paid        ?? 0);
  const remaining = parseFloat(financialSummary?.remaining_balance ?? student?.remaining_balance ?? 0);
  const pct       = tuition > 0 ? Math.min(100, Math.round((paid / tuition) * 100)) : 0;
  const regFeePaid = financialSummary?.registration_fee_paid ?? student?.registration_fee_paid ?? false;
  const regFee    = parseFloat(financialSummary?.registration_fee ?? student?.registration_fee ?? 0);

  // Échéancier de scolarité (payment installment schedule)
  const hasPaymentSchedule = financialSummary?.has_payment_schedule ?? student?.has_payment_schedule ?? false;
  const tuitionUpToDate    = financialSummary?.tuition_up_to_date ?? student?.tuition_up_to_date ?? true;
  const echeanceOverride   = financialSummary?.echeance_override ?? student?.echeance_override ?? false;
  const echeanceBadge = echeanceOverride
    ? { label: 'Admission autorisée', bg: 'rgba(37,99,235,0.25)', color: '#bfdbfe' }
    : tuitionUpToDate
      ? { label: 'À jour', bg: 'rgba(16,185,129,0.25)', color: '#a7f3d0' }
      : { label: 'Non à jour', bg: 'rgba(239,68,68,0.25)', color: '#fecaca' };
  const canSeeElearning = (studentModality === 'ELEARNING' || studentModality === 'HYBRIDE')
    && (tuitionUpToDate || echeanceOverride);

  // Split the combined tuition+registration total (`tuition`) into its two
  // parts so "Situation financière" can show them separately, like the
  // Finance screen does — aggregated from the real invoices (same method as
  // FinanceScreen) so the two screens always agree, rather than trusting the
  // summary's scalar registration_fee/tuition_fee_only fields on their own.
  const tuitionOnly = parseFloat(financialSummary?.tuition_fee_only ?? 0);
  const regAgg      = aggregateInvoices(invoices, REG_FEE_RE);
  const tuitionAgg  = aggregateInvoices(invoices, TUITION_FEE_RE);

  const regTotal      = regAgg.list.length > 0 ? regAgg.total : regFee;
  const regPaidAmt    = regAgg.list.length > 0 ? regAgg.paid : (regFeePaid ? regFee : 0);
  const regRemaining  = regAgg.list.length > 0 ? regAgg.balance : (regFeePaid ? 0 : regFee);

  const scoTotal      = tuitionAgg.list.length > 0 ? tuitionAgg.total : tuitionOnly;
  const scoPaidAmt     = tuitionAgg.list.length > 0 ? tuitionAgg.paid : Math.max(0, paid - regPaidAmt);
  const scoRemaining  = tuitionAgg.list.length > 0 ? tuitionAgg.balance : Math.max(0, remaining - regRemaining);
  const scoPct        = scoTotal > 0 ? Math.min(100, Math.round((scoPaidAmt / scoTotal) * 100)) : 0;

  const activeEnrollment =
    enrollments.find((e) => e.is_active || e.status === 'ACTIVE' || e.status === 'ENROLLED') ||
    (dossier?.enrollments || []).find((e) => e.is_active || e.status === 'ACTIVE' || e.status === 'ENROLLED') ||
    enrollments[0];
  const currentClass = activeEnrollment?.class_name || dossier?.current_class?.name || '—';
  const currentYear = activeEnrollment?.academic_year_name || dossier?.current_class?.academic_year || '—';
  const siteName = student?.site_name || studentUser?.site_name || '—';

  const statusInfo = STATUS_LABELS[student?.status] || STATUS_LABELS.ACTIVE;

  const recentFiles = student?.files?.slice(0, 4) || [];

  if (loading) {
    return (
      <LinearGradient colors={HEADER_GRADIENT} style={styles.loadingCenter}>
        <ActivityIndicator color="#fff" size="large" />
      </LinearGradient>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <LinearGradient colors={HEADER_GRADIENT} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <SafeAreaView edges={['top']}>
            <View style={styles.headerTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.greeting}>{greeting},</Text>
                <Text style={styles.userName} numberOfLines={1}>{fullName}</Text>
                <View style={styles.headerBadgesRow}>
                  {student?.matricule && (
                    <View style={styles.matriculeBadge}>
                      <Ionicons name="card-outline" size={10} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.matriculeText}>#{student.matricule}</Text>
                    </View>
                  )}
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                  </View>
                  {(hasPaymentSchedule || echeanceOverride) && (
                    <View style={[styles.statusBadge, { backgroundColor: echeanceBadge.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: echeanceBadge.color }]}>{echeanceBadge.label}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Notifications')}>
                  <Ionicons name="notifications-outline" size={20} color="#fff" />
                  {unreadCount > 0 && (
                    <View style={styles.notifDot}>
                      <Text style={styles.notifDotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.avatarBtn} onPress={() => navigation.navigate('Profile')}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum} numberOfLines={1}>{currentClass}</Text>
                <Text style={styles.statLabel}>Classe</Text>
              </View>
            </View>

            {/* Fees breakdown — same layout/figures as the Finance screen header */}
            {(regTotal > 0 || scoTotal > 0) && (
              <View style={styles.feesGrid}>
                {regTotal > 0 && (
                  <View style={styles.feesSection}>
                    <Text style={styles.feesSectionTitle}>INSCRIPTION</Text>
                    <View style={styles.feesCols}>
                      <FinStat label="TOTAL" value={fmtN(regTotal)} />
                      <FinStat label="PAYÉ" value={fmtN(regPaidAmt)} paid={regPaidAmt > 0} />
                      <FinStat label="RESTE" value={fmtN(regRemaining)} danger={regRemaining > 0} />
                    </View>
                  </View>
                )}
                {scoTotal > 0 && (
                  <View style={styles.feesSection}>
                    <Text style={styles.feesSectionTitle}>SCOLARITÉ</Text>
                    <View style={styles.feesCols}>
                      <FinStat label="TOTAL" value={fmtN(scoTotal)} />
                      <FinStat label="PAYÉ" value={fmtN(scoPaidAmt)} paid={scoPaidAmt > 0} />
                      <FinStat label="RESTE" value={fmtN(scoRemaining)} danger={scoRemaining > 0} />
                    </View>
                  </View>
                )}
              </View>
            )}
          </SafeAreaView>
        </LinearGradient>

        {/* ── Inscription status ─────────────────────────────── */}
        {(tuition > 0 || regTotal > 0) && (
          <View style={styles.section}>
            <View style={[styles.inscriptionCard, regRemaining <= 0
              ? { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }
              : { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
              <View style={[styles.inscriptionIcon, { backgroundColor: regRemaining <= 0 ? colors.success : colors.warning }]}>
                <Ionicons name={regRemaining <= 0 ? 'checkmark-circle' : 'alert-circle'} size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inscriptionTitle, { color: regRemaining <= 0 ? '#065F46' : '#92400E' }]}>
                  {regRemaining <= 0 ? 'Inscription validée' : 'Inscription non validée'}
                </Text>
                {regTotal > 0 && (
                  <Text style={[styles.inscriptionSub, { color: regRemaining <= 0 ? '#047857' : '#B45309' }]}>
                    Frais d'inscription : {regTotal.toLocaleString('fr-FR')} F
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ── Enrollment info ────────────────────────────────── */}
        {activeEnrollment && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Inscription en cours</Text>
            <View style={styles.enrollGrid}>
              {[
                { icon: 'school-outline',   label: 'Classe', value: currentClass, color: '#1D4ED8', bg: '#EFF6FF' },
                { icon: 'calendar-outline', label: 'Année',  value: currentYear,  color: '#7C3AED', bg: '#F5F3FF' },
                { icon: 'location-outline', label: 'Site',   value: siteName,     color: '#0891B2', bg: '#ECFEFF' },
              ].map((item) => (
                <View key={item.label} style={[styles.enrollItem, { backgroundColor: item.bg }]}>
                  <View style={[styles.enrollIcon, { backgroundColor: `${item.color}20` }]}>
                    <Ionicons name={item.icon} size={16} color={item.color} />
                  </View>
                  <Text style={[styles.enrollLabel, { color: item.color }]}>{item.label}</Text>
                  <Text style={styles.enrollValue} numberOfLines={1}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Financial summary ──────────────────────────────── */}
        {(scoTotal > 0 || regTotal > 0) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Situation financière</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Finance')}>
                <Text style={styles.seeAll}>Voir tout</Text>
              </TouchableOpacity>
            </View>

            {regTotal > 0 && (
              <View style={[styles.card, { marginBottom: spacing.sm }]}>
                <Text style={styles.finBlockTitle}>Frais d'inscription</Text>
                <View style={styles.finRow}>
                  <Text style={styles.finLabel}>Total</Text>
                  <Text style={styles.finValue}>{regTotal.toLocaleString('fr-FR')} F</Text>
                </View>
                <View style={styles.finRow}>
                  <Text style={styles.finLabel}>Montant payé</Text>
                  <Text style={[styles.finValue, { color: colors.success }]}>{regPaidAmt.toLocaleString('fr-FR')} F</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, {
                    width: `${regTotal > 0 ? Math.min(100, Math.round((regPaidAmt / regTotal) * 100)) : 0}%`,
                    backgroundColor: regRemaining <= 0 ? colors.success : colors.warning,
                  }]} />
                </View>
                <View style={styles.finRow}>
                  <Text style={styles.finLabel}>{regRemaining > 0 ? 'Reste à payer' : 'Solde'}</Text>
                  <Text style={[styles.finValue, { color: regRemaining > 0 ? colors.danger : colors.success }]}>
                    {regRemaining > 0 ? `${regRemaining.toLocaleString('fr-FR')} F` : 'Soldé ✓'}
                  </Text>
                </View>
              </View>
            )}

            {scoTotal > 0 && (
              <View style={styles.card}>
                <Text style={styles.finBlockTitle}>Frais de scolarité</Text>
                <View style={styles.finRow}>
                  <Text style={styles.finLabel}>Total</Text>
                  <Text style={styles.finValue}>{scoTotal.toLocaleString('fr-FR')} F</Text>
                </View>
                <View style={styles.finRow}>
                  <Text style={styles.finLabel}>Montant payé</Text>
                  <Text style={[styles.finValue, { color: colors.success }]}>{scoPaidAmt.toLocaleString('fr-FR')} F</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, {
                    width: `${scoPct}%`,
                    backgroundColor: scoPct === 100 ? colors.success : scoPct >= 50 ? colors.warning : colors.danger,
                  }]} />
                </View>
                <View style={styles.finRow}>
                  <Text style={styles.finLabel}>{scoRemaining > 0 ? 'Reste à payer' : 'Solde'}</Text>
                  <Text style={[styles.finValue, { color: scoRemaining > 0 ? colors.danger : colors.success }]}>
                    {scoRemaining > 0 ? `${scoRemaining.toLocaleString('fr-FR')} F` : 'Soldé ✓'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Services ──────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Mes services</Text>
          <View style={styles.servicesGrid}>
            {SERVICES.filter((svc) => !svc.elearningOnly || canSeeElearning).map((svc) => (
              <TouchableOpacity
                key={svc.screen}
                style={[styles.serviceCard, { backgroundColor: svc.bg, borderColor: svc.border }]}
                onPress={() => navigation.navigate(svc.screen)}
                activeOpacity={0.8}
              >
                <View style={[styles.serviceIconWrap, { backgroundColor: `${svc.color}18` }]}>
                  <Ionicons name={svc.icon} size={22} color={svc.color} />
                </View>
                <Text style={[styles.serviceLabel, { color: svc.color }]}>{svc.label}</Text>
                <Text style={styles.serviceDesc}>{svc.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Recent files ──────────────────────────────────── */}
        {recentFiles.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Documents récents</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Documents')}>
                <Text style={styles.seeAll}>Voir tout</Text>
              </TouchableOpacity>
            </View>
            {recentFiles.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={styles.fileRow}
                onPress={() => f.file_url && Linking.openURL(f.file_url)}
              >
                <View style={styles.fileIcon}>
                  <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileName} numberOfLines={1}>{f.title || f.name || `Fichier #${f.id}`}</Text>
                  <Text style={styles.fileSub}>
                    {f.academic_year_name || ''}
                    {f.created_at ? ` · ${new Date(f.created_at).toLocaleDateString('fr-FR')}` : ''}
                  </Text>
                </View>
                {f.file_type && (
                  <View style={styles.fileTypeBadge}>
                    <Text style={styles.fileTypeText}>{f.file_type}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Notifications ─────────────────────────────────── */}
        {notifications.length > 0 && (
          <View style={[styles.section, { marginBottom: 32 }]}>
            <Text style={styles.sectionLabel}>Notifications récentes</Text>
            {notifications.map((n) => (
              <View key={n.id} style={styles.notifRow}>
                <View style={[styles.notifDotSmall, { backgroundColor: n.is_read ? colors.border : colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.notifTitle, !n.is_read && { fontWeight: '700' }]}>{n.title}</Text>
                  <Text style={styles.notifMsg} numberOfLines={1}>{n.message}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: spacing.md },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  userName: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 1 },
  headerBadgesRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  matriculeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  matriculeText: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  headerBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  notifDot: { position: 'absolute', top: 6, right: 6, backgroundColor: colors.danger, borderRadius: 5, minWidth: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  notifDotText: { color: '#fff', fontSize: 7, fontWeight: '700' },
  avatarBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 4 },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', gap: 3 },
  statNum: { fontSize: 15, fontWeight: '900', color: '#fff', textAlign: 'center' },
  statLabel: { fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },

  // fees breakdown — mirrors the Finance screen header exactly
  feesGrid: { gap: 8, marginTop: 12, marginBottom: 4 },
  feesSection: { backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 12, padding: 12 },
  feesSectionTitle: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.55)', letterSpacing: 1.2, marginBottom: 10 },
  feesCols: { flexDirection: 'row' },
  finStat: { flex: 1, alignItems: 'center', gap: 2 },
  finStatLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5 },
  finStatValue: { fontSize: 17, fontWeight: '800', color: '#fff' },
  finStatUnit: { fontSize: 9, color: 'rgba(255,255,255,0.45)' },

  section: { paddingHorizontal: spacing.md, marginTop: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  seeAll: { fontSize: 13, color: colors.primary, fontWeight: '600' },

  inscriptionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, padding: 14, borderWidth: 1.5 },
  inscriptionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  inscriptionTitle: { fontSize: 13, fontWeight: '700' },
  inscriptionSub: { fontSize: 11, marginTop: 2 },

  enrollGrid: { flexDirection: 'row', gap: 8 },
  enrollItem: { flex: 1, borderRadius: radius.md, padding: 10, gap: 4 },
  enrollIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  enrollLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  enrollValue: { fontSize: 12, fontWeight: '800', color: '#1E293B' },

  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  finBlockTitle: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  finLabel: { fontSize: 13, color: colors.textSecondary },
  finValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  progressBar: { height: 8, backgroundColor: colors.divider, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },

  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  serviceCard: { width: '47.5%', borderRadius: 18, padding: 16, borderWidth: 1.5, gap: 5 },
  serviceIconWrap: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  serviceLabel: { fontSize: 13, fontWeight: '800', lineHeight: 18 },
  serviceDesc: { fontSize: 11, color: colors.textTertiary },

  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8FAFC', borderRadius: radius.md, padding: 12, marginBottom: 6 },
  fileIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  fileName: { fontSize: 13, fontWeight: '600', color: colors.text },
  fileSub: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  fileTypeBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  fileTypeText: { fontSize: 10, fontWeight: '700', color: '#2563EB' },

  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  notifDotSmall: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  notifTitle: { fontSize: 13, color: colors.text, fontWeight: '500' },
  notifMsg: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
});
