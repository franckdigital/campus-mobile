import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import studentService from '../../services/student';
import apiClient from '../../services/apiClient';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, radius } from '../../theme/colors';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAY_MAP = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5 };
const TODAY_IDX = Math.min(new Date().getDay() - 1, 5); // Mon=0, handle Sun=-1→-1→0

const SUBJECT_COLORS = [
  { bg: '#EEF2FF', text: '#4F46E5' },
  { bg: '#D1FAE5', text: '#059669' },
  { bg: '#FEF3C7', text: '#D97706' },
  { bg: '#FCE7F3', text: '#DB2777' },
  { bg: '#E0F2FE', text: '#0284C7' },
  { bg: '#F3E8FF', text: '#7C3AED' },
  { bg: '#FFE4E6', text: '#E11D48' },
];

function colorForSubject(name) {
  if (!name) return SUBJECT_COLORS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % SUBJECT_COLORS.length;
  return SUBJECT_COLORS[h];
}

export default function StudentPlanningScreen({ navigation }) {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState(TODAY_IDX >= 0 ? TODAY_IDX : 0);

  const fetchData = useCallback(async () => {
    try {
      const me = await studentService.getMe();
      const dossier = await studentService.getDossier(me.id);
      const activeEnroll = dossier?.enrollments?.find((e) => e.is_active);
      const classId = activeEnroll?.class_obj;
      if (classId) {
        const data = await apiClient.get('/timetable/sessions/', { params: { class_obj: classId } }).then((r) => r.data);
        setSchedule(data?.results || data || []);
      } else {
        const data = await apiClient.get('/timetable/sessions/', { params: { student: me.id } }).then((r) => r.data);
        setSchedule(data?.results || data || []);
      }
    } catch (e) {
      console.log('Planning error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const dayKey = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][selectedDay];
  const todaySlots = schedule.filter((s) => s.day_of_week === dayKey || DAY_MAP[s.day_of_week] === selectedDay);
  todaySlots.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#3730A3', '#4F46E5', '#6D28D9']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Planning</Text>
            <View style={{ width: 38 }} />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayBar}>
            {DAYS.map((d, i) => (
              <TouchableOpacity
                key={d}
                style={[styles.dayChip, selectedDay === i && styles.dayChipActive]}
                onPress={() => setSelectedDay(i)}
              >
                <Text style={[styles.dayLabel, selectedDay === i && styles.dayLabelActive]}>{d}</Text>
                {i === TODAY_IDX && <View style={[styles.todayDot, selectedDay === i && styles.todayDotActive]} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {todaySlots.length === 0 ? (
            <EmptyState icon="calendar-outline" title="Pas de cours ce jour" subtitle="Profitez de votre journée libre !" />
          ) : (
            todaySlots.map((slot) => {
              const sc = colorForSubject(slot.subject_name);
              return (
                <View key={slot.id} style={styles.slotCard}>
                  <View style={[styles.slotAccent, { backgroundColor: sc.text }]} />
                  <View style={styles.slotTime}>
                    <Text style={styles.slotStart}>{slot.start_time?.slice(0, 5) || '--:--'}</Text>
                    <View style={styles.slotDivLine} />
                    <Text style={styles.slotEnd}>{slot.end_time?.slice(0, 5) || '--:--'}</Text>
                  </View>
                  <View style={styles.slotBody}>
                    <View style={[styles.subjectBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.subjectBadgeText, { color: sc.text }]} numberOfLines={1}>
                        {slot.subject_name || 'Matière'}
                      </Text>
                    </View>
                    <Text style={styles.slotClass}>{slot.class_name || ''}</Text>
                    {slot.teacher_name && (
                      <View style={styles.teacherRow}>
                        <Ionicons name="person-outline" size={12} color={colors.textTertiary} />
                        <Text style={styles.teacherName}>{slot.teacher_name}</Text>
                      </View>
                    )}
                    {slot.room && (
                      <View style={styles.teacherRow}>
                        <Ionicons name="location-outline" size={12} color={colors.textTertiary} />
                        <Text style={styles.teacherName}>{slot.room}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, paddingBottom: spacing.md },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  dayBar: { flexDirection: 'row', gap: 8, paddingBottom: spacing.md, paddingRight: spacing.md },
  dayChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', minWidth: 52 },
  dayChipActive: { backgroundColor: '#fff' },
  dayLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  dayLabelActive: { color: colors.primary },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.6)', marginTop: 2 },
  todayDotActive: { backgroundColor: colors.primary },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  slotCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: radius.lg, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  slotAccent: { width: 4 },
  slotTime: { width: 56, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 12, borderRightWidth: 1, borderRightColor: colors.divider },
  slotStart: { fontSize: 12, fontWeight: '700', color: colors.text },
  slotDivLine: { width: 1, height: 12, backgroundColor: colors.divider },
  slotEnd: { fontSize: 12, color: colors.textSecondary },
  slotBody: { flex: 1, padding: 12, gap: 4 },
  subjectBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  subjectBadgeText: { fontSize: 13, fontWeight: '700' },
  slotClass: { fontSize: 12, color: colors.textSecondary },
  teacherRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  teacherName: { fontSize: 11, color: colors.textTertiary },
});
