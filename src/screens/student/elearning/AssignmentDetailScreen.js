import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Linking,
} from 'react-native';
import Alert from '../../../utils/appAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { elearningService } from '../../../services/elearning';
import { colors, spacing, radius } from '../../../theme/colors';

const PINK = '#DB2777';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AssignmentDetailScreen({ route, navigation }) {
  const { assignment: initial } = route.params;
  const [assignment, setAssignment] = useState(initial);
  const [submission, setSubmission] = useState(initial.submission || null);
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await elearningService.getAssignmentById(initial.id);
      setAssignment(res);
      if (res.submissions?.length) setSubmission(res.submissions[0]);
    } catch (e) { console.log('Assignment detail error:', e.message); }
  }, [initial.id]);

  useEffect(() => { load(); }, [load]);

  const isPastDue = assignment.due_date && new Date(assignment.due_date) < new Date();
  const correction = submission?.correction;
  const isGraded = correction?.score != null;

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

  const submit = async () => {
    if (!content.trim() && !file) {
      setError('Veuillez rédiger une réponse ou joindre un fichier.');
      return;
    }
    setSubmitting(true); setError('');
    try {
      const fd = new FormData();
      if (content.trim()) fd.append('content', content.trim());
      if (file) fd.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
      const res = await elearningService.submitAssignment(assignment.id, fd);
      setSubmission(res);
      setCompleting(false);
      setContent(''); setFile(null);
      Alert.alert('Devoir soumis', 'Votre soumission a bien été enregistrée.');
    } catch (e) {
      setError(e?.response?.data?.detail || 'Erreur lors de la soumission.');
    } finally {
      setSubmitting(false);
    }
  };

  const borderClr = submission ? colors.success : isPastDue ? colors.danger : colors.warning;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#9D174D', PINK, '#BE185D']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{assignment.title}</Text>
            <View style={{ width: 38 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: borderClr }]}>
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Date limite</Text>
              <Text style={[styles.metaValue, isPastDue && { color: colors.danger }]}>{fmt(assignment.due_date)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Note max</Text>
              <Text style={styles.metaValue}>{assignment.max_score || 20} pts</Text>
            </View>
            {!!assignment.teacher_name && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Enseignant</Text>
                <Text style={styles.metaValue}>{assignment.teacher_name}</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Statut</Text>
              <Text style={[styles.metaValue, { color: borderClr }]}>
                {submission ? (isGraded ? 'Corrigé' : 'Rendu') : isPastDue ? 'En retard' : 'À rendre'}
              </Text>
            </View>
          </View>
        </View>

        {!!assignment.description && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.sectionText}>{assignment.description}</Text>
          </View>
        )}
        {!!assignment.instructions && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            <Text style={styles.sectionText}>{assignment.instructions}</Text>
          </View>
        )}
        {!!assignment.attachment && (
          <TouchableOpacity style={styles.pdfCard} onPress={() => Linking.openURL(assignment.attachment)}>
            <View style={styles.pdfIcon}><Ionicons name="document-text-outline" size={20} color="#7C3AED" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pdfTitle}>Sujet du devoir</Text>
              <Text style={styles.pdfSub}>Ouvrir le PDF</Text>
            </View>
            <Ionicons name="download-outline" size={18} color="#7C3AED" />
          </TouchableOpacity>
        )}

        {/* Grade */}
        {isGraded && (
          <View style={[styles.card, { backgroundColor: colors.successLight, borderWidth: 0 }]}>
            <View style={styles.gradeRow}>
              <Text style={styles.gradeScore}>{correction.score}</Text>
              <Text style={styles.gradeMax}>/ {assignment.max_score || 20} pts</Text>
            </View>
            {!!correction.feedback && (
              <View style={styles.feedbackBox}>
                <Text style={styles.feedbackLabel}>Commentaire du professeur</Text>
                <Text style={styles.feedbackText}>{correction.feedback}</Text>
              </View>
            )}
            {!!correction.corrected_file && (
              <TouchableOpacity style={styles.correctionBtn} onPress={() => Linking.openURL(correction.corrected_file)}>
                <Ionicons name="download-outline" size={16} color="#fff" />
                <Text style={styles.correctionBtnText}>Télécharger la correction</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Submission summary / submit form */}
        {submission && !completing ? (
          <View style={styles.card}>
            <View style={styles.submittedRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.submittedTitle}>Devoir soumis</Text>
                <Text style={styles.submittedSub}>
                  {fmt(submission.submitted_at)}{submission.is_late ? ' · En retard' : ''}
                  {!isGraded ? ' · En attente de correction' : ''}
                </Text>
              </View>
            </View>
            {!!submission.content && (
              <View style={styles.answerBox}>
                <Text style={styles.metaLabel}>Votre réponse</Text>
                <Text style={styles.sectionText}>{submission.content}</Text>
              </View>
            )}
            {!!submission.file && (
              <TouchableOpacity style={styles.fileChip} onPress={() => Linking.openURL(submission.file)}>
                <Ionicons name="document-attach-outline" size={15} color="#7C3AED" />
                <Text style={styles.fileChipText}>Votre fichier soumis</Text>
              </TouchableOpacity>
            )}
            {!isGraded && (!submission.file || !submission.content) && (
              <TouchableOpacity
                style={styles.completeBtn}
                onPress={() => { setContent(submission.content || ''); setCompleting(true); }}
              >
                <Ionicons name="add-circle-outline" size={16} color="#B45309" />
                <Text style={styles.completeBtnText}>
                  {!submission.file ? 'Ajouter le fichier de ma copie' : 'Ajouter une réponse texte'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.formHeaderRow}>
              <Text style={styles.sectionTitle}>{completing ? 'Compléter ma soumission' : 'Rendre le devoir'}</Text>
              {completing && (
                <TouchableOpacity onPress={() => setCompleting(false)}>
                  <Text style={styles.cancelLink}>Annuler</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.metaLabel}>Votre réponse (optionnel si fichier joint)</Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={5}
              placeholder="Rédigez votre réponse ici..."
              placeholderTextColor={colors.textTertiary}
              style={styles.textArea}
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.filePicker} onPress={pickFile}>
              <Ionicons name="cloud-upload-outline" size={20} color={file ? PINK : colors.textTertiary} />
              <Text style={[styles.filePickerText, file && { color: PINK, fontWeight: '700' }]}>
                {file ? file.name : 'Joindre un fichier (PDF, image, Word, ZIP)'}
              </Text>
            </TouchableOpacity>
            {!!error && <Text style={styles.errorText}>{error}</Text>}
            <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={16} color="#fff" />}
              <Text style={styles.submitBtnText}>{submitting ? 'Envoi...' : 'Soumettre le devoir'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#fff', textAlign: 'center' },

  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },

  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  metaItem: { minWidth: '40%' },
  metaLabel: { fontSize: 11, fontWeight: '700', color: colors.textTertiary, marginBottom: 2, textTransform: 'uppercase' },
  metaValue: { fontSize: 14, fontWeight: '700', color: colors.text },

  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  sectionText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },

  pdfCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FAF5FF', borderWidth: 1.5, borderColor: '#EDE9FE', borderStyle: 'dashed', borderRadius: radius.lg, padding: spacing.md },
  pdfIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center' },
  pdfTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  pdfSub: { fontSize: 11, color: '#9F7AEA', marginTop: 1 },

  gradeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  gradeScore: { fontSize: 36, fontWeight: '900', color: colors.success },
  gradeMax: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  feedbackBox: { backgroundColor: '#fff', borderRadius: radius.md, padding: 12, gap: 4 },
  feedbackLabel: { fontSize: 11, fontWeight: '700', color: colors.textTertiary },
  feedbackText: { fontSize: 13, color: colors.text },
  correctionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.success, paddingVertical: 12, borderRadius: radius.md },
  correctionBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  submittedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  submittedTitle: { fontSize: 14, fontWeight: '700', color: colors.success },
  submittedSub: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  answerBox: { backgroundColor: colors.background, borderRadius: radius.md, padding: 12, gap: 4 },
  fileChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F3FF', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md },
  fileChipText: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  completeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.warningLight, borderWidth: 1.5, borderColor: '#FDE68A', paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, alignSelf: 'flex-start' },
  completeBtnText: { fontSize: 12, fontWeight: '700', color: '#B45309' },

  formHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cancelLink: { fontSize: 12, fontWeight: '700', color: colors.textTertiary },
  textArea: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 13, color: colors.text, minHeight: 100 },
  filePicker: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.md, padding: 14, justifyContent: 'center' },
  filePickerText: { fontSize: 13, color: colors.textSecondary },
  errorText: { fontSize: 12, color: colors.danger, fontWeight: '600' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: PINK, paddingVertical: 13, borderRadius: radius.md },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
