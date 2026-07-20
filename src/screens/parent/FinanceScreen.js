import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import parentService from '../../services/parent';
import financeService from '../../services/finance';
import studentService from '../../services/student';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import ConfirmModal from '../../components/common/ConfirmModal';
import { colors, spacing, radius } from '../../theme/colors';
import {
  PaymentTab, ManualMoneyModal, FinStat,
  aggregateInvoices, REG_FEE_RE, TUITION_FEE_RE, fmt, fmtN,
} from '../../components/finance/PaymentPanel';

const GRADIENT = ['#064E3B', '#065F46', '#059669'];

const TABS = [
  { key: 'summary',  label: 'Paiement',    icon: 'wallet-outline'  },
  { key: 'invoices', label: 'Factures',    icon: 'receipt-outline' },
  { key: 'payments', label: 'Historique',  icon: 'cash-outline'    },
];

export default function ParentFinanceScreen({ navigation, route }) {
  const childIdParam = route?.params?.childId;

  const [children, setChildren]     = useState([]);
  const [selected, setSelected]     = useState(null);
  const [summary, setSummary]       = useState(null);
  const [invoices, setInvoices]     = useState([]);
  const [payments, setPayments]     = useState([]);
  const [echeancier, setEcheancier] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode]     = useState('list'); // 'list' | 'detail'
  const [tab, setTab]               = useState('summary');

  const [preparingInvoices, setPreparingInvoices] = useState(false);
  const [payModal, setPayModal]         = useState({ visible: false, invoice: null, fixedAmount: null, label: '' });
  const [freePayVisible, setFreePayVisible] = useState(false);
  const [errorModal, setErrorModal]     = useState({ visible: false, message: '' });

  // ── load child finance detail ──────────────────────────────────────────────
  const loadChildFinance = useCallback(async (child) => {
    setSelected(child);
    setViewMode('detail');
    setTab('summary');
    setLoadingDetail(true);
    try {
      const [sum, inv, pay, ech] = await Promise.allSettled([
        financeService.getStudentFinancialSummary(child.id),
        financeService.getInvoices({ student: child.id }),
        financeService.getPayments({ student: child.id }),
        financeService.getEcheancier(child.id),
      ]);
      if (sum.status === 'fulfilled') setSummary(sum.value);
      if (inv.status === 'fulfilled') setInvoices(inv.value?.results || inv.value || []);
      if (pay.status === 'fulfilled') setPayments(pay.value?.results || pay.value || []);
      if (ech.status === 'fulfilled') setEcheancier(ech.value);
    } catch (e) { console.log(e.message); }
    finally { setLoadingDetail(false); }
  }, []);

  // ── initial load ───────────────────────────────────────────────────────────
  const fetchChildren = useCallback(async () => {
    try {
      const res = await parentService.getMyStudents();
      const list = res?.results || res || [];

      // Enrich with financial summaries for cards
      const summaries = await Promise.allSettled(
        list.map(c => financeService.getStudentFinancialSummary(c.id))
      );
      const enriched = list.map((c, i) => {
        const s = summaries[i].status === 'fulfilled' ? summaries[i].value : null;
        return s ? {
          ...c,
          _tuition: s.tuition_fee, _paid: s.total_paid, _remaining: s.remaining_balance,
          _hasSchedule: s.has_payment_schedule, _upToDate: s.tuition_up_to_date, _override: s.echeance_override,
        } : c;
      });
      setChildren(enriched);

      // Auto-open if childId param given (from Dashboard)
      if (childIdParam) {
        const target = enriched.find(c => c.id === childIdParam) || enriched[0];
        if (target) await loadChildFinance(target);
      }
    } catch (e) { console.log(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [childIdParam, loadChildFinance]);

  useEffect(() => { fetchChildren(); }, [fetchChildren]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (viewMode === 'detail' && selected) {
      await loadChildFinance(selected);
      setRefreshing(false);
    } else {
      await fetchChildren();
    }
  }, [viewMode, selected, loadChildFinance, fetchChildren]);

  const backToList = () => {
    setViewMode('list'); setSelected(null);
    setSummary(null); setInvoices([]); setPayments([]);
  };

  /* ── prepare invoices ── */
  const handlePrepareInvoices = useCallback(async () => {
    if (!selected || preparingInvoices) return;
    setPreparingInvoices(true);
    try {
      const res = await studentService.prepareInvoices(selected.id);
      if (res.created > 0) {
        setInvoices(res.invoices || []);
        const sum = await financeService.getStudentFinancialSummary(selected.id);
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
  }, [selected, preparingInvoices]);

  /* ── modal helpers ── */
  const openPayModal  = (invoice, fixedAmount = null, label = '') => setPayModal({ visible: true, invoice, fixedAmount, label });
  const closePayModal = ()         => setPayModal({ visible: false, invoice: null, fixedAmount: null, label: '' });

  const onPaymentSuccess = useCallback(() => {
    closePayModal();
    if (selected) loadChildFinance(selected);
  }, [selected, loadChildFinance]);

  /* ── derived values ── */
  const tuition      = parseFloat(summary?.tuition_fee      || 0);
  const tuitionOnly  = parseFloat(summary?.tuition_fee_only || 0);
  const regFeeHeader = parseFloat(summary?.registration_fee || 0);
  const paid         = parseFloat(summary?.total_paid       || 0);
  const remaining    = parseFloat(summary?.remaining_balance || 0);
  const pct          = tuition > 0 ? Math.min((paid / tuition) * 100, 100) : 0;

  const regAgg     = aggregateInvoices(invoices, REG_FEE_RE);
  const tuitionAgg = aggregateInvoices(invoices, TUITION_FEE_RE);

  const regTotal = regAgg.list.length > 0 ? regAgg.total : regFeeHeader;
  const regPaid  = regAgg.list.length > 0 ? regAgg.paid  : (summary?.registration_fee_paid ? regFeeHeader : 0);
  const regReste = regAgg.list.length > 0 ? regAgg.balance : (summary?.registration_fee_paid ? 0 : regFeeHeader);

  const scoTotal = tuitionAgg.list.length > 0 ? tuitionAgg.total : tuitionOnly;
  const scoPaid  = tuitionAgg.list.length > 0 ? tuitionAgg.paid  : Math.max(0, paid - regPaid);
  const scoReste = tuitionAgg.list.length > 0 ? tuitionAgg.balance : Math.max(0, remaining - regReste);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <LinearGradient colors={GRADIENT} style={styles.loadingCenter}>
        <ActivityIndicator color="#fff" size="large" />
      </LinearGradient>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────────
  if (children.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <LinearGradient colors={GRADIENT} style={styles.headerSimple}>
          <SafeAreaView edges={['top']}>
            <Text style={styles.headerTitle}>Finance</Text>
          </SafeAreaView>
        </LinearGradient>
        <EmptyState icon="wallet-outline" title="Aucun enfant lié" subtitle="Contactez l'administration" />
      </View>
    );
  }

  // ── LIST MODE ──────────────────────────────────────────────────────────────
  if (viewMode === 'list') {
    return (
      <View style={styles.container}>
        <LinearGradient colors={GRADIENT} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <SafeAreaView edges={['top']}>
            <Text style={styles.headerTitle}>Finance</Text>
            <Text style={styles.headerSub}>
              {children.length} enfant{children.length > 1 ? 's' : ''} · Sélectionnez pour voir les paiements
            </Text>
          </SafeAreaView>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.success} />}
          showsVerticalScrollIndicator={false}
        >
          {children.map((child) => (
            <ChildFinanceCard key={child.id} child={child} onPress={() => loadChildFinance(child)} />
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    );
  }

  // ── DETAIL MODE ────────────────────────────────────────────────────────────
  const childName = selected
    ? (selected.user?.full_name ||
      `${selected.user?.first_name || selected.first_name || ''} ${selected.user?.last_name || selected.last_name || ''}`.trim() ||
      'Enfant')
    : '';

  return (
    <View style={styles.container}>
      <LinearGradient colors={GRADIENT} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          {/* Back row */}
          <TouchableOpacity style={styles.backRow} onPress={backToList} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color="#fff" />
            <Text style={styles.backText}>Finance</Text>
          </TouchableOpacity>

          {/* Child name */}
          {selected && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm, flexWrap: 'wrap' }}>
              <Text style={[styles.detailChildName, { marginBottom: 0 }]} numberOfLines={1}>{childName}</Text>
              {summary && (summary.has_payment_schedule || summary.echeance_override) && (
                <View style={[styles.badgeGreen, {
                  backgroundColor: summary.echeance_override ? '#DBEAFE' : summary.tuition_up_to_date ? '#D1FAE5' : '#FEE2E2',
                }]}>
                  <Text style={[styles.badgeGreenText, {
                    color: summary.echeance_override ? '#2563EB' : summary.tuition_up_to_date ? '#059669' : '#DC2626',
                  }]}>
                    {summary.echeance_override ? 'Admission autorisée' : summary.tuition_up_to_date ? 'À jour' : 'Non à jour'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* fees breakdown — INSCRIPTION / SCOLARITÉ, same as the student screen */}
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
                <Ionicons name={t.icon} size={13} color={tab === t.key ? colors.success : 'rgba(255,255,255,0.75)'} />
                <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loadingDetail ? (
        <View style={styles.center}><ActivityIndicator color={colors.success} size="large" /></View>

      ) : tab === 'summary' ? (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.success} />}
        >
          <PaymentTab
            summary={summary} invoices={invoices} payments={payments} echeancier={echeancier}
            pct={pct} tuition={tuition} tuitionOnly={tuitionOnly} paid={paid} remaining={remaining}
            onPayPress={openPayModal}
            onPrepareInvoices={handlePrepareInvoices}
            preparingInvoices={preparingInvoices}
            onFreePay={() => setFreePayVisible(true)}
            prepareTitle="Préparer le dossier de paiement"
            prepareSub="Appuyez pour créer les factures et activer le paiement"
          />
        </ScrollView>

      ) : tab === 'invoices' ? (
        <FlatList
          data={invoices}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.success} />}
          ListEmptyComponent={<EmptyState icon="receipt-outline" title="Aucune facture" subtitle="Aucune facture enregistrée pour cet enfant" />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardIcon}>
                  <Ionicons name="document-text-outline" size={22} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.invoice_number}</Text>
                  <Text style={styles.cardSub}>
                    {item.issue_date ? new Date(item.issue_date).toLocaleDateString('fr-FR') : '--'}
                  </Text>
                </View>
                <Badge status={item.status} />
              </View>
              <View style={styles.amountRow}>
                <View style={styles.amountItem}>
                  <Text style={styles.amountLabel}>Total</Text>
                  <Text style={styles.amountVal}>{fmt(item.total)}</Text>
                </View>
                <View style={styles.amountItem}>
                  <Text style={styles.amountLabel}>Payé</Text>
                  <Text style={[styles.amountVal, { color: colors.success }]}>{fmt(item.amount_paid)}</Text>
                </View>
                <View style={styles.amountItem}>
                  <Text style={styles.amountLabel}>Reste</Text>
                  <Text style={[styles.amountVal, { color: parseFloat(item.balance) > 0 ? colors.warning : colors.success }]}>
                    {fmt(item.balance)}
                  </Text>
                </View>
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
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.success} />}
          ListEmptyComponent={<EmptyState icon="cash-outline" title="Aucun paiement" />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardIcon}>
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
              <View style={styles.paymentAmountRow}>
                <Text style={styles.paymentAmountLabel}>Montant</Text>
                <Text style={styles.paymentAmountValue}>{fmt(item.amount)}</Text>
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
        onSuccess={onPaymentSuccess}
      />

      {/* ── free payment modal (no pre-existing invoice) ── */}
      <ManualMoneyModal
        visible={freePayVisible}
        mode="free"
        studentId={selected?.id}
        onClose={() => setFreePayVisible(false)}
        onSuccess={() => { setFreePayVisible(false); if (selected) loadChildFinance(selected); }}
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

// ── ChildFinanceCard ──────────────────────────────────────────────────────────

function ChildFinanceCard({ child, onPress }) {
  const name = child.user?.full_name ||
    `${child.user?.first_name || child.first_name || ''} ${child.user?.last_name || child.last_name || ''}`.trim() ||
    'Enfant';
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const tuition   = parseFloat(child._tuition   ?? child.tuition_fee      ?? 0);
  const paid      = parseFloat(child._paid      ?? child.total_paid       ?? 0);
  const remaining = parseFloat(child._remaining ?? child.remaining_balance ?? 0);
  const pct = tuition > 0 ? Math.min(100, Math.round((paid / tuition) * 100)) : 0;
  const isEnrolled = child.registration_fee_paid || child.status === 'ACTIVE';

  return (
    <TouchableOpacity style={styles.childCard} onPress={onPress} activeOpacity={0.75}>
      {isEnrolled && <View style={styles.childCardAccent} />}

      <View style={styles.childCardTop}>
        <View style={styles.childAvatar}>
          <Text style={styles.childAvatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.childName} numberOfLines={1}>{name}</Text>
          {child.matricule && <Text style={styles.childMatricule}>#{child.matricule}</Text>}
          <View style={styles.childBadges}>
            {isEnrolled && (
              <View style={styles.badgeGreen}>
                <Ionicons name="checkmark" size={10} color="#059669" />
                <Text style={styles.badgeGreenText}>Inscrit</Text>
              </View>
            )}
            {child.status === 'ACTIVE' && (
              <View style={styles.badgeBlue}>
                <Text style={styles.badgeBlueText}>Actif</Text>
              </View>
            )}
            {(child._hasSchedule || child._override) && (
              <View style={[styles.badgeGreen, {
                backgroundColor: child._override ? '#DBEAFE' : child._upToDate ? '#D1FAE5' : '#FEE2E2',
              }]}>
                <Text style={[styles.badgeGreenText, {
                  color: child._override ? '#2563EB' : child._upToDate ? '#059669' : '#DC2626',
                }]}>
                  {child._override ? 'Admission autorisée' : child._upToDate ? 'À jour' : 'Non à jour'}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </View>

      {tuition > 0 ? (
        <View style={styles.childFinance}>
          <View style={styles.financeKpiRow}>
            {[
              { label: 'Scolarité', value: tuition,   color: '#2563EB', bg: '#DBEAFE' },
              { label: 'Payé',      value: paid,      color: '#059669', bg: '#D1FAE5' },
              { label: 'Reste',     value: remaining, color: remaining > 0 ? '#EF4444' : '#059669', bg: remaining > 0 ? '#FEE2E2' : '#D1FAE5' },
            ].map((k) => (
              <View key={k.label} style={[styles.financeKpi, { backgroundColor: k.bg }]}>
                <Text style={styles.financeKpiLabel}>{k.label}</Text>
                <Text style={[styles.financeKpiValue, { color: k.color }]} numberOfLines={1}>
                  {k.value > 0 ? `${(k.value / 1000).toFixed(0)}k F` : '—'}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.progressWrap}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Progression</Text>
              <Text style={[styles.progressPct, { color: pct === 100 ? colors.success : pct >= 50 ? colors.warning : colors.danger }]}>
                {pct}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {
                width: `${pct}%`,
                backgroundColor: pct === 100 ? colors.success : pct >= 50 ? colors.warning : colors.danger,
              }]} />
            </View>
            <Text style={[styles.progressSub, { color: remaining > 0 ? colors.danger : colors.success }]}>
              {remaining > 0 ? `Reste ${remaining.toLocaleString('fr-FR')} F à régler` : '✓ Scolarité soldée'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.noFinance}>
          <Text style={styles.noFinanceText}>Aucune facture enregistrée</Text>
        </View>
      )}

      {(child.current_class?.name || child.site_name) && (
        <View style={styles.childMeta}>
          {child.current_class?.name && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>CLASSE</Text>
              <Text style={styles.metaValue}>{child.current_class.name}</Text>
            </View>
          )}
          {child.current_class?.academic_year && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>ANNÉE</Text>
              <Text style={styles.metaValue}>{child.current_class.academic_year}</Text>
            </View>
          )}
          {child.site_name && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>SITE</Text>
              <Text style={styles.metaValue} numberOfLines={1}>{child.site_name}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerSimple: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', paddingTop: spacing.sm, paddingBottom: 2 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },

  // Detail header
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: spacing.sm, paddingBottom: 4 },
  backText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  detailChildName: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: spacing.sm },

  // fees breakdown grid (INSCRIPTION / SCOLARITÉ) — same layout as the student screen
  feesGrid:          { gap: 8, marginBottom: spacing.md },
  feesSection:       { backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 12, padding: 12 },
  feesSectionTitle:  { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.55)', letterSpacing: 1.2, marginBottom: 10 },
  feesCols:          { flexDirection: 'row' },

  tabs:          { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm },
  tab:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.15)' },
  tabActive:     { backgroundColor: '#fff' },
  tabText:       { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  tabTextActive: { color: colors.success },

  // List mode
  listContent: { padding: spacing.md },
  list:        { padding: spacing.md, gap: spacing.md, paddingBottom: 32 },

  // Child card
  childCard: { backgroundColor: '#fff', borderRadius: 18, marginBottom: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3, overflow: 'hidden' },
  childCardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.success },
  childCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, paddingLeft: 20 },
  childAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  childAvatarText: { fontSize: 18, fontWeight: '700', color: '#059669' },
  childName: { fontSize: 16, fontWeight: '700', color: colors.text },
  childMatricule: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  childBadges: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badgeGreen: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeGreenText: { fontSize: 11, fontWeight: '700', color: '#059669' },
  badgeBlue: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeBlueText: { fontSize: 11, fontWeight: '700', color: '#2563EB' },

  childFinance: { paddingHorizontal: 20, paddingBottom: spacing.md, gap: 10 },
  financeKpiRow: { flexDirection: 'row', gap: 8 },
  financeKpi: { flex: 1, borderRadius: 10, padding: 8, alignItems: 'center', gap: 2 },
  financeKpiLabel: { fontSize: 9, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 },
  financeKpiValue: { fontSize: 13, fontWeight: '800' },

  progressWrap: { gap: 4 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 12, color: colors.textSecondary },
  progressPct: { fontSize: 13, fontWeight: '700' },
  progressBar: { height: 7, backgroundColor: colors.divider, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressSub: { fontSize: 11, fontWeight: '600' },

  noFinance: { paddingHorizontal: 20, paddingBottom: spacing.md },
  noFinanceText: { fontSize: 12, color: colors.textTertiary, fontStyle: 'italic' },

  childMeta: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.divider, paddingHorizontal: 20, paddingVertical: 10, gap: 16 },
  metaItem: { gap: 2 },
  metaLabel: { fontSize: 9, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { fontSize: 12, fontWeight: '600', color: colors.text },

  // Detail mode invoice/payment list
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 12, color: colors.textSecondary },
  dueDate: { fontSize: 12, color: colors.textTertiary, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 8 },

  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.md, padding: 10 },
  amountItem: { flex: 1, alignItems: 'center' },
  amountLabel: { fontSize: 11, color: colors.textSecondary },
  amountVal: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 },

  paymentAmountRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.divider, padding: 12, borderRadius: radius.md },
  paymentAmountLabel: { fontSize: 13, color: colors.textSecondary },
  paymentAmountValue: { fontSize: 20, fontWeight: '800', color: colors.success },

  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  methodText: { fontSize: 13, color: colors.textSecondary },

  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: 13 },
  payBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
