import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, BackHandler,
} from 'react-native';
import Alert from '../../../utils/appAlert';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { elearningService } from '../../../services/elearning';
import QuestionRenderer, { isAnswered } from '../../../components/quiz/QuestionRenderer';
import { colors, spacing, radius } from '../../../theme/colors';

const PURPLE = '#7C3AED';

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function QuizTakeScreen({ route, navigation }) {
  const { quizId } = route.params;
  const [phase, setPhase] = useState('loading');
  const [quiz, setQuiz] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    elearningService.getQuizById(quizId)
      .then((res) => { setQuiz(res); setPhase('intro'); })
      .catch(() => { setError('Quiz introuvable.'); setPhase('error'); });
  }, [quizId]);

  const handleSubmit = useCallback(async (auto = false) => {
    if (submittingRef.current || !attempt) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const payload = questions.map((qn) => {
        const a = answers[qn.id] || {};
        return {
          question_id: qn.id,
          choice_ids: a.choice_ids || [],
          text_response: a.text_response || '',
          numeric_response: a.numeric_response ?? null,
          ordering_response: a.ordering_response || [],
          matching_response: a.matching_response || {},
        };
      });
      const res = await elearningService.submitQuizAttempt(attempt.id, payload);
      setResult(res);
      setPhase('submitted');
    } catch (e) {
      if (!auto) Alert.alert('Erreur', 'Erreur lors de la soumission. Réessayez.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [attempt, answers, questions]);

  // Timer
  useEffect(() => {
    if (phase !== 'quiz' || timeLeft === null) return;
    if (timeLeft <= 0) { handleSubmit(true); return; }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft, handleSubmit]);

  // Block hardware back button mid-quiz (Android) — avoid accidentally losing progress.
  useEffect(() => {
    if (phase !== 'quiz') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert('Quitter le quiz ?', 'Votre progression sera perdue si vous quittez maintenant.', [
        { text: 'Rester', style: 'cancel' },
        { text: 'Quitter', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
      return true;
    });
    return () => sub.remove();
  }, [phase, navigation]);

  const startQuiz = async () => {
    try {
      const att = await elearningService.startQuizAttempt(quizId);
      setAttempt(att);
      const full = await elearningService.getQuizById(quizId);
      const qs = full.questions || [];
      setQuestions(qs);
      if (full.time_limit_minutes > 0) setTimeLeft(full.time_limit_minutes * 60);
      setPhase('quiz');
    } catch (e) {
      Alert.alert('Erreur', e?.response?.data?.detail || "Impossible de démarrer le quiz.");
    }
  };

  const setAnswer = useCallback((qId, data) => {
    setAnswers((prev) => ({ ...prev, [qId]: { ...(prev[qId] || {}), ...data } }));
  }, []);

  const confirmSubmit = () => {
    const answeredCount = questions.filter((qn) => isAnswered(answers[qn.id])).length;
    const unanswered = questions.length - answeredCount;
    Alert.alert(
      'Soumettre le quiz ?',
      `${answeredCount}/${questions.length} question(s) répondue(s).${unanswered > 0 ? `\n${unanswered} sans réponse — vous pouvez encore y répondre.` : ''}\n\nCette action est irréversible.`,
      [
        { text: 'Continuer', style: 'cancel' },
        { text: 'Soumettre', style: 'destructive', onPress: () => handleSubmit(false) },
      ]
    );
  };

  if (phase === 'loading') {
    return <View style={styles.center}><ActivityIndicator color={PURPLE} size="large" /></View>;
  }

  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="close-circle-outline" size={48} color={colors.danger} />
        <Text style={{ marginTop: 10, color: colors.textSecondary }}>{error}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: PURPLE, fontWeight: '700' }}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (phase === 'intro') {
    const maxAtt = quiz?.max_attempts || 0;
    const used = quiz?.attempts_used || 0;
    const canStart = !maxAtt || used < maxAtt;
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.introScroll}>
          <View style={styles.introIconWrap}>
            <Ionicons name="list-outline" size={32} color={PURPLE} />
          </View>
          <Text style={styles.introTitle}>{quiz?.title}</Text>
          {!!quiz?.description && <Text style={styles.introDesc}>{quiz.description}</Text>}

          <View style={styles.introMetaCard}>
            {[
              ['Questions', `${quiz?.question_count || 0}`],
              ['Durée', quiz?.time_limit_minutes > 0 ? `${quiz.time_limit_minutes} min` : 'Illimitée'],
              ['Tentatives', maxAtt > 0 ? `${used}/${maxAtt} utilisée(s)` : 'Illimitées'],
              ['Seuil de réussite', `${quiz?.pass_score_percent || 50}%`],
            ].map(([k, v]) => (
              <View key={k} style={styles.introMetaRow}>
                <Text style={styles.introMetaKey}>{k}</Text>
                <Text style={styles.introMetaVal}>{v}</Text>
              </View>
            ))}
          </View>

          {!!quiz?.subject_file && (
            <TouchableOpacity style={styles.pdfCard} onPress={() => Linking.openURL(quiz.subject_file)}>
              <Ionicons name="document-text-outline" size={18} color="#7C3AED" />
              <View style={{ flex: 1 }}>
                <Text style={styles.pdfTitle}>Télécharger le sujet</Text>
                <Text style={styles.pdfSub}>Lisez le PDF avant de commencer</Text>
              </View>
              <Ionicons name="download-outline" size={16} color="#7C3AED" />
            </TouchableOpacity>
          )}

          {canStart ? (
            <TouchableOpacity style={styles.startBtn} onPress={startQuiz}>
              <Ionicons name="play" size={16} color="#fff" />
              <Text style={styles.startBtnText}>Commencer le quiz</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.exhaustedBox}>
              <Text style={styles.exhaustedText}>Nombre maximum de tentatives atteint.</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 14, alignItems: 'center' }}>
            <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Retour</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase === 'submitted') {
    const score = parseFloat(result?.percent || 0);
    const passed = result?.is_passed;
    const pending = !result?.is_graded;
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.introScroll}>
          <View style={[styles.resultCard, { backgroundColor: passed ? colors.successLight : pending ? colors.warningLight : colors.dangerLight }]}>
            <View style={[styles.resultIconWrap, { backgroundColor: passed ? colors.success : pending ? colors.warning : colors.danger }]}>
              <Ionicons name={pending ? 'alert-circle' : passed ? 'trophy' : 'close-circle'} size={30} color="#fff" />
            </View>
            <Text style={[styles.resultTitle, { color: passed ? colors.success : pending ? '#B45309' : colors.danger }]}>
              {pending ? 'En attente de correction' : passed ? 'Réussi !' : 'Non validé'}
            </Text>
            <Text style={[styles.resultScore, { color: passed ? colors.success : pending ? '#B45309' : colors.danger }]}>
              {score.toFixed(1)}%
            </Text>
            <Text style={styles.resultPoints}>{result?.score}/{result?.max_score} points</Text>
            {pending && <Text style={styles.resultPending}>Certaines réponses textuelles attendent la correction du professeur.</Text>}
          </View>

          <Text style={styles.sectionTitle}>Détail des réponses</Text>
          {questions.map((qn, idx) => {
            const r = result?.answers?.find((x) => x.question === qn.id);
            const correct = r?.is_correct;
            const isPending = r?.is_correct === null || r?.is_correct === undefined;
            return (
              <View key={qn.id} style={[styles.answerCard, { borderColor: correct ? '#BBF7D0' : isPending ? '#FDE68A' : '#FECACA', backgroundColor: correct ? '#F0FDF4' : isPending ? '#FFFBEB' : '#FEF2F2' }]}>
                <View style={[styles.answerIcon, { backgroundColor: correct ? colors.success : isPending ? colors.warning : colors.danger }]}>
                  <Ionicons name={correct ? 'checkmark' : isPending ? 'time' : 'close'} size={13} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.answerText}>Q{idx + 1}. {qn.text}</Text>
                  {!!r?.manual_feedback && <Text style={styles.answerFeedback}>Commentaire : {r.manual_feedback}</Text>}
                </View>
                <Text style={styles.answerPts}>{r ? `${parseFloat(r.points_earned).toFixed(1)}/${parseFloat(qn.points).toFixed(1)}` : ''}</Text>
              </View>
            );
          })}

          <TouchableOpacity style={styles.backHomeBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backHomeBtnText}>Retour aux évaluations</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── phase === 'quiz' ──
  const answeredCount = questions.filter((qn) => isAnswered(answers[qn.id])).length;
  const allDone = answeredCount === questions.length;
  const timerRed = timeLeft !== null && timeLeft < 120;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.quizHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.quizHeaderTitle} numberOfLines={1}>{quiz?.title}</Text>
          <Text style={styles.quizHeaderSub}>{answeredCount}/{questions.length} répondues</Text>
        </View>
        {timeLeft !== null && (
          <View style={[styles.timerBox, timerRed && { backgroundColor: colors.dangerLight }]}>
            <Ionicons name="time-outline" size={13} color={timerRed ? colors.danger : PURPLE} />
            <Text style={[styles.timerText, { color: timerRed ? colors.danger : PURPLE }]}>{formatTime(timeLeft)}</Text>
          </View>
        )}
      </View>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(answeredCount / Math.max(questions.length, 1)) * 100}%`, backgroundColor: allDone ? colors.success : PURPLE }]} />
      </View>

      <ScrollView contentContainerStyle={styles.quizScroll}>
        {questions.map((qn, idx) => {
          const done = isAnswered(answers[qn.id]);
          return (
            <View key={qn.id} style={[styles.qCard, { borderColor: done ? '#BBF7D0' : colors.border }]}>
              <View style={[styles.qCardHeader, { backgroundColor: done ? '#F0FDF4' : '#FAFBFF' }]}>
                <View style={styles.qCardHeaderLeft}>
                  <View style={[styles.qIdx, { backgroundColor: done ? colors.success : PURPLE }]}>
                    <Text style={styles.qIdxText}>{idx + 1}</Text>
                  </View>
                  <Text style={[styles.qStatus, { color: done ? colors.success : PURPLE }]}>
                    {done ? '✓ Répondue' : `Question ${idx + 1}/${questions.length}`}
                  </Text>
                </View>
                <Text style={styles.qPts}>{qn.points} pt{qn.points > 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.qBody}>
                <Text style={styles.qText}>{qn.text}</Text>
                <QuestionRenderer question={qn} answer={answers[qn.id]} onAnswer={setAnswer} />
              </View>
            </View>
          );
        })}

        <TouchableOpacity
          style={[styles.finishBtn, allDone && { backgroundColor: colors.success }]}
          onPress={confirmSubmit}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={16} color="#fff" />}
          <Text style={styles.finishBtnText}>{submitting ? 'Envoi...' : `Terminer · ${answeredCount}/${questions.length}`}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },

  introScroll: { padding: spacing.lg, paddingBottom: 40, alignItems: 'stretch' },
  introIconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14 },
  introTitle: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  introDesc: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6 },
  introMetaCard: { marginTop: 20, gap: 4 },
  introMetaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  introMetaKey: { fontSize: 13, color: colors.textSecondary },
  introMetaVal: { fontSize: 13, fontWeight: '700', color: colors.text },
  pdfCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FAF5FF', borderWidth: 1.5, borderColor: '#EDE9FE', borderStyle: 'dashed', borderRadius: radius.lg, padding: spacing.md, marginTop: 16 },
  pdfTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  pdfSub: { fontSize: 11, color: '#9F7AEA', marginTop: 1 },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: PURPLE, paddingVertical: 14, borderRadius: radius.lg, marginTop: 24 },
  startBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  exhaustedBox: { marginTop: 24, alignItems: 'center' },
  exhaustedText: { fontSize: 13, color: colors.textSecondary },

  resultCard: { borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center', gap: 4 },
  resultIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  resultTitle: { fontSize: 18, fontWeight: '800' },
  resultScore: { fontSize: 40, fontWeight: '900', marginVertical: 4 },
  resultPoints: { fontSize: 13, color: colors.textSecondary },
  resultPending: { fontSize: 11, color: '#B45309', marginTop: 8, textAlign: 'center' },

  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 20, marginBottom: 10 },
  answerCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1.5, borderRadius: radius.lg, padding: spacing.md, marginBottom: 8 },
  answerIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  answerText: { fontSize: 13, fontWeight: '600', color: colors.text },
  answerFeedback: { fontSize: 11, color: PURPLE, backgroundColor: '#EDE9FE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 6, alignSelf: 'flex-start' },
  answerPts: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  backHomeBtn: { marginTop: 12, paddingVertical: 14, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  backHomeBtnText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },

  quizHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 8, backgroundColor: '#fff' },
  quizHeaderTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  quizHeaderSub: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  timerBox: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F5F3FF', paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.md },
  timerText: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  progressBar: { height: 3, backgroundColor: colors.divider },
  progressFill: { height: '100%' },

  quizScroll: { padding: spacing.md, gap: spacing.sm, paddingBottom: 40 },
  qCard: { backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1.5, overflow: 'hidden', marginBottom: spacing.sm },
  qCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 10 },
  qCardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qIdx: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  qIdxText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  qStatus: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  qPts: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, backgroundColor: '#EDE9FE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  qBody: { padding: spacing.md, gap: 12 },
  qText: { fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 20 },

  finishBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: PURPLE, paddingVertical: 15, borderRadius: radius.lg, marginTop: 8 },
  finishBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
