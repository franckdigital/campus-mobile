import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, StatusBar,
} from 'react-native';
import Alert from '../../utils/appAlert';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import EmptyState from '../../components/common/EmptyState';
import { TextField, ToggleRow, FilePickerRow } from '../../components/teacher/FormField';
import SelectField from '../../components/teacher/SelectField';
import teacherService from '../../services/teacher';
import { colors, spacing, radius } from '../../theme/colors';

const TC = '#0891b2';
const TB = '#ecfeff';

const TEACHER_COLORS = ['#6366f1', '#0891b2', '#059669', '#d97706', '#db2777', '#7c3aed'];
function teacherColor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return TEACHER_COLORS[Math.abs(h) % TEACHER_COLORS.length];
}

const CONTRACT_LABELS = {
  PERMANENT: { label: 'Permanent', bg: '#d1fae5', color: '#059669' },
  CONTRACT: { label: 'Contractuel', bg: '#fef3c7', color: '#d97706' },
  VISITING: { label: 'Vacataire', bg: '#e0e7ff', color: '#6366f1' },
};

const DOC_TYPES = [
  { label: "Pièce d'identité", value: 'IDENTITY', icon: '🪪', color: '#6366f1', bg: '#e0e7ff' },
  { label: 'Diplôme', value: 'DIPLOMA', icon: '🎓', color: '#0891b2', bg: '#ecfeff' },
  { label: 'Certificat', value: 'CERTIFICATE', icon: '📜', color: '#059669', bg: '#d1fae5' },
  { label: 'Autre', value: 'OTHER', icon: '📄', color: '#64748b', bg: '#f1f5f9' },
];
const DOC_TYPE_MAP = Object.fromEntries(DOC_TYPES.map((t) => [t.value, t]));

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const TABS = [
  { id: 'info', label: 'Informations' },
  { id: 'aff', label: 'Affectations' },
  { id: 'edt', label: 'Emploi du temps' },
  { id: 'exp', label: 'Expériences' },
  { id: 'docs', label: 'Documents' },
];

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: TB }]}>
        <Ionicons name={icon} size={16} color={TC} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={2}>{value || '—'}</Text>
      </View>
    </View>
  );
}

// ── Experiences tab (lazy-loaded) ────────────────────────────────────────────
function ExperiencesTab({ teacherId }) {
  const [exps, setExps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ position: '', company: '', start_date: '', end_date: '', is_current: false, description: '' });

  const load = useCallback(() => {
    setLoading(true);
    teacherService.getTeacherExperiences(teacherId)
      .then((r) => setExps(Array.isArray(r) ? r : (r?.results || [])))
      .catch(() => setExps([]))
      .finally(() => setLoading(false));
  }, [teacherId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.position.trim() || !form.company.trim() || !form.start_date.trim()) {
      return Alert.alert('Champs requis', 'Poste, établissement et date de début sont obligatoires.');
    }
    setSaving(true);
    try {
      const payload = { ...form, end_date: form.is_current ? null : (form.end_date || null) };
      const created = await teacherService.addTeacherExperience(teacherId, payload);
      setExps((prev) => [created, ...(prev || [])]);
      setForm({ position: '', company: '', start_date: '', end_date: '', is_current: false, description: '' });
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d’enregistrer cette expérience.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (exp) => {
    Alert.alert('Supprimer', `Supprimer l'expérience "${exp.position}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          try {
            await teacherService.deleteTeacherExperience(teacherId, exp.id);
            setExps((prev) => prev.filter((e) => e.id !== exp.id));
          } catch { Alert.alert('Erreur', 'Suppression impossible.'); }
        },
      },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.addBox}>
        <Text style={styles.addBoxTitle}>Ajouter une expérience</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <TextField label="Poste / Titre" required value={form.position} onChangeText={(v) => setForm((p) => ({ ...p, position: v }))} placeholder="Ex: Professeur de Mathématiques" />
          </View>
        </View>
        <TextField label="Établissement / Entreprise" required value={form.company} onChangeText={(v) => setForm((p) => ({ ...p, company: v }))} placeholder="Ex: Lycée National" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <TextField label="Date de début" required value={form.start_date} onChangeText={(v) => setForm((p) => ({ ...p, start_date: v }))} placeholder="AAAA-MM-JJ" keyboardType="numbers-and-punctuation" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Date de fin" value={form.is_current ? '' : form.end_date} onChangeText={(v) => setForm((p) => ({ ...p, end_date: v }))} placeholder="AAAA-MM-JJ" keyboardType="numbers-and-punctuation" editable={!form.is_current} />
          </View>
        </View>
        <ToggleRow label="Poste actuel" value={form.is_current} onValueChange={(v) => setForm((p) => ({ ...p, is_current: v, end_date: v ? '' : p.end_date }))} accentColor="#059669" />
        <TextField label="Description (optionnel)" multiline value={form.description} onChangeText={(v) => setForm((p) => ({ ...p, description: v }))} />
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#059669' }, saving && { opacity: 0.7 }]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : (
            <><Ionicons name="add" size={14} color="#fff" /><Text style={styles.addBtnText}>Ajouter</Text></>
          )}
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color="#059669" style={{ marginVertical: 20 }} /> : !exps?.length ? (
        <EmptyState icon="briefcase-outline" title="Aucune expérience enregistrée" />
      ) : (
        <View style={{ gap: 8, marginTop: spacing.md }}>
          {exps.map((exp) => (
            <View key={exp.id} style={styles.listRow}>
              <View style={[styles.listRowIcon, { backgroundColor: '#d1fae5' }]}>
                <Ionicons name="briefcase-outline" size={16} color="#059669" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.listRowTitle}>{exp.position}</Text>
                <Text style={[styles.listRowSub, { color: TC }]}>{exp.company}</Text>
                <Text style={styles.listRowMeta}>
                  {exp.start_date ? new Date(exp.start_date).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : '—'}
                  {' – '}
                  {exp.is_current ? 'Présent' : (exp.end_date ? new Date(exp.end_date).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : '—')}
                </Text>
                {!!exp.description && <Text style={styles.listRowDesc}>{exp.description}</Text>}
              </View>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => remove(exp)}>
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Documents tab (lazy-loaded) ──────────────────────────────────────────────
function DocumentsTab({ teacherId }) {
  const [docs, setDocs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('DIPLOMA');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    teacherService.getTeacherDocuments(teacherId)
      .then((r) => setDocs(Array.isArray(r) ? r : (r?.results || [])))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [teacherId]);

  useEffect(() => { load(); }, [load]);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) setFile(result.assets[0]);
    } catch {
      Alert.alert('Erreur', "Impossible d'ouvrir le sélecteur de fichiers.");
    }
  };

  const upload = async () => {
    if (!file || !title.trim()) return Alert.alert('Champs requis', 'Intitulé et fichier sont obligatoires.');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('document_type', docType);
      fd.append('title', title.trim());
      fd.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
      const created = await teacherService.uploadTeacherDocument(teacherId, fd);
      setDocs((prev) => [created, ...(prev || [])]);
      setTitle(''); setFile(null);
    } catch (e) {
      Alert.alert('Erreur', 'Téléversement impossible.');
    } finally {
      setUploading(false);
    }
  };

  const remove = (doc) => {
    Alert.alert('Supprimer', `Supprimer "${doc.title}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          try {
            await teacherService.deleteTeacherDocument(teacherId, doc.id);
            setDocs((prev) => prev.filter((d) => d.id !== doc.id));
          } catch { Alert.alert('Erreur', 'Suppression impossible.'); }
        },
      },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={[styles.addBox, { backgroundColor: '#f0f9ff', borderColor: '#7dd3fc' }]}>
        <Text style={[styles.addBoxTitle, { color: TC }]}>Ajouter un document</Text>
        <SelectField label="Type" accentColor={TC} value={docType} onChange={setDocType} options={DOC_TYPES.map(({ label, value }) => ({ label, value }))} />
        <TextField label="Intitulé" required value={title} onChangeText={setTitle} placeholder="ex: CNI, Master 2 Informatique…" />
        <FilePickerRow label="Fichier (PDF, image…)" fileName={file?.name} onPick={pickFile} onClear={() => setFile(null)} accentColor={TC} />
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: TC }, (uploading || !file || !title.trim()) && { opacity: 0.5 }]} onPress={upload} disabled={uploading || !file || !title.trim()}>
          {uploading ? <ActivityIndicator size="small" color="#fff" /> : (
            <><Ionicons name="cloud-upload-outline" size={14} color="#fff" /><Text style={styles.addBtnText}>Téléverser</Text></>
          )}
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color={TC} style={{ marginVertical: 20 }} /> : !docs?.length ? (
        <EmptyState icon="folder-open-outline" title="Aucun document enregistré" />
      ) : (
        <View style={{ gap: 8, marginTop: spacing.md }}>
          {docs.map((doc) => {
            const dt = DOC_TYPE_MAP[doc.document_type] || DOC_TYPES[3];
            return (
              <View key={doc.id} style={styles.listRow}>
                <View style={[styles.listRowIcon, { backgroundColor: dt.bg }]}>
                  <Text style={{ fontSize: 15 }}>{dt.icon}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.listRowTitle} numberOfLines={1}>{doc.title}</Text>
                  <View style={styles.docMetaRow}>
                    <View style={[styles.docTypePill, { backgroundColor: dt.bg }]}>
                      <Text style={[styles.docTypePillText, { color: dt.color }]}>{dt.label}</Text>
                    </View>
                    <Text style={styles.listRowMeta}>{new Date(doc.created_at).toLocaleDateString('fr-FR')}</Text>
                  </View>
                </View>
                {!!doc.file_url && (
                  <TouchableOpacity style={styles.downloadBtn} onPress={() => Linking.openURL(doc.file_url)}>
                    <Ionicons name="download-outline" size={14} color="#1e40af" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.deleteBtn} onPress={() => remove(doc)}>
                  <Ionicons name="trash-outline" size={14} color={colors.danger} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function TeacherProfileScreen({ navigation }) {
  const { logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('info');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ specialization: '', qualification: '', bio: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await teacherService.getMe();
      const profil = await teacherService.getTeacherProfil(me.id);
      setTeacher(profil);
      setForm({ specialization: profil.specialization || '', qualification: profil.qualification || '', bio: profil.bio || '' });
    } catch (e) {
      console.log('TeacherProfile load error', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!teacher) return;
    setSaving(true);
    try {
      await teacherService.updateTeacher(teacher.id, form);
      setTeacher((prev) => ({ ...prev, ...form }));
      setEditing(false);
    } catch {
      Alert.alert('Erreur', 'Mise à jour impossible.');
    } finally {
      setSaving(false);
    }
  };

  const openFiche = async () => {
    const url = await teacherService.getTeacherFicheUrl(teacher.id);
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={TC} />
      </View>
    );
  }

  if (!teacher) {
    return (
      <View style={[styles.container, styles.center]}>
        <EmptyState icon="person-outline" title="Profil introuvable" />
      </View>
    );
  }

  const fullName = teacher.full_name || `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim();
  const initials = `${teacher.first_name?.[0] || ''}${teacher.last_name?.[0] || ''}`.toUpperCase() || 'EN';
  const color = teacherColor(fullName);
  const ct = CONTRACT_LABELS[teacher.contract_type] || { label: teacher.contract_type, bg: '#f1f5f9', color: '#64748b' };
  const stats = teacher.stats || {};
  const weeklyHours = stats.weekly_hours ?? 0;
  const overloaded = weeklyHours > 18;
  const barPct = Math.min(100, Math.round((weeklyHours / 20) * 100));
  const barColor = overloaded ? '#ef4444' : weeklyHours > 12 ? '#f59e0b' : '#059669';
  const assignments = teacher.assignments || [];
  const sessions = teacher.sessions || [];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#4C1D95', '#6D28D9', '#8B5CF6']} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mon profil</Text>
            <View style={{ width: 38 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Identity banner */}
        <View style={styles.card}>
          <View style={[styles.banner, { backgroundColor: color + '14', borderColor: color + '40' }]}>
            <View style={[styles.avatar, { backgroundColor: color }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
              <Text style={[styles.employeeId, { color: TC }]}>{teacher.employee_id}</Text>
              {!!teacher.specialization && <Text style={styles.specialization} numberOfLines={1}>{teacher.specialization}</Text>}
              <View style={[styles.contractBadge, { backgroundColor: ct.bg }]}>
                <Text style={[styles.contractBadgeText, { color: ct.color }]}>{ct.label}</Text>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{assignments.length}</Text>
              <Text style={styles.statLabel}>Affect.</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.classes_count ?? new Set(sessions.map((s) => s.class_name)).size}</Text>
              <Text style={styles.statLabel}>Classes</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: barColor }]}>{weeklyHours}h</Text>
              <Text style={styles.statLabel}>/sem</Text>
            </View>
          </View>

          {!!teacher.sites?.length && (
            <View style={styles.sitesRow}>
              {teacher.sites.map((ts, i) => (
                <View key={i} style={[styles.siteChip, ts.is_primary && { backgroundColor: TB, borderColor: '#a5f3fc' }]}>
                  <Ionicons name="location-outline" size={11} color={ts.is_primary ? TC : colors.textSecondary} />
                  <Text style={[styles.siteChipText, ts.is_primary && { color: TC }]}>
                    {ts.site_name}{ts.is_primary ? ' (principal)' : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.ficheBtn} onPress={openFiche}>
              <Ionicons name="document-text-outline" size={14} color="#fff" />
              <Text style={styles.ficheBtnText}>Fiche complète PDF</Text>
            </TouchableOpacity>
            {!editing ? (
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
                <Ionicons name="create-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.editBtnText}>Modifier</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.dangerLight }]} onPress={() => { setEditing(false); setForm({ specialization: teacher.specialization || '', qualification: teacher.qualification || '', bio: teacher.bio || '' }); }}>
                <Ionicons name="close" size={14} color={colors.danger} />
                <Text style={[styles.editBtnText, { color: colors.danger }]}>Annuler</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsRow}>
          {TABS.map((t) => (
            <TouchableOpacity key={t.id} style={[styles.tabBtn, tab === t.id && { backgroundColor: TB }]} onPress={() => setTab(t.id)}>
              <Text style={[styles.tabBtnText, tab === t.id && { color: TC }]}>
                {t.id === 'aff' ? `${t.label} (${assignments.length})` : t.id === 'edt' ? `${t.label} (${sessions.length})` : t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tab content */}
        {tab === 'info' && (
          <View style={styles.card}>
            <InfoRow icon="mail-outline" label="E-mail" value={teacher.email} />
            <InfoRow icon="call-outline" label="Téléphone" value={teacher.phone} />
            <InfoRow icon="calendar-outline" label="Date d'embauche" value={teacher.hire_date ? new Date(teacher.hire_date).toLocaleDateString('fr-FR') : null} />
            <InfoRow icon="time-outline" label="Taux horaire" value={teacher.hourly_rate ? `${parseFloat(teacher.hourly_rate).toLocaleString('fr-FR')} FCFA/h` : null} />
            <InfoRow icon="calendar-outline" label="Année académique" value={teacher.academic_year_name} />

            {teacher.contract_hours_per_week != null && (
              <View style={styles.hoursGrid}>
                <View style={styles.hoursCard}>
                  <Text style={[styles.hoursValue, { color: TC }]}>{teacher.contract_hours_per_week}h / sem</Text>
                  <Text style={styles.hoursLabel}>Charge contractuelle</Text>
                </View>
                <View style={styles.hoursCard}>
                  <Text style={[styles.hoursValue, { color: TC }]}>{teacher.contract_hours_per_week * 4}h / mois</Text>
                  <Text style={styles.hoursLabel}>Charge mensuelle</Text>
                </View>
              </View>
            )}

            {weeklyHours > 0 && (
              <View style={styles.workloadBox}>
                <View style={styles.workloadTop}>
                  <Text style={styles.workloadLabel}>Charge effective (séances planifiées)</Text>
                  <Text style={[styles.workloadValue, { color: barColor }]}>{weeklyHours}h / sem</Text>
                </View>
                <View style={styles.workloadBar}>
                  <View style={[styles.workloadBarFill, { width: `${barPct}%`, backgroundColor: barColor }]} />
                </View>
                {overloaded && (
                  <View style={styles.overloadRow}>
                    <Ionicons name="warning-outline" size={13} color={colors.danger} />
                    <Text style={styles.overloadText}>Surcharge horaire ({weeklyHours}h &gt; 18h)</Text>
                  </View>
                )}
              </View>
            )}

            {!editing ? (
              (teacher.specialization || teacher.qualification || teacher.bio) && (
                <View style={{ gap: 8, marginTop: spacing.sm }}>
                  {!!teacher.specialization && <InfoRow icon="ribbon-outline" label="Spécialisation" value={teacher.specialization} />}
                  {!!teacher.qualification && <InfoRow icon="ribbon-outline" label="Qualification" value={teacher.qualification} />}
                  {!!teacher.bio && (
                    <View style={styles.bioBox}>
                      <Text style={styles.bioLabel}>Biographie</Text>
                      <Text style={styles.bioText}>{teacher.bio}</Text>
                    </View>
                  )}
                </View>
              )
            ) : (
              <View style={styles.editForm}>
                <Text style={[styles.editFormTitle, { color: TC }]}>Modifier mes informations</Text>
                <TextField label="Spécialisation" value={form.specialization} onChangeText={(v) => setForm((p) => ({ ...p, specialization: v }))} placeholder="ex: Informatique, Réseaux…" />
                <TextField label="Qualification" value={form.qualification} onChangeText={(v) => setForm((p) => ({ ...p, qualification: v }))} placeholder="ex: Doctorat, Master 2…" />
                <TextField label="Biographie" multiline value={form.bio} onChangeText={(v) => setForm((p) => ({ ...p, bio: v }))} placeholder="Décrivez votre parcours, domaines d'expertise…" />
                <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                    <><Ionicons name="checkmark" size={16} color="#fff" /><Text style={styles.saveBtnText}>Enregistrer les modifications</Text></>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {tab === 'aff' && (
          <View style={styles.card}>
            <Text style={styles.tabCount}>{assignments.length} affectation{assignments.length !== 1 ? 's' : ''}</Text>
            {assignments.length === 0 ? (
              <EmptyState icon="briefcase-outline" title="Aucune affectation" />
            ) : (
              <View style={{ gap: 8 }}>
                {assignments.map((a, i) => (
                  <View key={a.id ?? i} style={styles.listRow}>
                    <View style={[styles.listRowIcon, { backgroundColor: '#ede9fe' }]}>
                      <Ionicons name="book-outline" size={16} color="#6366f1" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.listRowTitle} numberOfLines={1}>
                        <Text style={{ color: '#6366f1' }}>{a.subject_code}</Text> — {a.subject_name}
                      </Text>
                      <Text style={styles.listRowMeta}>{a.class_name} · {a.level_name} · {a.program_name}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {tab === 'edt' && (
          <View style={styles.card}>
            <Text style={styles.tabCount}>{sessions.length} séance{sessions.length !== 1 ? 's' : ''} planifiée{sessions.length !== 1 ? 's' : ''}</Text>
            {sessions.length === 0 ? (
              <EmptyState icon="calendar-outline" title="Aucune séance planifiée" />
            ) : (
              <View style={{ gap: 8 }}>
                {[...sessions].sort((a, b) => (a.day_of_week ?? 0) - (b.day_of_week ?? 0)).map((s, i) => (
                  <View key={s.id ?? i} style={styles.listRow}>
                    <View style={[styles.listRowIcon, { backgroundColor: '#fce7f3' }]}>
                      <Ionicons name="calendar-outline" size={16} color="#db2777" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.sessionTop}>
                        <Text style={styles.listRowTitle}>{typeof s.day_of_week === 'number' ? DAYS[s.day_of_week] : (s.day_name || s.day_of_week)}</Text>
                        <View style={[styles.timePill, { backgroundColor: TB }]}>
                          <Text style={[styles.timePillText, { color: TC }]}>{s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}</Text>
                        </View>
                      </View>
                      <Text style={styles.listRowMeta}>{s.subject_name} · {s.class_name}{s.room_name ? ` · Salle ${s.room_name}` : ''}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {tab === 'exp' && <ExperiencesTab teacherId={teacher.id} />}
        {tab === 'docs' && <DocumentsTab teacherId={teacher.id} />}

        <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowLogoutModal(true)}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>

      <ConfirmModal
        visible={showLogoutModal}
        title="Déconnexion"
        message="Voulez-vous vraiment vous déconnecter de votre compte ?"
        confirmText="Se déconnecter"
        cancelText="Annuler"
        variant="danger"
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={() => { setShowLogoutModal(false); logout(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, paddingBottom: spacing.sm },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },

  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, marginBottom: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  name: { fontSize: 15, fontWeight: '800', color: colors.text },
  employeeId: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  specialization: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  contractBadge: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999 },
  contractBadgeText: { fontSize: 11, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.sm },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.divider },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 10, color: colors.textTertiary, marginTop: 1 },

  sitesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  siteChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.divider },
  siteChipText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },

  actionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  ficheBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1e40af', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md },
  ficheBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.divider, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md },
  editBtnText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },

  tabsScroll: { flexGrow: 0 },
  tabsRow: { flexDirection: 'row', gap: 6, backgroundColor: colors.background, padding: 4, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md },
  tabBtnText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.background, borderRadius: radius.md, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.divider },
  infoIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 9, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase' },
  infoValue: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 1 },

  hoursGrid: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  hoursCard: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, backgroundColor: '#f0f9ff', borderWidth: 1.5, borderColor: '#bae6fd' },
  hoursValue: { fontSize: 14, fontWeight: '800' },
  hoursLabel: { fontSize: 10, color: colors.textSecondary, marginTop: 2 },

  workloadBox: { backgroundColor: colors.background, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: colors.divider, marginBottom: 8 },
  workloadTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  workloadLabel: { fontSize: 9, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', flex: 1 },
  workloadValue: { fontSize: 13, fontWeight: '800' },
  workloadBar: { height: 6, borderRadius: 3, backgroundColor: colors.divider, overflow: 'hidden' },
  workloadBarFill: { height: '100%', borderRadius: 3 },
  overloadRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  overloadText: { fontSize: 11, fontWeight: '700', color: colors.danger },

  bioBox: { backgroundColor: colors.background, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: colors.divider },
  bioLabel: { fontSize: 9, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', marginBottom: 3 },
  bioText: { fontSize: 12, color: colors.text, lineHeight: 18 },

  editForm: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1.5, borderTopColor: colors.divider, borderStyle: 'dashed', gap: 4 },
  editFormTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: TC, borderRadius: radius.md, paddingVertical: 12, marginTop: 4 },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  tabCount: { fontSize: 10, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', marginBottom: spacing.sm },

  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.background, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: colors.divider },
  listRowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  listRowTitle: { fontSize: 12, fontWeight: '700', color: colors.text },
  listRowSub: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  listRowMeta: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },
  listRowDesc: { fontSize: 10, color: colors.textSecondary, fontStyle: 'italic', marginTop: 3 },
  deleteBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.dangerLight, alignItems: 'center', justifyContent: 'center' },
  downloadBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },

  sessionTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  timePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  timePillText: { fontSize: 10, fontWeight: '700' },

  docMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  docTypePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  docTypePillText: { fontSize: 9, fontWeight: '700' },

  addBox: { backgroundColor: '#f0fdf4', borderRadius: radius.lg, borderWidth: 1.5, borderColor: '#86efac', borderStyle: 'dashed', padding: spacing.md, gap: 4 },
  addBoxTitle: { fontSize: 11, fontWeight: '800', color: '#059669', textTransform: 'uppercase', marginBottom: 4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.md, paddingVertical: 10, marginTop: 4 },
  addBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: radius.lg, backgroundColor: colors.dangerLight },
  logoutText: { fontSize: 15, fontWeight: '700', color: colors.danger },
});
