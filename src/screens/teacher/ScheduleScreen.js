import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import teacherService from '../../services/teacher';
import { colors, spacing, radius } from '../../theme/colors';

const DAYS = [
  { key: 'MONDAY',    label: 'Lun', full: 'Lundi' },
  { key: 'TUESDAY',   label: 'Mar', full: 'Mardi' },
  { key: 'WEDNESDAY', label: 'Mer', full: 'Mercredi' },
  { key: 'THURSDAY',  label: 'Jeu', full: 'Jeudi' },
  { key: 'FRIDAY',    label: 'Ven', full: 'Vendredi' },
  { key: 'SATURDAY',  label: 'Sam', full: 'Samedi' },
];

// Converts day_of_week (number or string) → English key matching DAYS[].key
// Backend: 0=Monday … 5=Saturday; seed may use 1=Lundi … 6=Samedi (frontend conv.)
const DOW_NUM_EN = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DOW_FR_EN  = {
  LUNDI:'MONDAY', MARDI:'TUESDAY', MERCREDI:'WEDNESDAY',
  JEUDI:'THURSDAY', VENDREDI:'FRIDAY', SAMEDI:'SATURDAY', DIMANCHE:'SUNDAY',
  MONDAY:'MONDAY', TUESDAY:'TUESDAY', WEDNESDAY:'WEDNESDAY',
  THURSDAY:'THURSDAY', FRIDAY:'FRIDAY', SATURDAY:'SATURDAY', SUNDAY:'SUNDAY',
};
function normDayEn(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return DOW_NUM_EN[raw] ?? null;
  return DOW_FR_EN[String(raw).toUpperCase()] ?? String(raw).toUpperCase();
}

const JS_DAY_MAP = { 0: 'SUNDAY', 1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY', 4: 'THURSDAY', 5: 'FRIDAY', 6: 'SATURDAY' };
const TODAY_KEY = JS_DAY_MAP[new Date().getDay()];

const SUBJECT_COLORS = ['#4F46E5', '#D97706', '#059669', '#DC2626', '#7C3AED', '#0EA5E9', '#F59E0B'];

export default function ScheduleScreen({ navigation }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeDay, setActiveDay] = useState(TODAY_KEY);

  const fetchSessions = useCallback(async () => {
    try {
      const me = await teacherService.getMe().catch(() => null);
      const teacherId = me?.id;
      const res = await teacherService.getSessions(teacherId ? { teacher_id: teacherId } : {});
      setSessions(res?.results || res || []);
    } catch (e) {
      console.log('schedule error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const unsub = navigation?.addListener?.('focus', fetchSessions);
    return unsub;
  }, [fetchSessions, navigation]);
  const onRefresh = () => { setRefreshing(true); fetchSessions(); };

  const daySessions = sessions
    .filter((s) => normDayEn(s.day_of_week) === activeDay)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

  const subjectColorMap = {};
  const subjects = [...new Set(sessions.map((s) => s.subject_name || s.subject))];
  subjects.forEach((sub, i) => { subjectColorMap[sub] = SUBJECT_COLORS[i % SUBJECT_COLORS.length]; });

  const totalHoursPerDay = (day) => {
    const daySess = sessions.filter((s) => normDayEn(s.day_of_week) === day);
    return daySess.reduce((acc, s) => {
      if (!s.start_time || !s.end_time) return acc;
      const [sh, sm] = s.start_time.split(':').map(Number);
      const [eh, em] = s.end_time.split(':').map(Number);
      return acc + (eh * 60 + em - sh * 60 - sm) / 60;
    }, 0);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#7C2D12', '#B45309', '#D97706']} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <Text style={styles.headerTitle}>Mon Planning</Text>
          <Text style={styles.headerSub}>{sessions.length} séance{sessions.length > 1 ? 's' : ''} programmée{sessions.length > 1 ? 's' : ''}</Text>
        </SafeAreaView>
      </LinearGradient>

      {/* Day selector */}
      <View style={styles.dayBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayScroll}>
          {DAYS.map((d) => {
            const isActive = activeDay === d.key;
            const isToday = d.key === TODAY_KEY;
            const hours = totalHoursPerDay(d.key);
            return (
              <TouchableOpacity key={d.key} style={[styles.dayBtn, isActive && styles.dayBtnActive]} onPress={() => setActiveDay(d.key)}>
                <Text style={[styles.dayLabel, isActive && styles.dayLabelActive]}>{d.label}</Text>
                {isToday && <View style={styles.todayDot} />}
                {hours > 0 && <Text style={[styles.dayHours, isActive && { color: '#fff' }]}>{hours}h</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.warning} />}
      >
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.warning} size="large" /></View>
        ) : daySessions.length === 0 ? (
          <View style={styles.empty}>
            <LinearGradient colors={['#FEF3C7', '#FDE68A']} style={styles.emptyIcon}>
              <Ionicons name="sunny-outline" size={32} color="#92400E" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>Pas de cours ce jour</Text>
            <Text style={styles.emptyText}>Profitez de votre temps libre !</Text>
          </View>
        ) : (
          daySessions.map((s, idx) => {
            const subjectKey = s.subject_name || s.subject;
            const accentColor = subjectColorMap[subjectKey] || colors.primary;
            const [sh, sm] = (s.start_time || '00:00').split(':').map(Number);
            const [eh, em] = (s.end_time || '00:00').split(':').map(Number);
            const duration = eh * 60 + em - sh * 60 - sm;

            return (
              <TouchableOpacity
                key={s.id}
                style={styles.sessionCard}
                activeOpacity={0.75}
                onPress={() => navigation?.navigate?.('TeacherSessionForm', { session: s })}
              >
                {/* Time column */}
                <View style={styles.timeCol}>
                  <Text style={styles.timeStart}>{s.start_time?.slice(0, 5) || '--:--'}</Text>
                  <View style={[styles.timeLine, { backgroundColor: accentColor + '30' }]} />
                  <Text style={styles.timeEnd}>{s.end_time?.slice(0, 5) || '--:--'}</Text>
                </View>

                {/* Content */}
                <View style={[styles.sessionContent, { borderLeftColor: accentColor }]}>
                  <View style={styles.sessionTop}>
                    <View style={[styles.subjectDot, { backgroundColor: accentColor }]} />
                    <Text style={styles.subjectName}>{s.subject_name || s.subject}</Text>
                  </View>
                  <Text style={styles.className}>{s.class_name || s.class_obj}</Text>
                  <View style={styles.sessionMeta}>
                    {s.room_name && (
                      <View style={styles.metaChip}>
                        <Ionicons name="location-outline" size={11} color={colors.textTertiary} />
                        <Text style={styles.metaText}>{s.room_name}</Text>
                      </View>
                    )}
                    <View style={styles.metaChip}>
                      <Ionicons name="time-outline" size={11} color={colors.textTertiary} />
                      <Text style={styles.metaText}>{duration} min</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Weekly summary */}
        {!loading && sessions.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Résumé hebdomadaire</Text>
            <View style={styles.summaryGrid}>
              {DAYS.map((d) => {
                const count = sessions.filter((s) => normDayEn(s.day_of_week) === d.key).length;
                const h = totalHoursPerDay(d.key);
                return (
                  <View key={d.key} style={styles.summaryItem}>
                    <Text style={styles.summaryDay}>{d.label}</Text>
                    <Text style={styles.summaryCount}>{count}</Text>
                    <Text style={styles.summaryH}>{h > 0 ? `${h}h` : '-'}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => navigation?.navigate?.('TeacherSessionForm', { dayOfWeek: activeDay })}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff', paddingTop: spacing.sm },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  dayBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border },
  dayScroll: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  dayBtn: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md, minWidth: 52 },
  dayBtnActive: { backgroundColor: colors.warning },
  dayLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  dayLabelActive: { color: '#fff' },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.danger, marginTop: 2 },
  dayHours: { fontSize: 10, color: colors.textTertiary, marginTop: 1 },
  center: { paddingTop: 60, alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 14, color: colors.textSecondary },
  sessionCard: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  timeCol: { alignItems: 'center', width: 48 },
  timeStart: { fontSize: 12, fontWeight: '700', color: colors.text },
  timeLine: { flex: 1, width: 2, marginVertical: 4, minHeight: 20, borderRadius: 1 },
  timeEnd: { fontSize: 11, color: colors.textTertiary },
  sessionContent: { flex: 1, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, borderLeftWidth: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  sessionTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  subjectDot: { width: 8, height: 8, borderRadius: 4 },
  subjectName: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 },
  className: { fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
  sessionMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, color: colors.textTertiary },
  summaryCard: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { alignItems: 'center', gap: 2 },
  summaryDay: { fontSize: 11, color: colors.textTertiary, fontWeight: '600' },
  summaryCount: { fontSize: 16, fontWeight: '700', color: colors.text },
  summaryH: { fontSize: 10, color: colors.textSecondary },
  fab: {
    position: 'absolute', right: spacing.md, bottom: spacing.md,
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.warning,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
  },
});
