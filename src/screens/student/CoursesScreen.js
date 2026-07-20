import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import elearningService from '../../services/elearning';
import studentService from '../../services/student';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, radius } from '../../theme/colors';

const TABS = [
  { key: 'lessons', label: 'Cours', icon: 'book-outline' },
  { key: 'assignments', label: 'Devoirs', icon: 'clipboard-outline' },
];

export default function StudentCoursesScreen({ navigation }) {
  const [tab, setTab] = useState('lessons');
  const [lessons, setLessons] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enrollment, setEnrollment] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const me = await studentService.getMe();
      const currentClass = me?.current_class;
      setEnrollment(currentClass);
      const classId = currentClass?.id;
      const [les, ass] = await Promise.allSettled([
        elearningService.getLessons(classId ? { class_obj: classId } : {}),
        elearningService.getAssignments(classId ? { class_obj: classId } : {}),
      ]);
      if (les.status === 'fulfilled') setLessons(les.value?.results || les.value || []);
      if (ass.status === 'fulfilled') setAssignments(ass.value?.results || ass.value || []);
    } catch (e) {
      console.log('Courses error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const overdueAssignments = assignments.filter(
    (a) => a.due_date && new Date(a.due_date) < new Date() && a.my_submission?.status !== 'SUBMITTED'
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#3730A3', '#4F46E5', '#6D28D9']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Cours & Devoirs</Text>
            <View style={{ width: 38 }} />
          </View>
          {enrollment && (
            <View style={styles.classChip}>
              <Ionicons name="people-outline" size={13} color="rgba(255,255,255,0.8)" />
              <Text style={styles.classChipText}>{enrollment.name || 'Classe active'}</Text>
            </View>
          )}
          <View style={styles.tabs}>
            {TABS.map((t) => (
              <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
                <Ionicons name={t.icon} size={14} color={tab === t.key ? '#EA580C' : 'rgba(255,255,255,0.7)'} />
                <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
                {t.key === 'assignments' && overdueAssignments.length > 0 && (
                  <View style={styles.urgentBadge}>
                    <Text style={styles.urgentText}>{overdueAssignments.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#EA580C" size="large" /></View>
      ) : tab === 'lessons' ? (
        <FlatList
          data={lessons}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState icon="book-outline" title="Aucun cours disponible" subtitle="Les enseignants publient les cours ici" />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.lessonIconWrap}>
                <Ionicons name="book-outline" size={22} color="#EA580C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSub} numberOfLines={2}>{item.description || ''}</Text>
                <View style={styles.cardMeta}>
                  {item.subject_name && (
                    <View style={styles.metaChip}>
                      <Text style={styles.metaChipText}>{item.subject_name}</Text>
                    </View>
                  )}
                  {item.published_at && (
                    <Text style={styles.cardDate}>{new Date(item.published_at).toLocaleDateString('fr-FR')}</Text>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </View>
          )}
        />
      ) : (
        <FlatList
          data={assignments}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState icon="clipboard-outline" title="Aucun devoir" subtitle="Vous serez notifié quand des devoirs sont publiés" />}
          renderItem={({ item }) => {
            const isOverdue = item.due_date && new Date(item.due_date) < new Date();
            const submitted = item.my_submission?.status === 'SUBMITTED' || item.my_submission?.status === 'GRADED';
            return (
              <View style={[styles.assignCard, isOverdue && !submitted && styles.assignCardOverdue]}>
                <View style={styles.cardTop}>
                  <View style={[styles.lessonIconWrap, { backgroundColor: isOverdue ? colors.dangerLight : '#FEF3C7' }]}>
                    <Ionicons name="clipboard-outline" size={20} color={isOverdue ? colors.danger : '#D97706'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardSub} numberOfLines={1}>{item.subject_name || ''}</Text>
                  </View>
                  {submitted && <Badge status="SUBMITTED" />}
                  {item.my_submission?.status === 'GRADED' && <Badge status="GRADED" />}
                </View>
                <View style={styles.assignMeta}>
                  <View style={[styles.dueBadge, isOverdue && { backgroundColor: colors.dangerLight }]}>
                    <Ionicons name="time-outline" size={12} color={isOverdue ? colors.danger : colors.warning} />
                    <Text style={[styles.dueText, isOverdue && { color: colors.danger }]}>
                      {item.due_date ? `Échéance: ${new Date(item.due_date).toLocaleDateString('fr-FR')}` : 'Sans échéance'}
                    </Text>
                  </View>
                  {item.max_score && <Text style={styles.maxScore}>/{item.max_score} pts</Text>}
                </View>
                {item.my_submission?.score != null && (
                  <Text style={styles.gradeText}>Note: {item.my_submission.score}/{item.max_score}</Text>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, paddingBottom: spacing.md },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  classChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: spacing.sm },
  classChipText: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },

  tabs: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.md },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.15)' },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  tabTextActive: { color: '#EA580C' },
  urgentBadge: { backgroundColor: colors.danger, borderRadius: 6, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  urgentText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  list: { padding: spacing.md, gap: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  lessonIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  metaChip: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  metaChipText: { fontSize: 11, color: '#B45309', fontWeight: '600' },
  cardDate: { fontSize: 11, color: colors.textTertiary },

  assignCard: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  assignCardOverdue: { borderLeftWidth: 3, borderLeftColor: colors.danger },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  assignMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dueBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.warningLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  dueText: { fontSize: 12, color: '#D97706', fontWeight: '500' },
  maxScore: { fontSize: 12, color: colors.textSecondary },
  gradeText: { fontSize: 13, fontWeight: '600', color: colors.success },
});
