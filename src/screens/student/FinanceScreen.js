import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import financeService from '../../services/finance';
import studentService from '../../services/student';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import ConfirmModal from '../../components/common/ConfirmModal';
import { colors, spacing, radius } from '../../theme/colors';
import { useAuth } from '../../contexts/AuthContext';
import {
  PaymentTab, ManualMoneyModal, FinStat,
  aggregateInvoices, REG_FEE_RE, TUITION_FEE_RE, fmt, fmtN,
} from '../../components/finance/PaymentPanel';

/* ─── tabs ──────────────────────────────────────────────────────────────── */

const TABS = [
  { key: 'summary',  label: 'Paiement',    icon: 'wallet-outline'  },
  { key: 'invoices', label: 'Factures',    icon: 'receipt-outline' },
  { key: 'payments', label: 'Historique',  icon: 'cash-outline'    },
];

/* ═══════════════════════════════════════════════════════════════════════════
   StudentFinanceScreen
   ══════════════════════════════════════════════════════════════════════════ */

export default function StudentFinanceScreen({ navigation }) {
  const { refreshRegistrationFeeStatus } = useAuth();
  const [tab,               setTab]               = useState('summary');
  const [summary,           setSummary]           = useState(null);
  const [invoices,          setInvoices]          = useState([]);
  const [payments,          setPayments]          = useState([]);
  const [echeancier,        setEcheancier]        = useState(null);
  const [loading,           setLoading]           = useState(true);
  const [refreshing,        setRefreshing]        = useState(false);
  const [studentId,         setStudentId]         = useState(null);
  const [student,           setStudent]           = useState(null);
  const [preparingInvoices, setPreparingInvoices] = useState(false);
  const [payModal,          setPayModal]          = useState({ visible: false, invoice: null, fixedAmount: null, label: '' });
  const [freePayVisible,    setFreePayVisible]    = useState(false);
  const [errorModal,        setErrorModal]        = useState({ visible: false, message: '' });

  /* ── fetch ── */
  const fetchData = useCallback(async () => {
    try {
      const me = await studentService.getMe();
      setStudentId(me.id);
      setStudent(me);
      // Keep the app-wide fee gate in sync — a successful payment here
      // should unlock the rest of the app (registration gate AND the
      // e-learning menu's échéancier status) on this same screen refresh,
      // without waiting for a full app restart.
      refreshRegistrationFeeStatus();
      const [sum, inv, pay, ech] = await Promise.allSettled([
        financeService.getStudentFinancialSummary(me.id),
        financeService.getInvoices({ student: me.id }),
        financeService.getPayments({ student: me.id }),
        financeService.getEcheancier(me.id),
      ]);
      if (sum.status === 'fulfilled') setSummary(sum.value);
      if (inv.status === 'fulfilled') setInvoices(inv.value?.results || inv.value || []);
      if (pay.status === 'fulfilled') setPayments(pay.value?.results || pay.value || []);
      if (ech.status === 'fulfilled') setEcheancier(ech.value);
    } catch (e) {
      console.log('Finance error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refetch every time this tab regains focus, not just on first mount —
  // bottom-tab screens stay mounted across tab switches, so a plain
  // `useEffect(fetchData, [])` would only ever run once and silently show
  // stale figures after the user pays elsewhere and comes back here.
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  /* ── prepare invoices ── */
  const handlePrepareInvoices = useCallback(async () => {
    if (!studentId || preparingInvoices) return;
    setPreparingInvoices(true);
    try {
      const res = await studentService.prepareInvoices(studentId);
      if (res.created > 0) {
        setInvoices(res.invoices || []);
        const sum = await financeService.getStudentFinancialSummary(studentId);
        setSummary(sum);
      }
    } catch (e) {
      const data = e?.response?.data;
      const msg  = data?.detail || (typeof data === 'string' ? data : null)
                   || e?.message || 'Impossible de préparer les factures.';
      setErrorModal({ visible: true, message: msg });
    } finally {
      setPreparingInvoices(false);
    }
  }, [studentId, preparingInvoices]);

  /* ── modal helpers ── */
  const openPayModal  = (invoice, fixedAmount = null, label = '') => setPayModal({ visible: true, invoice, fixedAmount, label });
  const closePayModal = ()         => setPayModal({ visible: false, invoice: null, fixedAmount: null, label: '' });

  /* ── derived values ── */
  const tuition      = parseFloat(summary?.tuition_fee      || 0);
  const tuitionOnly  = parseFloat(summary?.tuition_fee_only || 0);
  const regFeeHeader = parseFloat(summary?.registration_fee || 0);
  const paid         = parseFloat(summary?.total_paid       || 0);
  const remaining    = parseFloat(summary?.remaining_balance || 0);
  const pct          = tuition > 0 ? Math.min((paid / tuition) * 100, 100) : 0;

  // Per-section header data — aggregated across ALL matching invoices so
  // this always agrees with "Progression des paiements" below, regardless
  // of how many separate inscription/scolarité invoices the student has.
  const regAgg      = aggregateInvoices(invoices, REG_FEE_RE);
  const tuitionAgg  = aggregateInvoices(invoices, TUITION_FEE_RE);

  const regTotal = regAgg.list.length > 0 ? regAgg.total : regFeeHeader;
  const regPaid  = regAgg.list.length > 0 ? regAgg.paid  : (summary?.registration_fee_paid ? regFeeHeader : 0);
  const regReste = regAgg.list.length > 0 ? regAgg.balance : (summary?.registration_fee_paid ? 0 : regFeeHeader);

  const scoTotal = tuitionAgg.list.length > 0 ? tuitionAgg.total : tuitionOnly;
  const scoPaid  = tuitionAgg.list.length > 0 ? tuitionAgg.paid  : Math.max(0, paid - regPaid);
  const scoReste = tuitionAgg.list.length > 0 ? tuitionAgg.balance : Math.max(0, remaining - regReste);

  const studentName = [
    student?.user?.first_name || student?.first_name,
    student?.user?.last_name  || student?.last_name,
  ].filter(Boolean).join(' ') || '';
  const studentCode = student?.student_id || student?.matricule || '';

  return (
    <View style={styles.container}>
      {/* ── header ── */}
      <LinearGradient
        colors={['#3730A3', '#4F46E5', '#6D28D9']}
        style={styles.header}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            {/* Finance is also a bottom tab (StudentTabs) — when it's the
                active tab there's no stack history to go back to, and an
                unconditional goBack() throws a GO_BACK/navigator warning.
                Only show the back button when there's actually somewhere
                to go (e.g. opened by pushing from another screen). */}
            {navigation.canGoBack() ? (
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={styles.backBtn} />
            )}
            <Text style={styles.headerTitle}>Finance</Text>
            <View style={{ width: 38 }} />
          </View>

          {/* student info */}
          {studentName ? (
            <View style={styles.studentRow}>
              <View style={styles.studentAvatar}>
                <Ionicons name="person" size={18} color="rgba(255,255,255,0.9)" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.studentName}>{studentName}</Text>
                {studentCode ? <Text style={styles.studentCode}>#{studentCode}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                {student?.is_active !== undefined && (
                  <View style={[styles.studentBadge, { backgroundColor: student.is_active ? '#10B981' : '#F59E0B' }]}>
                    <Text style={styles.studentBadgeText}>{student.is_active ? 'Actif' : 'Inactif'}</Text>
                  </View>
                )}
                {(summary?.has_payment_schedule || summary?.echeance_override) && (
                  <View style={[styles.studentBadge, {
                    backgroundColor: summary.echeance_override ? '#3B82F6' : summary.tuition_up_to_date ? '#10B981' : '#DC2626',
                  }]}>
                    <Text style={styles.studentBadgeText}>
                      {summary.echeance_override ? 'Admission autorisée' : summary.tuition_up_to_date ? 'À jour' : 'Non à jour'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : null}

          {/* fees breakdown */}
          {summary && (
            <View style={styles.feesGrid}>
              {regFeeHeader > 0 && (
                <View style={styles.feesSection}>
                  <Text style={styles.feesSectionTitle}>INSCRIPTION</Text>
                  <View style={styles.feesCols}>
                    <FinStat label="TOTAL" value={fmtN(regTotal)} />
                    <FinStat label="PAYÉ"  value={fmtN(regPaid)}  paid={regPaid > 0}   />
                    <FinStat label="RESTE" value={fmtN(regReste)} danger={regReste > 0} />
                  </View>
                </View>
              )}
              {scoTotal > 0 && (
                <View style={styles.feesSection}>
                  <Text style={styles.feesSectionTitle}>SCOLARITÉ</Text>
                  <View style={styles.feesCols}>
                    <FinStat label="TOTAL" value={fmtN(scoTotal)} />
                    <FinStat label="PAYÉ"  value={fmtN(scoPaid)}  paid={scoPaid > 0}   />
                    <FinStat label="RESTE" value={fmtN(scoReste)} danger={scoReste > 0} />
                  </View>
                </View>
              )}
            </View>
          )}

          <View style={styles.tabs}>
            {TABS.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.tab, tab === t.key && styles.tabActive]}
                onPress={() => setTab(t.key)}
              >
                <Ionicons name={t.icon} size={13} color={tab === t.key ? colors.primary : 'rgba(255,255,255,0.75)'} />
                <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── body ── */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>

      ) : tab === 'summary' ? (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <PaymentTab
            summary={summary} invoices={invoices} payments={payments} echeancier={echeancier}
            pct={pct} tuition={tuition} tuitionOnly={tuitionOnly} paid={paid} remaining={remaining}
            onPayPress={openPayModal}
            onPrepareInvoices={handlePrepareInvoices}
            preparingInvoices={preparingInvoices}
            onFreePay={() => setFreePayVisible(true)}
          />
        </ScrollView>

      ) : tab === 'invoices' ? (
        <FlatList
          data={invoices}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="receipt-outline" title="Aucune facture" />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.invIconWrap}>
                  <Ionicons name="document-text-outline" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.invoice_number}</Text>
                  <Text style={styles.cardSub}>
                    Émise le {item.issue_date ? new Date(item.issue_date).toLocaleDateString('fr-FR') : '--'}
                  </Text>
                </View>
                <Badge status={item.status} />
              </View>
              <View style={styles.cardBody}>
                <Row label="Total" value={fmt(item.total)} />
                <Row label="Payé"  value={fmt(item.amount_paid)} color={colors.success} />
                <Row label="Reste" value={fmt(item.balance)} color={parseFloat(item.balance) > 0 ? colors.warning : colors.success} />
              </View>
              {item.due_date && (
                <Text style={styles.dueDate}>Échéance : {new Date(item.due_date).toLocaleDateString('fr-FR')}</Text>
              )}
              {parseFloat(item.balance) > 0 && item.status !== 'CANCELLED' && (
                <TouchableOpacity style={styles.payBtn} onPress={() => openPayModal(item)} activeOpacity={0.8}>
                  <Ionicons name="phone-portrait-outline" size={16} color="#fff" />
                  <Text style={styles.payBtnText}>Payer avec Mobile Money</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />

      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="cash-outline" title="Aucun paiement" />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.invIconWrap, { backgroundColor: '#D1FAE5' }]}>
                  <Ionicons name="cash-outline" size={22} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.payment_number || `Paiement #${item.id}`}</Text>
                  <Text style={styles.cardSub}>
                    {item.payment_date ? new Date(item.payment_date).toLocaleDateString('fr-FR') : '--'}
                  </Text>
                </View>
                <Badge status={item.status} />
              </View>
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Montant</Text>
                <Text style={styles.amountValue}>{fmt(item.amount)}</Text>
              </View>
              {item.payment_method_name && (
                <View style={styles.methodRow}>
                  <Ionicons name="card-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.methodText}>{item.payment_method_name}</Text>
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* ── payment modal (manual Mobile Money, semi-automatic) ── */}
      <ManualMoneyModal
        visible={payModal.visible}
        mode="fixed"
        invoice={payModal.invoice}
        fixedAmount={payModal.fixedAmount}
        label={payModal.label}
        onClose={closePayModal}
        onSuccess={() => { closePayModal(); fetchData(); }}
      />

      {/* ── free payment modal (no pre-existing invoice) ── */}
      <ManualMoneyModal
        visible={freePayVisible}
        mode="free"
        studentId={studentId}
        onClose={() => setFreePayVisible(false)}
        onSuccess={() => { setFreePayVisible(false); fetchData(); }}
      />

      {/* ── error modal ── */}
      <ConfirmModal
        visible={errorModal.visible}
        variant="warning"
        title="Erreur"
        message={errorModal.message}
        confirmText="Compris"
        onConfirm={() => setErrorModal({ visible: false, message: '' })}
      />
    </View>
  );
}


function Row({ label, value, color }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, color && { color }]}>{value}</Text>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Styles
   ══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.background },
  header:      { paddingHorizontal: spacing.lg, paddingBottom: 0 },
  headerRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, paddingBottom: spacing.md },
  backBtn:     { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },

  // student info row
  studentRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  studentAvatar:     { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  studentName:       { fontSize: 15, fontWeight: '700', color: '#fff' },
  studentCode:       { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  studentBadge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  studentBadgeText:  { fontSize: 11, fontWeight: '700', color: '#fff' },

  // fees breakdown grid
  feesGrid:          { gap: 8, marginBottom: spacing.md },
  feesSection:       { backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 12, padding: 12 },
  feesSectionTitle:  { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.55)', letterSpacing: 1.2, marginBottom: 10 },
  feesCols:          { flexDirection: 'row' },

  tabs:          { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.md },
  tab:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.15)' },
  tabActive:     { backgroundColor: '#fff' },
  tabText:       { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  tabTextActive: { color: colors.primary },

  list:   { padding: spacing.md, gap: spacing.md, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card:        { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTop:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  invIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  cardTitle:   { fontSize: 14, fontWeight: '700', color: colors.text },
  cardSub:     { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  cardBody:    { gap: 4 },
  row:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  rowLabel:    { fontSize: 13, color: colors.textSecondary },
  rowValue:    { fontSize: 14, fontWeight: '600', color: colors.text },
  dueDate:     { fontSize: 12, color: colors.textTertiary, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 8 },

  amountRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.divider, padding: 12, borderRadius: radius.md },
  amountLabel: { fontSize: 13, color: colors.textSecondary },
  amountValue: { fontSize: 20, fontWeight: '800', color: colors.success },
  methodRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  methodText:  { fontSize: 13, color: colors.textSecondary },

  payBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 13, marginTop: 4 },
  payBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
