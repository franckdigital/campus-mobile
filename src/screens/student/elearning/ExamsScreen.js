import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { elearningService } from '../../../services/elearning';
import EmptyState from '../../../components/common/EmptyState';
import { colors, spacing, radius } from '../../../theme/colors';

const GREEN = '#059669';
const EXAM_COLORS = { MID: '#d97706', FINAL: '#ef4444', SUPP: '#7c3aed', TP: '#059669', CONCOURS: '#0ea5e9' };
const EXAM_LABELS = { MID: 'Partiel', FINAL: 'Examen final', SUPP: 'Rattrapage', TP: 'TP noté', CONCOURS: 'Concours' };

const TABS = [
  { key: 'all', label: 'Tous' },
  { key: 'ongoing', label: 'En cours' },
  { key: 'upcoming', label: 'À venir' },
  { key: 'done', label: 'Complétés' },
];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ExamsScreen({ navigation }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await elearningService.getSecureExams({ page_size: 200, is_published: true });
      setExams(res?.results || res || []);
    } catch (e) {
      console.log('Exams error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const now = new Date();
  const done = exams.filter((e) => ['SUBMITTED', 'FLAGGED'].includes(e.my_session?.status));
  const ongoing = exams.filter((e) => !done.includes(e) && e.is_available && (!e.start_date || new Date(e.start_date) <= now));
  const upcoming = exams.filter((e) => !done.includes(e) && !ongoing.includes(e));

  const filtered = tab === 'ongoing' ? ongoing : tab === 'upcoming' ? upcoming : tab === 'done' ? done : exams;
  const searched = search.trim()
    ? filtered.filter((e) =>
        e.title?.toLowerCase().includes(search.toLowerCase()) ||
        e.subject_name?.toLowerCase().includes(search.toLowerCase()))
    : filtered;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#065F46', GREEN, '#047857']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Examens sécurisés</Text>
            <View style={{ width: 38 }} />
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{exams.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{ongoing.length}</Text>
              <Text style={styles.statLabel}>En cours</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{done.length}</Text>
              <Text style={styles.statLabel}>Complétés</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.tabsRow}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={colors.textTertiary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un examen..."
          placeholderTextColor={colors.textTertiary}
          style={styles.searchInput}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={GREEN} size="large" /></View>
      ) : (
        <FlatList
          data={searched}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}
          ListEmptyComponent={<EmptyState icon="ribbon-outline" title="Aucun examen" />}
          renderItem={({ item }) => {
            const tc = EXAM_COLORS[item.exam_type] || '#6366f1';
            const isDone = ['SUBMITTED', 'FLAGGED'].includes(item.my_session?.status);
            return (
              <TouchableOpacity
                style={[styles.card, { borderTopColor: tc, borderTopWidth: 4 }]}
                onPress={() => navigation.navigate('ExamDetail', { examId: item.id })}
              >
                <View style={styles.cardBadges}>
                  <View style={[styles.typeBadge, { backgroundColor: tc + '20' }]}>
                    <Text style={[styles.typeBadgeText, { color: tc }]}>{EXAM_LABELS[item.exam_type] || item.exam_type}</Text>
                  </View>
                  {!!item.exam_pdf && (
                    <View style={styles.pdfBadge}>
                      <Text style={styles.pdfBadgeText}>PDF</Text>
                    </View>
                  )}
                  {!!item.quiz && (
                    <View style={styles.onlineBadge}>
                      <Text style={styles.onlineBadgeText}>En ligne</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                {!!item.subject_name && <Text style={styles.cardSub}>{item.subject_name} · {item.duration_minutes} min</Text>}
                {!!item.start_date && <Text style={styles.cardDate}>{fmtDate(item.start_date)}</Text>}
                <View style={[styles.statusRow, { backgroundColor: isDone ? colors.successLight : colors.background }]}>
                  <Ionicons name={isDone ? 'checkmark-circle' : 'time-outline'} size={13} color={isDone ? colors.success : colors.textTertiary} />
                  <Text style={[styles.statusText, isDone && { color: colors.success }]}>{isDone ? 'Terminé' : 'Voir les détails'}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, paddingBottom: spacing.md },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, padding: 10, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  tabsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  tab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: GREEN, borderColor: GREEN },
  tabText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { color: '#fff' },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.md, marginTop: spacing.md, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 13, color: colors.text },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 32 },

  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardBadges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  typeBadgeText: { fontSize: 10, fontWeight: '800' },
  pdfBadge: { backgroundColor: '#EDE9FE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pdfBadgeText: { fontSize: 10, fontWeight: '700', color: '#7C3AED' },
  onlineBadge: { backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  onlineBadgeText: { fontSize: 10, fontWeight: '700', color: '#2563EB' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 },
  cardSub: { fontSize: 12, color: colors.textSecondary },
  cardDate: { fontSize: 11, color: colors.textTertiary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.md },
  statusText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
});
