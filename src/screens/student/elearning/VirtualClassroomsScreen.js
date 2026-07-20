import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import elearningService from '../../../services/elearning';
import studentService from '../../../services/student';
import EmptyState from '../../../components/common/EmptyState';
import { colors, spacing, radius } from '../../../theme/colors';

function classroomStatus(c) {
  if (c.is_ended) return 'ended';
  const now = new Date();
  const start = new Date(c.start_time);
  const end = new Date(start.getTime() + (c.duration_minutes || 60) * 60000);
  if (now < start) return 'upcoming';
  if (now <= end) return 'live';
  return 'ended';
}

const STATUS_INFO = {
  live: { label: 'EN DIRECT', bg: '#D1FAE5', color: '#059669', dot: '#22C55E' },
  upcoming: { label: 'À VENIR', bg: '#DBEAFE', color: '#2563EB', dot: '#60A5FA' },
  ended: { label: 'TERMINÉE', bg: '#F1F5F9', color: '#64748B', dot: '#94A3B8' },
};

const FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'live', label: 'En direct' },
  { key: 'upcoming', label: 'À venir' },
  { key: 'ended', label: 'Passées' },
];

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function VirtualClassroomsScreen({ navigation }) {
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const fetchData = useCallback(async () => {
    try {
      const me = await studentService.getMe();
      const classId = me?.current_class?.id;
      const res = classId
        ? await elearningService.getClassrooms({ class_obj: classId, page_size: 100 })
        : { results: [] };
      const list = (res?.results ?? res ?? []).slice().sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
      setClassrooms(list);
    } catch (e) {
      console.log('Classrooms error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const withStatus = classrooms.map((c) => ({ ...c, _status: classroomStatus(c) }));
  const liveCount = withStatus.filter((c) => c._status === 'live').length;
  const upcomingCount = withStatus.filter((c) => c._status === 'upcoming').length;
  const endedCount = withStatus.filter((c) => c._status === 'ended').length;

  const filtered = withStatus.filter((c) => {
    if (filter !== 'all' && c._status !== filter) return false;
    if (search && !c.title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openUrl = (url) => {
    if (url) Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1E3A8A', '#2563EB', '#3B82F6']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Classes virtuelles</Text>
            <View style={{ width: 38 }} />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{liveCount}</Text>
              <Text style={styles.statLabel}>En direct</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{upcomingCount}</Text>
              <Text style={styles.statLabel}>À venir</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{endedCount}</Text>
              <Text style={styles.statLabel}>Passées</Text>
            </View>
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color="rgba(255,255,255,0.7)" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher une session..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              style={styles.searchInput}
            />
          </View>

          <View style={styles.filterRow}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#2563EB" size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState icon="videocam-outline" title="Aucune classe virtuelle" subtitle="Revenez plus tard" />}
          renderItem={({ item }) => {
            const st = STATUS_INFO[item._status];
            return (
              <TouchableOpacity
                style={[styles.card, item._status === 'live' && styles.cardLive]}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('ClassroomDetail', { classroomId: item.id, classroomTitle: item.title })}
              >
                <View style={styles.cardIcon}>
                  <Ionicons name="videocam-outline" size={22} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: st.dot }]} />
                      <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardMeta}>{formatDateTime(item.start_time)} · {item.duration_minutes} min</Text>
                  {item.subject_name ? <Text style={styles.cardSubject}>{item.subject_name}</Text> : null}
                </View>
                {item._status === 'live' && (
                  <TouchableOpacity style={styles.joinBtn} onPress={() => navigation.navigate('ClassroomDetail', { classroomId: item.id, classroomTitle: item.title })}>
                    <Ionicons name="radio" size={13} color="#fff" />
                    <Text style={styles.joinBtnText}>Rejoindre</Text>
                  </TouchableOpacity>
                )}
                {item._status === 'ended' && item.recording_url && (
                  <TouchableOpacity style={styles.replayBtn} onPress={() => openUrl(item.recording_url)}>
                    <Ionicons name="play" size={13} color="#475569" />
                  </TouchableOpacity>
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

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9, marginBottom: spacing.sm },
  searchInput: { flex: 1, color: '#fff', fontSize: 13 },

  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { flex: 1, paddingVertical: 7, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  filterChipActive: { backgroundColor: '#fff' },
  filterChipText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  filterChipTextActive: { color: '#2563EB' },

  list: { padding: spacing.md, gap: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardLive: { borderLeftWidth: 3, borderLeftColor: '#22C55E' },
  cardIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '700' },
  cardMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  cardSubject: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },

  joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md },
  joinBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  replayBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.divider, alignItems: 'center', justifyContent: 'center' },
});
