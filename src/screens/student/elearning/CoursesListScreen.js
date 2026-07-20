import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import elearningService from '../../../services/elearning';
import EmptyState from '../../../components/common/EmptyState';
import { colors, spacing, radius } from '../../../theme/colors';

const LEVEL_INFO = {
  beginner: { label: 'Débutant', bg: '#D1FAE5', color: '#059669' },
  intermediate: { label: 'Intermédiaire', bg: '#DBEAFE', color: '#2563EB' },
  advanced: { label: 'Avancé', bg: '#FCE7F3', color: '#DB2777' },
  all_levels: { label: 'Tous niveaux', bg: '#F3E8FF', color: '#7C3AED' },
};

const LEVEL_FILTERS = [
  { key: null, label: 'Tous' },
  { key: 'beginner', label: 'Débutant' },
  { key: 'intermediate', label: 'Intermédiaire' },
  { key: 'advanced', label: 'Avancé' },
];

export default function CoursesListScreen({ navigation }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await elearningService.getCourses({ status: 'published', page_size: 100 });
      setCourses(res?.results ?? res ?? []);
    } catch (e) {
      console.log('Courses list error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const filtered = courses.filter((c) => {
    if (level && c.level !== level) return false;
    if (search && !c.title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const beginnerCount = courses.filter((c) => c.level === 'beginner').length;
  const certCount = courses.filter((c) => c.certificate_enabled).length;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#9D174D', '#DB2777', '#BE185D']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Cours</Text>
            <View style={{ width: 38 }} />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{courses.length}</Text>
              <Text style={styles.statLabel}>Disponibles</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{beginnerCount}</Text>
              <Text style={styles.statLabel}>Débutant</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{certCount}</Text>
              <Text style={styles.statLabel}>Certifiants</Text>
            </View>
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color="rgba(255,255,255,0.7)" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher un cours..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              style={styles.searchInput}
            />
          </View>

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={LEVEL_FILTERS}
            keyExtractor={(item) => String(item.key)}
            contentContainerStyle={styles.filterRow}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.filterChip, level === item.key && styles.filterChipActive]}
                onPress={() => setLevel(item.key)}
              >
                <Text style={[styles.filterChipText, level === item.key && styles.filterChipTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#DB2777" size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.sm }}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState icon="layers-outline" title="Aucun cours disponible" subtitle="Les cours seront publiés prochainement" />}
          renderItem={({ item }) => {
            const lv = LEVEL_INFO[item.level] || LEVEL_INFO.all_levels;
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('CourseDetail', { courseId: item.id, courseTitle: item.title })}
              >
                {item.thumbnail_url ? (
                  <Image source={{ uri: item.thumbnail_url }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]}>
                    <Ionicons name="layers-outline" size={32} color="#DB2777" style={{ opacity: 0.4 }} />
                  </View>
                )}
                <View style={styles.cardBody}>
                  <View style={styles.badgeRow}>
                    <View style={[styles.levelBadge, { backgroundColor: lv.bg }]}>
                      <Text style={[styles.levelBadgeText, { color: lv.color }]}>{lv.label}</Text>
                    </View>
                    {item.is_free && (
                      <View style={[styles.levelBadge, { backgroundColor: '#D1FAE5' }]}>
                        <Text style={[styles.levelBadgeText, { color: '#059669' }]}>Gratuit</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  {item.subtitle ? <Text style={styles.cardSubtitle} numberOfLines={1}>{item.subtitle}</Text> : null}
                  <View style={styles.cardFooter}>
                    {item.total_students > 0 ? (
                      <Text style={styles.cardMeta}><Ionicons name="people-outline" size={11} /> {item.total_students}</Text>
                    ) : <View />}
                    <Text style={styles.cardCta}>Commencer</Text>
                  </View>
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

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2, textAlign: 'center' },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9, marginBottom: spacing.sm },
  searchInput: { flex: 1, color: '#fff', fontSize: 13 },

  filterRow: { gap: 8, paddingBottom: 4 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.15)' },
  filterChipActive: { backgroundColor: '#fff' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  filterChipTextActive: { color: '#DB2777' },

  list: { padding: spacing.md, gap: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: { flex: 1, backgroundColor: '#fff', borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  thumb: { width: '100%', height: 90 },
  thumbFallback: { backgroundColor: '#FCE7F3', alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: spacing.sm, gap: 4 },
  badgeRow: { flexDirection: 'row', gap: 6 },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  levelBadgeText: { fontSize: 9, fontWeight: '700' },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 2 },
  cardSubtitle: { fontSize: 11, color: colors.textSecondary },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cardMeta: { fontSize: 10, color: colors.textTertiary },
  cardCta: { fontSize: 11, fontWeight: '700', color: '#DB2777' },
});
