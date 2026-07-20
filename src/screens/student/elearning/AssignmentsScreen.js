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

const PINK = '#DB2777';
const PINK_LIGHT = '#FCE7F3';

const TABS = [
  { key: 'all', label: 'Tous' },
  { key: 'pending', label: 'À rendre' },
  { key: 'submitted', label: 'Rendus' },
  { key: 'graded', label: 'Notés' },
];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AssignmentsScreen({ navigation }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await elearningService.getAssignments({ page_size: 100, ordering: '-created_at' });
      setAssignments(res?.results || res || []);
    } catch (e) {
      console.log('Assignments error:', e.message);
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

  const pending = assignments.filter((a) => !a.submission);
  const submitted = assignments.filter((a) => !!a.submission);
  const graded = assignments.filter((a) => a.submission?.correction?.score != null);

  const filtered = tab === 'pending' ? pending : tab === 'submitted' ? submitted : tab === 'graded' ? graded : assignments;
  const searched = search.trim()
    ? filtered.filter((a) =>
        a.title?.toLowerCase().includes(search.toLowerCase()) ||
        a.subject_name?.toLowerCase().includes(search.toLowerCase()))
    : filtered;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#9D174D', PINK, '#BE185D']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Devoirs & Exercices</Text>
            <View style={{ width: 38 }} />
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{assignments.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{pending.length}</Text>
              <Text style={styles.statLabel}>À rendre</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{submitted.length}</Text>
              <Text style={styles.statLabel}>Rendus</Text>
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
          placeholder="Rechercher un devoir..."
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
        <View style={styles.center}><ActivityIndicator color={PINK} size="large" /></View>
      ) : (
        <FlatList
          data={searched}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PINK} />}
          ListEmptyComponent={<EmptyState icon="clipboard-outline" title="Aucun devoir" />}
          renderItem={({ item }) => {
            const isPastDue = item.due_date && new Date(item.due_date) < new Date() && !item.submission;
            const isGraded = item.submission?.correction?.score != null;
            const score = item.submission?.correction?.score;
            const borderClr = item.submission ? colors.success : isPastDue ? colors.danger : colors.warning;
            return (
              <TouchableOpacity
                style={[styles.card, { borderLeftColor: borderClr }]}
                onPress={() => navigation.navigate('AssignmentDetail', { assignment: item })}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.cardIcon, { backgroundColor: item.submission ? colors.successLight : PINK_LIGHT }]}>
                    <Ionicons
                      name={isGraded ? 'star' : item.submission ? 'checkmark-circle' : 'clipboard-outline'}
                      size={18}
                      color={item.submission ? colors.success : PINK}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                    {!!item.subject_name && <Text style={styles.cardSub}>{item.subject_name}</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </View>
                <View style={styles.cardMeta}>
                  {!!item.attachment && (
                    <View style={styles.pdfBadge}>
                      <Ionicons name="document-text-outline" size={11} color="#7C3AED" />
                      <Text style={styles.pdfBadgeText}>PDF</Text>
                    </View>
                  )}
                  {!!item.due_date && (
                    <Text style={[styles.dueText, isPastDue && { color: colors.danger, fontWeight: '700' }]}>
                      <Ionicons name="time-outline" size={11} /> {fmtDate(item.due_date)}
                    </Text>
                  )}
                </View>
                <View style={[styles.statusRow, { backgroundColor: isGraded ? colors.successLight : item.submission ? colors.successLight : isPastDue ? colors.dangerLight : colors.warningLight }]}>
                  <Text style={[styles.statusText, { color: isGraded ? colors.success : item.submission ? colors.success : isPastDue ? colors.danger : '#B45309' }]}>
                    {isGraded ? `✓ Corrigé — ${score}/${item.max_score || 20} pts` : item.submission ? '✓ Rendu' : isPastDue ? '⚠ Délai dépassé' : '⏳ En attente'}
                  </Text>
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
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: PINK, borderColor: PINK },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { color: '#fff' },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.md, marginTop: spacing.md, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 13, color: colors.text },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 32 },

  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: 10, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  pdfBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F5F3FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pdfBadgeText: { fontSize: 10, fontWeight: '700', color: '#7C3AED' },
  dueText: { fontSize: 11, color: colors.textSecondary },
  statusRow: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.md },
  statusText: { fontSize: 12, fontWeight: '700' },
});
