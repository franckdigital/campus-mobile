import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import Alert from '../../../utils/appAlert';
import FormScreen from '../../../components/teacher/FormScreen';
import { TextField, SectionLabel } from '../../../components/teacher/FormField';
import SelectField from '../../../components/teacher/SelectField';
import elearningService from '../../../services/elearning';
import useTeacherClassSubjects from '../../../hooks/useTeacherClassSubjects';

const ACCENT = '#2563EB';
const GRADIENT = ['#1E3A8A', '#1D4ED8', '#2563EB'];

const PROVIDERS = [
  { label: 'Jitsi Meet (intégré, sans compte requis)', value: 'JITSI' },
  { label: 'Zoom', value: 'ZOOM' },
  { label: 'Google Meet', value: 'MEET' },
  { label: 'Microsoft Teams', value: 'TEAMS' },
  { label: 'BigBlueButton', value: 'BBB' },
  { label: 'Autre', value: 'OTHER' },
];

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;

export default function TeacherClassroomFormScreen({ navigation, route }) {
  const editing = route.params?.classroom || null;
  const { options: classSubjectOptions, loading: loadingCS } = useTeacherClassSubjects();
  const [lessons, setLessons] = useState([]);

  const editingStart = editing?.start_time ? new Date(editing.start_time) : null;

  const [title, setTitle] = useState(editing?.title || '');
  const [provider, setProvider] = useState(editing?.provider || 'JITSI');
  const [classSubject, setClassSubject] = useState(editing ? `${editing.class_obj}|${editing.subject}` : '');
  const [lesson, setLesson] = useState(editing?.lesson || '');
  const [date, setDate] = useState(editingStart ? editingStart.toISOString().slice(0, 10) : '');
  const [time, setTime] = useState(editingStart ? editingStart.toTimeString().slice(0, 5) : '');
  const [duration, setDuration] = useState(editing ? String(editing.duration_minutes) : '60');
  const [joinUrl, setJoinUrl] = useState(editing?.join_url || '');
  const [hostUrl, setHostUrl] = useState(editing?.host_url || '');
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
    if (!dateRe.test(date)) return Alert.alert('Date invalide', 'Utilisez le format AAAA-MM-JJ.');
    if (!timeRe.test(time)) return Alert.alert('Heure invalide', 'Utilisez le format HH:MM.');
    if (provider !== 'JITSI' && !joinUrl.trim()) {
      return Alert.alert('Lien requis', `Indiquez le lien de la réunion ${provider} (join_url).`);
    }

    const [class_obj, subject] = classSubject.split('|');
    const payload = {
      title: title.trim(), provider,
      class_obj, subject,
      lesson: lesson || null,
      start_time: new Date(`${date}T${time}:00`).toISOString(),
      duration_minutes: parseInt(duration, 10) || 60,
      join_url: joinUrl.trim(),
      host_url: hostUrl.trim(),
    };
    setSaving(true);
    try {
      if (editing) await elearningService.updateClassroom(editing.id, payload);
      else await elearningService.createClassroom(payload);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Erreur', e.response?.data?.detail || "Impossible d'enregistrer cette session.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Supprimer la session', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          setDeleting(true);
          try {
            await elearningService.deleteClassroom(editing.id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Erreur', 'Impossible de supprimer cette session.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <FormScreen
      title={editing ? 'Modifier la session' : 'Nouvelle classe virtuelle'}
      subtitle="Classes virtuelles"
      gradient={GRADIENT}
      accentColor={ACCENT}
      onBack={() => navigation.goBack()}
      onSave={handleSave}
      saving={saving}
      onDelete={editing ? handleDelete : undefined}
      deleting={deleting}
    >
      <TextField label="Titre" required value={title} onChangeText={setTitle} placeholder="Ex: Séance de révision TP3" />
      <SelectField label="Plateforme" required accentColor={ACCENT} value={provider} onChange={setProvider} options={PROVIDERS} />
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

      <SectionLabel>Date et durée</SectionLabel>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1.3 }}>
          <TextField label="Date" required placeholder="2026-07-20" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Heure" required placeholder="14:00" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Durée (min)" required placeholder="60" value={duration} onChangeText={setDuration} keyboardType="number-pad" />
        </View>
      </View>

      {provider !== 'JITSI' && (
        <>
          <SectionLabel>Lien de la réunion ({provider})</SectionLabel>
          <TextField label="Lien pour rejoindre (join_url)" required value={joinUrl} onChangeText={setJoinUrl} placeholder="https://..." autoCapitalize="none" />
          <TextField label="Lien animateur (optionnel)" value={hostUrl} onChangeText={setHostUrl} placeholder="https://..." autoCapitalize="none" />
        </>
      )}
    </FormScreen>
  );
}
