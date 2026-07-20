import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking,
  RefreshControl, ActivityIndicator, StatusBar,
} from 'react-native';
import Alert from '../../../utils/appAlert';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyState from '../../../components/common/EmptyState';
import { TextField, FilePickerRow } from '../../../components/teacher/FormField';
import QuestionGradeRow from '../../../components/teacher/QuestionGradeRow';
import TotalBadge from '../../../components/teacher/TotalBadge';
import elearningService from '../../../services/elearning';
import asArray from '../../../utils/asArray';
import { colors, spacing, radius } from '../../../theme/colors';

const ACCENT = '#DB2777';
const GRADIENT = ['#9D174D', '#DB2777', '#BE185D'];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Per-question panel (only when the assignment has a linked quiz) ─────────
function AssignmentPerQuestionPanel({ sub, assignment, onApplyAndSave }) {
  const quizId = assignment?.quiz;
  const [questions, setQuestions] = useState([]);
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qScores, setQScores] = useState({});
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!quizId) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    Promise.all([
      elearningService.getQuestions({ quiz: quizId, page_size: 200 }),
      elearningService.getQuizAttempts({ quiz: quizId, page_size: 200 }),
    ]).then(([qRes, aRes]) => {
      if (!active) return;
      const qs = qRes?.results || qRes || [];
      const attempts = aRes?.results || aRes || [];
      const mine = attempts.find((a) => String(a.student) === String(sub.student));
      setQuestions(qs);
      setAttempt(mine || null);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [quizId, sub.student]);

  const answerMap = useMemo(() => {
    const m = {};
    (attempt?.answers || []).forEach((a) => { m[a.question] = a; });
    return m;
  }, [attempt]);

  const rows = useMemo(() => questions.map((q) => {
    const ans = answerMap[q.id];
    const maxPts = parseFloat(q.points) || 1;
    const manual = qScores[q.id];
    const existing = ans?.points_earned ?? (ans?.is_correct != null ? (ans.is_correct ? maxPts : 0) : null);
    const earned = manual !== undefined ? (parseFloat(manual) || 0) : (existing ?? null);
    const status = !ans ? 'missing'
      : q.question_type === 'TEXT' ? (earned == null ? 'pending' : 'manual')
      : ans.is_correct ? 'correct' : ans.is_correct === false ? 'incorrect' : 'pending';
    return { q, ans, earned, maxPts, status };
  }), [questions, answerMap, qScores]);

  const totalMax = rows.reduce((s, r) => s + r.maxPts, 0);
  const totalEarned = rows.reduce((s, r) => s + (r.earned ?? 0), 0);
  const assignmentMaxScore = assignment?.max_score || 20;
  const normalizedTotal = totalMax > 0 ? (totalEarned / totalMax) * assignmentMaxScore : totalEarned;
  const previewScore = Math.min(assignmentMaxScore, +normalizedTotal.toFixed(2));

  const applyTotal = async () => {
    setApplying(true);
    await onApplyAndSave(previewScore);
    setApplying(false);
  };

  if (!quizId) {
    return <Text style={styles.panelHint}>Ce devoir n'a pas de questions en ligne associées</Text>;
  }
  if (loading) return <ActivityIndicator color={ACCENT} style={{ paddingVertical: 20 }} />;
  if (questions.length === 0) {
    return <Text style={styles.panelHint}>Aucune question enregistrée pour ce devoir</Text>;
  }

  return (
    <View style={styles.qPanel}>
      <View style={styles.qPanelHeader}>
        <Text style={styles.qPanelHeaderText}>Notation par question</Text>
        {!attempt && <Text style={styles.qPanelWarn}>Pas de réponse en ligne</Text>}
      </View>
      {rows.map(({ q, ans, earned, maxPts, status }, i) => (
        <QuestionGradeRow
          key={q.id} q={q} idx={i} ans={ans} earned={earned} maxPts={maxPts} status={status}
          accentColor={ACCENT}
          manualVal={qScores[q.id] ?? (ans?.points_earned ?? '')}
          onManualChange={(val) => setQScores((p) => ({ ...p, [q.id]: val }))}
        />
      ))}
      <View style={styles.qPanelFooter}>
        <TotalBadge earned={totalEarned} max={totalMax} />
        <TouchableOpacity style={[styles.applyBtn, applying && { opacity: 0.7 }]} onPress={applyTotal} disabled={applying}>
          {applying ? <ActivityIndicator size="small" color="#fff" /> : (
            <Text style={styles.applyBtnText}>Utiliser ce total comme note finale ({previewScore}/{assignmentMaxScore})</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── One submission row, expandable in-place ──────────────────────────────────
function SubmissionRow({ sub, assignment, onGraded }) {
  const maxScore = assignment?.max_score || 20;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('global');
  const [score, setScore] = useState(sub.correction?.score != null ? String(sub.correction.score) : '');
  const [feedback, setFeedback] = useState(sub.correction?.feedback || '');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const isGraded = sub.correction?.score != null;

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) setFile(result.assets[0]);
    } catch {
      Alert.alert('Erreur', "Impossible d'ouvrir le sélecteur de fichiers.");
    }
  };

  const saveGrade = async (scoreValue, feedbackValue) => {
    const scoreNum = parseFloat(scoreValue);
    if (Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > maxScore) {
      Alert.alert('Note invalide', `La note doit être comprise entre 0 et ${maxScore}.`);
      return false;
    }
    setSaving(true);
    try {
      if (file) {
        const fd = new FormData();
        fd.append('score', String(scoreNum));
        if (feedbackValue) fd.append('feedback', feedbackValue);
        fd.append('corrected_file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
        await elearningService.gradeSubmission(sub.id, fd);
      } else {
        await elearningService.gradeSubmission(sub.id, { score: scoreNum, feedback: feedbackValue });
      }
      setOpen(false); setFile(null); onGraded();
      return true;
    } catch (e) {
      Alert.alert('Erreur', e.response?.data?.detail || 'Impossible de corriger cette soumission.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.subCard}>
      <View style={styles.subTop}>
        <View style={[styles.subIcon, { backgroundColor: isGraded ? colors.successLight : '#fffbeb' }]}>
          <Ionicons name={isGraded ? 'checkmark-circle' : 'time-outline'} size={16} color={isGraded ? colors.success : '#d97706'} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.subName} numberOfLines={1}>{sub.student_name || `Étudiant #${sub.student}`}</Text>
          <Text style={styles.subMeta}>
            {fmtDate(sub.submitted_at)}{sub.is_late ? ' · En retard' : ''}
            {isGraded ? ` · ${sub.correction.score}/${maxScore}` : ''}
          </Text>
        </View>
      </View>

      {!!sub.content && (
        <Text style={styles.contentPreview} numberOfLines={4}>
          <Text style={styles.contentLabel}>RÉPONSE : </Text>{sub.content}
        </Text>
      )}

      <View style={styles.subActions}>
        {!!sub.file && (
          <TouchableOpacity style={styles.linkChip} onPress={() => Linking.openURL(sub.file)}>
            <Ionicons name="download-outline" size={12} color="#2563eb" />
            <Text style={[styles.linkChipText, { color: '#2563eb' }]}>Travail</Text>
          </TouchableOpacity>
        )}
        {!!sub.correction?.corrected_file && (
          <TouchableOpacity style={[styles.linkChip, { backgroundColor: colors.successLight }]} onPress={() => Linking.openURL(sub.correction.corrected_file)}>
            <Ionicons name="document-text-outline" size={12} color={colors.success} />
            <Text style={[styles.linkChipText, { color: colors.success }]}>Correction</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.correctBtn, { backgroundColor: isGraded ? '#fce7f3' : ACCENT + '12' }]}
          onPress={() => setOpen((v) => !v)}
        >
          <Ionicons name="star-outline" size={12} color={ACCENT} />
          <Text style={[styles.linkChipText, { color: ACCENT }]}>{isGraded ? 'Modifier' : 'Corriger'}</Text>
        </TouchableOpacity>
      </View>

      {open && (
        <View style={{ marginTop: spacing.sm }}>
          {!!assignment?.quiz && (
            <View style={styles.modeToggle}>
              {[{ id: 'global', label: 'Note globale' }, { id: 'perQuestion', label: 'Par question' }].map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.modeBtn, mode === m.id && styles.modeBtnActive]}
                  onPress={() => setMode(m.id)}
                >
                  <Text style={[styles.modeBtnText, mode === m.id && { color: ACCENT }]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {mode === 'perQuestion' && !!assignment?.quiz ? (
            <AssignmentPerQuestionPanel
              sub={sub} assignment={assignment}
              onApplyAndSave={(s) => saveGrade(s, feedback)}
            />
          ) : (
            <View style={styles.formPanel}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <TextField label={`Note /${maxScore}`} required value={score} onChangeText={setScore} keyboardType="numeric" placeholder={`0 – ${maxScore}`} accentColor={ACCENT} />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField label="Appréciation" value={feedback} onChangeText={setFeedback} placeholder="Bien, Insuffisant, Excellent…" />
                </View>
              </View>
              <FilePickerRow label="Fichier corrigé (optionnel)" fileName={file?.name} onPick={pickFile} onClear={() => setFile(null)} accentColor={ACCENT} />
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.saveBtn, (score === '' || saving) && { opacity: 0.5 }]}
                  onPress={() => saveGrade(score, feedback)}
                  disabled={score === '' || saving}
                >
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Valider la note</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setOpen(false); setFile(null); }}>
                  <Text style={styles.cancelBtnText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function TeacherAssignmentSubmissionsScreen({ navigation, route }) {
  const assignment = route.params?.assignment;
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!assignment?.id) { setLoading(false); return; }
    try {
      const res = await elearningService.getSubmissions(assignment.id);
      setSubmissions(asArray(res));
    } catch (e) {
      console.log('submissions load error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [assignment?.id]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const graded = submissions.filter((s) => s.correction?.score != null);

  if (!assignment) {
    return (
      <View style={[styles.container, styles.center]}>
        <EmptyState icon="alert-circle-outline" title="Devoir introuvable" subtitle="Retournez à l'écran précédent et réessayez." />
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
              <Text style={styles.headerTitle} numberOfLines={1}>{assignment.title}</Text>
              <Text style={styles.headerSub}>{graded.length}/{submissions.length} corrigé{graded.length === 1 ? '' : 's'}</Text>
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
          {submissions.length === 0 ? (
            <EmptyState icon="people-outline" title="Aucune soumission" />
          ) : (
            submissions.map((sub) => <SubmissionRow key={sub.id} sub={sub} assignment={assignment} onGraded={load} />)
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

  subCard: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  subTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  subName: { fontSize: 14, fontWeight: '700', color: colors.text },
  subMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },

  contentPreview: { fontSize: 12, color: '#475569', backgroundColor: colors.background, borderRadius: radius.md, padding: 10, marginTop: 10, lineHeight: 18 },
  contentLabel: { fontSize: 10, fontWeight: '800', color: colors.textTertiary, textTransform: 'uppercase' },

  subActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 10 },
  linkChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.sm },
  linkChipText: { fontSize: 11, fontWeight: '700' },
  correctBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.sm },

  modeToggle: { flexDirection: 'row', gap: 4, backgroundColor: colors.background, borderRadius: radius.md, padding: 4, marginBottom: spacing.sm },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 },
  modeBtnText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },

  panelHint: { fontSize: 12, color: colors.textTertiary, textAlign: 'center', backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md },
  qPanel: { borderRadius: radius.lg, borderWidth: 1.5, borderColor: ACCENT + '20', overflow: 'hidden' },
  qPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: ACCENT + '08' },
  qPanelHeaderText: { fontSize: 10, fontWeight: '800', color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5 },
  qPanelWarn: { fontSize: 10, fontWeight: '700', color: '#d97706', backgroundColor: '#fff7ed', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  qPanelFooter: { padding: spacing.md, gap: spacing.sm, backgroundColor: '#fafbff' },
  applyBtn: { backgroundColor: ACCENT, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  applyBtnText: { fontSize: 12, fontWeight: '700', color: '#fff', textAlign: 'center' },

  formPanel: { backgroundColor: '#fdf2f8', borderRadius: radius.lg, borderWidth: 1.5, borderColor: ACCENT + '20', padding: spacing.md, gap: spacing.sm },
  formActions: { flexDirection: 'row', gap: 8 },
  saveBtn: { flex: 1, backgroundColor: ACCENT, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
});
