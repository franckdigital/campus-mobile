import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import parentService from '../../services/parent';
import gradesService from '../../services/grades';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, radius } from '../../theme/colors';

const GRADIENT = ['#064E3B', '#065F46', '#059669'];

export default function ParentGradesScreen({ navigation, route }) {
  const childIdParam = route?.params?.childId;
  const [children, setChildren] = useState([]);
  const [selectedId, setSelectedId] = useState(childIdParam || null);
  const [grades, setGrades] = useState([]);
  const [reportCards, setReportCards] = useState([]);
  const [tab, setTab] = useState('grades');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchChildren = useCallback(async () => {
    try {
      const res = await parentService.getMyStudents();
      const list = res?.results || res || [];
      setChildren(list);
      const id = childIdParam || (list[0]?.id ?? null);
      if (id) { setSelectedId(id); await loadGrades(id); }
    } catch (e) {
      console.log('ParentGrades', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [childIdParam]);

  const loadGrades = async (id) => {
    try {
      const [g, rc] = await Promise.allSettled([
        gradesService.getGrades({ student: id, page_size: 100 }),
        gradesService.getReportCards({ student: id }),
      ]);
      if (g.status === 'fulfilled') setGrades(g.value?.results || g.value || []);
      if (rc.status === 'fulfilled') setReportCards(rc.value?.results || rc.value || []);
    } catch (e) {
      console.log('load grades', e.message);
    }
  };

  useEffect(() => { fetchChildren(); }, [fetchChildren]);

  const onRefresh = () => { setRefreshing(true); fetchChildren(); };

  const selectChild = async (id) => {
    setSelectedId(id);
    setGrades([]);
    setReportCards([]);
    await loadGrades(id);
  };

  // Group grades by subject
  const bySubject = grades.reduce((acc, g) => {
    const key = g.subject_name || g.subject || 'Inconnu';
    if (!acc[key]) acc[key] = { subject: key, grades: [], total: 0, count: 0 };
    acc[key].grades.push(g);
    acc[key].total += parseFloat(g.score || 0);
    acc[key].count += 1;
    return acc;
  }, {});
  const subjects = Object.values(bySubject).map((s) => ({
    ...s,
    average: s.count ? (s.total / s.count).toFixed(1) : '--',
  }));

  const overallAvg = grades.length
    ? (grades.reduce((s, g) => s + parseFloat(g.score || 0), 0) / grades.length).toFixed(2)
    : '--';

  return (
    <View style={styles.container}>
      <LinearGradient colors={GRADIENT} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Notes</Text>
            <View style={{ width: 38 }} />
          </View>

          {/* Child selector */}
          {children.length > 1 && (
            <FlatList
              data={children}
              keyExtractor={(i) => String(i.id)}
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.chip, selectedId === item.id && styles.chipActive]}
                  onPress={() => selectChild(item.id)}
                >
                  <Text style={[styles.chipText, selectedId === item.id && styles.chipTextActive]}>
                    {item.user?.first_name || item.first_name || 'Enfant'}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}

          {/* Average card */}
          <View style={styles.avgCard}>
            <View>
              <Text style={styles.avgLabel}>Moyenne générale</Text>
              <Text style={styles.avgValue}>{overallAvg}</Text>
            </View>
            <View style={styles.avgCircle}>
              <Ionicons name="school-outline" size={28} color="rgba(255,255,255,0.8)" />
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {[{ key: 'grades', label: 'Notes' }, { key: 'bulletins', label: 'Bulletins' }].map((t) => (
              <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
                <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.success} size="large" /></View>
      ) : tab === 'grades' ? (
        <FlatList
          data={subjects}
          keyExtractor={(item) => item.subject}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.success} />}
          ListEmptyComponent={<EmptyState icon="bar-chart-outline" title="Aucune note disponible" />}
          renderItem={({ item }) => (
            <View style={styles.subjectCard}>
              <View style={styles.subjectHeader}>
                <View style={styles.subjectIcon}>
                  <Ionicons name="book-outline" size={18} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subjectName}>{item.subject}</Text>
                  <Text style={styles.subjectSub}>{item.count} évaluation{item.count > 1 ? 's' : ''}</Text>
                </View>
                <View style={[styles.avgBadge, { backgroundColor: scoreColor(item.average, 20) + '20' }]}>
                  <Text style={[styles.avgBadgeText, { color: scoreColor(item.average, 20) }]}>
                    {item.average}/20
                  </Text>
                </View>
              </View>
              {item.grades.map((g, i) => (
                <View key={i} style={styles.gradeItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gradeTitle}>{g.evaluation_title || g.category || 'Évaluation'}</Text>
                    {g.comment && <Text style={styles.gradeComment}>{g.comment}</Text>}
                  </View>
                  <Text style={[styles.gradeScore, { color: scoreColor(g.score, g.max_score) }]}>
                    {g.score}/{g.max_score}
                  </Text>
                </View>
              ))}
            </View>
          )}
        />
      ) : (
        <FlatList
          data={reportCards}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.success} />}
          ListEmptyComponent={<EmptyState icon="document-text-outline" title="Aucun bulletin disponible" />}
          renderItem={({ item }) => {
            const avg = item.average ? parseFloat(item.average) : null;
            const passed = avg != null ? avg >= 10 : null;
            return (
              <View style={styles.rcCard}>
                <View style={styles.rcHeader}>
                  <View style={[styles.rcIcon, { backgroundColor: '#D1FAE5' }]}>
                    <Ionicons name="ribbon-outline" size={20} color={colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rcTitle}>{item.semester_name || 'Semestre'}</Text>
                    <Text style={styles.rcSub}>{item.academic_year_name || ''}</Text>
                  </View>
                  {item.status === 'PASS' && <View style={styles.passBadge}><Text style={styles.passText}>Admis</Text></View>}
                  {item.status === 'FAIL' && <View style={styles.failBadge}><Text style={styles.failText}>Ajourné</Text></View>}
                </View>
                {avg != null && (
                  <View style={[styles.avgRow, { backgroundColor: passed ? '#F0FDF4' : '#FEF2F2' }]}>
                    <Text style={styles.avgRowLabel}>Moyenne</Text>
                    <Text style={[styles.avgRowValue, { color: passed ? colors.success : colors.danger }]}>
                      {avg.toFixed(2)}/20
                    </Text>
                    <View style={[styles.resultPill, { backgroundColor: passed ? '#BBF7D0' : '#FECACA' }]}>
                      <Ionicons name={passed ? 'checkmark-circle' : 'close-circle'} size={14} color={passed ? colors.success : colors.danger} />
                      <Text style={[styles.resultText, { color: passed ? colors.success : colors.danger }]}>
                        {passed ? 'Admis' : 'Ajourné'}
                      </Text>
                    </View>
                  </View>
                )}
                {item.comment && <Text style={styles.rcComment}>"{item.comment}"</Text>}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function scoreColor(score, max) {
  if (!max) return colors.textSecondary;
  const pct = (parseFloat(score) / parseFloat(max)) * 100;
  if (pct >= 75) return colors.success;
  if (pct >= 50) return colors.warning;
  return colors.danger;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, paddingBottom: spacing.md },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  chipActive: { backgroundColor: '#fff' },
  chipText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  chipTextActive: { color: '#065F46' },
  avgCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  avgLabel: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  avgValue: { fontSize: 36, fontWeight: '800', color: '#fff', marginTop: 2 },
  avgCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.md },
  tab: { flex: 1, paddingVertical: 8, borderRadius: radius.md, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  tabTextActive: { color: '#059669' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 32 },
  subjectCard: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  subjectHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  subjectIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  subjectName: { fontSize: 15, fontWeight: '700', color: colors.text },
  subjectSub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  avgBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  avgBadgeText: { fontSize: 13, fontWeight: '700' },
  gradeItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.divider },
  gradeTitle: { fontSize: 13, color: colors.text },
  gradeComment: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  gradeScore: { fontSize: 14, fontWeight: '700' },
  rcCard: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  rcHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rcIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rcTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  rcSub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  passBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  passText: { fontSize: 12, fontWeight: '700', color: colors.success },
  failBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  failText: { fontSize: 12, fontWeight: '700', color: colors.danger },
  avgRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: radius.md },
  avgRowLabel: { flex: 1, fontSize: 12, color: colors.textSecondary },
  avgRowValue: { fontSize: 20, fontWeight: '800', marginRight: 8 },
  resultPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  resultText: { fontSize: 12, fontWeight: '700' },
  rcComment: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 8 },
});
