import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal,
} from 'react-native';
import Alert from '../../../utils/appAlert';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCameraPermissions } from 'expo-camera';
import { elearningService } from '../../../services/elearning';
import PdfViewerModal from '../../../components/exam/PdfViewerModal';
import { colors, spacing, radius } from '../../../theme/colors';

const GREEN = '#059669';
const EXAM_COLORS = { MID: '#d97706', FINAL: '#ef4444', SUPP: '#7c3aed', TP: '#059669', CONCOURS: '#0ea5e9' };
const EXAM_LABELS = { MID: 'Partiel', FINAL: 'Examen final', SUPP: 'Rattrapage', TP: 'TP noté', CONCOURS: 'Concours' };

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Conditions/rules confirmation shown before actually starting a secure exam
// — ports the web's ExamSecurityModal (StudentExamsHub.jsx) content and
// scroll-to-unlock mechanic exactly: the "Continuer" button stays disabled
// until the student has actually scrolled through every section, not just
// tapped a single "I agree". Two adaptations for mobile: there's no browser
// "fullscreen" concept (a native app already occupies the whole screen), so
// that section's copy talks about leaving the app instead; and the web's
// separate webcam pre-flight (a second screen, IntroPage in ExamPage.jsx) is
// folded into this same modal as one more scrollable section, since mobile
// has no equivalent second step before SecureExamTakeScreen consumes the
// attempt.
function ExamConditionsModal({ visible, exam, tc, starting, onCancel, onConfirm }) {
  const needsWebcam = !!exam?.webcam_required;
  const [permission, requestPermission] = useCameraPermissions();
  const [checked, setChecked] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [containerH, setContainerH] = useState(0);
  const [contentH, setContentH] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setScrolledToEnd(false);
    if (!needsWebcam) return;
    setChecked(false);
    requestPermission().finally(() => setChecked(true));
    // Only re-run when the modal opens, not on every permission object change
    // (requestPermission's own resolution already updates `permission`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, needsWebcam]);

  // A short exam (few rules, no webcam) may already fit the viewport with
  // nothing to scroll — don't leave the button permanently disabled in that
  // case, mirroring the web's attachScroll callback-ref check.
  useEffect(() => {
    if (containerH && contentH && contentH <= containerH + 24) setScrolledToEnd(true);
  }, [containerH, contentH]);

  const onScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 24) setScrolledToEnd(true);
  };

  const webcamStatus = !needsWebcam ? 'not_required' : !checked ? 'checking' : permission?.granted ? 'ready' : 'failed';
  const canStart = scrolledToEnd && webcamStatus !== 'checking' && webcamStatus !== 'failed';

  const rules = [
    needsWebcam && 'Webcam requise pendant toute la durée de l\'examen',
    exam?.block_copy_paste && 'Copier-coller désactivé',
    exam?.max_tab_switches != null && `Changement d'application limité à ${exam.max_tab_switches} fois`,
  ].filter(Boolean);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View style={styles.condOverlay}>
        <View style={styles.condCard}>
          <View style={[styles.condHeader, { backgroundColor: tc }]}>
            <TouchableOpacity style={styles.condCloseBtn} onPress={onCancel}>
              <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
            <View style={styles.condIconWrap}>
              <Ionicons name="shield-outline" size={24} color="#fff" />
            </View>
            <Text style={styles.condTitle}>Avant de commencer : conditions de surveillance</Text>
            <Text style={styles.condSubtitle} numberOfLines={2}>Merci de lire attentivement — {exam?.title}</Text>
          </View>

          <ScrollView
            style={styles.condScroll}
            onScroll={onScroll}
            scrollEventThrottle={100}
            onLayout={(e) => setContainerH(e.nativeEvent.layout.height)}
            onContentSizeChange={(w, h) => setContentH(h)}
          >
            {rules.length > 0 && (
              <View style={[styles.condSection, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={styles.condSectionKicker}>Cet examen impose</Text>
                <View style={styles.condChipsRow}>
                  {rules.map((r, i) => (
                    <View key={i} style={styles.condChip}><Text style={styles.condChipText}>{r}</Text></View>
                  ))}
                </View>
              </View>
            )}

            <View style={[styles.condSection, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
              <View style={styles.condSectionHeader}>
                <View style={[styles.condSectionIconWrap, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="camera-outline" size={16} color="#2563EB" />
                </View>
                <Text style={[styles.condSectionTitle, { color: '#1E40AF' }]}>Une surveillance active pendant tout l'examen</Text>
              </View>
              <Text style={[styles.condSectionText, { color: '#1E3A8A' }]}>
                Votre webcam reste activée en continu. Le système analyse en temps réel votre visage et vos mouvements,
                et enregistre régulièrement des captures. Chaque capture est décrite précisément par une intelligence
                artificielle (ex : « l'étudiant tient un téléphone », « une deuxième personne est visible »).{' '}
                <Text style={{ fontWeight: '800' }}>Toutes ces captures et descriptions sont transmises à votre enseignant</Text>,
                qui les consultera lors de la correction de votre copie.
              </Text>
            </View>

            <View style={[styles.condSection, { backgroundColor: colors.dangerLight, borderColor: '#FECACA' }]}>
              <View style={styles.condSectionHeader}>
                <View style={[styles.condSectionIconWrap, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                </View>
                <Text style={[styles.condSectionTitle, { color: '#991B1B' }]}>Comportements interdits</Text>
              </View>
              {[
                { icon: 'eye-outline', text: 'Ne détournez pas le regard de votre écran — évitez de regarder à gauche, à droite, en haut ou en bas de façon prolongée.' },
                { icon: 'phone-portrait-outline', text: 'Ne tenez et ne montrez aucun téléphone, papier ou objet suspect devant la caméra.' },
                { icon: 'people-outline', text: 'Ne parlez à personne — vous devez rester seul(e) devant votre écran pendant toute la durée de l\'examen.' },
                { icon: 'camera-outline', text: 'Ne quittez pas le champ de la webcam (se retourner, sortir du cadre, s\'absenter).' },
              ].map((item, i) => (
                <View key={i} style={styles.condRuleRow}>
                  <Ionicons name={item.icon} size={16} color={colors.danger} style={{ marginTop: 1 }} />
                  <Text style={[styles.condSectionText, { color: '#7F1D1D' }]}>{item.text}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.condSection, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
              <View style={styles.condSectionHeader}>
                <View style={[styles.condSectionIconWrap, { backgroundColor: '#FFEDD5' }]}>
                  <Ionicons name="warning-outline" size={16} color="#C2410C" />
                </View>
                <Text style={[styles.condSectionTitle, { color: '#9A3412' }]}>Ne quittez pas l'application</Text>
              </View>
              <Text style={[styles.condSectionText, { color: '#7C2D12' }]}>
                La composition se déroule seul(e) dans l'application. <Text style={{ fontWeight: '800' }}>Dès la première fois</Text>{' '}
                que vous quittez l'application (app switcher, notification, autre appli), votre examen est{' '}
                <Text style={{ fontWeight: '800' }}>immédiatement suspendu pendant 5 minutes</Text> — voir ci-dessous.
              </Text>
            </View>

            <View style={[styles.condSection, { backgroundColor: colors.dangerLight, borderColor: '#FECACA' }]}>
              <View style={styles.condSectionHeader}>
                <View style={[styles.condSectionIconWrap, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="lock-closed-outline" size={16} color={colors.danger} />
                </View>
                <Text style={[styles.condSectionTitle, { color: '#991B1B' }]}>Que se passe-t-il en cas de comportement suspect ?</Text>
              </View>
              <Text style={[styles.condSectionText, { color: '#7F1D1D', marginBottom: 8 }]}>
                Quitter l'application déclenche une suspension dès la première fois. Les signaux détectés par la webcam
                (objet tenu près du visage, regard détourné de façon répétée, une autre personne dans le champ, absence
                prolongée) déclenchent une suspension s'ils se répètent <Text style={{ fontWeight: '800' }}>plusieurs fois</Text>.
                Dans les deux cas, votre examen est <Text style={{ fontWeight: '800' }}>automatiquement suspendu pendant 5 minutes</Text> :
                un écran de blocage affiche le motif exact avec un compte à rebours, et le chronomètre de votre examen est mis
                en pause pendant ce temps (les 5 minutes sont ensuite déduites de votre temps restant).
              </Text>
              <Text style={[styles.condSectionText, { color: '#7F1D1D' }]}>
                Si un nouveau comportement suspect est détecté après cette suspension,{' '}
                <Text style={{ fontWeight: '800' }}>l'examen est immédiatement terminé</Text> et vos réponses sont automatiquement
                soumises pour correction.
              </Text>
            </View>

            <View style={[styles.condSection, { backgroundColor: colors.successLight, borderColor: '#BBF7D0', flexDirection: 'row', gap: 10 }]}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} style={{ marginTop: 1 }} />
              <Text style={[styles.condSectionText, { color: '#065F46', flex: 1 }]}>
                Installez-vous dans un endroit calme, seul(e), avec un bon éclairage face à votre webcam, et gardez les yeux
                sur votre écran pendant toute l'épreuve. C'est tout ce qu'il vous faut pour que l'examen se déroule sans accroc.
              </Text>
            </View>

            {needsWebcam && (
              <View style={[
                styles.condWebcamBox,
                { backgroundColor: webcamStatus === 'ready' ? colors.successLight : webcamStatus === 'failed' ? colors.dangerLight : colors.background },
              ]}>
                {webcamStatus === 'ready'
                  ? <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  : webcamStatus === 'failed'
                  ? <Ionicons name="camera-outline" size={20} color={colors.danger} />
                  : <ActivityIndicator size="small" color={colors.textSecondary} />}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.condWebcamTitle, { color: webcamStatus === 'ready' ? colors.success : webcamStatus === 'failed' ? colors.danger : colors.text }]}>
                    {webcamStatus === 'ready' ? 'Webcam prête' : webcamStatus === 'failed' ? 'Webcam indisponible' : 'Vérification de la webcam…'}
                  </Text>
                  {webcamStatus === 'failed' && (
                    <Text style={styles.condWebcamSub}>Autorisez la caméra pour pouvoir démarrer cet examen.</Text>
                  )}
                </View>
                {webcamStatus === 'failed' && (
                  <TouchableOpacity
                    style={styles.condRetryBtn}
                    onPress={() => { setChecked(false); requestPermission().finally(() => setChecked(true)); }}
                  >
                    <Text style={styles.condRetryBtnText}>Réessayer</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>

          <View style={styles.condFooter}>
            {!scrolledToEnd && (
              <View style={styles.condScrollHint}>
                <Ionicons name="chevron-down-outline" size={14} color={colors.textTertiary} />
                <Text style={styles.condScrollHintText}>Faites défiler pour lire toutes les conditions</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.condStartBtn, { backgroundColor: canStart ? tc : '#CBD5E1' }]}
              onPress={onConfirm}
              disabled={!canStart || starting}
            >
              {starting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.condStartBtnText}>
                    {!scrolledToEnd ? 'Continuer (lisez les conditions ci-dessus)' : webcamStatus === 'failed' ? 'Résolvez le problème de webcam' : 'J\'ai compris, commencer'}
                  </Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ExamDetailScreen({ route, navigation }) {
  const { examId } = route.params;
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('detail');
  const [ranking, setRanking] = useState(null);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showConditions, setShowConditions] = useState(false);
  const [showPdf, setShowPdf] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await elearningService.getSecureExamById(examId);
      setExam(res);
    } catch (e) { console.log('Exam detail error:', e.message); }
    finally { setLoading(false); }
  }, [examId]);

  useEffect(() => { load(); }, [load]);

  const loadRanking = useCallback(async () => {
    setRankingLoading(true);
    try {
      const res = await elearningService.getExamRanking(examId);
      setRanking(res);
    } catch (e) { console.log('Ranking error:', e.message); }
    finally { setRankingLoading(false); }
  }, [examId]);

  useEffect(() => { if (tab === 'ranking' && !ranking) loadRanking(); }, [tab, ranking, loadRanking]);

  if (loading || !exam) {
    return <View style={styles.center}><ActivityIndicator color={GREEN} size="large" /></View>;
  }

  const tc = EXAM_COLORS[exam.exam_type] || '#6366f1';
  const isDone = ['SUBMITTED', 'FLAGGED'].includes(exam.my_session?.status);
  const session = exam.my_session;

  // Both quiz-based and PDF-based exams now run inside the monitored
  // SecureExamTakeScreen — a PDF-only exam used to be answered right here,
  // inline, with no anti-cheat armed at all (no webcam, no AppState
  // backgrounding check), which was the actual gap: a "surveilled" exam that
  // carried only a PDF subject was never actually surveilled.
  const startExam = async () => {
    if (starting) return;
    setStarting(true);
    try {
      setShowConditions(false);
      navigation.navigate('SecureExamTake', { examId: exam.id });
    } catch (e) {
      Alert.alert('Erreur', e?.response?.data?.detail || "Impossible de démarrer l'examen.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ExamConditionsModal
        visible={showConditions}
        exam={exam}
        tc={tc}
        starting={starting}
        onCancel={() => setShowConditions(false)}
        onConfirm={startExam}
      />

      <View style={[styles.header, { backgroundColor: tc }]}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{exam.title}</Text>
            <View style={{ width: 38 }} />
          </View>
        </SafeAreaView>
      </View>

      <View style={styles.tabsRow}>
        {[['detail', 'Détails'], ['answer', 'Passer l\'examen'], ['ranking', 'Classement']].map(([k, l]) => (
          <TouchableOpacity key={k} style={[styles.tab, tab === k && { backgroundColor: tc }]} onPress={() => setTab(k)}>
            <Text style={[styles.tabText, tab === k && { color: '#fff' }]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'detail' && (
          <>
            <View style={styles.card}>
              <View style={[styles.typeBadge, { backgroundColor: tc + '20' }]}>
                <Text style={[styles.typeBadgeText, { color: tc }]}>{EXAM_LABELS[exam.exam_type] || exam.exam_type}</Text>
              </View>
              {!!exam.description && <Text style={styles.desc}>{exam.description}</Text>}
              <View style={styles.metaGrid}>
                {!!exam.subject_name && (
                  <View style={styles.metaItem}><Text style={styles.metaLabel}>Matière</Text><Text style={styles.metaValue}>{exam.subject_name}</Text></View>
                )}
                <View style={styles.metaItem}><Text style={styles.metaLabel}>Durée</Text><Text style={styles.metaValue}>{exam.duration_minutes} min</Text></View>
                {!!exam.start_date && (
                  <View style={styles.metaItem}><Text style={styles.metaLabel}>Début</Text><Text style={styles.metaValue}>{fmt(exam.start_date)}</Text></View>
                )}
                <View style={styles.metaItem}><Text style={styles.metaLabel}>Seuil</Text><Text style={styles.metaValue}>{exam.pass_score_percent}%</Text></View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Paramètres de sécurité</Text>
              <View style={{ gap: 8 }}>
                {exam.fullscreen_required && <SecurityRow icon="expand-outline" label="Plein écran requis" />}
                {exam.block_copy_paste && <SecurityRow icon="lock-closed-outline" label="Copier-coller bloqué" />}
                {exam.webcam_required && <SecurityRow icon="camera-outline" label="Photo webcam requise au démarrage" />}
                {!!exam.max_tab_switches && <SecurityRow icon="swap-horizontal-outline" label={`Max ${exam.max_tab_switches} changement(s) d'application`} />}
              </View>
            </View>

            {!!exam.exam_pdf && (
              <TouchableOpacity style={styles.pdfCard} onPress={() => setShowPdf(true)}>
                <View style={styles.pdfIcon}><Ionicons name="document-text-outline" size={20} color="#7C3AED" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pdfTitle}>Sujet de l'examen</Text>
                  <Text style={styles.pdfSub}>Fichier PDF</Text>
                </View>
                <Ionicons name="eye-outline" size={18} color="#7C3AED" />
              </TouchableOpacity>
            )}
            <PdfViewerModal visible={showPdf} url={exam.exam_pdf} onClose={() => setShowPdf(false)} />

            {isDone && session?.score != null && (
              <View style={[styles.card, { backgroundColor: colors.successLight }]}>
                <Text style={styles.gradeLabel}>Votre note</Text>
                <Text style={styles.gradeScore}>{session.score}/{exam.max_score}</Text>
                {!!session.feedback && <Text style={styles.desc}>{session.feedback}</Text>}
              </View>
            )}
          </>
        )}

        {tab === 'answer' && (
          <View style={styles.card}>
            {isDone ? (
              <View style={styles.lockedBox}>
                <Ionicons name="lock-closed" size={32} color={colors.danger} />
                <Text style={styles.lockedTitle}>Nombre maximum de tentatives atteint</Text>
                <Text style={styles.lockedSub}>Vous avez utilisé toutes vos tentatives pour cet examen.</Text>
              </View>
            ) : !exam.is_available ? (
              <View style={styles.lockedBox}>
                <Ionicons name="time-outline" size={32} color={colors.textTertiary} />
                <Text style={styles.lockedTitle}>Examen non disponible</Text>
                <Text style={styles.lockedSub}>Cet examen n'est pas encore ouvert ou est déjà terminé.</Text>
              </View>
            ) : exam.quiz || exam.exam_pdf ? (
              <View style={{ alignItems: 'center', gap: 10 }}>
                <View style={styles.startIconWrap}>
                  <Ionicons name={exam.quiz ? 'ribbon-outline' : 'document-text-outline'} size={30} color={tc} />
                </View>
                <Text style={styles.startTitle}>{exam.quiz ? 'Examen en ligne' : 'Examen à rendre'}</Text>
                <Text style={styles.startSub}>
                  {exam.duration_minutes} minutes
                  {exam.quiz && exam.exam_pdf ? ' · + réponse au sujet PDF' : !exam.quiz ? ' · sujet PDF' : ''}
                </Text>
                {exam.webcam_required && (
                  <View style={styles.webcamTip}>
                    <Ionicons name="phone-portrait-outline" size={18} color="#B45309" />
                    <Text style={styles.webcamTipText}>
                      Inclinez votre téléphone contre un support (livre, étui...) au lieu de le poser à plat —
                      la caméra doit voir votre visage tout au long de l'examen.
                    </Text>
                  </View>
                )}
                <TouchableOpacity style={[styles.startBtn, { backgroundColor: tc }]} onPress={() => setShowConditions(true)} disabled={starting}>
                  {starting ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="play" size={16} color="#fff" />}
                  <Text style={styles.startBtnText}>Commencer l'examen</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text style={styles.lockedSub}>Format d'examen non configuré. Contactez votre enseignant.</Text>
              </View>
            )}
          </View>
        )}

        {tab === 'ranking' && (
          <View style={styles.card}>
            {rankingLoading ? (
              <ActivityIndicator color={GREEN} />
            ) : !ranking?.results?.length ? (
              <Text style={styles.emptyRanking}>Aucun résultat disponible pour le moment.</Text>
            ) : (
              <>
                <View style={styles.rankHeaderRow}>
                  <Text style={[styles.rankHeaderCell, { flex: 0.5 }]}>Rang</Text>
                  <Text style={[styles.rankHeaderCell, { flex: 2 }]}>Étudiant</Text>
                  <Text style={styles.rankHeaderCell}>Mention</Text>
                </View>
                {ranking.results.map((r) => (
                  <View key={r.rank} style={[styles.rankRow, r.is_me && { backgroundColor: '#FCE7F3' }]}>
                    <Text style={[styles.rankCell, { flex: 0.5, fontWeight: '800' }]}>
                      {r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}
                    </Text>
                    <Text style={[styles.rankCell, { flex: 2, fontWeight: r.is_me ? '800' : '600' }]}>
                      {r.full_name}{r.is_me ? ' (vous)' : ''}
                    </Text>
                    <Text style={[styles.rankCell, { color: tc, fontWeight: '700' }]}>{r.mention}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SecurityRow({ icon, label }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Ionicons name={icon} size={16} color="#B45309" />
      <Text style={{ fontSize: 12, fontWeight: '600', color: '#92400E', flex: 1 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#fff', textAlign: 'center' },

  tabsRow: { flexDirection: 'row', gap: 8, padding: spacing.md, backgroundColor: '#fff' },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.background, alignItems: 'center' },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },

  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },

  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  typeBadgeText: { fontSize: 11, fontWeight: '800' },
  desc: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  metaItem: { minWidth: '40%' },
  metaLabel: { fontSize: 11, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase' },
  metaValue: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.text },

  pdfCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FAF5FF', borderWidth: 1.5, borderColor: '#EDE9FE', borderStyle: 'dashed', borderRadius: radius.lg, padding: spacing.md },
  pdfIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center' },
  pdfTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  pdfSub: { fontSize: 11, color: '#9F7AEA', marginTop: 1 },

  gradeLabel: { fontSize: 11, fontWeight: '700', color: colors.success, textTransform: 'uppercase' },
  gradeScore: { fontSize: 28, fontWeight: '900', color: colors.success },

  lockedBox: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  lockedTitle: { fontSize: 14, fontWeight: '800', color: colors.text, textAlign: 'center' },
  lockedSub: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },

  startIconWrap: { width: 60, height: 60, borderRadius: 20, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  startTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  startSub: { fontSize: 12, color: colors.textSecondary },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 24, borderRadius: radius.lg, marginTop: 4 },
  startBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  webcamTip: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.warningLight, borderWidth: 1.5, borderColor: '#FDE68A', borderRadius: radius.md, padding: 12, marginTop: 4 },
  webcamTipText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#92400E', lineHeight: 17 },

  emptyRanking: { fontSize: 13, color: colors.textTertiary, textAlign: 'center', paddingVertical: 20 },
  rankHeaderRow: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  rankHeaderCell: { flex: 1, fontSize: 11, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase' },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider, borderRadius: radius.sm },
  rankCell: { flex: 1, fontSize: 13, color: colors.text },

  condOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.72)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  condCard: { backgroundColor: '#fff', borderRadius: radius.xl, overflow: 'hidden', maxWidth: 440, width: '100%', maxHeight: '90%' },
  condHeader: { alignItems: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, gap: 6 },
  condCloseBtn: { position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  condIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  condTitle: { fontSize: 16, fontWeight: '900', color: '#fff', textAlign: 'center' },
  condSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 2 },

  condScroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  condSection: { borderWidth: 1.5, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, gap: 8 },
  condSectionKicker: { fontSize: 10, fontWeight: '800', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 },
  condChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  condChip: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  condChipText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  condSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  condSectionIconWrap: { width: 30, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  condSectionTitle: { flex: 1, fontSize: 13, fontWeight: '800' },
  condSectionText: { fontSize: 12, lineHeight: 18 },
  condRuleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },

  condWebcamBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  condWebcamTitle: { fontSize: 13, fontWeight: '800' },
  condWebcamSub: { fontSize: 11, color: colors.danger, marginTop: 2 },
  condRetryBtn: { backgroundColor: colors.dangerLight, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md },
  condRetryBtnText: { fontSize: 11, fontWeight: '800', color: colors.danger },

  condFooter: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  condScrollHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 },
  condScrollHintText: { fontSize: 11, fontWeight: '600', color: colors.textTertiary },
  condStartBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.lg },
  condStartBtnText: { fontSize: 13, fontWeight: '800', color: '#fff', textAlign: 'center' },
});
