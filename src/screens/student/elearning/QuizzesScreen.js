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

const PURPLE = '#7C3AED';
const PURPLE_LIGHT = '#EDE9FE';

const TABS = [
  { key: 'all', label: 'Tous' },
  { key: 'pending', label: 'À faire' },
  { key: 'done', label: 'Terminés' },
];

export default function QuizzesScreen({ navigation }) {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await elearningService.getQuizzes({ page_size: 100, is_published: true });
      setQuizzes(res?.results || res || []);
    } catch (e) {
      console.log('Quizzes error:', e.message);
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

  const done = quizzes.filter((q) => q.max_attempts > 0 ? q.attempts_used >= q.max_attempts : q.best_score != null);
  const pending = quizzes.filter((q) => !done.includes(q));

  const filtered = tab === 'pending' ? pending : tab === 'done' ? done : quizzes;
  const searched = search.trim()
    ? filtered.filter((q) =>
        q.title?.toLowerCase().includes(search.toLowerCase()) ||
        q.subject_name?.toLowerCase().includes(search.toLowerCase()))
    : filtered;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#5B21B6', PURPLE, '#6D28D9']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Évaluations</Text>
            <View style={{ width: 38 }} />
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{quizzes.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{pending.length}</Text>
              <Text style={styles.statLabel}>À faire</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{done.length}</Text>
              <Text style={styles.statLabel}>Terminés</Text>
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
          placeholder="Rechercher un quiz..."
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
        <View style={styles.center}><ActivityIndicator color={PURPLE} size="large" /></View>
      ) : (
        <FlatList
          data={searched}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PURPLE} />}
          ListEmptyComponent={<EmptyState icon="list-outline" title="Aucun quiz disponible" />}
          renderItem={({ item }) => {
            const maxAtt = item.max_attempts || 0;
            const used = item.attempts_used || 0;
            const isDone = maxAtt > 0 && used >= maxAtt;
            const best = item.best_score;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('QuizTake', { quizId: item.id })}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.cardIcon, { backgroundColor: PURPLE_LIGHT }]}>
                    <Ionicons name="list-outline" size={18} color={PURPLE} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                    {!!item.subject_name && <Text style={styles.cardSub}>{item.subject_name}</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </View>
                <View style={styles.cardMeta}>
                  <Text style={styles.metaChip}>{item.question_count || 0} question{item.question_count > 1 ? 's' : ''}</Text>
                  <Text style={styles.metaChip}>{item.time_limit_minutes > 0 ? `${item.time_limit_minutes} min` : 'Illimité'}</Text>
                  {maxAtt > 0 && <Text style={styles.metaChip}>{used}/{maxAtt} tentative{maxAtt > 1 ? 's' : ''}</Text>}
                </View>
                {best && (
                  <View style={[styles.statusRow, { backgroundColor: best.is_passed ? colors.successLight : colors.dangerLight }]}>
                    <Text style={[styles.statusText, { color: best.is_passed ? colors.success : colors.danger }]}>
                      {best.is_passed ? '✓ Réussi' : '✗ Non validé'} — {parseFloat(best.percent).toFixed(1)}%
                    </Text>
                  </View>
                )}
                {isDone && !best && (
                  <View style={[styles.statusRow, { backgroundColor: colors.warningLight }]}>
                    <Text style={[styles.statusText, { color: '#B45309' }]}>Tentatives épuisées</Text>
                  </View>
                )}
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
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: PURPLE, borderColor: PURPLE },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { color: '#fff' },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.md, marginTop: spacing.md, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 13, color: colors.text },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 32 },

  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  cardMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaChip: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusRow: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.md },
  statusText: { fontSize: 12, fontWeight: '700' },
});
