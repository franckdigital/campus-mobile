import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, AppState, BackHandler, Modal, Linking, TextInput,
} from 'react-native';
import Alert from '../../../utils/appAlert';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ScreenCapture from 'expo-screen-capture';
import { WebView } from 'react-native-webview';
import { elearningService } from '../../../services/elearning';
import { setExamInProgress } from '../../../hooks/usePushNotifications';
import QuestionRenderer, { isAnswered } from '../../../components/quiz/QuestionRenderer';
import { colors, spacing, radius } from '../../../theme/colors';

// How often a webcam frame is captured and archived server-side while the
// exam is active — purely for the teacher's own review, no automatic
// consequence attached to it anymore (no phone/face/gaze detection reacted
// to on the client).
const DETECT_INTERVAL = 5000;
// Ceiling for the adaptive backoff below — if the AI backend keeps signaling
// it's overloaded (ai_available: false), captures space out up to this much
// instead of retrying every 5s into a saturated quota.
const MAX_DETECT_INTERVAL = 20000;
// Flat suspension duration for the only two anti-cheat triggers left:
// leaving the app (tab/window-switch equivalent) or a screenshot attempt
// (copy/paste equivalent). Never escalates, never auto-submits the exam.
const FRAUD_SUSPEND_MIN = 5;

// Anti-multi-device: interval between two heartbeat pings to the backend
// while an exam is in progress. Must stay comfortably under the server's
// DEVICE_LOCK_STALE_SECONDS (60s) so a single slow/dropped request doesn't
// make another device think this one is gone. Mirrors ExamPage.jsx (web).
const HEARTBEAT_INTERVAL_MS = 20000;

// Identifies this app launch (not this student) for the "one device at a
// time" exam lock — a fresh token per mount is fine: a killed/relaunched
// app is treated the same as a genuinely new device taking over once the
// previous token goes stale server-side.
function makeDeviceToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// A tab/window switch (leaving the app) or a screenshot attempt suspends the
// exam behind this blocking overlay for a flat FRAUD_SUSPEND_MIN minutes —
// never escalates, never ends the exam: the student just waits it out and
// resumes exactly where they were. Mirrors ExamPage.jsx (web) exactly (same
// copy, same countdown behavior, same "minutes deducted up front, timer
// stays paused during the block" contract).
function FraudSuspensionModal({ reason, until, onExpire }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) onExpire();
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [until, onExpire]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.suspendOverlay}>
        <View style={styles.suspendCard}>
          <View style={styles.suspendIconWrap}>
            <Ionicons name="shield-outline" size={40} color={colors.danger} />
          </View>
          <Text style={styles.suspendTitle}>Examen suspendu</Text>
          <Text style={styles.suspendReason}>{reason}</Text>
          <Text style={styles.suspendTimer}>{mm}:{ss}</Text>
          <Text style={styles.suspendNote}>
            L'examen reprendra automatiquement à la fin du compte à rebours. Ces {FRAUD_SUSPEND_MIN} minutes sont
            déduites de votre temps d'examen — le chronomètre est pour l'instant en pause et reprendra là où il en était.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// Small always-on live camera preview shown in a corner during the exam,
// archival only — mirrors the web's little webcam thumbnail. Captures a
// frame every DETECT_INTERVAL and hands it to onFrame(uri) for upload
// (purely for the teacher's own review, no automatic consequence); capture
// failures are reported once via onLost so the teacher sees monitoring was
// interrupted, without blocking the exam itself.
function WebcamMonitor({ enabled, permission, onFrame, onLost }) {
  const [active, setActive] = useState(false);
  const camRef = useRef(null);
  const reportedLoss = useRef(false);
  const busyRef = useRef(false);
  // onFrame/onLost are recreated every time the student answers a question
  // (they depend on handleFraudBlock -> handleSubmit -> answers), so calling
  // them through a ref — rather than putting them in the effect's own deps —
  // keeps the capture interval alive across those renders. Without this, the
  // interval was torn down and restarted on every answer change, and during
  // active answering could keep resetting before ever completing one full
  // DETECT_INTERVAL tick, silently stalling proctoring capture entirely
  // while the live preview kept looking normal.
  const onFrameRef = useRef(onFrame);
  const onLostRef = useRef(onLost);
  onFrameRef.current = onFrame;
  onLostRef.current = onLost;

  useEffect(() => {
    if (!enabled || !permission?.granted) return;
    let cancelled = false;
    let timer = null;
    // Self-scheduling instead of setInterval so the cadence can adapt: when
    // onFrame reports the AI backend was overloaded (ai_available: false,
    // see analyze_exam_snapshot's rate limiter), back off exponentially
    // (capped at MAX_DETECT_INTERVAL) instead of retrying every
    // DETECT_INTERVAL into a budget that's already exhausted — that would
    // just waste the little quota there is, elsewhere. Recovers back to the
    // normal cadence the moment a capture actually gets a real verdict.
    let delay = DETECT_INTERVAL;
    const tick = async () => {
      if (cancelled) return;
      if (busyRef.current || !camRef.current) {
        timer = setTimeout(tick, delay);
        return;
      }
      busyRef.current = true;
      try {
        // 0.4 was too aggressive for Gemini to reliably make out a held
        // phone/object at typical arm's-length distance from the front
        // camera — unlike the web's local coco-ssd (a dedicated object
        // detector sampling every 3s), this is a single compressed frame
        // sent every DETECT_INTERVAL to a general vision model, so image
        // clarity matters more here per attempt.
        const photo = await camRef.current.takePictureAsync({ quality: 0.7, base64: false });
        setActive(true);
        const overloaded = await onFrameRef.current(photo.uri);
        delay = overloaded ? Math.min(delay * 1.5, MAX_DETECT_INTERVAL) : DETECT_INTERVAL;
      } catch {
        setActive(false);
        if (!reportedLoss.current) { reportedLoss.current = true; onLostRef.current('Échec de capture webcam pendant l\'examen.'); }
      } finally {
        busyRef.current = false;
        if (!cancelled) timer = setTimeout(tick, delay);
      }
    };
    timer = setTimeout(tick, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [enabled, permission]);

  if (!enabled || !permission?.granted) return null;

  return (
    <View style={styles.webcamWrap}>
      <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="front" />
      <View style={[styles.webcamDot, { backgroundColor: active ? colors.success : '#9CA3AF' }]} />
    </View>
  );
}

// Blocks entry into a webcam_required exam until camera access is actually
// granted — without this, a denied/unavailable camera used to fail silently
// (WebcamMonitor just renders nothing) and the student would only find out
// after the fact, from the teacher's "no capture received" flag. `canAskAgain
// === false` means Android/iOS won't show the system prompt again, so that
// case sends the student to the app's own settings screen instead of
// spinning on a request that resolves instantly with no UI.
function CameraRequiredGate({ permission, onRequest }) {
  const canAskAgain = permission?.canAskAgain !== false;
  return (
    <View style={styles.center}>
      <View style={styles.gateIconWrap}>
        <Ionicons name="camera-outline" size={38} color={colors.danger} />
      </View>
      <Text style={styles.gateTitle}>Caméra requise pour cet examen</Text>
      <Text style={styles.gateText}>
        Cet examen est surveillé par webcam. L'accès à la caméra doit être autorisé avant de pouvoir commencer.
      </Text>
      <TouchableOpacity
        style={styles.gateBtn}
        onPress={() => (canAskAgain ? onRequest() : Linking.openSettings())}
      >
        <Text style={styles.gateBtnText}>{canAskAgain ? 'Autoriser la caméra' : 'Ouvrir les réglages'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// Replaces the old native Alert.alert confirmation with a card matching the
// rest of the exam's modal styling (FraudSuspensionModal, suspend overlay).
function SubmitConfirmModal({ answeredCount, total, hasQuestions = true, onCancel, onConfirm }) {
  const unanswered = total - answeredCount;
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.suspendOverlay}>
        <View style={styles.suspendCard}>
          <View style={[styles.suspendIconWrap, { backgroundColor: colors.successLight, borderColor: '#BBF7D0' }]}>
            <Ionicons name="paper-plane-outline" size={36} color={colors.success} />
          </View>
          <Text style={styles.suspendTitle}>Soumettre l'examen ?</Text>
          {hasQuestions && (
            <View style={styles.submitStatsRow}>
              <Text style={styles.submitStatsCount}>{answeredCount}/{total}</Text>
              <Text style={styles.submitStatsLabel}>question(s) répondue(s)</Text>
            </View>
          )}
          {hasQuestions && unanswered > 0 && (
            <View style={styles.submitWarningPill}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.warning} />
              <Text style={styles.submitWarningText}>{unanswered} question(s) sans réponse</Text>
            </View>
          )}
          <Text style={styles.suspendNote}>Cette action est irréversible — vous ne pourrez plus modifier vos réponses après soumission.</Text>
          <View style={styles.submitActions}>
            <TouchableOpacity style={styles.submitCancelBtn} onPress={onCancel}>
              <Text style={styles.submitCancelBtnText}>Continuer l'examen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitConfirmBtn} onPress={onConfirm}>
              <Ionicons name="send" size={15} color="#fff" />
              <Text style={styles.submitConfirmBtnText}>Soumettre</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// "Répondre dans le système" for exams that carry a PDF subject. Unlike the
// Devoirs screen, this is a proctored exam screen — no file-upload mode
// here: DocumentPicker.getDocumentAsync backgrounds the app to open the
// native file browser, which is exactly the AppState transition the
// tab/app-switch detector below (see the AppState listener a bit further
// down) treats as leaving the exam — attaching a file would trigger an
// immediate fraud suspension. Text-in-system is the only supported answer
// mode on this screen. Has its own "Envoyer" button that saves immediately
// (via submitExamFile) rather than only being bundled into the exam's final
// "Terminer" action — the final submit still resends whatever's in content
// as a safety net (idempotent), but a student shouldn't have to trust a
// silent background save for something they spent time writing.
function PdfAnswerSection({ sessionId, content, setContent, error }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');
  const sentTimer = useRef(null);

  const handleSend = async () => {
    if (!content.trim()) { setSendError('Rédigez une réponse avant d\'envoyer.'); return; }
    if (!sessionId) { setSendError('Session introuvable — réessayez dans quelques secondes.'); return; }
    setSendError('');
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('note', content.trim());
      await elearningService.submitExamFile(sessionId, fd);
      setSent(true);
      clearTimeout(sentTimer.current);
      sentTimer.current = setTimeout(() => setSent(false), 5000);
    } catch {
      setSendError('Erreur lors de l\'envoi — vérifiez votre connexion et réessayez.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.pdfAnswerCard}>
      <Text style={styles.pdfAnswerTitle}>Votre réponse au sujet PDF</Text>
      <Text style={styles.pdfAnswerSub}>
        Rédigez votre réponse ci-dessous, puis appuyez sur « Envoyer ». Vous pouvez la modifier et la
        renvoyer autant de fois que nécessaire jusqu'à la soumission finale de l'examen.
      </Text>

      <TextInput
        value={content}
        onChangeText={(v) => { setContent(v); setSent(false); }}
        placeholder="Rédigez votre réponse ici..."
        placeholderTextColor={colors.textTertiary}
        multiline
        textAlignVertical="top"
        style={styles.pdfTextInput}
      />

      {(!!sendError || !!error) && (
        <View style={styles.pdfErrorBox}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
          <Text style={styles.pdfErrorText}>{sendError || error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.pdfSendBtn, sent && styles.pdfSendBtnSent, sending && { opacity: 0.6 }]}
        onPress={handleSend}
        disabled={sending}
      >
        {sending
          ? <ActivityIndicator color="#fff" size="small" />
          : <Ionicons name={sent ? 'checkmark-circle' : 'send'} size={16} color="#fff" />}
        <Text style={styles.pdfSendBtnText}>
          {sending ? 'Envoi en cours…' : sent ? 'Réponse envoyée ✓' : 'Envoyer ma réponse'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function SecureExamTakeScreen({ route, navigation }) {
  const { examId } = route.params;
  const [phase, setPhase] = useState('loading'); // loading|exam|submitted|error
  const [exam, setExam] = useState(null);
  const [session, setSession] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  // Flat, single-stage suspension — a tab/app switch or a screenshot attempt
  // suspends the exam for FRAUD_SUSPEND_MIN minutes, then resumes
  // automatically. Never escalates and never ends the exam on its own.
  const [fraudBlock, setFraudBlock] = useState(null); // { reason, until } | null
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  // "Répondre dans le système" for exams that carry a PDF subject — shown
  // alongside the quiz stepper when the exam also has a quiz, or in its
  // place when the exam is PDF-only. Submitted together with the quiz (if
  // any) from the single "Terminer" action — see handleSubmit below.
  const [pdfContent, setPdfContent] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [contentTab, setContentTab] = useState('questions'); // 'questions' | 'pdf' — only relevant when both a quiz and a PDF are present
  const [permission, requestPermission] = useCameraPermissions();

  const submittingRef = useRef(false);
  const fraudBlockRef = useRef(null);
  const phaseRef = useRef(phase);
  const lastSwitchAt = useRef(0);
  const backgroundedAt = useRef(null);
  const lostReported = useRef(false);
  const autoRequestedCamera = useRef(false);
  const deviceTokenRef = useRef(null);
  if (!deviceTokenRef.current) deviceTokenRef.current = makeDeviceToken();

  useEffect(() => { fraudBlockRef.current = fraudBlock; }, [fraudBlock]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Native "copy-paste blocking" equivalent: prevents screenshots/screen
  // recording of the exam content on Android (FLAG_SECURE) for the whole
  // time this screen is focused, and suspends the exam on a detected
  // attempt — same FRAUD_SUSPEND_MIN consequence as leaving the app. iOS
  // can't be blocked at the OS level but addScreenshotListener below at
  // least reports and suspends on the attempt.
  useEffect(() => {
    if (phase !== 'exam') return;
    ScreenCapture.preventScreenCaptureAsync('secure-exam').catch(() => {});
    const sub = ScreenCapture.addScreenshotListener(() => {
      elearningService.logExamEvent(examId, 'COPY_ATTEMPT', 'Capture d\'écran détectée pendant l\'examen.').catch(() => {});
      handleFraudBlock('Une capture d\'écran a été détectée pendant l\'examen.');
    });
    return () => {
      ScreenCapture.allowScreenCaptureAsync('secure-exam').catch(() => {});
      sub.remove();
    };
  }, [phase, examId, handleFraudBlock]);

  // Tapping a push notification during the exam backgrounds+foregrounds the
  // app just like switching to another app does, which the AppState listener
  // below legitimately treats as a tab-switch. Without this flag,
  // usePushNotifications would ALSO navigate away (Finance/Présences/...) on
  // that same foreground event, yanking the student off this screen right as
  // the suspension modal should appear — see usePushNotifications.js.
  useEffect(() => {
    setExamInProgress(phase === 'exam');
    return () => setExamInProgress(false);
  }, [phase]);

  // Submits the quiz attempt (if any) and/or the PDF "répondre dans le
  // système" section (if the exam carries a subject PDF), together as one
  // final action — mirrors ExamPage.jsx (web). A PDF-only exam has no
  // `attempt` at all, so the old `!attempt` guard would have made this a
  // silent no-op for it.
  const handleSubmit = useCallback(async (auto = false) => {
    if (submittingRef.current || (!attempt && !session)) return;
    // A PDF-only exam has nothing else to fall back on — block a voluntary
    // empty submission (auto-submit on timer/fraud lock still goes through
    // regardless, closing the session even with a blank draft).
    if (!auto && !attempt && exam?.exam_pdf && !pdfContent.trim()) {
      setPdfError('Rédigez une réponse avant de soumettre.');
      setContentTab('pdf');
      return;
    }
    setPdfError('');
    submittingRef.current = true;
    setSubmitting(true);
    try {
      let res = null;
      if (attempt) {
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
        res = await elearningService.submitQuizAttempt(attempt.id, payload);
      }
      if (exam?.exam_pdf && session?.id) {
        const fd = new FormData();
        if (pdfContent.trim()) fd.append('note', pdfContent.trim());
        await elearningService.submitExamFile(session.id, fd);
      }
      setResult(res);
      setPhase('submitted');
    } catch (e) {
      if (!auto) Alert.alert('Erreur', 'Erreur lors de la soumission.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [attempt, session, answers, questions, exam, pdfContent]);

  // Suspension handler — shared by the app-switch detector and the
  // screenshot listener above, the only two things left that suspend an
  // exam. Always a flat FRAUD_SUSPEND_MIN minutes, logged server-side for
  // the teacher's own review (fraud_block_count), but never escalates and
  // never ends the exam on its own — the student just waits it out and
  // resumes exactly where they were.
  const handleFraudBlock = useCallback((reason) => {
    if (phaseRef.current !== 'exam' || fraudBlockRef.current) return;
    elearningService.logExamEvent(examId, 'FRAUD_BLOCK', reason).catch(() => {});
    setTimeLeft((t) => (t == null ? t : Math.max(0, t - FRAUD_SUSPEND_MIN * 60)));
    setFraudBlock({ reason, until: Date.now() + FRAUD_SUSPEND_MIN * 60 * 1000 });
  }, [examId]);

  // FraudSuspensionModal's onExpire — just resumes.
  const handleSuspensionExpire = useCallback(() => {
    setFraudBlock(null);
  }, []);

  // Start sequence — identical order to the web (quiz attempt quota checked
  // before the exam session is created; exam.duration_minutes governs the
  // clock, not the quiz's own time_limit_minutes).
  useEffect(() => {
    (async () => {
      try {
        const examData = await elearningService.getSecureExamById(examId);
        setExam(examData);
        if (['SUBMITTED', 'FLAGGED'].includes(examData.my_session?.status)) {
          setError('Vous avez déjà soumis cet examen.');
          setPhase('error');
          return;
        }
        let att = null;
        let qs = [];
        if (examData.quiz) {
          att = await elearningService.startQuizAttempt(examData.quiz);
          const fullQuiz = await elearningService.getQuizById(examData.quiz);
          qs = fullQuiz.questions || [];
        }
        const sess = await elearningService.startExamSession(examId, deviceTokenRef.current);
        setSession(sess);
        if (att) { setAttempt(att); setQuestions(qs); }
        if (!att && sess?.submission_note) setPdfContent(sess.submission_note);
        setContentTab(att ? 'questions' : 'pdf');

        const durationSeconds = (examData.duration_minutes || 60) * 60;
        const startedAtMs = sess?.started_at ? new Date(sess.started_at).getTime() : Date.now();
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
        setTimeLeft(Math.max(0, durationSeconds - elapsedSeconds));
        setPhase('exam');
      } catch (e) {
        setError(e?.response?.data?.detail || "Impossible de démarrer l'examen.");
        setPhase('error');
      }
    })();
  }, [examId]);

  // Anti-multi-device: periodic heartbeat while the exam is in progress. If
  // another device has taken over the lock (this one went quiet too long —
  // app backgrounded/killed), the server starts rejecting our heartbeats;
  // deliberately does NOT auto-submit here, since the other device may now
  // be the one genuinely finishing the exam — this one just backs off.
  useEffect(() => {
    if (phase !== 'exam') return undefined;
    const t = setInterval(() => {
      elearningService.heartbeatExamSession(examId, deviceTokenRef.current).catch((e) => {
        if (e?.response?.data?.code === 'DEVICE_LOCKED') {
          clearInterval(t);
          setError(e.response.data.detail || 'Votre session a été reprise sur un autre appareil.');
          setPhase('error');
        }
      });
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(t);
  }, [phase, examId]);

  // A webcam_required exam must not proceed monitored-but-blind: request
  // camera access as soon as the exam loads, and gate the actual questions
  // behind CameraRequiredGate below until it's granted (see that component's
  // comment for why a denied/unavailable camera used to fail silently).
  const cameraBlocking = phase === 'exam' && !!exam?.webcam_required && !permission?.granted;
  useEffect(() => {
    if (phase !== 'exam' || !exam?.webcam_required || permission == null) return;
    if (permission.granted || autoRequestedCamera.current) return;
    autoRequestedCamera.current = true;
    requestPermission();
  }, [phase, exam, permission, requestPermission]);

  // Timer — paused while a fraud suspension is active (handleFraudBlock
  // already deducted the 5-minute penalty up front instead) or while the
  // student hasn't granted the required camera yet.
  useEffect(() => {
    if (phase !== 'exam' || timeLeft === null || fraudBlock || cameraBlocking) return;
    if (timeLeft <= 0) { handleSubmit(true); return; }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft, fraudBlock, cameraBlocking, handleSubmit]);

  // Leaving the app (Alt-Tab equivalent) — mirrors the web exactly: the very
  // first occurrence fires the flat FRAUD_SUSPEND_MIN suspension, no grace
  // period. The check runs on *return* to active rather than at the moment
  // of backgrounding (unlike the web's onBlur, which fires immediately)
  // because JS execution — and so the logExamEvent/handleFraudBlock network
  // calls — isn't reliably able to run while the app is actually suspended;
  // resuming is the first reliable point to act.
  useEffect(() => {
    if (phase !== 'exam') return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        if (backgroundedAt.current == null) backgroundedAt.current = Date.now();
        return;
      }
      if (next !== 'active' || backgroundedAt.current == null) return;
      const awayMs = Date.now() - backgroundedAt.current;
      backgroundedAt.current = null;

      const now = Date.now();
      if (now - lastSwitchAt.current < 1000) return; // debounce a single switch firing twice
      lastSwitchAt.current = now;

      const awaySecs = Math.round(awayMs / 1000);
      elearningService.logExamEvent(examId, 'TAB_SWITCH', `App backgrounded ${awaySecs}s`).catch(() => {});
      handleFraudBlock(`Vous avez quitté l'application pendant ${awaySecs} secondes.`);
    });
    return () => sub.remove();
  }, [phase, examId, handleFraudBlock]);

  // Block hardware back button mid-exam (Android).
  useEffect(() => {
    if (phase !== 'exam') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert("Quitter l'examen ?", 'Votre progression sera perdue si vous quittez maintenant.', [
        { text: 'Rester', style: 'cancel' },
        { text: 'Quitter', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
      return true;
    });
    return () => sub.remove();
  }, [phase, navigation]);

  // Periodic frame archival (see WebcamMonitor above for capture cadence) —
  // purely for the teacher's own review server-side, no phone/face/gaze
  // reading acted on here anymore. Returns true when the AI backend
  // reported it was overloaded (ai_available: false) so WebcamMonitor's
  // capture loop can back off instead of hammering an already-saturated
  // quota — see MAX_DETECT_INTERVAL.
  // A second person in frame is unambiguous on its own — unlike a momentary
  // distraction, it doesn't need a sustained streak before it's worth
  // suspending over (handleFraudBlock's own phase/fraudBlock guard already
  // prevents stacking a second suspension on one already showing).
  const onFrame = useCallback(async (uri) => {
    try {
      const fd = new FormData();
      fd.append('snapshot', { uri, name: `snap_${Date.now()}.jpg`, type: 'image/jpeg' });
      const res = await elearningService.uploadExamSnapshot(examId, fd);
      if (res.multiple_faces) {
        handleFraudBlock('Une autre personne a été détectée à côté ou derrière le candidat.');
      }
      return res.ai_available === false;
    } catch {
      // best-effort — a single failed upload isn't itself suspicious, but a
      // network/server failure is exactly the kind of signal worth backing
      // off from too (no point retrying every 5s into whatever's failing).
      return true;
    }
  }, [examId, handleFraudBlock]);

  const onWebcamLost = useCallback((detail) => {
    if (lostReported.current) return;
    lostReported.current = true;
    elearningService.logExamEvent(examId, 'WEBCAM_LOST', detail).catch(() => {});
  }, [examId]);

  const setAnswer = useCallback((qId, data) => {
    setAnswers((prev) => ({ ...prev, [qId]: { ...(prev[qId] || {}), ...data } }));
  }, []);

  const confirmSubmit = () => setShowSubmitConfirm(true);

  if (phase === 'loading') return <View style={styles.center}><ActivityIndicator color="#059669" size="large" /></View>;

  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="close-circle-outline" size={48} color={colors.danger} />
        <Text style={{ marginTop: 10, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 24 }}>{error}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: '#059669', fontWeight: '700' }}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (phase === 'submitted') {
    // No quiz was submitted (PDF-only exam, or an exam whose only content
    // was the PDF response) — there's no auto-computed score to show yet.
    if (!result) {
      return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <ScrollView contentContainerStyle={styles.introScroll}>
            <View style={[styles.resultCard, { backgroundColor: '#F5F3FF' }]}>
              <View style={[styles.resultIconWrap, { backgroundColor: '#7C3AED' }]}>
                <Ionicons name="document-text" size={30} color="#fff" />
              </View>
              <Text style={[styles.resultTitle, { color: '#7C3AED' }]}>Copie transmise</Text>
              <Text style={styles.resultPoints}>En attente de correction par votre enseignant.</Text>
            </View>
            <TouchableOpacity style={styles.backHomeBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backHomeBtnText}>Retour aux examens</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      );
    }
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
            <Text style={[styles.resultScore, { color: passed ? colors.success : pending ? '#B45309' : colors.danger }]}>{score.toFixed(1)}%</Text>
            <Text style={styles.resultPoints}>{result?.score}/{result?.max_score} points</Text>
          </View>
          <TouchableOpacity style={styles.backHomeBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backHomeBtnText}>Retour aux examens</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── phase === 'exam' ──
  const answeredCount = questions.filter((qn) => isAnswered(answers[qn.id])).length;
  const allDone = answeredCount === questions.length;
  const timerRed = timeLeft !== null && timeLeft < 120;
  const hasQuestions = questions.length > 0;
  const hasPdfAnswer = !!exam?.exam_pdf;
  // A PDF-only exam never has a 'questions' tab to switch to, so it always
  // effectively shows the PDF panel regardless of contentTab's stored value.
  const effectiveTab = hasQuestions ? contentTab : 'pdf';

  if (cameraBlocking) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <CameraRequiredGate permission={permission} onRequest={requestPermission} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {showSubmitConfirm && (
        <SubmitConfirmModal
          answeredCount={answeredCount}
          total={questions.length}
          hasQuestions={hasQuestions}
          onCancel={() => setShowSubmitConfirm(false)}
          onConfirm={() => { setShowSubmitConfirm(false); handleSubmit(false); }}
        />
      )}

      {fraudBlock && (
        <FraudSuspensionModal
          reason={fraudBlock.reason}
          until={fraudBlock.until}
          onExpire={handleSuspensionExpire}
        />
      )}

      <View style={styles.quizHeader}>
        <WebcamMonitor enabled={!!exam?.webcam_required} permission={permission} onFrame={onFrame} onLost={onWebcamLost} />
        <View style={{ flex: 1 }}>
          <Text style={styles.quizHeaderTitle} numberOfLines={1}>{exam?.title}</Text>
          <Text style={styles.quizHeaderSub}>{answeredCount}/{questions.length} répondues · examen surveillé</Text>
        </View>
        {timeLeft !== null && (
          <View style={[styles.timerBox, timerRed && { backgroundColor: colors.dangerLight }]}>
            <Ionicons name="time-outline" size={13} color={timerRed ? colors.danger : '#059669'} />
            <Text style={[styles.timerText, { color: timerRed ? colors.danger : '#059669' }]}>{formatTime(timeLeft)}</Text>
          </View>
        )}
      </View>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(answeredCount / Math.max(questions.length, 1)) * 100}%`, backgroundColor: allDone ? colors.success : '#059669' }]} />
      </View>

      <View style={{ flex: 1 }}>
        {/* Sujet — shown automatically the moment composition starts (no more
            tap-to-open button/modal), taking half the screen above the
            questions/answer. Routed through Google Docs Viewer (see the old
            PdfViewerModal) since Android's system WebView can't reliably
            render a raw PDF uri; never Linking.openURL, which would trip the
            AppState-based fraud detector. */}
        {hasPdfAnswer && (
          <View style={{ flex: 1 }}>
            <View style={styles.subjectHeader}>
              <Ionicons name="document-text-outline" size={14} color="#fff" />
              <Text style={styles.subjectHeaderText}>Sujet de l'examen</Text>
            </View>
            <WebView
              source={{ uri: `https://docs.google.com/viewer?url=${encodeURIComponent(exam.exam_pdf)}&embedded=true` }}
              style={{ flex: 1 }}
            />
          </View>
        )}

        <View style={{ flex: 1 }}>
          {/* Questions / Réponse PDF switcher — only shown when the exam
              combines a quiz AND a PDF subject. */}
          {hasQuestions && hasPdfAnswer && (
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabBtn, effectiveTab === 'questions' && styles.tabBtnActive]}
                onPress={() => setContentTab('questions')}
              >
                <Ionicons name="list-outline" size={14} color={effectiveTab === 'questions' ? '#fff' : colors.textSecondary} />
                <Text style={[styles.tabBtnText, effectiveTab === 'questions' && styles.tabBtnTextActive]}>
                  Questions ({answeredCount}/{questions.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, effectiveTab === 'pdf' && styles.tabBtnActivePurple]}
                onPress={() => setContentTab('pdf')}
              >
                <Ionicons name="document-text-outline" size={14} color={effectiveTab === 'pdf' ? '#fff' : colors.textSecondary} />
                <Text style={[styles.tabBtnText, effectiveTab === 'pdf' && styles.tabBtnTextActive]}>Réponse PDF</Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.quizScroll}>
            {effectiveTab === 'questions' && hasQuestions && questions.map((qn, idx) => {
              const done = isAnswered(answers[qn.id]);
              return (
                <View key={qn.id} style={[styles.qCard, { borderColor: done ? '#BBF7D0' : colors.border }]}>
                  <View style={[styles.qCardHeader, { backgroundColor: done ? '#F0FDF4' : '#FAFBFF' }]}>
                    <View style={styles.qCardHeaderLeft}>
                      <View style={[styles.qIdx, { backgroundColor: done ? colors.success : '#059669' }]}>
                        <Text style={styles.qIdxText}>{idx + 1}</Text>
                      </View>
                      <Text style={[styles.qStatus, { color: done ? colors.success : '#059669' }]}>
                        {done ? '✓ Répondue' : `Question ${idx + 1}/${questions.length}`}
                      </Text>
                    </View>
                    <Text style={styles.qPts}>{qn.points} pt{qn.points > 1 ? 's' : ''}</Text>
                  </View>
                  <View style={styles.qBody}>
                    <Text style={styles.qText}>{qn.text}</Text>
                    <QuestionRenderer question={qn} answer={answers[qn.id]} onAnswer={setAnswer} secure />
                  </View>
                </View>
              );
            })}

            {effectiveTab === 'pdf' && hasPdfAnswer && (
              <PdfAnswerSection
                sessionId={session?.id}
                content={pdfContent} setContent={setPdfContent}
                error={pdfError}
              />
            )}

            <TouchableOpacity
              style={[styles.finishBtn, allDone && { backgroundColor: colors.success }]}
              onPress={confirmSubmit}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={16} color="#fff" />}
              <Text style={styles.finishBtnText}>
                {submitting ? 'Envoi...' : hasQuestions ? `Terminer · ${answeredCount}/${questions.length}` : 'Terminer et soumettre'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, gap: 8 },

  introScroll: { padding: spacing.lg, paddingBottom: 40 },
  resultCard: { borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center', gap: 4 },
  resultIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  resultTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  resultScore: { fontSize: 40, fontWeight: '900', marginVertical: 4 },
  resultPoints: { fontSize: 13, color: colors.textSecondary },
  backHomeBtn: { marginTop: 20, paddingVertical: 14, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  backHomeBtnText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },

  quizHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 8, backgroundColor: '#fff' },
  quizHeaderTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  quizHeaderSub: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  subjectHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7C3AED', paddingHorizontal: spacing.md, paddingVertical: 8 },
  subjectHeaderText: { fontSize: 12, fontWeight: '800', color: '#fff' },

  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingTop: spacing.sm, backgroundColor: '#fff' },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: radius.md, backgroundColor: colors.background },
  tabBtnActive: { backgroundColor: '#6366F1' },
  tabBtnActivePurple: { backgroundColor: '#7C3AED' },
  tabBtnText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  tabBtnTextActive: { color: '#fff' },

  pdfAnswerCard: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: 12, marginBottom: spacing.sm },
  pdfAnswerTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  pdfAnswerSub: { fontSize: 12, color: colors.textTertiary, lineHeight: 17, marginTop: -6 },
  pdfTextInput: { minHeight: 220, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 14, color: colors.text, backgroundColor: colors.background, lineHeight: 20 },
  pdfErrorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.dangerLight, padding: 10, borderRadius: radius.md },
  pdfErrorText: { fontSize: 12, fontWeight: '600', color: colors.danger, flex: 1 },
  pdfSendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: radius.lg, backgroundColor: '#7C3AED' },
  pdfSendBtnSent: { backgroundColor: colors.success },
  pdfSendBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  timerBox: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.md },
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
  qPts: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  qBody: { padding: spacing.md, gap: 12 },
  qText: { fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 20 },

  finishBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#059669', paddingVertical: 15, borderRadius: radius.lg, marginTop: 8 },
  finishBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  webcamWrap: { width: 48, height: 36, borderRadius: 8, overflow: 'hidden', backgroundColor: '#111827' },
  webcamDot: { position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: '#fff' },

  suspendOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  suspendCard: { backgroundColor: '#fff', borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center', gap: 12, maxWidth: 420, width: '100%' },
  suspendIconWrap: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.dangerLight, borderWidth: 3, borderColor: '#FCA5A5', alignItems: 'center', justifyContent: 'center' },
  suspendTitle: { fontSize: 17, fontWeight: '900', color: colors.text, textAlign: 'center' },
  suspendReason: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  suspendTimer: { fontSize: 42, fontWeight: '900', color: colors.danger, fontVariant: ['tabular-nums'] },
  suspendNote: { fontSize: 11, color: colors.textTertiary, textAlign: 'center', lineHeight: 16 },

  gateIconWrap: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.dangerLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  gateTitle: { fontSize: 17, fontWeight: '900', color: colors.text, textAlign: 'center', paddingHorizontal: 24 },
  gateText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19, paddingHorizontal: 32, marginTop: 4 },
  gateBtn: { marginTop: 16, backgroundColor: '#059669', paddingVertical: 13, paddingHorizontal: 28, borderRadius: radius.lg },
  gateBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  submitStatsRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  submitStatsCount: { fontSize: 28, fontWeight: '900', color: colors.text },
  submitStatsLabel: { fontSize: 13, color: colors.textSecondary },
  submitWarningPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.warningLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  submitWarningText: { fontSize: 12, fontWeight: '700', color: '#B45309' },
  submitActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
  submitCancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border },
  submitCancelBtnText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  submitConfirmBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: radius.lg, backgroundColor: '#059669' },
  submitConfirmBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
