import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import Alert from '../../../utils/appAlert';
import * as DocumentPicker from 'expo-document-picker';
import FormScreen from '../../../components/teacher/FormScreen';
import { TextField, ToggleRow, SectionLabel, FilePickerRow } from '../../../components/teacher/FormField';
import SelectField from '../../../components/teacher/SelectField';
import elearningService from '../../../services/elearning';
import useTeacherClassSubjects from '../../../hooks/useTeacherClassSubjects';

const ACCENT = '#059669';
const GRADIENT = ['#064E3B', '#059669', '#10B981'];

const EXAM_TYPES = [
  { label: 'Partiel', value: 'MID' },
  { label: 'Examen final', value: 'FINAL' },
  { label: 'Rattrapage', value: 'SUPP' },
  { label: 'TP noté', value: 'TP' },
  { label: 'Concours', value: 'CONCOURS' },
];

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;

function splitDateTime(iso) {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  return { date: d.toISOString().slice(0, 10), time: d.toTimeString().slice(0, 5) };
}

export default function TeacherExamFormScreen({ navigation, route }) {
  const editing = route.params?.exam || null;
  const { options: classSubjectOptions, loading: loadingCS } = useTeacherClassSubjects();
  const [quizzes, setQuizzes] = useState([]);

  const startDT = splitDateTime(editing?.start_date);
  const endDT = splitDateTime(editing?.end_date);

  const [title, setTitle] = useState(editing?.title || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [classSubject, setClassSubject] = useState(editing ? `${editing.class_obj}|${editing.subject}` : '');
  const [examType, setExamType] = useState(editing?.exam_type || 'MID');
  const [quiz, setQuiz] = useState(editing?.quiz || '');
  const [duration, setDuration] = useState(editing ? String(editing.duration_minutes) : '60');
  const [startDate, setStartDate] = useState(startDT.date);
  const [startTime, setStartTime] = useState(startDT.time);
  const [endDate, setEndDate] = useState(endDT.date);
  const [endTime, setEndTime] = useState(endDT.time);
  const [maxAttempts, setMaxAttempts] = useState(editing ? String(editing.max_attempts) : '1');
  const [passScore, setPassScore] = useState(editing ? String(editing.pass_score_percent) : '50');
  const [coefficient, setCoefficient] = useState(editing ? String(editing.coefficient) : '1');
  const [maxScore, setMaxScore] = useState(editing ? String(editing.max_score) : '20');
  const [fullscreenRequired, setFullscreenRequired] = useState(editing?.fullscreen_required ?? true);
  const [webcamRequired, setWebcamRequired] = useState(editing?.webcam_required ?? false);
  const [blockCopyPaste, setBlockCopyPaste] = useState(editing?.block_copy_paste ?? true);
  const [maxTabSwitches, setMaxTabSwitches] = useState(editing ? String(editing.max_tab_switches) : '1');
  const [requirePhoto, setRequirePhoto] = useState(editing?.require_student_photo ?? false);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!classSubject) { setQuizzes([]); return; }
    const [class_obj, subject] = classSubject.split('|');
    elearningService.getQuizzes({ class_obj, subject, page_size: 100 })
      .then((r) => setQuizzes(r?.results || r || []))
      .catch(() => setQuizzes([]));
  }, [classSubject]);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.length > 0) setFile(result.assets[0]);
    } catch {
      Alert.alert('Erreur', "Impossible d'ouvrir le sélecteur de fichiers.");
    }
  };

  const handleSave = async () => {
    if (!classSubject) return Alert.alert('Champ requis', 'Choisissez une classe et une matière.');
    if (startDate && !dateRe.test(startDate)) return Alert.alert('Date invalide', 'Format de date de début invalide (AAAA-MM-JJ).');
    if (startTime && !timeRe.test(startTime)) return Alert.alert('Heure invalide', 'Format d\'heure de début invalide (HH:MM).');
    if (endDate && !dateRe.test(endDate)) return Alert.alert('Date invalide', 'Format de date de fin invalide (AAAA-MM-JJ).');
    if (endTime && !timeRe.test(endTime)) return Alert.alert('Heure invalide', 'Format d\'heure de fin invalide (HH:MM).');

    const [class_obj, subject] = classSubject.split('|');
    const fields = {
      title: title.trim(), description,
      class_obj, subject,
      quiz: quiz || '',
      exam_type: examType,
      duration_minutes: parseInt(duration, 10) || 60,
      start_date: startDate && startTime ? new Date(`${startDate}T${startTime}:00`).toISOString() : '',
      end_date: endDate && endTime ? new Date(`${endDate}T${endTime}:00`).toISOString() : '',
      max_attempts: parseInt(maxAttempts, 10) || 1,
      fullscreen_required: fullscreenRequired,
      webcam_required: webcamRequired,
      block_copy_paste: blockCopyPaste,
      max_tab_switches: parseInt(maxTabSwitches, 10) || 1,
      require_student_photo: requirePhoto,
      pass_score_percent: parseInt(passScore, 10) || 50,
      coefficient: parseFloat(coefficient) || 1,
      max_score: parseFloat(maxScore) || 20,
    };

    let payload;
    if (file) {
      const fd = new FormData();
      Object.entries(fields).forEach(([k, v]) => {
        if (v === null || v === undefined) return;
        fd.append(k, typeof v === 'boolean' ? String(v) : String(v));
      });
      fd.append('subject_file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
      payload = fd;
    } else {
      payload = { ...fields, quiz: quiz || null };
    }

    setSaving(true);
    try {
      if (editing) await elearningService.updateSecureExam(editing.id, payload);
      else await elearningService.createSecureExam(payload);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Erreur', e.response?.data?.detail || "Impossible d'enregistrer cet examen.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Supprimer l\'examen', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          setDeleting(true);
          try {
            await elearningService.deleteSecureExam(editing.id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Erreur', 'Impossible de supprimer cet examen.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <FormScreen
      title={editing ? 'Modifier l\'examen' : 'Nouvel examen sécurisé'}
      subtitle="Examens sécurisés"
      gradient={GRADIENT}
      accentColor={ACCENT}
      onBack={() => navigation.goBack()}
      onSave={handleSave}
      saving={saving}
      onDelete={editing ? handleDelete : undefined}
      deleting={deleting}
    >
      <TextField label="Titre" value={title} onChangeText={setTitle} placeholder="Ex: Examen final S1" />
      <TextField label="Description" multiline value={description} onChangeText={setDescription} placeholder="Description de l'examen..." />
      <SelectField
        label="Classe et matière" required searchable accentColor={ACCENT}
        value={classSubject} onChange={(v) => { setClassSubject(v); setQuiz(''); }}
        options={classSubjectOptions}
        placeholder={loadingCS ? 'Chargement...' : 'Choisir...'}
      />
      <SelectField label="Type d'examen" required accentColor={ACCENT} value={examType} onChange={setExamType} options={EXAM_TYPES} />
      <SelectField
        label="Quiz lié (optionnel, pour un examen QCM)" accentColor={ACCENT}
        value={quiz} onChange={setQuiz}
        options={quizzes.map((q) => ({ label: q.title, value: q.id }))}
        placeholder={classSubject ? 'Aucun quiz lié' : 'Choisissez une classe d\'abord'}
        disabled={!classSubject}
      />

      <SectionLabel>Créneau et notation</SectionLabel>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1.3 }}>
          <TextField label="Date début" placeholder="2026-08-01" value={startDate} onChangeText={setStartDate} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Heure" placeholder="09:00" value={startTime} onChangeText={setStartTime} keyboardType="numbers-and-punctuation" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1.3 }}>
          <TextField label="Date fin" placeholder="2026-08-01" value={endDate} onChangeText={setEndDate} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Heure" placeholder="11:00" value={endTime} onChangeText={setEndTime} keyboardType="numbers-and-punctuation" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <TextField label="Durée (min)" value={duration} onChangeText={setDuration} keyboardType="number-pad" placeholder="60" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Tentatives max" value={maxAttempts} onChangeText={setMaxAttempts} keyboardType="number-pad" placeholder="1" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <TextField label="Seuil de réussite %" value={passScore} onChangeText={setPassScore} keyboardType="number-pad" placeholder="50" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Coefficient" value={coefficient} onChangeText={setCoefficient} keyboardType="numeric" placeholder="1" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Note max" value={maxScore} onChangeText={setMaxScore} keyboardType="numeric" placeholder="20" />
        </View>
      </View>

      <SectionLabel>Sécurité</SectionLabel>
      <ToggleRow label="Plein écran obligatoire" value={fullscreenRequired} onValueChange={setFullscreenRequired} accentColor={ACCENT} />
      <ToggleRow label="Webcam obligatoire" value={webcamRequired} onValueChange={setWebcamRequired} accentColor={ACCENT} />
      <ToggleRow label="Bloquer copier-coller" value={blockCopyPaste} onValueChange={setBlockCopyPaste} accentColor={ACCENT} />
      <ToggleRow label="Photo d'identité requise" value={requirePhoto} onValueChange={setRequirePhoto} accentColor={ACCENT} />
      <TextField label="Changements d'onglet autorisés" value={maxTabSwitches} onChangeText={setMaxTabSwitches} keyboardType="number-pad" placeholder="1" />

      <SectionLabel>Sujet</SectionLabel>
      <FilePickerRow label="Fichier du sujet (optionnel)" fileName={file?.name} onPick={pickFile} onClear={() => setFile(null)} accentColor={ACCENT} />
    </FormScreen>
  );
}
