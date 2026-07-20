import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Modal, StatusBar,
} from 'react-native';
import Alert from '../../../utils/appAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyState from '../../../components/common/EmptyState';
import { TextField, ToggleRow } from '../../../components/teacher/FormField';
import SelectField from '../../../components/teacher/SelectField';
import elearningService from '../../../services/elearning';
import { colors, spacing, radius } from '../../../theme/colors';

const ACCENT = '#7C3AED';
const GRADIENT = ['#4C1D95', '#6D28D9', '#8B5CF6'];

const QUESTION_TYPES = [
  { label: 'Choix unique (QCU)', value: 'QCU' },
  { label: 'Choix multiple (QCM)', value: 'QCM' },
  { label: 'Vrai ou Faux', value: 'TRUEFALSE' },
  { label: 'Texte libre', value: 'TEXT' },
  { label: 'Calcul / Numérique', value: 'NUMERIC' },
  { label: 'Association', value: 'MATCHING' },
  { label: 'Glisser-déposer (ordre)', value: 'ORDERING' },
];
const TYPE_LABEL = Object.fromEntries(QUESTION_TYPES.map((t) => [t.value, t.label]));
const CHOICE_TYPES = ['QCU', 'QCM', 'TRUEFALSE', 'MATCHING', 'ORDERING'];

const emptyChoice = () => ({ key: `new-${Math.random()}`, text: '', is_correct: false, match_text: '', order: 0 });

export default function TeacherQuizQuestionsScreen({ navigation, route }) {
  const quiz = route.params.quiz;
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [qType, setQType] = useState('QCU');
  const [qText, setQText] = useState('');
  const [qPoints, setQPoints] = useState('1');
  const [qExplanation, setQExplanation] = useState('');
  const [qNumericAnswer, setQNumericAnswer] = useState('');
  const [qNumericTolerance, setQNumericTolerance] = useState('0');
  const [qTextAnswer, setQTextAnswer] = useState('');
  const [choices, setChoices] = useState([emptyChoice(), emptyChoice()]);
  const [removedChoiceIds, setRemovedChoiceIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await elearningService.getQuestions({ quiz: quiz.id, page_size: 200, ordering: 'order' });
      setQuestions(res?.results || res || []);
    } catch (e) {
      console.log('questions load error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [quiz.id]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const openCreate = () => {
    setEditing(null);
    setQType('QCU'); setQText(''); setQPoints('1'); setQExplanation('');
    setQNumericAnswer(''); setQNumericTolerance('0'); setQTextAnswer('');
    setChoices([emptyChoice(), emptyChoice()]);
    setRemovedChoiceIds([]);
    setEditorOpen(true);
  };

  const openEdit = (q) => {
    setEditing(q);
    setQType(q.question_type); setQText(q.text); setQPoints(String(q.points ?? 1)); setQExplanation(q.explanation || '');
    setQNumericAnswer(q.numeric_answer != null ? String(q.numeric_answer) : '');
    setQNumericTolerance(q.numeric_tolerance != null ? String(q.numeric_tolerance) : '0');
    setQTextAnswer(q.text_answer || '');
    const existingChoices = (q.choices || []).map((c) => ({
      key: c.id, id: c.id, text: c.text, is_correct: c.is_correct, match_text: c.match_text || '', order: c.order || 0,
    }));
    setChoices(existingChoices.length ? existingChoices : [emptyChoice(), emptyChoice()]);
    setRemovedChoiceIds([]);
    setEditorOpen(true);
  };

  const addChoice = () => setChoices((prev) => [...prev, emptyChoice()]);
  const updateChoice = (key, patch) => setChoices((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const removeChoice = (key) => {
    setChoices((prev) => {
      const target = prev.find((c) => c.key === key);
      if (target?.id) setRemovedChoiceIds((ids) => [...ids, target.id]);
      return prev.filter((c) => c.key !== key);
    });
  };
  const toggleCorrect = (key) => {
    setChoices((prev) => prev.map((c) => {
      if (qType === 'QCU' || qType === 'TRUEFALSE') return { ...c, is_correct: c.key === key };
      return c.key === key ? { ...c, is_correct: !c.is_correct } : c;
    }));
  };

  const handleSaveQuestion = async () => {
    if (!qText.trim()) return Alert.alert('Champ requis', "L'énoncé de la question est obligatoire.");
    const needsChoices = CHOICE_TYPES.includes(qType);
    if (needsChoices && choices.filter((c) => c.text.trim()).length < 2) {
      return Alert.alert('Choix requis', 'Ajoutez au moins deux options.');
    }
    if (needsChoices && (qType === 'QCU' || qType === 'TRUEFALSE') && !choices.some((c) => c.is_correct)) {
      return Alert.alert('Réponse requise', 'Indiquez la bonne réponse.');
    }
    if (qType === 'NUMERIC' && qNumericAnswer.trim() === '') {
      return Alert.alert('Champ requis', 'Indiquez la réponse numérique attendue.');
    }

    const payload = {
      quiz: quiz.id, question_type: qType, text: qText.trim(),
      points: parseFloat(qPoints) || 1, explanation: qExplanation,
      order: editing ? editing.order : questions.length,
      numeric_answer: qType === 'NUMERIC' && qNumericAnswer !== '' ? parseFloat(qNumericAnswer) : null,
      numeric_tolerance: qType === 'NUMERIC' ? (parseFloat(qNumericTolerance) || 0) : 0,
      text_answer: qType === 'TEXT' ? qTextAnswer : '',
    };

    setSaving(true);
    try {
      let questionId = editing?.id;
      if (questionId) await elearningService.updateQuestion(questionId, payload);
      else {
        const created = await elearningService.createQuestion(payload);
        questionId = created.id;
      }

      if (needsChoices) {
        for (const id of removedChoiceIds) {
          await elearningService.deleteChoice(id).catch(() => {});
        }
        for (const c of choices) {
          if (!c.text.trim()) continue;
          const choicePayload = { question: questionId, text: c.text.trim(), is_correct: !!c.is_correct, match_text: c.match_text || '', order: c.order || 0 };
          if (c.id) await elearningService.updateChoice(c.id, choicePayload);
          else await elearningService.createChoice(choicePayload);
        }
      }

      setEditorOpen(false);
      load();
    } catch (e) {
      Alert.alert('Erreur', e.response?.data?.detail || "Impossible d'enregistrer la question.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = (q) => {
    Alert.alert('Supprimer la question', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          setDeletingId(q.id);
          try {
            await elearningService.deleteQuestion(q.id);
            load();
          } catch (e) {
            Alert.alert('Erreur', 'Impossible de supprimer cette question.');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const needsChoicesForType = CHOICE_TYPES.includes(qType);

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
              <Text style={styles.headerSub}>{questions.length} question{questions.length === 1 ? '' : 's'}</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={ACCENT} size="large" /></View>
      ) : (
        <FlatList
          data={questions}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
          ListEmptyComponent={<EmptyState icon="help-circle-outline" title="Aucune question" subtitle="Ajoutez votre première question avec le bouton +" />}
          renderItem={({ item, index }) => (
            <View style={styles.qCard}>
              <TouchableOpacity style={styles.qTop} onPress={() => openEdit(item)} activeOpacity={0.75}>
                <View style={styles.qBadge}>
                  <Text style={styles.qBadgeText}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.qText} numberOfLines={2}>{item.text}</Text>
                  <View style={styles.qMeta}>
                    <View style={styles.typePill}><Text style={styles.typePillText}>{TYPE_LABEL[item.question_type]}</Text></View>
                    <Text style={styles.qPoints}>{item.points} pt{item.points > 1 ? 's' : ''}</Text>
                    {CHOICE_TYPES.includes(item.question_type) && (
                      <Text style={styles.qPoints}>{(item.choices || []).length} choix</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDeleteQuestion(item)} hitSlop={8} disabled={deletingId === item.id}>
                  {deletingId === item.id
                    ? <ActivityIndicator size="small" color={colors.danger} />
                    : <Ionicons name="trash-outline" size={18} color={colors.danger} />}
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <TouchableOpacity style={[styles.fab, { backgroundColor: ACCENT }]} activeOpacity={0.85} onPress={openCreate}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      <Modal visible={editorOpen} animationType="slide" onRequestClose={() => setEditorOpen(false)}>
        <View style={styles.editorContainer}>
          <StatusBar barStyle="light-content" />
          <LinearGradient colors={GRADIENT} style={styles.editorHeader}>
            <SafeAreaView edges={['top']}>
              <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => setEditorOpen(false)} style={styles.backBtn} hitSlop={8}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{editing ? 'Modifier la question' : 'Nouvelle question'}</Text>
                <View style={{ width: 38 }} />
              </View>
            </SafeAreaView>
          </LinearGradient>

          <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
            <SelectField label="Type de question" required accentColor={ACCENT} value={qType} onChange={setQType} options={QUESTION_TYPES} />
            <TextField label="Énoncé" required multiline value={qText} onChangeText={setQText} placeholder="Posez votre question..." />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <TextField label="Points" value={qPoints} onChangeText={setQPoints} keyboardType="numeric" placeholder="1" />
              </View>
            </View>
            <TextField label="Explication (optionnel)" multiline value={qExplanation} onChangeText={setQExplanation} placeholder="Affichée après correction..." />

            {qType === 'NUMERIC' && (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <TextField label="Réponse attendue" required value={qNumericAnswer} onChangeText={setQNumericAnswer} keyboardType="numeric" placeholder="42" />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField label="Tolérance" value={qNumericTolerance} onChangeText={setQNumericTolerance} keyboardType="numeric" placeholder="0" />
                </View>
              </View>
            )}

            {qType === 'TEXT' && (
              <TextField label="Réponse attendue (optionnel)" value={qTextAnswer} onChangeText={setQTextAnswer} placeholder="Laissez vide pour correction manuelle" />
            )}

            {needsChoicesForType && (
              <View style={{ marginTop: spacing.sm }}>
                <View style={styles.choicesHeader}>
                  <Text style={styles.choicesTitle}>
                    {qType === 'MATCHING' ? 'Paires à associer' : qType === 'ORDERING' ? 'Éléments à ordonner' : 'Options de réponse'}
                  </Text>
                  <TouchableOpacity onPress={addChoice} style={styles.addChoiceBtn}>
                    <Ionicons name="add-circle" size={16} color={ACCENT} />
                    <Text style={styles.addChoiceText}>Ajouter</Text>
                  </TouchableOpacity>
                </View>
                {choices.map((c, i) => (
                  <View key={c.key} style={styles.choiceRow}>
                    {(qType === 'QCU' || qType === 'TRUEFALSE' || qType === 'QCM') && (
                      <TouchableOpacity onPress={() => toggleCorrect(c.key)} hitSlop={8}>
                        <Ionicons
                          name={c.is_correct ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={c.is_correct ? colors.success : colors.textTertiary}
                        />
                      </TouchableOpacity>
                    )}
                    {qType === 'ORDERING' && <Text style={styles.orderIndex}>{i + 1}</Text>}
                    <View style={{ flex: 1 }}>
                      <TextField
                        value={c.text}
                        onChangeText={(t) => updateChoice(c.key, { text: t, order: i })}
                        placeholder={qType === 'MATCHING' ? 'Élément' : `Option ${i + 1}`}
                      />
                      {qType === 'MATCHING' && (
                        <TextField
                          value={c.match_text}
                          onChangeText={(t) => updateChoice(c.key, { match_text: t })}
                          placeholder="Correspond à..."
                        />
                      )}
                    </View>
                    <TouchableOpacity onPress={() => removeChoice(c.key)} hitSlop={8}>
                      <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: ACCENT }, saving && { opacity: 0.7 }]}
              onPress={handleSaveQuestion}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Enregistrer la question</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff', flex: 1 },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 96 },
  qCard: { backgroundColor: '#fff', borderRadius: radius.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  qTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: spacing.md },
  qBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' },
  qBadgeText: { fontSize: 12, fontWeight: '800', color: ACCENT },
  qText: { fontSize: 14, fontWeight: '600', color: colors.text },
  qMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  typePill: { backgroundColor: colors.divider, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  typePillText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
  qPoints: { fontSize: 11, color: colors.textTertiary },

  fab: {
    position: 'absolute', right: spacing.md, bottom: spacing.md,
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
  },

  editorContainer: { flex: 1, backgroundColor: colors.background },
  editorHeader: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },

  choicesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  choicesTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  addChoiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addChoiceText: { fontSize: 12, fontWeight: '700', color: ACCENT },
  choiceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  orderIndex: { width: 20, fontSize: 13, fontWeight: '700', color: colors.textSecondary, textAlign: 'center' },

  saveBtn: { borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
