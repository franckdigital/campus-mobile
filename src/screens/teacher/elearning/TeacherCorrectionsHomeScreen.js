import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, RefreshControl, ActivityIndicator, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyState from '../../../components/common/EmptyState';
import elearningService from '../../../services/elearning';
import asArray from '../../../utils/asArray';
import { colors, spacing, radius } from '../../../theme/colors';

const ACCENT = '#EA580C';
const GRADIENT = ['#7C2D12', '#C2410C', '#EA580C'];

const TABS = [
  { key: 'assignments', label: 'Devoirs', icon: 'clipboard-outline' },
  { key: 'quizzes', label: 'Quiz', icon: 'list-outline' },
  { key: 'exams', label: 'Examens', icon: 'shield-checkmark-outline' },
];

export default function TeacherCorrectionsHomeScreen({ navigation }) {
  const [tab, setTab] = useState('assignments');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async (t) => {
    setLoading(true);
    try {
      let data = [];
      if (t === 'assignments') {
        const res = await elearningService.getAssignments({ page_size: 100, ordering: '-created_at' });
        data = asArray(res);
      } else if (t === 'quizzes') {
        const res = await elearningService.getQuizzes({ page_size: 100, ordering: '-created_at' });
        data = asArray(res);
      } else {
        const res = await elearningService.getSecureExams({ page_size: 100, ordering: '-created_at' });
        data = asArray(res);
      }
      setItems(data);
    } catch (e) {
      console.log('corrections load error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
    const unsub = navigation.addListener('focus', () => load(tab));
    return unsub;
  }, [tab, load, navigation]);

  const onRefresh = () => { setRefreshing(true); load(tab); };

  const filtered = search.trim()
    ? items.filter((it) => (it.title || '').toLowerCase().includes(search.toLowerCase()))
    : items;

  const openItem = (item) => {
    if (tab === 'assignments') navigation.navigate('TeacherAssignmentSubmissions', { assignment: item });
    else if (tab === 'quizzes') navigation.navigate('TeacherQuizAttempts', { quiz: item });
    else navigation.navigate('TeacherExamSessions', { exam: item });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={GRADIENT} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Corrections</Text>
            <View style={{ width: 38 }} />
          </View>
          <Text style={styles.headerSub}>Notation par question — devoirs, quiz et examens</Text>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.tabsRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => { setTab(t.key); setSearch(''); }}
          >
            <Ionicons name={t.icon} size={14} color={tab === t.key ? '#fff' : colors.textSecondary} />
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={colors.textTertiary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher..."
          placeholderTextColor={colors.textTertiary}
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={ACCENT} size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
          ListEmptyComponent={<EmptyState icon="checkmark-done-outline" title="Rien à corriger" />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openItem(item)} activeOpacity={0.75}>
              <View style={styles.cardIcon}>
                <Ionicons name={TABS.find((t) => t.key === tab)?.icon || 'document-outline'} size={18} color={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title || '—'}</Text>
                <Text style={styles.cardSub}>{[item.class_name, item.subject_name].filter(Boolean).join(' · ')}</Text>
              </View>
              {tab === 'assignments' && (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{item.submission_count || 0}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, paddingBottom: spacing.sm },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },

  tabsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, flex: 1, justifyContent: 'center' },
  tabActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { color: '#fff' },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.md, marginTop: spacing.md, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 13, color: colors.text },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 32 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  countBadge: { backgroundColor: ACCENT + '18', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { fontSize: 12, fontWeight: '800', color: ACCENT },
});
