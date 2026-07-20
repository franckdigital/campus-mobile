import React, { useState, useEffect } from 'react';
import Alert from '../../../utils/appAlert';
import FormScreen from '../../../components/teacher/FormScreen';
import { TextField, ToggleRow } from '../../../components/teacher/FormField';
import SelectField from '../../../components/teacher/SelectField';
import elearningService from '../../../services/elearning';
import useTeacherClassSubjects from '../../../hooks/useTeacherClassSubjects';

const ACCENT = '#DB2777';
const GRADIENT = ['#9D174D', '#DB2777', '#BE185D'];

export default function TeacherLessonFormScreen({ navigation, route }) {
  const editing = route.params?.lesson || null;
  const { options: classSubjectOptions, loading: loadingCS } = useTeacherClassSubjects();
  const [chapters, setChapters] = useState([]);

  const [title, setTitle] = useState(editing?.title || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [content, setContent] = useState(editing?.content || '');
  const [classSubject, setClassSubject] = useState(editing ? `${editing.class_obj}|${editing.subject}` : '');
  const [chapter, setChapter] = useState(editing?.chapter || '');
  const [isPublished, setIsPublished] = useState(editing?.is_published ?? false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!classSubject) { setChapters([]); return; }
    const [class_obj, subject] = classSubject.split('|');
    elearningService.getChapters({ class_obj, subject, page_size: 100 })
      .then((r) => setChapters(r?.results || r || []))
      .catch(() => setChapters([]));
  }, [classSubject]);

  const handleSave = async () => {
    if (!title.trim()) return Alert.alert('Champ requis', 'Le titre est obligatoire.');
    if (!classSubject) return Alert.alert('Champ requis', 'Choisissez une classe et une matière.');

    const [class_obj, subject] = classSubject.split('|');
    const payload = {
      title: title.trim(), description, content,
      class_obj, subject,
      chapter: chapter || null,
      is_published: isPublished,
    };
    setSaving(true);
    try {
      if (editing) await elearningService.updateLesson(editing.id, payload);
      else await elearningService.createLesson(payload);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Erreur', e.response?.data?.detail || "Impossible d'enregistrer ce cours.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Supprimer le cours', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          setDeleting(true);
          try {
            await elearningService.deleteLesson(editing.id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Erreur', 'Impossible de supprimer ce cours.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <FormScreen
      title={editing ? 'Modifier le cours' : 'Nouveau cours'}
      subtitle="Cours & leçons"
      gradient={GRADIENT}
      accentColor={ACCENT}
      onBack={() => navigation.goBack()}
      onSave={handleSave}
      saving={saving}
      onDelete={editing ? handleDelete : undefined}
      deleting={deleting}
    >
      <TextField label="Titre" required value={title} onChangeText={setTitle} placeholder="Ex: Introduction aux algorithmes" />
      <SelectField
        label="Classe et matière" required searchable accentColor={ACCENT}
        value={classSubject} onChange={(v) => { setClassSubject(v); setChapter(''); }}
        options={classSubjectOptions}
        placeholder={loadingCS ? 'Chargement...' : 'Choisir...'}
      />
      <SelectField
        label="Chapitre (optionnel)" accentColor={ACCENT}
        value={chapter} onChange={setChapter}
        options={chapters.map((c) => ({ label: c.title, value: c.id }))}
        placeholder={classSubject ? 'Aucun chapitre' : 'Choisissez une classe d\'abord'}
        disabled={!classSubject}
      />
      <TextField label="Description" multiline value={description} onChangeText={setDescription} placeholder="Résumé du cours..." />
      <TextField label="Contenu" multiline value={content} onChangeText={setContent} placeholder="Contenu du cours (texte, liens...)" />
      <ToggleRow
        label="Publier ce cours"
        description="Visible par les étudiants une fois publié"
        value={isPublished}
        onValueChange={setIsPublished}
        accentColor={ACCENT}
      />
    </FormScreen>
  );
}
