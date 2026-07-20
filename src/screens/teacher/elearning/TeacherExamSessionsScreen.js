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
import SnapshotGallery from '../../../components/teacher/SnapshotGallery';
import elearningService from '../../../services/elearning';
import asArray from '../../../utils/asArray';
import { colors, spacing, radius } from '../../../theme/colors';

const ACCENT = '#EA580C';
const GRADIENT = ['#7C2D12', '#C2410C', '#EA580C'];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function ExamSessionRow({ session: s, exam, onGraded }) {
  const maxScore = exam?.max_score || 20;
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(s.score != null ? String(s.score) : '');
  const [feedback, setFeedback] = useState(s.feedback || '');
  const [qScores, setQScores] = useState({});
  const [saving, setSaving] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [file, setFile] = useState(null);
  const isGraded = s.score != null;

  const [showSnapshots, setShowSnapshots] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);

  const quizId = exam?.quiz;
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    if (!open || !quizId) return;
    elearningService.getQuestions({ quiz: quizId, page_size: 200 })
      .then((r) => setQuestions(r?.results || r || []))
      .catch(() => {});
  }, [open, quizId]);

  // Pre-fill from the linked quiz attempt's auto-graded answers, if any.
  useEffect(() => {
    if (!open || !s.quiz_attempt) return;
    elearningService.getQuizAttemptById(s.quiz_attempt).then((data) => {
      if (!data?.answers?.length) return;
      const initial = {};
      data.answers.forEach((a) => { initial[a.question] = parseFloat(a.points_earned ?? 0); });
      setQScores(initial);
    }).catch(() => {});
  }, [open, s.quiz_attempt]);

  const toggleSnapshots = () => {
    setShowSnapshots((v) => !v);
    if (!showSnapshots && snapshots.length === 0) {
      setSnapshotsLoading(true);
      elearningService.getExamSessionSnapshots(s.id)
        .then((r) => setSnapshots(r?.results || r || []))
        .catch(() => {})
        .finally(() => setSnapshotsLoading(false));
    }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.length > 0) setFile(result.assets[0]);
    } catch {
      Alert.alert('Erreur', "Impossible d'ouvrir le sélecteur de fichiers.");
    }
  };

  const saveGrade = async (scoreValue, feedbackValue) => {
    const scoreNum = parseFloat(scoreValue);
    if (Number.isNaN(scoreNum)) { Alert.alert('Erreur', 'Note invalide.'); return false; }
    setSaving(true);
    try {
      if (file) {
        const fd = new FormData();
        fd.append('score', String(scoreNum));
        if (feedbackValue) fd.append('feedback', feedbackValue);
        fd.append('corrected_file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
        await elearningService.gradeExamSession(s.id, fd);
      } else {
        await elearningService.gradeExamSession(s.id, { score: scoreNum, feedback: feedbackValue });
      }
      return true;
    } catch (e) {
      Alert.alert('Erreur', e.response?.data?.detail || 'Impossible de corriger cette copie.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(() => questions.map((q) => {
    const maxPts = parseFloat(q.points) || 1;
    const val = qScores[q.id];
    const earned = val !== undefined ? (parseFloat(val) || 0) : null;
    return { q, maxPts, earned };
  }), [questions, qScores]);

  const totalMax = rows.reduce((s2, r) => s2 + r.maxPts, 0);
  const totalEarned = rows.reduce((s2, r) => s2 + (r.earned ?? 0), 0);

  const applyAutoCorrection = async () => {
    if (!s.quiz_attempt) return;
    setAutoFilling(true);
    try {
      const data = await elearningService.getQuizAttemptById(s.quiz_attempt);
      if (data?.answers?.length) {
        const scores = {};
        data.answers.forEach((a) => { scores[a.question] = parseFloat(a.points_earned ?? 0); });
        setQScores(scores);
        const realTotalMax = questions.reduce((sum, q) => sum + (parseFloat(q.points) || 1), 0);
        const realTotalEarned = questions.reduce((sum, q) => sum + (scores[q.id] ?? 0), 0);
        if (realTotalMax > 0) {
          const normalized = Math.min(maxScore, +((realTotalEarned / realTotalMax) * maxScore).toFixed(2));
          setScore(String(normalized));
          const ok = await saveGrade(normalized, feedback);
          if (ok) { setOpen(false); setFile(null); onGraded(); return; }
        }
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de charger la correction.');
    } finally {
      setAutoFilling(false);
    }
  };

  const applyTotal = () => {
    const normalized = totalMax > 0 ? (totalEarned / totalMax) * maxScore : totalEarned;
    setScore(String(Math.min(maxScore, +normalized.toFixed(2))));
  };

  const handleSave = async () => {
    const ok = await saveGrade(score, feedback);
    if (ok) { setOpen(false); setFile(null); onGraded(); }
  };

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: isGraded ? colors.successLight : '#fffbeb' }]}>
          <Ionicons name={isGraded ? 'checkmark-circle' : 'time-outline'} size={16} color={isGraded ? colors.success : '#d97706'} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{s.student_name || `Étudiant #${s.student}`}</Text>
            {s.is_flagged && (
              <View style={styles.flagBadge}>
                <Ionicons name="shield-outline" size={10} color="#dc2626" />
                <Text style={styles.flagBadgeText}>Signalé</Text>
              </View>
            )}
          </View>
          <Text style={styles.meta}>
            {fmtDate(s.submitted_at)}{s.status ? ` · ${s.status}` : ''}{isGraded ? ` · ${s.score}/${maxScore}` : ''}
          </Text>
          {s.is_flagged && !!s.flag_reason && (
            <Text style={styles.flagReason} numberOfLines={2}>{s.flag_reason}</Text>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        {!!s.submission_file && (
          <TouchableOpacity style={styles.linkChip} onPress={() => Linking.openURL(s.submission_file)}>
            <Ionicons name="document-text-outline" size={12} color="#7c3aed" />
            <Text style={[styles.linkChipText, { color: '#7c3aed' }]}>Copie étudiant</Text>
          </TouchableOpacity>
        )}
        {!!s.submission_note && (
          <View style={styles.linkChip}>
            <Ionicons name="document-text-outline" size={12} color="#7c3aed" />
            <Text style={[styles.linkChipText, { color: '#7c3aed' }]}>Réponse rédigée</Text>
          </View>
        )}
        <TouchableOpacity style={[styles.linkChip, showSnapshots && { backgroundColor: '#dbeafe' }]} onPress={toggleSnapshots}>
          <Ionicons name="camera-outline" size={12} color="#2563eb" />
          <Text style={[styles.linkChipText, { color: '#2563eb' }]}>Captures</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.correctBtn, open && { backgroundColor: '#fef3c7' }]} onPress={() => setOpen((v) => !v)}>
          <Ionicons name="star-outline" size={12} color={ACCENT} />
          <Text style={[styles.linkChipText, { color: ACCENT }]}>{isGraded ? 'Modifier' : 'Corriger'}</Text>
        </TouchableOpacity>
      </View>

      {showSnapshots && (
        <View style={styles.snapshotPanel}>
          <View style={styles.snapshotHeader}>
            <Text style={styles.snapshotHeaderText}>Captures webcam & analyse IA</Text>
            {snapshots.length > 0 && <Text style={styles.snapshotCount}>{snapshots.length} capture{snapshots.length > 1 ? 's' : ''}</Text>}
          </View>
          <View style={{ padding: spacing.sm }}>
            <SnapshotGallery snapshots={snapshots} loading={snapshotsLoading} webcamRequired={exam?.webcam_required} />
          </View>
        </View>
      )}

      {open && (
        <View style={{ marginTop: spacing.sm }}>
          {questions.length > 0 && (
            <View style={styles.qPanel}>
              <View style={styles.qPanelHeader}>
                <Text style={styles.qPanelHeaderText}>Notation par question</Text>
                <Text style={styles.qPanelTotal}>{totalEarned.toFixed(1)} / {totalMax} pts</Text>
              </View>
              {rows.map(({ q, maxPts, earned }, i) => (
                <QuestionGradeRow
                  key={q.id} q={q} idx={i} ans={{}} earned={earned} maxPts={maxPts} status="manual"
                  accentColor={ACCENT}
                  manualVal={qScores[q.id] ?? ''}
                  onManualChange={(val) => setQScores((p) => ({ ...p, [q.id]: val }))}
                />
              ))}
              <View style={styles.qPanelFooter}>
                <TotalBadge earned={totalEarned} max={totalMax} />
                {!!s.quiz_attempt && (
                  <TouchableOpacity style={[styles.autoBtn, autoFilling && { opacity: 0.7 }]} onPress={applyAutoCorrection} disabled={autoFilling}>
                    {autoFilling ? <ActivityIndicator size="small" color="#4f46e5" /> : (
                      <Text style={styles.autoBtnText}>Appliquer la correction automatique</Text>
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.applyBtn} onPress={applyTotal}>
                  <Text style={styles.applyBtnText}>Utiliser ce total comme note finale</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Réponse rédigée dans le système ("répondre dans le système" —
              exams that carry a PDF subject) — submission_note was saved but
              never actually displayed anywhere in this screen before. */}
          {!!s.submission_note && (
            <View style={styles.notePanel}>
              <View style={styles.notePanelHeader}>
                <Ionicons name="document-text-outline" size={13} color="#7c3aed" />
                <Text style={styles.notePanelHeaderText}>Réponse rédigée dans le système</Text>
              </View>
              <View style={styles.notePanelBody}>
                <Text style={styles.notePanelText}>{s.submission_note}</Text>
              </View>
            </View>
          )}

          <View style={styles.formPanel}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <TextField label={`Note /${maxScore}`} value={score} onChangeText={setScore} keyboardType="numeric" placeholder={`0 – ${maxScore}`} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="Appréciation" value={feedback} onChangeText={setFeedback} placeholder="Commentaire…" />
              </View>
            </View>
            <FilePickerRow label="Fichier corrigé (optionnel)" fileName={file?.name} onPick={pickFile} onClear={() => setFile(null)} accentColor={ACCENT} />
            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.saveBtn, (score === '' || saving) && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={score === '' || saving}
              >
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Valider la note</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setOpen(false); setFile(null); }}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

export default function TeacherExamSessionsScreen({ navigation, route }) {
  const exam = route.params?.exam;
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!exam?.id) { setLoading(false); return; }
    try {
      const res = await elearningService.getExamSessions(exam.id);
      setSessions(asArray(res));
    } catch (e) {
      console.log('exam sessions load error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [exam?.id]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const graded = sessions.filter((s) => s.score != null);

  if (!exam) {
    return (
      <View style={[styles.container, styles.center]}>
        <EmptyState icon="alert-circle-outline" title="Examen introuvable" subtitle="Retournez à l'écran précédent et réessayez." />
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
              <Text style={styles.headerTitle} numberOfLines={1}>{exam.title}</Text>
              <Text style={styles.headerSub}>{graded.length}/{sessions.length} corrigée{graded.length === 1 ? '' : 's'}</Text>
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
          {sessions.length === 0 ? (
            <EmptyState icon="shield-checkmark-outline" title="Aucune copie" />
          ) : (
            sessions.map((s) => <ExamSessionRow key={s.id} session={s} exam={exam} onGraded={load} />)
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

  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1 },
  flagBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fef2f2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  flagBadgeText: { fontSize: 9, fontWeight: '800', color: '#dc2626' },
  meta: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  flagReason: { fontSize: 11, color: '#dc2626', marginTop: 3 },

  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 10 },
  linkChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.sm },
  linkChipText: { fontSize: 11, fontWeight: '700' },
  correctBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff7ed', paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.sm },

  snapshotPanel: { marginTop: spacing.sm, borderRadius: radius.lg, borderWidth: 1.5, borderColor: '#dbeafe', overflow: 'hidden' },
  snapshotHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: '#eff6ff' },
  snapshotHeaderText: { fontSize: 10, fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.5 },
  snapshotCount: { fontSize: 11, fontWeight: '800', color: '#2563eb' },

  qPanel: { borderRadius: radius.lg, borderWidth: 1.5, borderColor: ACCENT + '20', overflow: 'hidden', marginBottom: spacing.sm },
  qPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: ACCENT + '08' },
  qPanelHeaderText: { fontSize: 10, fontWeight: '800', color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5 },
  qPanelTotal: { fontSize: 12, fontWeight: '800', color: ACCENT },
  qPanelFooter: { padding: spacing.md, gap: spacing.sm, backgroundColor: '#fafbff' },
  autoBtn: { borderWidth: 2, borderColor: '#4f46e5', backgroundColor: '#eef2ff', borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  autoBtnText: { fontSize: 12, fontWeight: '700', color: '#4f46e5', textAlign: 'center' },
  applyBtn: { backgroundColor: ACCENT, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  applyBtnText: { fontSize: 12, fontWeight: '700', color: '#fff', textAlign: 'center' },

  notePanel: { borderRadius: radius.lg, borderWidth: 1.5, borderColor: '#ede9fe', overflow: 'hidden', marginTop: spacing.sm },
  notePanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 10, backgroundColor: '#f5f3ff' },
  notePanelHeaderText: { fontSize: 10, fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.5 },
  notePanelBody: { padding: spacing.md, backgroundColor: '#fff' },
  notePanelText: { fontSize: 12, lineHeight: 18, color: '#334155' },

  formPanel: { backgroundColor: '#fffbeb', borderRadius: radius.lg, borderWidth: 1.5, borderColor: ACCENT + '20', padding: spacing.md, gap: spacing.sm },
  formActions: { flexDirection: 'row', gap: 8 },
  saveBtn: { flex: 1, backgroundColor: ACCENT, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
});
