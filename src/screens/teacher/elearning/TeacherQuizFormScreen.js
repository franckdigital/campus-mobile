import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Alert from '../../../utils/appAlert';
import { Ionicons } from '@expo/vector-icons';
import FormScreen from '../../../components/teacher/FormScreen';
import { TextField, ToggleRow, SectionLabel } from '../../../components/teacher/FormField';
import SelectField from '../../../components/teacher/SelectField';
import elearningService from '../../../services/elearning';
import useTeacherClassSubjects from '../../../hooks/useTeacherClassSubjects';
import { colors, spacing, radius } from '../../../theme/colors';

const ACCENT = '#7C3AED';
const GRADIENT = ['#4C1D95', '#6D28D9', '#8B5CF6'];

export default function TeacherQuizFormScreen({ navigation, route }) {
  const editing = route.params?.quiz || null;
  const { options: classSubjectOptions, loading: loadingCS } = useTeacherClassSubjects();
  const [lessons, setLessons] = useState([]);

  const [title, setTitle] = useState(editing?.title || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [classSubject, setClassSubject] = useState(editing ? `${editing.class_obj}|${editing.subject}` : '');
  const [lesson, setLesson] = useState(editing?.lesson || '');
  const [timeLimit, setTimeLimit] = useState(editing ? String(editing.time_limit_minutes) : '0');
  const [maxAttempts, setMaxAttempts] = useState(editing ? String(editing.max_attempts) : '0');
  const [passScore, setPassScore] = useState(editing ? String(editing.pass_score_percent) : '50');
  const [shuffle, setShuffle] = useState(editing?.shuffle_questions ?? true);
  const [isPublished, setIsPublished] = useState(editing?.is_published ?? false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!classSubject) { setLessons([]); return; }
    const [class_obj, subject] = classSubject.split('|');
    elearningService.getLessons({ class_obj, subject, page_size: 100 })
      .then((r) => setLessons(r?.results || r || []))
      .catch(() => setLessons([]));
  }, [classSubject]);

  const handleSave = async () => {
    if (!title.trim()) return Alert.alert('Champ requis', 'Le titre est obligatoire.');
    if (!classSubject) return Alert.alert('Champ requis', 'Choisissez une classe et une matière.');

    const [class_obj, subject] = classSubject.split('|');
    const payload = {
      title: title.trim(), description,
      class_obj, subject,
      lesson: lesson || null,
      time_limit_minutes: parseInt(timeLimit, 10) || 0,
      max_attempts: parseInt(maxAttempts, 10) || 0,
      pass_score_percent: parseInt(passScore, 10) || 50,
      shuffle_questions: shuffle,
      is_published: isPublished,
    };
    setSaving(true);
    try {
      if (editing) {
        const updated = await elearningService.updateQuiz(editing.id, payload);
        navigation.setParams({ quiz: updated });
        Alert.alert('Enregistré', 'Le quiz a été mis à jour.');
      } else {
        const created = await elearningService.createQuiz(payload);
        navigation.replace('TeacherQuizForm', { quiz: created });
      }
    } catch (e) {
      Alert.alert('Erreur', e.response?.data?.detail || "Impossible d'enregistrer ce quiz.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Supprimer le quiz', 'Cette action supprimera aussi ses questions. Irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          setDeleting(true);
          try {
            await elearningService.deleteQuiz(editing.id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Erreur', 'Impossible de supprimer ce quiz.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <FormScreen
      title={editing ? 'Modifier le quiz' : 'Nouveau quiz'}
      subtitle="Évaluations"
      gradient={GRADIENT}
      accentColor={ACCENT}
      onBack={() => navigation.goBack()}
      onSave={handleSave}
      saving={saving}
      saveLabel={editing ? 'Enregistrer les modifications' : 'Créer le quiz'}
      onDelete={editing ? handleDelete : undefined}
      deleting={deleting}
    >
      {editing && (
        <TouchableOpacity style={styles.questionsBtn} onPress={() => navigation.navigate('TeacherQuizQuestions', { quiz: editing })} activeOpacity={0.85}>
          <View style={styles.questionsBtnIcon}>
            <Ionicons name="help-circle-outline" size={20} color={ACCENT} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.questionsBtnTitle}>Gérer les questions</Text>
            <Text style={styles.questionsBtnSub}>{editing.question_count || 0} question{editing.question_count === 1 ? '' : 's'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      )}

      <TextField label="Titre" required value={title} onChangeText={setTitle} placeholder="Ex: Partiel S1 - Algorithmique" />
      <TextField label="Description" multiline value={description} onChangeText={setDescription} placeholder="Instructions pour les étudiants..." />
      <SelectField
        label="Classe et matière" required searchable accentColor={ACCENT}
        value={classSubject} onChange={(v) => { setClassSubject(v); setLesson(''); }}
        options={classSubjectOptions}
        placeholder={loadingCS ? 'Chargement...' : 'Choisir...'}
      />
      <SelectField
        label="Cours lié (optionnel)" accentColor={ACCENT}
        value={lesson} onChange={setLesson}
        options={lessons.map((l) => ({ label: l.title, value: l.id }))}
        placeholder={classSubject ? 'Aucun cours lié' : 'Choisissez une classe d\'abord'}
        disabled={!classSubject}
      />

      <SectionLabel>Paramètres</SectionLabel>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <TextField label="Durée (min, 0=illimité)" value={timeLimit} onChangeText={setTimeLimit} keyboardType="number-pad" placeholder="0" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Tentatives (0=illimité)" value={maxAttempts} onChangeText={setMaxAttempts} keyboardType="number-pad" placeholder="0" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Seuil de réussite %" value={passScore} onChangeText={setPassScore} keyboardType="number-pad" placeholder="50" />
        </View>
      </View>

      <ToggleRow label="Mélanger les questions" value={shuffle} onValueChange={setShuffle} accentColor={ACCENT} />
      <ToggleRow label="Publier ce quiz" description="Visible par les étudiants une fois publié" value={isPublished} onValueChange={setIsPublished} accentColor={ACCENT} />

      {!editing && (
        <Text style={styles.hint}>Enregistrez d'abord le quiz pour pouvoir y ajouter des questions.</Text>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  questionsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1.5, borderColor: '#7C3AED33',
  },
  questionsBtnIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' },
  questionsBtnTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  questionsBtnSub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  hint: { fontSize: 12, color: colors.textTertiary, fontStyle: 'italic', textAlign: 'center', marginTop: spacing.sm },
});
