import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import Alert from '../../../utils/appAlert';
import * as DocumentPicker from 'expo-document-picker';
import FormScreen from '../../../components/teacher/FormScreen';
import { TextField, ToggleRow, SectionLabel, FilePickerRow } from '../../../components/teacher/FormField';
import SelectField from '../../../components/teacher/SelectField';
import elearningService from '../../../services/elearning';
import useTeacherClassSubjects from '../../../hooks/useTeacherClassSubjects';

const ACCENT = '#DB2777';
const GRADIENT = ['#9D174D', '#DB2777', '#BE185D'];

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;

export default function TeacherAssignmentFormScreen({ navigation, route }) {
  const editing = route.params?.assignment || null;
  const { options: classSubjectOptions, loading: loadingCS } = useTeacherClassSubjects();
  const [lessons, setLessons] = useState([]);

  const editingDue = editing?.due_date ? new Date(editing.due_date) : null;

  const [title, setTitle] = useState(editing?.title || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [instructions, setInstructions] = useState(editing?.instructions || '');
  const [classSubject, setClassSubject] = useState(editing ? `${editing.class_obj}|${editing.subject}` : '');
  const [lesson, setLesson] = useState(editing?.lesson || '');
  const [date, setDate] = useState(editingDue ? editingDue.toISOString().slice(0, 10) : '');
  const [time, setTime] = useState(editingDue ? editingDue.toTimeString().slice(0, 5) : '23:59');
  const [maxScore, setMaxScore] = useState(editing ? String(editing.max_score) : '20');
  const [allowLate, setAllowLate] = useState(editing?.allow_late_submission ?? false);
  const [latePenalty, setLatePenalty] = useState(editing ? String(editing.late_penalty_percent || 0) : '0');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!classSubject) { setLessons([]); return; }
    const [class_obj, subject] = classSubject.split('|');
    elearningService.getLessons({ class_obj, subject, page_size: 100 })
      .then((r) => setLessons(r?.results || r || []))
      .catch(() => setLessons([]));
  }, [classSubject]);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) setFile(result.assets[0]);
    } catch {
      Alert.alert('Erreur', "Impossible d'ouvrir le sélecteur de fichiers.");
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return Alert.alert('Champ requis', 'Le titre est obligatoire.');
    if (!description.trim()) return Alert.alert('Champ requis', 'La description est obligatoire.');
    if (!classSubject) return Alert.alert('Champ requis', 'Choisissez une classe et une matière.');
    if (!dateRe.test(date)) return Alert.alert('Date invalide', "Utilisez le format AAAA-MM-JJ pour l'échéance.");
    if (!timeRe.test(time)) return Alert.alert('Heure invalide', 'Utilisez le format HH:MM.');

    const [class_obj, subject] = classSubject.split('|');
    const fields = {
      title: title.trim(), description, instructions,
      class_obj, subject,
      lesson: lesson || '',
      due_date: new Date(`${date}T${time}:00`).toISOString(),
      max_score: parseFloat(maxScore) || 20,
      allow_late_submission: allowLate,
      late_penalty_percent: parseInt(latePenalty, 10) || 0,
    };

    let payload;
    if (file) {
      const fd = new FormData();
      Object.entries(fields).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
      fd.append('attachment', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
      payload = fd;
    } else {
      payload = { ...fields, lesson: lesson || null };
    }

    setSaving(true);
    try {
      if (editing) await elearningService.updateAssignment(editing.id, payload);
      else await elearningService.createAssignment(payload);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Erreur', e.response?.data?.detail || "Impossible d'enregistrer ce devoir.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Supprimer le devoir', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          setDeleting(true);
          try {
            await elearningService.deleteAssignment(editing.id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Erreur', 'Impossible de supprimer ce devoir.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <FormScreen
      title={editing ? 'Modifier le devoir' : 'Nouveau devoir'}
      subtitle="Devoirs & Exercices"
      gradient={GRADIENT}
      accentColor={ACCENT}
      onBack={() => navigation.goBack()}
      onSave={handleSave}
      saving={saving}
      onDelete={editing ? handleDelete : undefined}
      deleting={deleting}
    >
      <TextField label="Titre" required value={title} onChangeText={setTitle} placeholder="Ex: Devoir 1 - Structures de données" />
      <TextField label="Description" required multiline value={description} onChangeText={setDescription} placeholder="Description du devoir..." />
      <TextField label="Instructions (optionnel)" multiline value={instructions} onChangeText={setInstructions} placeholder="Consignes détaillées..." />
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

      <SectionLabel>Échéance et notation</SectionLabel>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1.3 }}>
          <TextField label="Date limite" required placeholder="2026-08-01" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Heure" required placeholder="23:59" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Note max" value={maxScore} onChangeText={setMaxScore} keyboardType="numeric" placeholder="20" />
        </View>
      </View>

      <ToggleRow
        label="Autoriser les rendus tardifs"
        value={allowLate}
        onValueChange={setAllowLate}
        accentColor={ACCENT}
      />
      {allowLate && (
        <TextField label="Pénalité de retard (%)" value={latePenalty} onChangeText={setLatePenalty} keyboardType="number-pad" placeholder="0" />
      )}

      <SectionLabel>Pièce jointe</SectionLabel>
      <FilePickerRow
        label="Fichier du sujet (optionnel)"
        fileName={file?.name}
        onPick={pickFile}
        onClear={() => setFile(null)}
        accentColor={ACCENT}
      />
    </FormScreen>
  );
}
