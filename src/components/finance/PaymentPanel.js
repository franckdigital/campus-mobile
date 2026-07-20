import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Image, KeyboardAvoidingView, Modal,
  Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import financeService from '../../services/finance';
import EmptyState from '../common/EmptyState';
import { colors, spacing, radius } from '../../theme/colors';

/* ─── shared helpers ────────────────────────────────────────────────────── */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isNetworkError = (msg = '') =>
  ['failed to resolve', 'Name or service not known', 'HTTPSConnectionPool',
   'Max retries exceeded', 'ConnectionError', 'Network Error', 'timeout']
  .some((k) => msg.includes(k));

const POLL_ATTEMPTS = 6;
const POLL_DELAY_MS = 3000;

export const fmt  = (v) => (v != null ? `${parseFloat(v).toLocaleString('fr-FR')} F` : '--');
export const fmtN = (v) => (v != null ? parseFloat(v).toLocaleString('fr-FR') : '--');

export const REG_FEE_RE     = /inscri|regist/i;
export const TUITION_FEE_RE = /tuition|scolarit/i;

const INSTALLMENT_STATUS = {
  PAYE:      { label: 'Payé',      color: '#059669', bg: '#D1FAE5' },
  PARTIEL:   { label: 'Partiel',   color: '#D97706', bg: '#FEF3C7' },
  EN_RETARD: { label: 'En retard', color: '#DC2626', bg: '#FEE2E2' },
  A_VENIR:   { label: 'À venir',   color: '#6B7280', bg: '#F3F4F6' },
};

// Aggregate ALL non-cancelled invoices matching a fee-type regex (there can
// be more than one scolarité invoice for a student), instead of picking a
// single invoice via .find() — that single-invoice approach is what caused
// the header/cards to show a different (and lower) total than the aggregate
// "Progression des paiements" figure whenever a student had more than one
// invoice of the same type.
export function aggregateInvoices(invoicesList, feeTypeRe) {
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

/* ═══════════════════════════════════════════════════════════════════════════
   FinStat  —  used in the header's INSCRIPTION / SCOLARITÉ grid
   ══════════════════════════════════════════════════════════════════════════ */

export function FinStat({ label, value, paid, danger }) {
  const vc = danger ? '#F59E0B' : paid ? '#10B981' : '#fff';
  return (
    <View style={styles.finStat}>
      <Text style={styles.finStatLabel}>{label}</Text>
      <Text style={[styles.finStatValue, { color: vc }]}>{value}</Text>
      <Text style={styles.finStatUnit}>FCFA</Text>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PaymentTab  —  progress card + free payment + prepare banner + fee cards
   ══════════════════════════════════════════════════════════════════════════ */

export function PaymentTab({ summary, invoices, payments, pct, tuition, tuitionOnly, paid, remaining,
  onPayPress, onPrepareInvoices, preparingInvoices, onFreePay, echeancier,
  prepareTitle = 'Préparer mon dossier de paiement',
  prepareSub = 'Appuyez pour créer vos factures et activer le paiement' }) {

  const regFee      = parseFloat(summary?.registration_fee || 0);
  const hasInvoices = summary?.has_invoices ?? invoices.length > 0;
  const needsPrepare = !hasInvoices && (tuition > 0 || regFee > 0);
  const lastPayments = (payments || []).slice(0, 3);

  // Aggregated across ALL matching invoices (a student can have more than
  // one scolarité invoice) so these cards agree with the header and the
  // "Progression des paiements" card above, which are both aggregate-based.
  const regAgg     = aggregateInvoices(invoices, REG_FEE_RE);
  const tuitionAgg = aggregateInvoices(invoices, TUITION_FEE_RE);

  const hasRegInvoices     = regAgg.list.length > 0;
  const regInvTotal        = hasRegInvoices ? regAgg.total   : regFee;
  const regInvPaid         = hasRegInvoices ? regAgg.paid    : 0;
  const regInvBalance      = hasRegInvoices ? regAgg.balance : 0;
  // Target invoice to open the pay modal against — the modal can only pay
  // down one invoice at a time, so pick the first one still owing.
  const regPayTarget = regAgg.list.find((inv) => parseFloat(inv.balance) > 0) || regAgg.list[0];

  const hasTuitionInvoices = tuitionAgg.list.length > 0;
  // Fall back to the scolarité-only total (tuitionOnly), not the grand total
  // (tuition = inscription + scolarité) — otherwise, when a student has no
  // scolarité invoice yet, this card shows the combined total instead of 0,
  // which happens to look identical to the inscription amount and is
  // misleading (mirrors the already-correct pattern in FinanceScreen.js).
  const tuitionInvTotal    = hasTuitionInvoices ? tuitionAgg.total   : tuitionOnly;
  const tuitionInvPaid     = hasTuitionInvoices ? tuitionAgg.paid    : paid;
  const tuitionInvBalance  = hasTuitionInvoices ? tuitionAgg.balance : remaining;
  const tuitionPayTarget = tuitionAgg.list.find((inv) => parseFloat(inv.balance) > 0) || tuitionAgg.list[0];

  // When real invoices exist, their aggregated balance is the source of truth —
  // the scalar registration_fee_paid flag can lag behind (it tracks a single
  // fee amount that may no longer match the sum of all registration invoices),
  // and OR-ing it in was hiding the pay button even with money still owed.
  const regInvoicePaid = hasRegInvoices ? regInvBalance <= 0 : false;
  const regFeePaid = hasRegInvoices ? regInvoicePaid : (summary?.registration_fee_paid || false);

  return (
    <>
      {/* ── progress card ── */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Progression des paiements</Text>
          <Text style={[styles.progressPct, {
            color: pct >= 100 ? colors.success : pct >= 50 ? colors.warning : colors.danger,
          }]}>{pct.toFixed(0)}%</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, {
            width: `${pct}%`,
            backgroundColor: pct >= 100 ? colors.success : pct >= 50 ? colors.warning : colors.danger,
          }]} />
        </View>
        <View style={styles.progressLegend}>
          <Text style={styles.progressLegendText}>
            <Text style={{ color: colors.success, fontWeight: '700' }}>{fmt(paid)}</Text>{' '}payé sur {fmt(tuition)}
          </Text>
          {remaining > 0 && (
            <Text style={[styles.progressLegendText, { color: colors.danger }]}>Reste : {fmt(remaining)}</Text>
          )}
        </View>
      </View>

      {/* ── free payment (no invoice) ── */}
      <TouchableOpacity style={styles.freePayBtn} onPress={onFreePay} activeOpacity={0.8}>
        <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
        <Text style={styles.freePayBtnText}>Paiement libre — autre montant</Text>
      </TouchableOpacity>

      {/* ── prepare banner ── */}
      {needsPrepare && (
        <TouchableOpacity style={styles.prepareBanner} onPress={onPrepareInvoices} disabled={preparingInvoices} activeOpacity={0.85}>
          <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.prepareBannerInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {preparingInvoices ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.prepareBannerText}>Création des factures en cours...</Text>
              </>
            ) : (
              <>
                <Ionicons name="document-text-outline" size={20} color="#fff" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.prepareBannerText}>{prepareTitle}</Text>
                  <Text style={styles.prepareBannerSub}>{prepareSub}</Text>
                </View>
                <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.8)" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* ── inscription card ── */}
      {regFee > 0 && (
        <View style={[styles.feeCard, regFeePaid ? styles.feeCardPaid : styles.feeCardPending]}>
          <View style={styles.feeCardHeader}>
            <View style={[styles.feeIcon, { backgroundColor: regFeePaid ? '#D1FAE5' : '#FEF3C7' }]}>
              <Ionicons
                name={regFeePaid ? 'checkmark-circle' : 'alert-circle'}
                size={22}
                color={regFeePaid ? colors.success : colors.warning}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.feeLabel}>Frais d'inscription</Text>
              {hasRegInvoices ? (
                <Text style={[styles.feeStatus, {
                  color: regInvBalance <= 0 ? colors.success : colors.warning,
                }]}>
                  {regInvBalance <= 0
                    ? 'Soldé ✓'
                    : `${fmt(regInvBalance)} restants`}
                </Text>
              ) : (
                <Text style={[styles.feeStatus, { color: regFeePaid ? colors.success : colors.warning }]}>
                  {regFeePaid ? 'Soldé ✓' : 'Non validée'}
                </Text>
              )}
            </View>
            <Text style={styles.feeAmount}>{fmt(regInvTotal)}</Text>
          </View>

          <View style={styles.feePaidRow}>
            <Text style={styles.feePaidLabel}>Montant payé</Text>
            <Text style={[styles.feePaidValue, { color: colors.success }]}>
              {fmt(hasRegInvoices ? regInvPaid : (regFeePaid ? regFee : 0))}
            </Text>
          </View>

          {hasRegInvoices && (
            <View style={styles.progressBarSlim}>
              <View style={[styles.progressFillSlim, {
                width: `${regInvTotal > 0
                  ? Math.min(100, (regInvPaid / regInvTotal) * 100)
                  : 0}%`,
                backgroundColor: regInvBalance <= 0
                  ? colors.success
                  : regInvPaid > 0 ? colors.warning : colors.danger,
              }]} />
            </View>
          )}

          {!regFeePaid && regPayTarget && parseFloat(regPayTarget.balance) > 0 && (
            <TouchableOpacity
              style={[styles.payBtn, { backgroundColor: '#D97706' }]}
              onPress={() => onPayPress(regPayTarget)}
              activeOpacity={0.8}
            >
              <Ionicons name="phone-portrait-outline" size={16} color="#fff" />
              <Text style={styles.payBtnText}>Payer {fmt(regPayTarget.balance)} — Mobile Money</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── scolarité card ── */}
      {(tuitionOnly > 0 || hasTuitionInvoices) && (
        <View style={styles.feeCard}>
          <View style={styles.feeCardHeader}>
            <View style={[styles.feeIcon, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="book-outline" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.feeLabel}>Frais de scolarité</Text>
              {hasTuitionInvoices ? (
                <Text style={[styles.feeStatus, { color: tuitionInvBalance > 0 ? colors.danger : colors.success }]}>
                  {tuitionInvBalance > 0 ? `${fmt(tuitionInvBalance)} restants` : 'Soldé ✓'}
                </Text>
              ) : (
                <Text style={[styles.feeStatus, { color: colors.textSecondary }]}>En attente de facturation</Text>
              )}
            </View>
            <Text style={styles.feeAmount}>{fmt(tuitionInvTotal)}</Text>
          </View>

          <View style={styles.feePaidRow}>
            <Text style={styles.feePaidLabel}>Montant payé</Text>
            <Text style={[styles.feePaidValue, { color: colors.success }]}>{fmt(tuitionInvPaid)}</Text>
          </View>

          {hasTuitionInvoices && (
            <View style={styles.progressBarSlim}>
              <View style={[styles.progressFillSlim, {
                width: `${tuitionInvTotal > 0
                  ? Math.min(100, (tuitionInvPaid / tuitionInvTotal) * 100)
                  : 0}%`,
                backgroundColor: tuitionInvBalance <= 0
                  ? colors.success : tuitionInvPaid > 0 ? colors.warning : colors.danger,
              }]} />
            </View>
          )}

          {tuitionPayTarget && parseFloat(tuitionPayTarget.balance) > 0 && (
            <TouchableOpacity style={styles.payBtn} onPress={() => onPayPress(tuitionPayTarget)} activeOpacity={0.8}>
              <Ionicons name="phone-portrait-outline" size={16} color="#fff" />
              <Text style={styles.payBtnText}>Payer {fmt(tuitionPayTarget.balance)} — Mobile Money</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── échéancier de scolarité ── */}
      {echeancier?.has_schedule && echeancier.installments?.length > 0 && (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Échéancier de scolarité</Text>
          {echeancier.installments.map((inst) => {
            const st = INSTALLMENT_STATUS[inst.status] || INSTALLMENT_STATUS.A_VENIR;
            const payable = inst.status !== 'PAYE' && !!tuitionPayTarget;
            return (
              <View key={inst.id} style={styles.installmentCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.installmentLabel}>{inst.label}</Text>
                  <Text style={styles.installmentDue}>
                    Échéance : {inst.due_date ? new Date(inst.due_date).toLocaleDateString('fr-FR') : '--'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.installmentAmount}>{fmt(inst.amount)}</Text>
                  <View style={[styles.installmentBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.installmentBadgeText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
                {payable && (
                  <TouchableOpacity
                    style={styles.installmentPayBtn}
                    onPress={() => onPayPress(
                      tuitionPayTarget,
                      Math.min(parseFloat(inst.amount), parseFloat(tuitionPayTarget.balance || 0)),
                      inst.label
                    )}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="phone-portrait-outline" size={16} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* ── derniers paiements ── */}
      {lastPayments.length > 0 && (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Derniers paiements</Text>
          {lastPayments.map((p) => (
            <View key={p.id} style={styles.miniCard}>
              <View style={[styles.miniIconWrap, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="cash-outline" size={16} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniTitle}>{p.payment_number || `Paiement #${p.id}`}</Text>
                <Text style={styles.miniSub}>{p.payment_date ? new Date(p.payment_date).toLocaleDateString('fr-FR') : ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                <Text style={styles.miniAmount}>{parseFloat(p.amount).toLocaleString('fr-FR')} F</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {tuition === 0 && regFee === 0 && (
        <EmptyState icon="wallet-outline" title="Aucune information financière" subtitle="Les frais apparaîtront ici une fois configurés." />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SuccessPhase  —  shared "done" phase UI for PaymentModal & FreePaymentModal
   (animated checkmark badge with a pulsing ring + the amount just paid)
   ══════════════════════════════════════════════════════════════════════════ */

function SuccessPhase({ amount }) {
  const scale       = useRef(new Animated.Value(0)).current;
  const ringScale   = useRef(new Animated.Value(0.8)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
    Animated.loop(
      Animated.parallel([
        Animated.timing(ringScale,   { toValue: 1.7, duration: 1300, useNativeDriver: true }),
        Animated.timing(ringOpacity, { toValue: 0,   duration: 1300, useNativeDriver: true }),
      ])
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.phaseCenter}>
      <View style={styles.successBadgeWrap}>
        <Animated.View
          pointerEvents="none"
          style={[styles.successRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]}
        />
        <Animated.View style={{ transform: [{ scale }] }}>
          <LinearGradient colors={['#059669', '#10B981']} style={styles.phaseIconWrap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Ionicons name="checkmark" size={36} color="#fff" />
          </LinearGradient>
        </Animated.View>
      </View>
      <Text style={[styles.phaseTitle, { color: colors.success }]}>Paiement effectué</Text>
      {amount != null && <Text style={styles.successAmount}>{fmt(amount)}</Text>}
      <Text style={styles.phaseSub}>Le paiement a été enregistré avec succès</Text>
      <Text style={styles.successClosing}>Fermeture automatique...</Text>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PaymentModal  —  self-contained, manages all payment phases
   Phases: select | paying | polling | error | demo | done
   ══════════════════════════════════════════════════════════════════════════ */

const TRANCHES = (balance) => [
  { key: 'full',   label: 'Solde complet', amount: balance,              sub: 'Tout régler'   },
  { key: 'half',   label: '½ versement',   amount: Math.ceil(balance/2), sub: '50% du reste'  },
  { key: 'third',  label: '⅓ versement',   amount: Math.ceil(balance/3), sub: '33% du reste'  },
  { key: 'custom', label: 'Montant libre', amount: null,                  sub: 'Saisir manuellement' },
];

export function PaymentModal({ visible, invoice, onClose, onSuccess }) {
  const [phase,         setPhase]         = useState('select');
  const [selected,      setSelected]      = useState('full');
  const [customAmt,     setCustomAmt]     = useState('');
  const [errorMsg,      setErrorMsg]      = useState('');
  const [isNetErr,      setIsNetErr]      = useState(false);
  const [capturedTxId,  setCapturedTxId]  = useState(null);
  const abortRef = useRef(false);

  // Inscription is always paid in one single, full payment — no staggered
  // (½/⅓/libre) tranches, unlike scolarité which supports partial payments.
  const isRegistration = (invoice?.fee_type_codes || []).some((c) => REG_FEE_RE.test(c));

  const balance = parseFloat(invoice?.balance || 0);
  const total   = parseFloat(invoice?.total   || 0);
  const amtPaid = parseFloat(invoice?.amount_paid || 0);
  const pct     = total > 0 ? Math.min((amtPaid / total) * 100, 100) : 0;

  const tranches = TRANCHES(balance);

  const getAmount = () => {
    if (selected === 'custom') {
      const v = parseFloat(customAmt.replace(/[\s,]/g, ''));
      return isNaN(v) ? 0 : v;
    }
    return tranches.find((t) => t.key === selected)?.amount || 0;
  };

  useEffect(() => {
    if (visible) {
      abortRef.current = false;
      setPhase('select');
      setSelected('full');
      setCustomAmt('');
      setErrorMsg('');
      setIsNetErr(false);
      setCapturedTxId(null);
    } else {
      abortRef.current = true;
    }
  }, [visible, invoice?.id]);

  /* ── pay handler ── */
  const handlePay = async () => {
    const amount = getAmount();
    if (!invoice || !amount || amount > balance + 1) return;
    setPhase('paying');

    try {
      const payload = { invoice_id: invoice.id };
      if (selected !== 'full') payload.amount = Math.round(amount);

      const initRes = await financeService.initiateCinetPay(payload);
      const { transaction_id, payment_url } = initRes || {};
      if (!payment_url) throw new Error('URL de paiement introuvable');

      setPhase('polling');
      await WebBrowser.openBrowserAsync(payment_url);

      if (abortRef.current) return;

      let finalStatus = 'PENDING';
      for (let i = 0; i < POLL_ATTEMPTS; i++) {
        if (abortRef.current) return;
        await sleep(POLL_DELAY_MS);
        try {
          const s = await financeService.checkCinetPayStatus(transaction_id);
          finalStatus = s?.transaction?.status || 'PENDING';
          if (finalStatus !== 'PENDING') break;
        } catch { /* keep polling */ }
      }

      if (finalStatus === 'SUCCESS') {
        setPhase('done');
        await sleep(1800);
        onSuccess?.();
      } else {
        setPhase('error');
        setErrorMsg("Le paiement n'a pas abouti.");
        setIsNetErr(false);
      }
    } catch (e) {
      if (abortRef.current) return;
      const detail = e?.response?.data?.detail || e?.message || '';
      const txId   = e?.response?.data?.transaction_id;
      if (txId) setCapturedTxId(txId);
      setPhase('error');
      setErrorMsg(detail || 'Une erreur est survenue.');
      setIsNetErr(isNetworkError(detail));
    }
  };

  /* ── demo handler — calls the real backend endpoint to create a Payment
     record. Never fakes success client-side: without a captured transaction
     to confirm server-side, there is nothing to pay down, and silently
     bumping the displayed amounts would show a balance that doesn't exist
     in the database (mismatched against admin web / other devices). ── */
  const handleDemo = async () => {
    if (!capturedTxId) return;
    setPhase('demo');

    try {
      await financeService.demoPay(capturedTxId);
      if (abortRef.current) return;
      setPhase('done');
      await sleep(1500);
      onSuccess?.();   // real DB record exists → fetchData gets updated data
    } catch (err) {
      if (abortRef.current) return;
      const detail = err?.response?.data?.detail || err?.message || '';
      setPhase('error');
      setErrorMsg(detail || "Le paiement test a échoué. Aucun montant n'a été modifié.");
      setIsNetErr(false);
    }
  };

  const amount  = getAmount();
  const isValid = amount >= 100 && amount <= balance + 1;
  const canClose = phase === 'select' || phase === 'error';

  if (!invoice) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={canClose ? onClose : undefined}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBg} onPress={canClose ? onClose : undefined} activeOpacity={1} />

        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />

          {/* ── common header ── */}
          <View style={styles.modalHeader}>
            <LinearGradient colors={['#EEF2FF', '#F5F3FF']} style={styles.modalIconWrap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Ionicons name="phone-portrait-outline" size={22} color={colors.primary} />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Paiement Mobile Money</Text>
              <Text style={styles.modalSub}>{invoice.invoice_number}</Text>
            </View>
            {canClose && (
              <TouchableOpacity onPress={onClose} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* ════════════ PHASE: SELECT ════════════ */}
          {phase === 'select' && (
            <>
              {/* invoice summary chips */}
              <View style={styles.chipRow}>
                <Chip label="Total"   value={fmt(total)}   bg="#F3F4F6" color={colors.text}    />
                <Chip label="Payé"    value={fmt(amtPaid)} bg="#D1FAE5" color={colors.success}  />
                <Chip label="Restant" value={fmt(balance)} bg="#FEE2E2" color={colors.danger}   />
              </View>

              {/* progress bar */}
              <View>
                <View style={styles.modalProgressBar}>
                  <View style={[styles.modalProgressFill, {
                    width: `${pct}%`,
                    backgroundColor: pct >= 100 ? colors.success : pct > 0 ? colors.warning : colors.danger,
                  }]} />
                </View>
                <Text style={styles.modalProgressLabel}>{pct.toFixed(0)}% réglé</Text>
              </View>

              {/* tranche selector — inscription is always full-payment only,
                  no staggered options, amount auto-filled and locked */}
              {isRegistration ? (
                <View style={styles.fullPayLockBox}>
                  <Ionicons name="lock-closed" size={16} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fullPayLockTitle}>Montant à payer : {fmt(balance)}</Text>
                    <Text style={styles.fullPayLockSub}>
                      L'inscription se paie intégralement, en un seul versement.
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.modalSectionTitle}>Choisir votre versement</Text>
                  <View style={styles.trancheGrid}>
                    {tranches.map((t) => {
                      const active = selected === t.key;
                      return (
                        <TouchableOpacity
                          key={t.key}
                          style={[styles.trancheChip, active && styles.trancheChipActive]}
                          onPress={() => setSelected(t.key)}
                          activeOpacity={0.8}
                        >
                          {active && (
                            <View style={styles.trancheCheck}>
                              <Ionicons name="checkmark" size={10} color="#fff" />
                            </View>
                          )}
                          <Text style={[styles.trancheLabel, active && styles.trancheLabelActive]}>{t.label}</Text>
                          {t.amount != null ? (
                            <Text style={[styles.trancheAmount, active && styles.trancheAmountActive]}>{fmt(t.amount)}</Text>
                          ) : (
                            <Text style={[styles.trancheSub, active && { color: 'rgba(255,255,255,0.75)' }]}>{t.sub}</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* custom input */}
                  {selected === 'custom' && (
                    <View style={styles.customInputRow}>
                      <TextInput
                        style={styles.customInput}
                        placeholder="Ex : 150 000"
                        keyboardType="numeric"
                        value={customAmt}
                        onChangeText={setCustomAmt}
                        placeholderTextColor={colors.textTertiary}
                        autoFocus
                      />
                      <Text style={styles.customCurrency}>F CFA</Text>
                    </View>
                  )}
                </>
              )}

              {/* pay button */}
              <TouchableOpacity
                style={[styles.modalPayBtn, !isValid && styles.modalPayBtnDisabled]}
                disabled={!isValid}
                onPress={handlePay}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={isValid ? ['#4F46E5', '#6D28D9'] : ['#D1D5DB', '#9CA3AF']}
                  style={styles.modalPayBtnGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
                  <Text style={styles.modalPayBtnText}>
                    {isValid ? `Payer ${fmt(amount)}` : 'Entrer un montant valide'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.secureRow}>
                <Ionicons name="lock-closed-outline" size={11} color={colors.textTertiary} />
                <Text style={styles.secureText}>Paiement sécurisé · CinetPay</Text>
              </View>
            </>
          )}

          {/* ════════════ PHASE: PAYING / POLLING ════════════ */}
          {(phase === 'paying' || phase === 'polling') && (
            <View style={styles.phaseCenter}>
              <View style={styles.loadingRing}>
                <ActivityIndicator color={colors.primary} size="large" />
              </View>
              <Text style={styles.phaseTitle}>
                {phase === 'paying' ? 'Connexion au service...' : 'Vérification du paiement...'}
              </Text>
              <Text style={styles.phaseSub}>
                {phase === 'paying'
                  ? 'Ouverture de la page de paiement CinetPay'
                  : 'Retour sur la page, veuillez patienter'}
              </Text>
            </View>
          )}

          {/* ════════════ PHASE: ERROR ════════════ */}
          {phase === 'error' && (
            <View style={styles.phaseCenter}>
              <View style={[styles.phaseIconWrap, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="wifi-outline" size={32} color={colors.danger} />
              </View>
              <Text style={styles.phaseTitle}>
                {isNetErr ? 'Service inaccessible' : 'Paiement échoué'}
              </Text>
              <Text style={styles.phaseSub}>
                {isNetErr
                  ? 'CinetPay est temporairement indisponible depuis le serveur.'
                  : errorMsg}
              </Text>

              <View style={styles.errorBtns}>
                <TouchableOpacity style={styles.retryBtn} onPress={() => setPhase('select')} activeOpacity={0.8}>
                  <Ionicons name="refresh-outline" size={16} color={colors.primary} />
                  <Text style={styles.retryBtnText}>Réessayer</Text>
                </TouchableOpacity>

                {isNetErr && capturedTxId && (
                  <TouchableOpacity style={styles.demoBtn} onPress={handleDemo} activeOpacity={0.8}>
                    <LinearGradient colors={['#4F46E5', '#6D28D9']} style={styles.demoBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Ionicons name="flask-outline" size={16} color="#fff" />
                      <Text style={styles.demoBtnText}>Mode test</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* ════════════ PHASE: DEMO ════════════ */}
          {phase === 'demo' && (
            <View style={styles.phaseCenter}>
              <LinearGradient colors={['#4F46E5', '#6D28D9']} style={styles.phaseIconWrap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <ActivityIndicator color="#fff" size="large" />
              </LinearGradient>
              <Text style={styles.phaseTitle}>Simulation en cours...</Text>
              <Text style={styles.phaseSub}>Mode test activé — traitement du versement</Text>
              <View style={styles.demoTag}>
                <Ionicons name="flask-outline" size={12} color="#4F46E5" />
                <Text style={styles.demoTagText}>TEST · Sans enregistrement réel</Text>
              </View>
            </View>
          )}

          {/* ════════════ PHASE: DONE ════════════ */}
          {phase === 'done' && <SuccessPhase amount={amount} />}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FreePaymentModal  —  pay without a pre-existing invoice
   (backend auto-creates the invoice from student_id + amount)
   Phases: select | paying | polling | error | done
   ══════════════════════════════════════════════════════════════════════════ */

// Inscription is deliberately excluded — it's always a single, full,
// auto-filled payment via the dedicated "Frais d'inscription" card/PaymentModal,
// never a manually-typed free-form amount (which is what this modal is for).
const FEE_TYPES = [
  { code: 'TUITION', label: 'Scolarité' },
  { code: 'OTHER',   label: 'Autre'     },
];

export function FreePaymentModal({ visible, studentId, onClose, onSuccess }) {
  const [phase,        setPhase]        = useState('select');
  const [feeType,      setFeeType]      = useState('TUITION');
  const [amountStr,    setAmountStr]    = useState('');
  const [description,  setDescription]  = useState('');
  const [errorMsg,     setErrorMsg]     = useState('');
  const [isNetErr,     setIsNetErr]     = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    if (visible) {
      abortRef.current = false;
      setPhase('select');
      setFeeType('TUITION');
      setAmountStr('');
      setDescription('');
      setErrorMsg('');
      setIsNetErr(false);
    } else {
      abortRef.current = true;
    }
  }, [visible]);

  const amount = (() => {
    const v = parseFloat(amountStr.replace(/[\s,]/g, ''));
    return isNaN(v) ? 0 : v;
  })();
  const isValid = !!studentId && amount >= 100;
  const canClose = phase === 'select' || phase === 'error';

  const handlePay = async () => {
    if (!isValid) return;
    setPhase('paying');
    try {
      const payload = {
        student_id: studentId,
        amount: Math.round(amount),
        fee_type_code: feeType,
      };
      if (description.trim()) payload.description = description.trim();

      const initRes = await financeService.initiateCinetPay(payload);
      const { transaction_id, payment_url } = initRes || {};
      if (!payment_url) throw new Error('URL de paiement introuvable');

      setPhase('polling');
      await WebBrowser.openBrowserAsync(payment_url);

      if (abortRef.current) return;

      let finalStatus = 'PENDING';
      for (let i = 0; i < POLL_ATTEMPTS; i++) {
        if (abortRef.current) return;
        await sleep(POLL_DELAY_MS);
        try {
          const s = await financeService.checkCinetPayStatus(transaction_id);
          finalStatus = s?.transaction?.status || 'PENDING';
          if (finalStatus !== 'PENDING') break;
        } catch { /* keep polling */ }
      }

      if (finalStatus === 'SUCCESS') {
        setPhase('done');
        await sleep(1800);
        onSuccess?.();
      } else {
        setPhase('error');
        setErrorMsg("Le paiement n'a pas abouti.");
        setIsNetErr(false);
      }
    } catch (e) {
      if (abortRef.current) return;
      const detail = e?.response?.data?.detail || e?.message || '';
      setPhase('error');
      setErrorMsg(detail || 'Une erreur est survenue.');
      setIsNetErr(isNetworkError(detail));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={canClose ? onClose : undefined}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBg} onPress={canClose ? onClose : undefined} activeOpacity={1} />

        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <LinearGradient colors={['#EEF2FF', '#F5F3FF']} style={styles.modalIconWrap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Paiement libre</Text>
              <Text style={styles.modalSub}>Payer sans facture existante</Text>
            </View>
            {canClose && (
              <TouchableOpacity onPress={onClose} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* ════════════ PHASE: SELECT ════════════ */}
          {phase === 'select' && (
            <>
              <Text style={styles.modalSectionTitle}>Type de frais</Text>
              <View style={styles.trancheGrid}>
                {FEE_TYPES.map((t) => {
                  const active = feeType === t.code;
                  return (
                    <TouchableOpacity
                      key={t.code}
                      style={[styles.trancheChip, { width: '30%' }, active && styles.trancheChipActive]}
                      onPress={() => setFeeType(t.code)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.trancheLabel, active && styles.trancheLabelActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.modalSectionTitle}>Montant</Text>
              <View style={styles.customInputRow}>
                <TextInput
                  style={styles.customInput}
                  placeholder="Ex : 50 000"
                  keyboardType="numeric"
                  value={amountStr}
                  onChangeText={setAmountStr}
                  placeholderTextColor={colors.textTertiary}
                />
                <Text style={styles.customCurrency}>F CFA</Text>
              </View>

              {feeType === 'OTHER' && (
                <>
                  <Text style={styles.modalSectionTitle}>Description</Text>
                  <View style={styles.customInputRow}>
                    <TextInput
                      style={styles.customInput}
                      placeholder="Ex : Frais de photocopie"
                      value={description}
                      onChangeText={setDescription}
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                </>
              )}

              <TouchableOpacity
                style={[styles.modalPayBtn, !isValid && styles.modalPayBtnDisabled]}
                disabled={!isValid}
                onPress={handlePay}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={isValid ? ['#4F46E5', '#6D28D9'] : ['#D1D5DB', '#9CA3AF']}
                  style={styles.modalPayBtnGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
                  <Text style={styles.modalPayBtnText}>
                    {isValid ? `Payer ${fmt(amount)}` : 'Entrer un montant valide'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.secureRow}>
                <Ionicons name="lock-closed-outline" size={11} color={colors.textTertiary} />
                <Text style={styles.secureText}>Paiement sécurisé · CinetPay</Text>
              </View>
            </>
          )}

          {/* ════════════ PHASE: PAYING / POLLING ════════════ */}
          {(phase === 'paying' || phase === 'polling') && (
            <View style={styles.phaseCenter}>
              <View style={styles.loadingRing}>
                <ActivityIndicator color={colors.primary} size="large" />
              </View>
              <Text style={styles.phaseTitle}>
                {phase === 'paying' ? 'Connexion au service...' : 'Vérification du paiement...'}
              </Text>
              <Text style={styles.phaseSub}>
                {phase === 'paying'
                  ? 'Ouverture de la page de paiement CinetPay'
                  : 'Retour sur la page, veuillez patienter'}
              </Text>
            </View>
          )}

          {/* ════════════ PHASE: ERROR ════════════ */}
          {phase === 'error' && (
            <View style={styles.phaseCenter}>
              <View style={[styles.phaseIconWrap, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="wifi-outline" size={32} color={colors.danger} />
              </View>
              <Text style={styles.phaseTitle}>
                {isNetErr ? 'Service inaccessible' : 'Paiement échoué'}
              </Text>
              <Text style={styles.phaseSub}>
                {isNetErr
                  ? 'CinetPay est temporairement indisponible depuis le serveur.'
                  : errorMsg}
              </Text>

              <View style={styles.errorBtns}>
                <TouchableOpacity style={styles.retryBtn} onPress={() => setPhase('select')} activeOpacity={0.8}>
                  <Ionicons name="refresh-outline" size={16} color={colors.primary} />
                  <Text style={styles.retryBtnText}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ════════════ PHASE: DONE ════════════ */}
          {phase === 'done' && <SuccessPhase amount={amount} />}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ManualMoneyModal  —  semi-automatic Mobile Money: the payer uploads proof
   (photo/scan/file) + phone numbers + optional transaction id + the date the
   transfer happened, and submits it for admin validation. Replaces
   PaymentModal/FreePaymentModal in the UI — CinetPay code above stays fully
   intact, it's just no longer invoked from the screens.
   mode='fixed' pays a known amount (invoice balance, or a specific
   échéancier tranche via `fixedAmount`); mode='free' lets the payer pick a
   fee type and type in any amount (no pre-existing invoice needed).
   Phases: form | submitting | done | error
   ══════════════════════════════════════════════════════════════════════════ */

function todayParts() {
  const d = new Date();
  return {
    day:   String(d.getDate()).padStart(2, '0'),
    month: String(d.getMonth() + 1).padStart(2, '0'),
    year:  String(d.getFullYear()),
  };
}

function SectionHeading({ icon, children }) {
  return (
    <View style={styles.sectionHeadingRow}>
      <Ionicons name={icon} size={13} color={colors.textSecondary} />
      <Text style={styles.modalSectionTitle}>{children}</Text>
    </View>
  );
}

function FieldInput({ icon, style, ...inputProps }) {
  return (
    <View style={styles.fieldRow}>
      <Ionicons name={icon} size={16} color={colors.textTertiary} />
      <TextInput style={[styles.fieldInput, style]} placeholderTextColor={colors.textTertiary} {...inputProps} />
    </View>
  );
}

export function ManualMoneyModal({
  visible, mode = 'fixed', invoice, fixedAmount, studentId, label,
  onClose, onSuccess,
}) {
  const [phase,          setPhase]          = useState('form');
  const [errorMsg,       setErrorMsg]       = useState('');

  const [feeType,        setFeeType]        = useState('TUITION');
  const [freeAmountStr,  setFreeAmountStr]  = useState('');
  const [description,    setDescription]    = useState('');

  const [amountMode,       setAmountMode]       = useState('full'); // 'full' | 'partial' — fixed mode only
  const [partialAmountStr, setPartialAmountStr] = useState('');

  const [proof,          setProof]          = useState(null); // { uri, name, type }
  const [recipientPhone, setRecipientPhone] = useState('');
  const [payerPhone,     setPayerPhone]     = useState('');
  const [txRef,          setTxRef]          = useState('');
  const [date,           setDate]           = useState(todayParts());
  // Admin-configured official Mobile Money number (Settings > Finance on
  // the web admin) — when set, the recipient field below is locked to it
  // instead of letting the payer type an arbitrary number, so there's no
  // ambiguity about where the money is actually supposed to go.
  const [officialNumber, setOfficialNumber] = useState('');

  const invoiceBalance = invoice ? parseFloat(invoice.balance || 0) : 0;
  // Inscription is always paid in full, in one go — every other fixed-amount
  // payment (scolarité, échéancier tranche) lets the payer choose between
  // settling the whole remaining balance or a partial amount.
  const isRegistration = mode === 'fixed' && (invoice?.fee_type_codes || []).some((c) => REG_FEE_RE.test(c));

  useEffect(() => {
    if (visible) {
      setPhase('form');
      setErrorMsg('');
      setFeeType('TUITION');
      setFreeAmountStr('');
      setDescription('');
      setProof(null);
      setRecipientPhone('');
      setPayerPhone('');
      setTxRef('');
      setDate(todayParts());
      setOfficialNumber('');
      financeService.getPublicConfigs()
        .then((configs) => {
          const method = (configs || []).find((c) => c.key === 'default_payment_method')?.value;
          const number = (configs || []).find((c) => c.key === 'mobile_money_number')?.value;
          if (method === 'Mobile Money' && number) {
            setOfficialNumber(number);
            setRecipientPhone(number);
          }
        })
        .catch(() => {});
      // A tranche's amount is usually less than the full remaining balance —
      // default to "partial" pre-filled with it, but still let the payer
      // switch to "solde total" or type a different amount.
      const bal = invoice ? parseFloat(invoice.balance || 0) : 0;
      const suggestPartial = fixedAmount != null && fixedAmount < bal;
      setAmountMode(suggestPartial ? 'partial' : 'full');
      setPartialAmountStr(suggestPartial ? String(Math.round(fixedAmount)) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, invoice?.id, studentId, fixedAmount]);

  const partialAmt = (() => {
    const v = parseFloat(partialAmountStr.replace(/[\s,]/g, ''));
    return isNaN(v) ? 0 : v;
  })();
  const fixedAmt = isRegistration ? invoiceBalance : (amountMode === 'full' ? invoiceBalance : partialAmt);
  const freeAmt = (() => {
    const v = parseFloat(freeAmountStr.replace(/[\s,]/g, ''));
    return isNaN(v) ? 0 : v;
  })();
  const amount = mode === 'free' ? freeAmt : fixedAmt;

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets?.[0]) {
      const a = res.assets[0];
      setProof({ uri: a.uri, name: a.fileName || `preuve-${Date.now()}.jpg`, type: a.mimeType || 'image/jpeg' });
    }
  };

  const pickFromFiles = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (!res.canceled && res.assets?.[0]) {
      const a = res.assets[0];
      setProof({ uri: a.uri, name: a.name || `preuve-${Date.now()}`, type: a.mimeType || 'application/octet-stream' });
    }
  };

  const dateFilled = date.day.length === 2 && date.month.length === 2 && date.year.length === 4;
  const dateValid = () => {
    const d = parseInt(date.day, 10), m = parseInt(date.month, 10), y = parseInt(date.year, 10);
    if (!d || !m || !y || y < 2000) return false;
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return false;
    const today = new Date(); today.setHours(23, 59, 59, 999);
    return dt <= today;
  };

  const amountUpperBound = (mode === 'fixed' && invoice) ? invoiceBalance + 1 : Infinity;
  const isValid =
    !!proof && recipientPhone.trim().length >= 8 && payerPhone.trim().length >= 8 &&
    dateValid() && amount >= 100 && amount <= amountUpperBound && (mode !== 'free' || !!studentId);

  const handleSubmit = async () => {
    if (!isValid) return;
    setPhase('submitting');
    try {
      const fd = new FormData();
      if (mode === 'fixed' && invoice) {
        fd.append('invoice_id', invoice.id);
        fd.append('amount', String(Math.round(amount)));
      } else {
        fd.append('student_id', studentId);
        fd.append('amount', String(Math.round(amount)));
        fd.append('fee_type_code', feeType);
        if (description.trim()) fd.append('description', description.trim());
      }
      fd.append('payer_phone', payerPhone.trim());
      fd.append('recipient_phone', recipientPhone.trim());
      if (txRef.trim()) fd.append('transaction_reference', txRef.trim());
      fd.append('declared_payment_date', `${date.year}-${date.month}-${date.day}`);
      fd.append('proof', { uri: proof.uri, name: proof.name, type: proof.type });

      await financeService.submitManualMobileMoney(fd);
      setPhase('done');
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message || 'Une erreur est survenue.';
      setErrorMsg(detail);
      setPhase('error');
    }
  };

  const canClose = phase === 'form' || phase === 'error';
  if (mode === 'fixed' && !invoice) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={canClose ? onClose : undefined}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBg} onPress={canClose ? onClose : undefined} activeOpacity={1} />

        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <LinearGradient colors={['#ECFDF5', '#F0FDFA']} style={styles.modalIconWrap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Ionicons name="phone-portrait-outline" size={22} color={colors.success} />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Paiement Mobile Money</Text>
              <Text style={styles.modalSub}>{label || invoice?.invoice_number || 'Soumettre une preuve de paiement'}</Text>
            </View>
            {canClose && (
              <TouchableOpacity onPress={onClose} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {phase === 'form' && (
            <View style={styles.amountBanner}>
              <Text style={styles.amountBannerLabel}>Montant à régler</Text>
              <Text style={styles.amountBannerValue}>{fmt(amount)}</Text>
            </View>
          )}

          {/* ════════════ PHASE: FORM ════════════ */}
          {phase === 'form' && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.manualScroll}
              contentContainerStyle={{ gap: 12, paddingTop: 12, paddingBottom: 4 }}
            >
              {mode === 'free' ? (
                <View style={styles.fieldGroup}>
                  <SectionHeading icon="pricetag-outline">Type de frais</SectionHeading>
                  <View style={styles.trancheGrid}>
                    {FEE_TYPES.map((t) => {
                      const active = feeType === t.code;
                      return (
                        <TouchableOpacity
                          key={t.code}
                          style={[styles.trancheChip, { width: '30%' }, active && styles.trancheChipActive]}
                          onPress={() => setFeeType(t.code)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.trancheLabel, active && styles.trancheLabelActive]}>{t.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <SectionHeading icon="cash-outline">Montant</SectionHeading>
                  <View style={styles.customInputRow}>
                    <TextInput
                      style={styles.customInput}
                      placeholder="Ex : 50 000"
                      keyboardType="numeric"
                      value={freeAmountStr}
                      onChangeText={setFreeAmountStr}
                      placeholderTextColor={colors.textTertiary}
                    />
                    <Text style={styles.customCurrency}>F CFA</Text>
                  </View>

                  {feeType === 'OTHER' && (
                    <View style={styles.customInputRow}>
                      <TextInput
                        style={styles.customInput}
                        placeholder="Ex : Frais de photocopie"
                        value={description}
                        onChangeText={setDescription}
                        placeholderTextColor={colors.textTertiary}
                      />
                    </View>
                  )}
                </View>
              ) : isRegistration ? (
                <View style={styles.fullPayLockBox}>
                  <Ionicons name="lock-closed" size={16} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fullPayLockTitle}>Montant à payer : {fmt(amount)}</Text>
                    <Text style={styles.fullPayLockSub}>
                      L'inscription se paie intégralement, en un seul versement.
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.fieldGroup}>
                  <SectionHeading icon="wallet-outline">Montant à régler</SectionHeading>
                  <View style={styles.trancheGrid}>
                    <TouchableOpacity
                      style={[styles.trancheChip, { width: '47%' }, amountMode === 'full' && styles.trancheChipActive]}
                      onPress={() => setAmountMode('full')}
                      activeOpacity={0.85}
                    >
                      {amountMode === 'full' && (
                        <View style={styles.trancheCheck}><Ionicons name="checkmark" size={10} color="#fff" /></View>
                      )}
                      <Text style={[styles.trancheLabel, amountMode === 'full' && styles.trancheLabelActive]}>Solde total</Text>
                      <Text style={[styles.trancheAmount, amountMode === 'full' && styles.trancheAmountActive]}>{fmt(invoiceBalance)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.trancheChip, { width: '47%' }, amountMode === 'partial' && styles.trancheChipActive]}
                      onPress={() => setAmountMode('partial')}
                      activeOpacity={0.85}
                    >
                      {amountMode === 'partial' && (
                        <View style={styles.trancheCheck}><Ionicons name="checkmark" size={10} color="#fff" /></View>
                      )}
                      <Text style={[styles.trancheLabel, amountMode === 'partial' && styles.trancheLabelActive]}>Paiement partiel</Text>
                      <Text style={[styles.trancheSub, amountMode === 'partial' && { color: 'rgba(255,255,255,0.75)' }]}>Montant libre</Text>
                    </TouchableOpacity>
                  </View>
                  {amountMode === 'partial' && (
                    <View style={styles.customInputRow}>
                      <TextInput
                        style={styles.customInput}
                        placeholder="Ex : 150 000"
                        keyboardType="numeric"
                        value={partialAmountStr}
                        onChangeText={setPartialAmountStr}
                        placeholderTextColor={colors.textTertiary}
                        autoFocus
                      />
                      <Text style={styles.customCurrency}>F CFA</Text>
                    </View>
                  )}
                  {amountMode === 'partial' && partialAmt > invoiceBalance && (
                    <Text style={styles.dateError}>Le montant dépasse le solde restant ({fmt(invoiceBalance)})</Text>
                  )}
                </View>
              )}

              <View style={styles.fieldGroup}>
                <SectionHeading icon="camera-outline">Preuve de paiement</SectionHeading>
                <View style={styles.proofRow}>
                  <TouchableOpacity style={styles.proofCard} onPress={pickFromCamera} activeOpacity={0.85}>
                    <View style={styles.proofCardIcon}>
                      <Ionicons name="camera" size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.proofCardTitle}>Scanner</Text>
                    <Text style={styles.proofCardSub}>Prendre une photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.proofCard} onPress={pickFromFiles} activeOpacity={0.85}>
                    <View style={styles.proofCardIcon}>
                      <Ionicons name="document-attach" size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.proofCardTitle}>Fichier</Text>
                    <Text style={styles.proofCardSub}>Image ou PDF</Text>
                  </TouchableOpacity>
                </View>
                {proof && (
                  <View style={styles.proofPreview}>
                    {proof.type?.startsWith('image/') ? (
                      <Image source={{ uri: proof.uri }} style={styles.proofThumb} />
                    ) : (
                      <View style={styles.proofThumbFile}>
                        <Ionicons name="document-text" size={18} color={colors.success} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.proofName} numberOfLines={1}>{proof.name}</Text>
                      <Text style={styles.proofReady}>Prêt à être envoyé</Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  </View>
                )}
              </View>

              <View style={styles.fieldGroup}>
                <SectionHeading icon="swap-horizontal-outline">Informations du transfert</SectionHeading>
                <FieldInput
                  icon="arrow-down-circle-outline"
                  placeholder="Numéro destinataire (a reçu le paiement)"
                  keyboardType="phone-pad"
                  value={recipientPhone}
                  onChangeText={officialNumber ? undefined : setRecipientPhone}
                  editable={!officialNumber}
                  style={officialNumber ? styles.fieldInputReadOnly : undefined}
                />
                <FieldInput
                  icon="arrow-up-circle-outline"
                  placeholder="Numéro payeur (a effectué le paiement)"
                  keyboardType="phone-pad"
                  value={payerPhone}
                  onChangeText={setPayerPhone}
                />
                <FieldInput
                  icon="key-outline"
                  placeholder="ID de transaction (optionnel)"
                  value={txRef}
                  onChangeText={setTxRef}
                />
              </View>

              <View style={styles.fieldGroup}>
                <SectionHeading icon="calendar-outline">Date du paiement</SectionHeading>
                <View style={styles.dateRow}>
                  <TextInput
                    style={styles.dateInput} placeholder="JJ" keyboardType="number-pad" maxLength={2}
                    value={date.day} onChangeText={(v) => setDate((d) => ({ ...d, day: v.replace(/\D/g, '') }))}
                    placeholderTextColor={colors.textTertiary}
                  />
                  <Text style={styles.dateSep}>/</Text>
                  <TextInput
                    style={styles.dateInput} placeholder="MM" keyboardType="number-pad" maxLength={2}
                    value={date.month} onChangeText={(v) => setDate((d) => ({ ...d, month: v.replace(/\D/g, '') }))}
                    placeholderTextColor={colors.textTertiary}
                  />
                  <Text style={styles.dateSep}>/</Text>
                  <TextInput
                    style={[styles.dateInput, { width: 62 }]} placeholder="AAAA" keyboardType="number-pad" maxLength={4}
                    value={date.year} onChangeText={(v) => setDate((d) => ({ ...d, year: v.replace(/\D/g, '') }))}
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
                {dateFilled && !dateValid() && (
                  <Text style={styles.dateError}>Date invalide ou dans le futur</Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.modalPayBtn, !isValid && styles.modalPayBtnDisabled, { marginTop: 4, marginBottom: 28 }]}
                disabled={!isValid}
                onPress={handleSubmit}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={isValid ? ['#059669', '#10B981'] : ['#D1D5DB', '#9CA3AF']}
                  style={styles.modalPayBtnGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                  <Text style={styles.modalPayBtnText}>Soumettre à l'administration</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ════════════ PHASE: SUBMITTING ════════════ */}
          {phase === 'submitting' && (
            <View style={styles.phaseCenter}>
              <View style={styles.loadingRing}>
                <ActivityIndicator color={colors.primary} size="large" />
              </View>
              <Text style={styles.phaseTitle}>Envoi en cours...</Text>
              <Text style={styles.phaseSub}>Transmission de votre preuve de paiement</Text>
            </View>
          )}

          {/* ════════════ PHASE: ERROR ════════════ */}
          {phase === 'error' && (
            <View style={styles.phaseCenter}>
              <View style={[styles.phaseIconWrap, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
              </View>
              <Text style={styles.phaseTitle}>Échec de l'envoi</Text>
              <Text style={styles.phaseSub}>{errorMsg}</Text>
              <View style={styles.errorBtns}>
                <TouchableOpacity style={styles.retryBtn} onPress={() => setPhase('form')} activeOpacity={0.8}>
                  <Ionicons name="refresh-outline" size={16} color={colors.primary} />
                  <Text style={styles.retryBtnText}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ════════════ PHASE: DONE ════════════ */}
          {phase === 'done' && (
            <View style={styles.phaseCenter}>
              <LinearGradient colors={['#059669', '#10B981']} style={styles.phaseIconWrap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="checkmark" size={36} color="#fff" />
              </LinearGradient>
              <Text style={[styles.phaseTitle, { color: colors.success }]}>Paiement soumis</Text>
              <Text style={styles.successAmount}>{fmt(amount)}</Text>
              <Text style={styles.phaseSub}>
                Votre preuve de paiement a été transmise à l'administration.{'\n'}
                Votre réintégration / scolarité sera effective après validation par l'administration.
              </Text>
              <TouchableOpacity
                style={[styles.modalPayBtn, { marginTop: 8, width: '100%' }]}
                onPress={() => onSuccess?.()}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#059669', '#10B981']} style={styles.modalPayBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.modalPayBtnText}>Fermer</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ─── small components ──────────────────────────────────────────────────── */

function Chip({ label, value, bg, color }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipValue, { color }]}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Styles
   ══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  // fees breakdown grid (FinStat)
  finStat:      { flex: 1, alignItems: 'center', gap: 2 },
  finStatLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5 },
  finStatValue: { fontSize: 17, fontWeight: '800', color: '#fff' },
  finStatUnit:  { fontSize: 9, color: 'rgba(255,255,255,0.45)' },

  progressCard:       { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  progressHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTitle:      { fontSize: 15, fontWeight: '700', color: colors.text },
  progressPct:        { fontSize: 22, fontWeight: '800' },
  progressBar:        { height: 10, backgroundColor: colors.divider, borderRadius: 5, overflow: 'hidden' },
  progressFill:       { height: '100%', borderRadius: 5 },
  progressBarSlim:    { height: 6, backgroundColor: colors.divider, borderRadius: 3, overflow: 'hidden' },
  progressFillSlim:   { height: '100%', borderRadius: 3 },
  progressLegend:     { flexDirection: 'row', justifyContent: 'space-between' },
  progressLegendText: { fontSize: 12, color: colors.textSecondary },

  prepareBanner:      { borderRadius: radius.lg, overflow: 'hidden', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  prepareBannerInner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md },
  prepareBannerText:  { fontSize: 14, fontWeight: '700', color: '#fff' },
  prepareBannerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  feeCard:        { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  feeCardPaid:    { borderLeftWidth: 4, borderLeftColor: colors.success },
  feeCardPending: { borderLeftWidth: 4, borderLeftColor: colors.warning },
  feeCardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  feeIcon:        { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  feeLabel:       { fontSize: 14, fontWeight: '700', color: colors.text },
  feeStatus:      { fontSize: 12, fontWeight: '600', marginTop: 2 },
  feeAmount:      { fontSize: 16, fontWeight: '800', color: colors.text },
  feePaidRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feePaidLabel:   { fontSize: 13, color: colors.textSecondary },
  feePaidValue:   { fontSize: 14, fontWeight: '700' },

  payBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 13, marginTop: 4 },
  payBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  freePayBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 2, borderColor: colors.primary, borderStyle: 'dashed', borderRadius: radius.md, paddingVertical: 12, backgroundColor: '#fff' },
  freePayBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },

  sectionBlock: { gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },

  miniCard:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: radius.md, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  miniIconWrap:{ width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  miniTitle:   { fontSize: 13, fontWeight: '600', color: colors.text },
  miniSub:     { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  miniAmount:  { fontSize: 13, fontWeight: '700', color: colors.success },

  /* échéancier */
  installmentCard:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: radius.md, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  installmentLabel:     { fontSize: 13, fontWeight: '700', color: colors.text },
  installmentDue:       { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  installmentAmount:    { fontSize: 14, fontWeight: '800', color: colors.text },
  installmentBadge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  installmentBadgeText: { fontSize: 10, fontWeight: '700' },
  installmentPayBtn:    { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },

  /* manual mobile money modal */
  manualScroll:  { maxHeight: 480 },

  amountBanner:      { backgroundColor: '#F0FDF4', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#D1FAE5' },
  amountBannerLabel: { fontSize: 12, fontWeight: '700', color: colors.success },
  amountBannerValue: { fontSize: 20, fontWeight: '900', color: colors.success, letterSpacing: -0.3 },

  fieldGroup:        { backgroundColor: '#FAFBFC', borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  fieldRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#fff' },
  fieldInput: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, paddingVertical: 13 },
  fieldInputReadOnly: { color: colors.textSecondary },

  proofRow:       { flexDirection: 'row', gap: 10 },
  proofCard:      { flex: 1, alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed', borderRadius: 16, paddingVertical: 16, backgroundColor: '#fff' },
  proofCardIcon:  { width: 38, height: 38, borderRadius: 12, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  proofCardTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  proofCardSub:   { fontSize: 10.5, color: colors.textSecondary },
  proofPreview:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F0FDF4', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#D1FAE5' },
  proofThumb:     { width: 36, height: 36, borderRadius: 8 },
  proofThumbFile: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  proofName:      { fontSize: 12.5, color: colors.text, fontWeight: '700' },
  proofReady:     { fontSize: 10.5, color: colors.success, marginTop: 1 },

  dateRow:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateInput:     { width: 50, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 11, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.text, backgroundColor: '#fff' },
  dateSep:       { fontSize: 16, fontWeight: '700', color: colors.textSecondary },
  dateError:     { fontSize: 11, color: colors.danger, marginTop: -2 },

  /* ── modal ── */
  overlay:   { flex: 1, justifyContent: 'flex-end' },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },

  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 36 : 28,
    gap: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 20,
  },
  modalHandle:  { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalIconWrap:{ width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalTitle:   { fontSize: 17, fontWeight: '800', color: colors.text },
  modalSub:     { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  modalClose:   { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },

  chipRow:      { flexDirection: 'row', gap: 8 },
  chip:         { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center', gap: 2 },
  chipValue:    { fontSize: 13, fontWeight: '800' },
  chipLabel:    { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },

  modalProgressBar:   { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  modalProgressFill:  { height: '100%', borderRadius: 4 },
  modalProgressLabel: { fontSize: 11, color: colors.textSecondary, textAlign: 'right', marginTop: 3 },

  modalSectionTitle: { fontSize: 12, fontWeight: '800', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5 },

  fullPayLockBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 16,
    backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#E0E7FF',
  },
  fullPayLockTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  fullPayLockSub:   { fontSize: 11.5, color: colors.textSecondary, marginTop: 2 },

  trancheGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  trancheChip: {
    width: '47%', borderRadius: 16, padding: 14,
    borderWidth: 2, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA',
    gap: 4, position: 'relative',
  },
  trancheChipActive:  { borderColor: colors.primary, backgroundColor: colors.primary },
  trancheCheck:       { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  trancheLabel:       { fontSize: 13, fontWeight: '700', color: colors.text },
  trancheLabelActive: { color: '#fff' },
  trancheAmount:      { fontSize: 15, fontWeight: '800', color: colors.primary },
  trancheAmountActive:{ color: '#fff' },
  trancheSub:         { fontSize: 11, color: colors.textSecondary },

  customInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: colors.primary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 2, gap: 8 },
  customInput:    { flex: 1, fontSize: 20, fontWeight: '700', color: colors.text, paddingVertical: 10 },
  customCurrency: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },

  modalPayBtn:        { borderRadius: 16, overflow: 'hidden' },
  modalPayBtnDisabled:{ opacity: 0.6 },
  modalPayBtnGrad:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  modalPayBtnText:    { fontSize: 16, fontWeight: '800', color: '#fff' },

  secureRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  secureText: { fontSize: 11, color: colors.textTertiary },

  /* phase screens */
  phaseCenter:  { paddingVertical: 16, alignItems: 'center', gap: 12 },
  phaseIconWrap:{ width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  loadingRing:  { width: 72, height: 72, borderRadius: 36, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  phaseTitle:   { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  phaseSub:     { fontSize: 13, color: colors.textSecondary, textAlign: 'center', maxWidth: 280 },

  successBadgeWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  successRing:  { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: colors.success },
  successAmount:  { fontSize: 26, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
  successClosing: { fontSize: 11, color: colors.textTertiary, marginTop: -4 },

  errorBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  retryBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 2, borderColor: colors.primary, borderRadius: 14, paddingVertical: 13 },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  demoBtn:   { flex: 1, borderRadius: 14, overflow: 'hidden' },
  demoBtnGrad:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13 },
  demoBtnText:  { fontSize: 14, fontWeight: '700', color: '#fff' },

  demoTag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 4 },
  demoTagText: { fontSize: 11, fontWeight: '700', color: '#4F46E5' },
});
