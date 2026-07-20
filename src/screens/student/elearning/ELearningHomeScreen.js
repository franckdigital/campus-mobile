import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../../../theme/colors';
import { useAuth } from '../../../contexts/AuthContext';

const CARDS = [
  {
    id: 'cours',
    label: 'Cours en ligne',
    sub: 'Cours autonomes à votre rythme',
    icon: 'layers-outline',
    color: '#DB2777',
    bg: '#FCE7F3',
    screen: 'CoursesList',
  },
  {
    id: 'classes-virt',
    label: 'Classes virtuelles',
    sub: 'Rejoignez vos sessions en direct',
    icon: 'videocam-outline',
    color: '#2563EB',
    bg: '#DBEAFE',
    screen: 'VirtualClassrooms',
  },
  {
    id: 'evaluations',
    label: 'Évaluations',
    sub: 'Quiz et évaluations en ligne',
    icon: 'list-outline',
    color: '#7C3AED',
    bg: '#EDE9FE',
    screen: 'Quizzes',
  },
  {
    id: 'devoirs',
    label: 'Devoirs & Exercices',
    sub: 'Vos devoirs à rendre',
    icon: 'clipboard-outline',
    color: '#DB2777',
    bg: '#FCE7F3',
    screen: 'Assignments',
  },
  {
    id: 'examens',
    label: 'Examens sécurisés',
    sub: 'Vos examens programmés',
    icon: 'shield-checkmark-outline',
    color: '#059669',
    bg: '#D1FAE5',
    screen: 'Exams',
  },
  {
    id: 'notes',
    label: 'Notes & Bulletins',
    sub: 'Résultats académiques et bulletins',
    icon: 'ribbon-outline',
    color: '#9333EA',
    bg: '#F3E8FF',
    screen: 'NotesTab',
  },
];

export default function ELearningHomeScreen({ navigation }) {
  const { studentModality, tuitionUpToDate, echeanceOverride } = useAuth();
  const goTo = (card) => {
    if (card.screen === 'NotesTab') {
      navigation.navigate('StudentTabs', { screen: 'Notes' });
    } else {
      navigation.navigate(card.screen);
    }
  };

  // Défense en profondeur : le menu masque déjà cet écran pour un étudiant
  // présentiel, ou pour un étudiant e-learning/hybride en retard sur son
  // échéancier, mais un accès direct (deep link, retour navigation) doit
  // aussi être bloqué.
  const wrongModality = studentModality && studentModality !== 'ELEARNING' && studentModality !== 'HYBRIDE';
  const behindOnSchedule = !wrongModality && !tuitionUpToDate && !echeanceOverride
    && (studentModality === 'ELEARNING' || studentModality === 'HYBRIDE');

  if (wrongModality || behindOnSchedule) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#9D174D', '#DB2777', '#BE185D']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <SafeAreaView edges={['top']}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>E-Learning</Text>
              <View style={{ width: 38 }} />
            </View>
          </SafeAreaView>
        </LinearGradient>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
          <Ionicons name={wrongModality ? 'desktop-outline' : 'calendar-outline'} size={40} color={colors.textTertiary} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, textAlign: 'center' }}>
            {wrongModality ? 'Non disponible pour votre modalité' : 'Accès e-learning verrouillé'}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>
            {wrongModality
              ? 'Les ressources e-learning sont réservées aux étudiants suivis en e-learning ou en hybride.'
              : "Vous n'êtes pas à jour de votre échéancier de scolarité. L'accès aux ressources e-learning est suspendu jusqu'à régularisation de votre situation."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#9D174D', '#DB2777', '#BE185D']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>E-Learning</Text>
            <View style={{ width: 38 }} />
          </View>
          <View style={styles.introRow}>
            <View style={styles.introIcon}>
              <Ionicons name="book-outline" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.introTitle}>Mon espace E-Learning</Text>
              <Text style={styles.introSub}>Cours, classes virtuelles, notes et bulletins</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        {CARDS.map((card) => (
          <TouchableOpacity key={card.id} style={styles.card} activeOpacity={0.8} onPress={() => goTo(card)}>
            <View style={[styles.cardIcon, { backgroundColor: card.bg }]}>
              <Ionicons name={card.icon} size={24} color={card.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>{card.label}</Text>
              <Text style={styles.cardSub}>{card.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, paddingBottom: spacing.md },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },

  introRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  introIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  introTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  introSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  content: { padding: spacing.md, gap: spacing.sm },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff',
    borderRadius: radius.lg, padding: spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
