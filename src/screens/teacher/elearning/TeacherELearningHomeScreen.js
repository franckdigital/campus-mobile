import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../../../theme/colors';

const CARDS = [
  { id: 'schedule', label: 'Emploi du temps', sub: 'Gérez vos séances de cours', icon: 'calendar-outline', color: '#D97706', bg: '#FEF3C7', screen: 'Planning' },
  { id: 'lessons', label: 'Cours', sub: 'Créez et organisez vos leçons', icon: 'book-outline', color: '#DB2777', bg: '#FCE7F3', screen: 'TeacherLessons' },
  { id: 'classrooms', label: 'Classes virtuelles', sub: 'Programmez vos sessions en direct', icon: 'videocam-outline', color: '#2563EB', bg: '#DBEAFE', screen: 'TeacherClassrooms' },
  { id: 'quizzes', label: 'Évaluations', sub: 'Quiz et évaluations en ligne', icon: 'list-outline', color: '#7C3AED', bg: '#EDE9FE', screen: 'TeacherQuizzes' },
  { id: 'assignments', label: 'Devoirs & Exercices', sub: 'Créez et suivez les devoirs', icon: 'clipboard-outline', color: '#DB2777', bg: '#FCE7F3', screen: 'TeacherAssignments' },
  { id: 'exams', label: 'Examens sécurisés', sub: 'Programmez vos examens', icon: 'shield-checkmark-outline', color: '#059669', bg: '#D1FAE5', screen: 'TeacherExams' },
  { id: 'corrections', label: 'Corrections', sub: 'Notez devoirs, quiz et examens', icon: 'checkmark-done-outline', color: '#EA580C', bg: '#FFEDD5', screen: 'TeacherCorrectionsHome' },
];

export default function TeacherELearningHomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#7C2D12', '#B45309', '#D97706']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>E-Learning</Text>
            <View style={{ width: 38 }} />
          </View>
          <View style={styles.introRow}>
            <View style={styles.introIcon}>
              <Ionicons name="easel-outline" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.introTitle}>Espace enseignant</Text>
              <Text style={styles.introSub}>Créez et gérez vos contenus pédagogiques</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        {CARDS.map((card) => (
          <TouchableOpacity key={card.id} style={styles.card} activeOpacity={0.8} onPress={() => navigation.navigate(card.screen)}>
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
