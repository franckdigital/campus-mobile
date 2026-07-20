import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Share, RefreshControl, Image,
} from 'react-native';
import Alert from '../../utils/appAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import studentService from '../../services/student';
import { colors, spacing, radius } from '../../theme/colors';

const STATUS_CONFIG = {
  ACTIVE:      { label: 'Actif',     color: '#86EFAC' },
  GRADUATED:   { label: 'Diplômé',   color: '#C4B5FD' },
  SUSPENDED:   { label: 'Suspendu',  color: '#FCA5A5' },
};

export default function StudentCardScreen({ navigation }) {
  const { user } = useAuth();
  const [student, setStudent] = useState(null);
  const [dossier, setDossier] = useState(null);
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const me = await studentService.getMe();
      setStudent(me);
      const [dos, c] = await Promise.allSettled([
        studentService.getDossier(me.id),
        studentService.getCard(me.id),
      ]);
      if (dos.status === 'fulfilled') setDossier(dos.value);
      if (c.status === 'fulfilled') setCard(c.value);
    } catch (e) {
      console.log('Card error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleGenerateCard = async () => {
    setGenerating(true);
    try {
      const result = await studentService.generateCard(student.id, {});
      setCard(result);
      Alert.alert('Succès', 'Carte étudiante générée avec succès.');
    } catch (e) {
      Alert.alert('Erreur', e?.response?.data?.detail || 'Impossible de générer la carte.');
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Carte étudiant — ${fullName}\nMatricule : ${student?.matricule}\nClasse : ${currentClass}`,
        title: 'Carte étudiant',
      });
    } catch {}
  };

  const studentUser = student?.user;
  const fullName =
    studentUser?.full_name ||
    (studentUser?.first_name ? `${studentUser.first_name} ${studentUser.last_name || ''}`.trim() : null) ||
    `${user?.first_name || ''} ${user?.last_name || ''}`.trim() ||
    user?.username || 'Étudiant';
  const initials = fullName !== 'Étudiant'
    ? fullName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const currentClass = dossier?.current_class?.name || '—';
  const currentLevel = dossier?.current_class?.level_name || '—';
  const currentYear = dossier?.current_class?.academic_year || card?.academic_year_name || '—';
  const photo = student?.photo || dossier?.photo || null;
  const statusCfg = STATUS_CONFIG[student?.status] || STATUS_CONFIG.ACTIVE;

  if (loading) {
    return (
      <LinearGradient colors={['#3730A3', '#4F46E5', '#6D28D9']} style={styles.loadingCenter}>
        <ActivityIndicator color="#fff" size="large" />
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#3730A3', '#4F46E5', '#6D28D9']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Carte étudiant</Text>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ── Physical-style card ─────────────────────────────── */}
        <View style={styles.cardOuter}>
          <LinearGradient
            colors={['#4338CA', '#5B21B6', '#7C3AED']}
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Decorative circles */}
            <View style={styles.circle1} />
            <View style={styles.circle2} />

            {/* Top bar */}
            <View style={styles.cardTop}>
              <View>
                <Text style={styles.cardInstitution}>CARTE ÉTUDIANT</Text>
                {student?.site_name && (
                  <Text style={styles.cardSiteName} numberOfLines={1}>{student.site_name}</Text>
                )}
              </View>
              <View style={styles.cardLogoWrap}>
                <Ionicons name="school" size={22} color="rgba(255,255,255,0.9)" />
              </View>
            </View>

            {/* Avatar + name */}
            <View style={styles.cardIdentity}>
              <View style={styles.cardAvatar}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.cardAvatarImg} />
                ) : (
                  <Text style={styles.cardAvatarText}>{initials}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName} numberOfLines={1}>{fullName}</Text>
                <View style={[styles.statusPill, { backgroundColor: statusCfg.color + '30' }]}>
                  <View style={[styles.statusDotSmall, { backgroundColor: statusCfg.color }]} />
                  <Text style={[styles.statusPillText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                </View>
              </View>
            </View>

            {/* Fields row */}
            <View style={styles.cardFields}>
              <CardField label="Matricule" value={student?.matricule || '—'} />
              <CardField label="Classe" value={currentClass} />
              <CardField label="Niveau" value={currentLevel} />
              <CardField label="Année" value={currentYear} />
              {card?.expiry_date && (
                <CardField
                  label="Validité"
                  value={new Date(card.expiry_date).toLocaleDateString('fr-FR', { month: '2-digit', year: '2-digit' })}
                />
              )}
            </View>

            {/* Card number */}
            {card?.card_number && (
              <Text style={styles.cardNumber}>{card.card_number}</Text>
            )}
          </LinearGradient>
        </View>

        {/* ── Card info ───────────────────────────────────────── */}
        {card ? (
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.infoText}>Carte active</Text>
            </View>
            {card.issue_date && (
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.infoSubText}>Émise le {new Date(card.issue_date).toLocaleDateString('fr-FR')}</Text>
              </View>
            )}
            {card.expiry_date && (
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.infoSubText}>Expire le {new Date(card.expiry_date).toLocaleDateString('fr-FR')}</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.noCardBox}>
            <Ionicons name="card-outline" size={40} color={colors.textTertiary} />
            <Text style={styles.noCardTitle}>Aucune carte générée</Text>
            <Text style={styles.noCardSub}>Contactez l'administration ou générez votre carte</Text>
            <TouchableOpacity
              style={[styles.generateBtn, generating && { opacity: 0.7 }]}
              onPress={handleGenerateCard}
              disabled={generating}
            >
              {generating
                ? <ActivityIndicator color="#fff" size="small" />
                : (
                  <>
                    <Ionicons name="add-circle-outline" size={18} color="#fff" />
                    <Text style={styles.generateBtnText}>Générer ma carte</Text>
                  </>
                )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Quick enrollment info ───────────────────────────── */}
        {dossier?.current_class && (
          <View style={styles.enrollCard}>
            <Text style={styles.enrollCardTitle}>Inscription en cours</Text>
            <View style={styles.enrollFields}>
              <EnrollRow icon="school-outline" label="Classe" value={currentClass} />
              <EnrollRow icon="layers-outline" label="Niveau" value={currentLevel} />
              <EnrollRow icon="calendar-outline" label="Année académique" value={currentYear} />
              {student?.admission_date && (
                <EnrollRow icon="enter-outline" label="Date d'admission" value={new Date(student.admission_date).toLocaleDateString('fr-FR')} />
              )}
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function CardField({ label, value }) {
  return (
    <View style={{ flex: 1, minWidth: '40%' }}>
      <Text style={styles.cardFieldLabel}>{label}</Text>
      <Text style={styles.cardFieldValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function EnrollRow({ icon, label, value }) {
  return (
    <View style={styles.enrollRow}>
      <Ionicons name={icon} size={15} color={colors.primary} />
      <Text style={styles.enrollLabel}>{label}</Text>
      <Text style={styles.enrollValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.lg, paddingBottom: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, paddingBottom: spacing.md },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  shareBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  content: { padding: spacing.md, gap: spacing.md },

  cardOuter: { borderRadius: radius.xl, overflow: 'hidden', shadowColor: '#4338CA', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  cardGradient: { padding: 20, gap: 16, minHeight: 200, overflow: 'hidden' },
  circle1: { position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.06)' },
  circle2: { position: 'absolute', bottom: -30, left: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.04)' },

  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInstitution: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 2, textTransform: 'uppercase' },
  cardSiteName: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  cardLogoWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

  cardIdentity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  cardAvatarImg: { width: 52, height: 52, borderRadius: 26 },
  cardAvatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  cardName: { fontSize: 18, fontWeight: '800', color: '#fff' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  statusDotSmall: { width: 5, height: 5, borderRadius: 3 },
  statusPillText: { fontSize: 11, fontWeight: '700' },

  cardFields: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 12 },
  cardFieldLabel: { fontSize: 9, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.8 },
  cardFieldValue: { fontSize: 13, fontWeight: '700', color: '#fff', marginTop: 2 },
  cardNumber: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontVariant: ['tabular-nums'], letterSpacing: 3, marginTop: -8 },

  infoCard: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 14, fontWeight: '700', color: colors.text },
  infoSubText: { fontSize: 13, color: colors.textSecondary },

  noCardBox: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  noCardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  noCardSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  generateBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: radius.md },
  generateBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  enrollCard: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  enrollCardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  enrollFields: { gap: 6 },
  enrollRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  enrollLabel: { flex: 1, fontSize: 13, color: colors.textSecondary },
  enrollValue: { fontSize: 13, fontWeight: '600', color: colors.text },
});
