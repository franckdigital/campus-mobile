import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import Alert from '../../utils/appAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import gradesService from '../../services/grades';
import studentService from '../../services/student';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, radius } from '../../theme/colors';

const TABS = [
  { key: 'grades', label: 'Notes' },
  { key: 'reportcards', label: 'Bulletins' },
];

export default function StudentGradesScreen({ navigation }) {
  const [tab, setTab] = useState('grades');
  const [grades, setGrades] = useState([]);
  const [reportCards, setReportCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const me = await studentService.getMe();
      const [g, rc] = await Promise.allSettled([
        gradesService.getGrades({ student: me.id, page_size: 100 }),
        gradesService.getReportCards({ student: me.id, page_size: 50 }),
      ]);
      if (g.status === 'fulfilled') setGrades(g.value?.results || g.value || []);
      if (rc.status === 'fulfilled') setReportCards(rc.value?.results || rc.value || []);
    } catch (e) {
      console.log('Grades error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refetch on every focus, not just once at mount — this is a bottom-tab
  // screen that stays mounted across tab switches (see FinanceScreen.js).
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

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

  // Simple mean like the web frontend
  const overallAvg = grades.length
    ? (grades.reduce((s, g) => s + parseFloat(g.score || 0), 0) / grades.length).toFixed(2)
    : '--';

  const handleDownloadPdf = async (item) => {
    if (!['PUBLISHED', 'PASS', 'FAIL'].includes(item.status)) {
      Alert.alert('Bulletin non disponible', 'Ce bulletin n\'est pas encore publié.');
      return;
    }
    setDownloading(item.id);
    try {
      await gradesService.downloadReportCardPdf(item.id, item.semester_name || `S${item.id}`);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de télécharger le bulletin. ' + (e.message || ''));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#3730A3', '#4F46E5']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mes notes</Text>
            <View style={{ width: 38 }} />
          </View>
          <View style={styles.avgCard}>
            <View>
              <Text style={styles.avgLabel}>Moyenne générale</Text>
              <Text style={styles.avgValue}>{overallAvg}</Text>
            </View>
            <View style={styles.avgCircle}>
              <Ionicons name="school-outline" size={28} color="rgba(255,255,255,0.8)" />
            </View>
          </View>
          <View style={styles.tabs}>
            {TABS.map((t) => (
              <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
                <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : tab === 'grades' ? (
        <FlatList
          data={subjects}
          keyExtractor={(item) => item.subject}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState icon="bar-chart-outline" title="Aucune note disponible" />}
          renderItem={({ item }) => (
            <View style={styles.subjectCard}>
              <View style={styles.subjectHeader}>
                <View style={styles.subjectIcon}>
                  <Ionicons name="book-outline" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subjectName}>{item.subject}</Text>
                  <Text style={styles.subjectSub}>{item.count} évaluation{item.count > 1 ? 's' : ''}</Text>
                </View>
                <View style={[styles.subjectAvgBadge, { backgroundColor: getScoreColor(item.average, 20) + '20' }]}>
                  <Text style={[styles.subjectAvg, { color: getScoreColor(item.average, 20) }]}>
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
                  <Text style={[styles.gradeScore, { color: getScoreColor(g.score, g.max_score) }]}>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState icon="document-text-outline" title="Aucun bulletin disponible" />}
          renderItem={({ item }) => {
            const isPublished = ['PUBLISHED', 'PASS', 'FAIL'].includes(item.status);
            const isDownloading = downloading === item.id;
            const avg = item.average ? parseFloat(item.average) : null;
            const passed = avg != null ? avg >= 10 : null;

            return (
              <View style={styles.rcCard}>
                <View style={styles.rcHeader}>
                  <View style={[styles.rcIconWrap, { backgroundColor: isPublished ? '#EEF2FF' : '#F8FAFC' }]}>
                    <Ionicons name="ribbon-outline" size={20} color={isPublished ? colors.primary : colors.textTertiary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rcTitle}>{item.semester_name || 'Semestre'}</Text>
                    <Text style={styles.rcSub}>{item.academic_year_name || ''}</Text>
                  </View>
                  <Badge
                    status={item.status === 'PASS' ? 'PASS' : item.status === 'FAIL' ? 'FAIL' : item.status}
                    label={item.status === 'PASS' ? 'Admis' : item.status === 'FAIL' ? 'Ajourné' : item.status === 'PUBLISHED' ? 'Publié' : item.status === 'DRAFT' ? 'Brouillon' : item.status}
                  />
                </View>

                {avg != null && (
                  <View style={styles.rcAvgRow}>
                    <View>
                      <Text style={styles.rcAvgLabel}>Moyenne du bulletin</Text>
                      <Text style={[styles.rcAvgValue, { color: passed ? colors.success : colors.danger }]}>
                        {avg.toFixed(2)}/20
                      </Text>
                    </View>
                    <View style={[styles.rcResultBadge, { backgroundColor: passed ? '#D1FAE5' : '#FEE2E2' }]}>
                      <Ionicons
                        name={passed ? 'checkmark-circle' : 'close-circle'}
                        size={16}
                        color={passed ? colors.success : colors.danger}
                      />
                      <Text style={[styles.rcResultText, { color: passed ? colors.success : colors.danger }]}>
                        {passed ? 'Admis' : 'Ajourné'}
                      </Text>
                    </View>
                  </View>
                )}

                {item.comment && <Text style={styles.rcComment}>"{item.comment}"</Text>}

                {/* Download PDF button */}
                <TouchableOpacity
                  style={[styles.pdfBtn, !isPublished && styles.pdfBtnDisabled]}
                  onPress={() => handleDownloadPdf(item)}
                  disabled={!isPublished || isDownloading}
                >
                  {isDownloading ? (
                    <ActivityIndicator size="small" color={isPublished ? colors.primary : colors.textTertiary} />
                  ) : (
                    <Ionicons
                      name="download-outline"
                      size={16}
                      color={isPublished ? colors.primary : colors.textTertiary}
                    />
                  )}
                  <Text style={[styles.pdfBtnText, !isPublished && styles.pdfBtnTextDisabled]}>
                    {isDownloading ? 'Téléchargement...' : 'Télécharger PDF'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function getScoreColor(score, max) {
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
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },

  avgCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  avgLabel: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  avgValue: { fontSize: 36, fontWeight: '800', color: '#fff', marginTop: 2 },
  avgCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

  tabs: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.md },
  tab: { flex: 1, paddingVertical: 8, borderRadius: radius.md, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  tabTextActive: { color: colors.primary },

  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  subjectCard: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  subjectHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  subjectIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  subjectName: { fontSize: 15, fontWeight: '700', color: colors.text },
  subjectSub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  subjectAvgBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  subjectAvg: { fontSize: 13, fontWeight: '700' },
  gradeItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.divider },
  gradeTitle: { fontSize: 13, color: colors.text },
  gradeComment: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  gradeScore: { fontSize: 14, fontWeight: '700' },

  rcCard: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  rcHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rcIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rcTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  rcSub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },

  rcAvgRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.divider, padding: 12, borderRadius: radius.md },
  rcAvgLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 2 },
  rcAvgValue: { fontSize: 20, fontWeight: '800' },
  rcResultBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  rcResultText: { fontSize: 12, fontWeight: '700' },
  rcComment: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 8 },

  pdfBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  pdfBtnDisabled: { borderColor: colors.border, backgroundColor: '#F8FAFC' },
  pdfBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  pdfBtnTextDisabled: { color: colors.textTertiary },
});
