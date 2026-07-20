import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import teacherService from '../../services/teacher';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, radius } from '../../theme/colors';

export default function TeacherClassesScreen({ navigation }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const teacherData = await teacherService.getMe().catch(() => null);
      const teacherId = teacherData?.id;

      // Primary site for cross-site filter
      const primarySiteId = teacherData?.sites?.find(ts => ts.is_primary)?.site
        || teacherData?.sites?.[0]?.site
        || null;

      // Use /teachers/{id}/sessions/ — scoped to teacher + is_active
      const sessData = teacherId
        ? await teacherService.getTeacherSessions(teacherId)
        : await teacherService.getSessions(primarySiteId ? { site_id: primarySiteId } : {});
      const rawSess = sessData?.results || sessData || [];

      // Coupled site+class filter
      const sessArr = primarySiteId
        ? rawSess.filter(s => !s.site_id || String(s.site_id) === String(primarySiteId))
        : rawSess;

      // Derive unique classes from sessions
      const classMap = {};
      sessArr.forEach((s) => {
        const cid = s.class_obj;
        if (!cid) return;
        if (!classMap[cid]) {
          const nameParts = (s.class_name || '').split(' — ');
          classMap[cid] = {
            id: cid,
            name: s.class_name || `Classe ${cid}`,
            level_name: nameParts[0] || '',
            academic_year_name: s.academic_year_name || '',
            student_count: null,
            subjects: [],
          };
        }
        if (s.subject_name && !classMap[cid].subjects.includes(s.subject_name)) {
          classMap[cid].subjects.push(s.subject_name);
        }
      });

      const classArr = Object.values(classMap);

      // Fetch student counts in parallel
      const counts = await Promise.allSettled(
        classArr.map((c) => teacherService.getClassStudents(c.id))
      );
      counts.forEach((res, i) => {
        if (res.status === 'fulfilled') {
          const data = res.value?.results || res.value || [];
          classArr[i].student_count = Array.isArray(data) ? data.length : (data.count ?? null);
        }
      });

      setClasses(classArr);
    } catch (e) { console.log(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#4C1D95', '#6D28D9', '#8B5CF6']} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mes classes</Text>
            <View style={{ width: 38 }} />
          </View>
          <View style={styles.statsChip}>
            <Ionicons name="people-outline" size={13} color="rgba(255,255,255,0.8)" />
            <Text style={styles.statsText}>{classes.length} classe{classes.length !== 1 ? 's' : ''}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#8B5CF6" size="large" /></View>
      ) : (
        <FlatList
          data={classes}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#8B5CF6" />}
          ListEmptyComponent={<EmptyState icon="people-outline" title="Aucune classe" />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <LinearGradient colors={['#EDE9FE', '#DDD6FE']} style={styles.cardIcon}>
                <Ionicons name="people-outline" size={22} color="#6D28D9" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSub}>{item.level_name || ''} · {item.academic_year_name || ''}</Text>
                <View style={styles.metaRow}>
                  {item.student_count != null && (
                    <View style={styles.metaItem}>
                      <Ionicons name="person-outline" size={12} color={colors.textTertiary} />
                      <Text style={styles.metaText}>{item.student_count} étudiant{item.student_count !== 1 ? 's' : ''}</Text>
                    </View>
                  )}
                  {item.subjects.length > 0 && (
                    <View style={styles.metaItem}>
                      <Ionicons name="book-outline" size={12} color={colors.textTertiary} />
                      <Text style={styles.metaText}>{item.subjects.length} matière{item.subjects.length !== 1 ? 's' : ''}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.actionsCol}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => navigation.navigate('Présences', { classId: item.id })}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkbox-outline" size={14} color="#6D28D9" />
                  <Text style={styles.actionBtnText}>Présences</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnPurple]}
                  onPress={() => navigation.navigate('Notes')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="create-outline" size={14} color="#6D28D9" />
                  <Text style={[styles.actionBtnText, { color: '#6D28D9' }]}>Notes</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, paddingBottom: spacing.md },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  statsChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statsText: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, gap: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 10, marginTop: 5 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, color: colors.textTertiary },
  actionsCol: { gap: 6, alignItems: 'flex-end' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EDE9FE', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  actionBtnPurple: { backgroundColor: '#EDE9FE' },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: '#6D28D9' },
});
