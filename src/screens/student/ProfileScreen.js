import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import studentService from '../../services/student';
import Badge from '../../components/common/Badge';
import ConfirmModal from '../../components/common/ConfirmModal';
import { colors, spacing, radius } from '../../theme/colors';

export default function StudentProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [student, setStudent] = useState(null);
  const [dossier, setDossier] = useState(null);
  const [card, setCard] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const fetchStudent = useCallback(async () => {
    try {
      const me = await studentService.getMe();
      setStudent(me);
      const [dos, c] = await Promise.allSettled([
        studentService.getDossier(me.id),
        studentService.getCard(me.id),
      ]);
      if (dos.status === 'fulfilled') setDossier(dos.value);
      if (c.status === 'fulfilled') setCard(c.value);
    } catch {}
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchStudent(); }, [fetchStudent]);
  const onRefresh = () => { setRefreshing(true); fetchStudent(); };

  const handleLogout = () => setShowLogoutModal(true);

  const studentUser = student?.user;
  const fullName =
    studentUser?.full_name ||
    (studentUser?.first_name ? `${studentUser.first_name} ${studentUser.last_name || ''}`.trim() : null) ||
    `${user?.first_name || ''} ${user?.last_name || ''}`.trim() ||
    user?.username || '';
  const initials = fullName
    ? fullName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const email = studentUser?.email || user?.email;
  const phone = studentUser?.phone || user?.phone;
  const enrollments = dossier?.enrollments || [];
  const currentClass = dossier?.current_class || null;
  const parents = dossier?.parents || student?.parents || [];
  const photo = student?.photo || dossier?.photo || null;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#3730A3', '#4F46E5', '#7C3AED']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mon profil</Text>
            <View style={{ width: 38 }} />
          </View>
          <View style={styles.avatarSection}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <Text style={styles.name}>{fullName}</Text>
            <Text style={styles.role}>Étudiant</Text>
            {student?.matricule && (
              <View style={styles.matriculeBadge}>
                <Ionicons name="card-outline" size={12} color="rgba(255,255,255,0.8)" />
                <Text style={styles.matriculeText}>{student.matricule}</Text>
              </View>
            )}
            {currentClass && (
              <View style={[styles.matriculeBadge, { marginTop: 4 }]}>
                <Ionicons name="school-outline" size={12} color="rgba(255,255,255,0.8)" />
                <Text style={styles.matriculeText}>
                  {currentClass.name}{currentClass.level_name ? ` · ${currentClass.level_name}` : ''}
                </Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Student card */}
        {student?.matricule && (
          <View style={styles.studentCard}>
            <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.cardGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardSchool}>Carte Étudiant</Text>
                  <Text style={styles.cardYear}>{card?.academic_year_name || currentClass?.academic_year || new Date().getFullYear()}</Text>
                </View>
                <View style={styles.cardLogoWrap}>
                  <Ionicons name="school" size={24} color="rgba(255,255,255,0.9)" />
                </View>
              </View>
              <Text style={styles.cardName}>{fullName}</Text>
              <View style={styles.cardRow}>
                <View>
                  <Text style={styles.cardFieldLabel}>Matricule</Text>
                  <Text style={styles.cardFieldValue}>{student.matricule}</Text>
                </View>
                {currentClass && (
                  <View>
                    <Text style={styles.cardFieldLabel}>Classe</Text>
                    <Text style={styles.cardFieldValue}>{currentClass.name || '--'}</Text>
                  </View>
                )}
                {currentClass?.level_name && (
                  <View>
                    <Text style={styles.cardFieldLabel}>Niveau</Text>
                    <Text style={styles.cardFieldValue}>{currentClass.level_name}</Text>
                  </View>
                )}
                {card?.expiry_date ? (
                  <View>
                    <Text style={styles.cardFieldLabel}>Validité</Text>
                    <Text style={styles.cardFieldValue}>{new Date(card.expiry_date).toLocaleDateString('fr-FR', { month: '2-digit', year: '2-digit' })}</Text>
                  </View>
                ) : student.status ? (
                  <View>
                    <Text style={styles.cardFieldLabel}>Statut</Text>
                    <Text style={[styles.cardFieldValue, { color: '#86EFAC' }]}>
                      {{ ACTIVE: 'Actif', GRADUATED: 'Diplômé', SUSPENDED: 'Suspendu' }[student.status] || student.status}
                    </Text>
                  </View>
                ) : null}
              </View>
              {card?.card_number && (
                <Text style={styles.cardNumber}>{card.card_number}</Text>
              )}
            </LinearGradient>
          </View>
        )}

        <Section title="Informations personnelles">
          <InfoRow icon="mail-outline" label="Email" value={email} />
          <InfoRow icon="call-outline" label="Téléphone" value={phone || 'Non renseigné'} />
          {student?.gender && <InfoRow icon="person-outline" label="Genre" value={student.gender === 'M' ? 'Masculin' : 'Féminin'} />}
          {student?.birth_date && <InfoRow icon="calendar-outline" label="Date de naissance" value={new Date(student.birth_date).toLocaleDateString('fr-FR')} />}
          {student?.city && <InfoRow icon="location-outline" label="Ville" value={student.city} />}
          {student?.nationality && <InfoRow icon="flag-outline" label="Nationalité" value={student.nationality} />}
        </Section>

        <Section title="Scolarité">
          {student?.status && <InfoRow icon="checkmark-circle-outline" label="Statut" value={{ ACTIVE: 'Actif', GRADUATED: 'Diplômé', SUSPENDED: 'Suspendu' }[student.status] || student.status} />}
          {student?.admission_date && <InfoRow icon="enter-outline" label="Admission" value={new Date(student.admission_date).toLocaleDateString('fr-FR')} />}
          {currentClass?.name && <InfoRow icon="school-outline" label="Classe actuelle" value={currentClass.name} />}
          {currentClass?.level_name && <InfoRow icon="layers-outline" label="Niveau" value={currentClass.level_name} />}
          {currentClass?.program_name && <InfoRow icon="bookmark-outline" label="Programme" value={currentClass.program_name} />}
          {currentClass?.academic_year && <InfoRow icon="calendar-outline" label="Année scolaire" value={currentClass.academic_year} />}
        </Section>

        {enrollments.length > 0 && (
          <Section title="Parcours académique">
            {enrollments.map((e) => (
              <View key={e.id} style={styles.enrollRow}>
                <View style={[styles.enrollDot, { backgroundColor: e.is_active ? colors.success : colors.textTertiary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.enrollClass}>{e.class_name || `Classe #${e.class_obj}`}</Text>
                  <Text style={styles.enrollYear}>{e.academic_year_name || ''}</Text>
                </View>
                {e.is_active && <Badge status="ACTIVE" />}
              </View>
            ))}
          </Section>
        )}

        {parents.length > 0 && (
          <Section title="Parents / Tuteurs">
            {parents.map((p, i) => (
              <View key={p.id || i} style={styles.parentCard}>
                <View style={styles.parentAvatar}>
                  <Ionicons name="person" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.parentName}>{p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Parent'}</Text>
                  {p.relationship && <Text style={styles.parentRelation}>{p.relationship}</Text>}
                  {p.phone && (
                    <View style={styles.parentContact}>
                      <Ionicons name="call-outline" size={12} color={colors.textTertiary} />
                      <Text style={styles.parentContactText}>{p.phone}</Text>
                    </View>
                  )}
                  {p.email && (
                    <View style={styles.parentContact}>
                      <Ionicons name="mail-outline" size={12} color={colors.textTertiary} />
                      <Text style={styles.parentContactText}>{p.email}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </Section>
        )}

        <Section title="Compte">
          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.menuLabel}>Changer le mot de passe</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="notifications-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.menuLabel}>Préférences notifications</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        </Section>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
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

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, paddingBottom: spacing.lg },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  avatarSection: { alignItems: 'center', gap: 4, paddingBottom: spacing.sm },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)', marginBottom: 4 },
  avatarImg: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)', marginBottom: 4 },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#fff' },
  name: { fontSize: 20, fontWeight: '700', color: '#fff' },
  role: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  matriculeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  matriculeText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },

  studentCard: { borderRadius: radius.xl, overflow: 'hidden', shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6 },
  cardGradient: { padding: spacing.lg, gap: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardSchool: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 1 },
  cardYear: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  cardLogoWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  cardRow: { flexDirection: 'row', gap: 24 },
  cardFieldLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardFieldValue: { fontSize: 13, fontWeight: '700', color: '#fff', marginTop: 2 },
  cardNumber: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontVariant: ['tabular-nums'], letterSpacing: 2, marginTop: 4 },

  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: 4 },
  sectionCard: { backgroundColor: '#fff', borderRadius: radius.lg, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  infoIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 12, color: colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 1 },

  enrollRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  enrollDot: { width: 10, height: 10, borderRadius: 5 },
  enrollClass: { fontSize: 14, fontWeight: '600', color: colors.text },
  enrollYear: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },

  parentCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  parentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  parentName: { fontSize: 14, fontWeight: '600', color: colors.text },
  parentRelation: { fontSize: 12, color: colors.primary, marginTop: 1 },
  parentContact: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  parentContactText: { fontSize: 12, color: colors.textTertiary },

  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  menuIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.text },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.dangerLight, backgroundColor: colors.dangerLight },
  logoutText: { fontSize: 15, fontWeight: '700', color: colors.danger },
});
