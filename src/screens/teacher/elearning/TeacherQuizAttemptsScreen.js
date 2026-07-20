import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, StatusBar,
} from 'react-native';
import Alert from '../../../utils/appAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyState from '../../../components/common/EmptyState';
import QuestionGradeRow from '../../../components/teacher/QuestionGradeRow';
import TotalBadge from '../../../components/teacher/TotalBadge';
import elearningService from '../../../services/elearning';
import asArray from '../../../utils/asArray';
import { colors, spacing, radius } from '../../../theme/colors';

const ACCENT = '#7C3AED';
const GRADIENT = ['#4C1D95', '#6D28D9', '#8B5CF6'];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function AttemptRow({ attempt, questions, onGraded }) {
  const [open, setOpen] = useState(false);
  const [manualPts, setManualPts] = useState({});
  const [saving, setSaving] = useState(false);

  const answerMap = useMemo(() => {
    const m = {};
    (attempt.answers || []).forEach((a) => { m[a.question] = a; });
    return m;
  }, [attempt.answers]);

  const rows = useMemo(() => questions.map((q) => {
    const ans = answerMap[q.id];
    const maxPts = parseFloat(q.points) || 1;
    if (!ans) return { q, ans: null, earned: 0, maxPts, status: 'missing' };
    if (q.question_type === 'TEXT') {
      const pending = manualPts[ans.id];
      const existing = ans.points_earned;
      const earned = pending !== undefined ? (parseFloat(pending) || 0) : existing;
      return { q, ans, earned, maxPts, status: earned == null ? 'pending' : 'manual' };
    }
    const earned = ans.points_earned ?? (ans.is_correct ? maxPts : 0);
    return { q, ans, earned, maxPts, status: ans.is_correct === true ? 'correct' : ans.is_correct === false ? 'incorrect' : 'pending' };
  }), [questions, answerMap, manualPts]);

  const totalMax = rows.reduce((s, r) => s + r.maxPts, 0);
  const totalEarned = rows.reduce((s, r) => s + (r.earned ?? 0), 0);
  const pendingCount = rows.filter((r) => r.status === 'pending').length;
  const hasPendingManual = Object.keys(manualPts).length > 0;
  const scorePct = attempt.score != null ? Math.round(attempt.score) : null;

  const saveGrades = async () => {
    const entries = Object.entries(manualPts).filter(([, v]) => v !== '');
    if (!entries.length) return;
    setSaving(true);
    try {
      await Promise.all(entries.map(([answerId, val]) =>
        elearningService.gradeQuizAttemptText(attempt.id, {
          answer_id: Number(answerId),
          is_correct: (parseFloat(val) || 0) > 0,
          points_earned: parseFloat(val) || 0,
        })
      ));
      setManualPts({});
      onGraded();
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de corriger ces réponses.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.top} onPress={() => setOpen((v) => !v)} activeOpacity={0.75}>
        <View style={[styles.icon, { backgroundColor: scorePct == null ? colors.divider : attempt.is_passed ? colors.successLight : colors.dangerLight }]}>
          <Ionicons
            name={scorePct == null ? 'time-outline' : attempt.is_passed ? 'trophy' : 'close'}
            size={16}
            color={scorePct == null ? colors.textTertiary : attempt.is_passed ? colors.success : colors.danger}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>{attempt.student_name || `Étudiant #${attempt.student}`}</Text>
          <View style={styles.metaRow}>
            {!!attempt.submitted_at && <Text style={styles.metaText}>{fmtDate(attempt.submitted_at)}</Text>}
            {scorePct != null && (
              <Text style={[styles.metaText, { color: attempt.is_passed ? colors.success : colors.danger, fontWeight: '800' }]}>
                · {scorePct}%
              </Text>
            )}
            {questions.length > 0 && (
              <Text style={[styles.metaText, { color: ACCENT, fontWeight: '700' }]}>
                · {totalEarned.toFixed(1)}/{totalMax} pts
              </Text>
            )}
            {pendingCount > 0 && (
              <View style={styles.pendingChip}><Text style={styles.pendingChipText}>{pendingCount} à noter</Text></View>
            )}
          </View>
        </View>
        <View style={styles.openBtn}>
          <Ionicons name="bar-chart-outline" size={12} color={ACCENT} />
          <Text style={styles.openBtnText}>{open ? 'Fermer' : 'Voir / Noter'}</Text>
        </View>
      </TouchableOpacity>

      {open && (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <TotalBadge earned={totalEarned} max={totalMax} />
          </View>
          {rows.length === 0 ? (
            <Text style={styles.panelHint}>Aucune question disponible</Text>
          ) : (
            rows.map(({ q, ans, earned, maxPts, status }, i) => (
              <QuestionGradeRow
                key={q.id} q={q} idx={i} ans={ans} earned={earned} maxPts={maxPts} status={status}
                accentColor={ACCENT}
                manualVal={manualPts[ans?.id] ?? (ans?.points_earned ?? '')}
                onManualChange={ans ? ((val) => setManualPts((p) => ({ ...p, [ans.id]: val }))) : null}
              />
            ))
          )}
          <View style={styles.panelFooter}>
            <Text style={[styles.footerText, { color: pendingCount > 0 ? '#d97706' : colors.success }]}>
              {pendingCount > 0 ? `${pendingCount} question${pendingCount > 1 ? 's' : ''} texte à noter` : '✓ Toutes les questions sont notées'}
            </Text>
            {hasPendingManual && (
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={saveGrades} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Valider les notes texte</Text>}
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

export default function TeacherQuizAttemptsScreen({ navigation, route }) {
  const quiz = route.params?.quiz;
  const [attempts, setAttempts] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!quiz?.id) { setLoading(false); return; }
    try {
      const [aRes, qRes] = await Promise.all([
        elearningService.getQuizAttempts({ quiz: quiz.id, page_size: 200, ordering: '-started_at' }),
        elearningService.getQuestions({ quiz: quiz.id, page_size: 200, ordering: 'order' }),
      ]);
      setAttempts(asArray(aRes));
      setQuestions(asArray(qRes));
    } catch (e) {
      console.log('attempts load error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [quiz?.id]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const completed = attempts.filter((a) => a.submitted_at);

  if (!quiz) {
    return (
      <View style={[styles.container, styles.center]}>
        <EmptyState icon="alert-circle-outline" title="Quiz introuvable" subtitle="Retournez à l'écran précédent et réessayez." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={GRADIENT} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>{quiz.title}</Text>
              <Text style={styles.headerSub}>{completed.length} tentative{completed.length === 1 ? '' : 's'} complétée{completed.length === 1 ? '' : 's'}</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={ACCENT} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
        >
          {completed.length === 0 ? (
            <EmptyState icon="bar-chart-outline" title="Aucune tentative complétée" />
          ) : (
            completed.map((att) => <AttemptRow key={att.id} attempt={att} questions={questions} onGraded={load} />)
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 32 },

  card: { backgroundColor: '#fff', borderRadius: radius.lg, marginBottom: spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.md },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 2 },
  metaText: { fontSize: 11, color: colors.textTertiary },
  pendingChip: { backgroundColor: '#fef3c7', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 2 },
  pendingChipText: { fontSize: 10, fontWeight: '700', color: '#d97706' },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: ACCENT + '12', borderWidth: 1.5, borderColor: ACCENT + '25', paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm },
  openBtnText: { fontSize: 11, fontWeight: '700', color: ACCENT },

  panel: { borderTopWidth: 1.5, borderTopColor: colors.divider, backgroundColor: '#fafbff' },
  panelHeader: { padding: spacing.md, paddingBottom: 0 },
  panelHint: { fontSize: 12, color: colors.textTertiary, textAlign: 'center', paddingVertical: 16 },
  panelFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, gap: 8 },
  footerText: { fontSize: 11, fontWeight: '700', flex: 1 },
  saveBtn: { backgroundColor: ACCENT, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  saveBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
});
