import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import Alert from '../../../utils/appAlert';
import FormScreen from '../../../components/teacher/FormScreen';
import { TextField, ToggleRow, SectionLabel } from '../../../components/teacher/FormField';
import SelectField from '../../../components/teacher/SelectField';
import scheduleService from '../../../services/schedule';
import teacherService from '../../../services/teacher';
import useTeacherClassSubjects from '../../../hooks/useTeacherClassSubjects';

const ACCENT = '#D97706';
const GRADIENT = ['#7C2D12', '#B45309', '#D97706'];

const DAY_OPTIONS = [
  { label: 'Lundi', value: 0 }, { label: 'Mardi', value: 1 }, { label: 'Mercredi', value: 2 },
  { label: 'Jeudi', value: 3 }, { label: 'Vendredi', value: 4 }, { label: 'Samedi', value: 5 }, { label: 'Dimanche', value: 6 },
];
const DAY_KEY_TO_NUM = { MONDAY: 0, TUESDAY: 1, WEDNESDAY: 2, THURSDAY: 3, FRIDAY: 4, SATURDAY: 5, SUNDAY: 6 };

export default function TeacherSessionFormScreen({ navigation, route }) {
  const editing = route.params?.session || null;
  const { options: classSubjectOptions, loading: loadingCS } = useTeacherClassSubjects();
  const [rooms, setRooms] = useState([]);
  const [semesters, setSemesters] = useState([]);

  const [classSubject, setClassSubject] = useState(
    editing ? `${editing.class_obj}|${editing.subject}` : ''
  );
  const [dayOfWeek, setDayOfWeek] = useState(
    editing ? editing.day_of_week : (DAY_KEY_TO_NUM[route.params?.dayOfWeek] ?? 0)
  );
  const [startTime, setStartTime] = useState(editing?.start_time?.slice(0, 5) || '');
  const [endTime, setEndTime] = useState(editing?.end_time?.slice(0, 5) || '');
  const [room, setRoom] = useState(editing?.room || '');
  const [semester, setSemester] = useState(editing?.semester || '');
  const [isRecurring, setIsRecurring] = useState(editing?.is_recurring ?? true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    teacherService.getRooms({ page_size: 200 }).then((r) => setRooms(r?.results || r || [])).catch(() => {});
    teacherService.getSemesters({ page_size: 50 }).then((r) => setSemesters(r?.results || r || [])).catch(() => {});
  }, []);

  const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;

  const handleSave = async () => {
    if (!classSubject) return Alert.alert('Champ requis', 'Choisissez une classe et une matière.');
    if (!timeRe.test(startTime) || !timeRe.test(endTime)) {
      return Alert.alert('Horaire invalide', 'Utilisez le format HH:MM (ex: 08:30).');
    }
    if (startTime >= endTime) return Alert.alert('Horaire invalide', "L'heure de fin doit être après l'heure de début.");

    const [class_obj, subject] = classSubject.split('|');
    const payload = {
      class_obj, subject, day_of_week: dayOfWeek,
      start_time: `${startTime}:00`, end_time: `${endTime}:00`,
      is_recurring: isRecurring,
      room: room || null,
      semester: semester || null,
    };
    setSaving(true);
    try {
      if (editing) await scheduleService.updateSession(editing.id, payload);
      else await scheduleService.createSession(payload);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Erreur', e.response?.data?.detail || "Impossible d'enregistrer cette séance.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Supprimer la séance', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          setDeleting(true);
          try {
            await scheduleService.deleteSession(editing.id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Erreur', 'Impossible de supprimer cette séance.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <FormScreen
      title={editing ? 'Modifier la séance' : 'Nouvelle séance'}
      subtitle="Emploi du temps"
      gradient={GRADIENT}
      accentColor={ACCENT}
      onBack={() => navigation.goBack()}
      onSave={handleSave}
      saving={saving}
      onDelete={editing ? handleDelete : undefined}
      deleting={deleting}
    >
      <SelectField
        label="Classe et matière" required searchable accentColor={ACCENT}
        value={classSubject} onChange={setClassSubject}
        options={classSubjectOptions}
        placeholder={loadingCS ? 'Chargement...' : 'Choisir...'}
      />
      <SelectField
        label="Jour" required accentColor={ACCENT}
        value={dayOfWeek} onChange={setDayOfWeek}
        options={DAY_OPTIONS}
      />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <TextField label="Heure de début" required placeholder="08:30" value={startTime} onChangeText={setStartTime} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Heure de fin" required placeholder="10:00" value={endTime} onChangeText={setEndTime} keyboardType="numbers-and-punctuation" />
        </View>
      </View>
      <SelectField
        label="Salle (optionnel)" searchable accentColor={ACCENT}
        value={room} onChange={setRoom}
        options={rooms.map((r) => ({ label: r.name, value: r.id }))}
        placeholder="Aucune salle"
      />
      <SelectField
        label="Semestre (optionnel)" accentColor={ACCENT}
        value={semester} onChange={setSemester}
        options={semesters.map((s) => ({ label: s.name || s.label, value: s.id }))}
        placeholder="Non spécifié"
      />
      <SectionLabel>Récurrence</SectionLabel>
      <ToggleRow
        label="Séance récurrente"
        description="Se répète chaque semaine à ce créneau"
        value={isRecurring}
        onValueChange={setIsRecurring}
        accentColor={ACCENT}
      />
    </FormScreen>
  );
}
