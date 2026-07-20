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
import gradesService from '../../services/grades';
import notificationsService from '../../services/notifications';
import { colors, spacing, radius } from '../../theme/colors';

const GRADIENT   = ['#1E3A8A', '#1D4ED8', '#2563EB'];
const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAY_FULL   = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const TODAY_IDX  = new Date().getDay();                 // 0=Sun … 6=Sat
const TODAY_STR  = DAY_FULL[TODAY_IDX].toUpperCase();   // "LUNDI" etc.

// Django stores day_of_week as 0=Monday … 6=Sunday (or English string)
const DOW_NUM = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE'];
const DOW_STR_MAP = {
  MONDAY: 'LUNDI', TUESDAY: 'MARDI', WEDNESDAY: 'MERCREDI',
  THURSDAY: 'JEUDI', FRIDAY: 'VENDREDI', SATURDAY: 'SAMEDI', SUNDAY: 'DIMANCHE',
  LUNDI: 'LUNDI', MARDI: 'MARDI', MERCREDI: 'MERCREDI',
  JEUDI: 'JEUDI', VENDREDI: 'VENDREDI', SAMEDI: 'SAMEDI', DIMANCHE: 'DIMANCHE',
};

function normDay(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return DOW_NUM[raw] ?? null;
  return DOW_STR_MAP[String(raw).toUpperCase()] ?? String(raw).toUpperCase();
}

// Map French day name to DOW_NUM index (used to build schedule per weekday)
const FR_TO_IDX = { LUNDI: 0, MARDI: 1, MERCREDI: 2, JEUDI: 3, VENDREDI: 4, SAMEDI: 5, DIMANCHE: 6 };

// Weekday picker — Mon to Sat
const WEEK_DAYS = [1, 2, 3, 4, 5, 6]; // JS getDay() values

// Real calendar dates for Mon–Sat of the current week
function getWeekDates() {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  return WEEK_DAYS.map((jsDay) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + (jsDay - 1));
    return d.getDate();
  });
}
const WEEK_DATES = getWeekDates();

const SESSION_COLORS = [
  ['#6366F1', '#818CF8'],
  ['#0891B2', '#22D3EE'],
  ['#059669', '#34D399'],
  ['#D97706', '#FBBF24'],
  ['#DC2626', '#F87171'],
  ['#7C3AED', '#A78BFA'],
];

export default function TeacherDashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [teacher, setTeacher]         = useState(null);
  const [sessions, setSessions]       = useState([]);
  const [classes, setClasses]         = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [activeDay, setActiveDay]     = useState(TODAY_IDX); // JS day index

  const fetchData = useCallback(async () => {
    try {
      // Get the authenticated teacher's profile first
      const teacherData = await teacherService.getMe().catch(() => null);
      setTeacher(teacherData);
      const teacherId = teacherData?.id;

      // Extract primary site (TeacherSiteSerializer field: `site` = Site UUID)
      const primarySiteId = teacherData?.sites?.find(ts => ts.is_primary)?.site
        || teacherData?.sites?.[0]?.site
        || null;

      // Use /teachers/{id}/sessions/ — already scoped to teacher + is_active
      // Fallback to /sessions/?site_id= when teacher profile is unavailable
      const [sessRes, evalsRes, notifRes] = await Promise.allSettled([
        teacherId
          ? teacherService.getTeacherSessions(teacherId)
          : teacherService.getSessions(primarySiteId ? { site_id: primarySiteId } : {}),
        gradesService.getEvaluations({}),
        notificationsService.getUnreadCount(),
      ]);

      const allSess = sessRes.status === 'fulfilled'
        ? (sessRes.value?.results || sessRes.value || [])
        : [];

      // Coupled site+class filter: keep only sessions from the teacher's primary site
      const sessArr = primarySiteId
        ? allSess.filter(s => !s.site_id || String(s.site_id) === String(primarySiteId))
        : allSess;

      setSessions(sessArr);

      // Derive unique classes from sessions (site-scoped, teacher-scoped)
      const classMap = {};
      sessArr.forEach((s) => {
        const cid = s.class_obj;
        if (cid && !classMap[cid]) {
          const parts = (s.class_name || '').split(' — ');
          classMap[cid] = {
            id: cid,
            name: s.class_name || `Classe ${cid}`,
            level_name: parts[0] || '',
            max_students: 40,
          };
        }
      });
      setClasses(Object.values(classMap));

      // Filter evaluations to teacher's classes only
      const classIds = new Set(Object.keys(classMap).map(String));
      const allEvals = evalsRes.status === 'fulfilled'
        ? (evalsRes.value?.results || evalsRes.value || [])
        : [];
      setEvaluations(
        classIds.size > 0
          ? allEvals.filter((ev) => classIds.has(String(ev.class_group)))
          : []
      );

      if (notifRes.status === 'fulfilled') setUnreadCount(notifRes.value?.count || 0);
    } catch (e) {
      console.log('Teacher dashboard error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // Sessions for the selected weekday
  const activeDayName = DAY_FULL[activeDay]?.toUpperCase();
  const daySessions = sessions
    .filter((s) => normDay(s.day_of_week) === activeDayName)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

  const todaySessions = sessions.filter((s) => normDay(s.day_of_week) === TODAY_STR);
  const pendingEvals  = evaluations;
  const initials      = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || 'P';

  if (loading) {
    return (
      <LinearGradient colors={GRADIENT} style={styles.loadingCenter}>
        <ActivityIndicator color="#fff" size="large" />
      </LinearGradient>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <LinearGradient colors={GRADIENT} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <SafeAreaView edges={['top']}>
            <View style={styles.headerTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.greeting}>Bonjour,</Text>
                <Text style={styles.userName}>{user?.first_name} {user?.last_name}</Text>
                {teacher?.employee_id && (
                  <View style={styles.empIdRow}>
                    <Ionicons name="card-outline" size={11} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.empId}>ID: {teacher.employee_id}</Text>
                  </View>
                )}
              </View>
              <View style={styles.headerRight}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
                  <Ionicons name="notifications-outline" size={20} color="#fff" />
                  {unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.avatarBtn} onPress={() => navigation.navigate('Profile')}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Stats row inside header ─────────────────────── */}
            <View style={styles.statsRow}>
              {[
                { label: 'Classes',        value: classes.length,       icon: 'people',           colors: ['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.12)'] },
                { label: 'Évaluations',   value: pendingEvals.length,  icon: 'create',           colors: ['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.12)'] },
                { label: 'Cours auj.',     value: todaySessions.length, icon: 'calendar',         colors: ['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.12)'] },
                { label: 'Séances/sem.',   value: sessions.length,      icon: 'clipboard-outline', colors: ['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.12)'] },
              ].map((k) => (
                <LinearGradient key={k.label} colors={k.colors} style={styles.statCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name={k.icon} size={18} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.statValue}>{k.value}</Text>
                  <Text style={styles.statLabel}>{k.label}</Text>
                </LinearGradient>
              ))}
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* ── Emploi du temps ────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>Emploi du temps</Text>
            </View>
          </View>

          {/* Day picker */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayPicker}
          >
            {WEEK_DAYS.map((jsDay) => {
              const isToday  = jsDay === TODAY_IDX;
              const isActive = jsDay === activeDay;
              const hasCourse = sessions.some((s) => normDay(s.day_of_week) === DAY_FULL[jsDay]?.toUpperCase());
              return (
                <TouchableOpacity
                  key={jsDay}
                  style={[styles.dayBtn, isActive && styles.dayBtnActive]}
                  onPress={() => setActiveDay(jsDay)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.dayBtnLabel, isActive && styles.dayBtnLabelActive]}>
                    {DAY_LABELS[jsDay]}
                  </Text>
                  <View style={[styles.dayBtnNum, isActive && styles.dayBtnNumActive, isToday && !isActive && styles.dayBtnNumToday]}>
                    <Text style={[styles.dayBtnNumText, isActive && { color: '#fff' }, isToday && !isActive && { color: '#2563EB' }]}>
                      {WEEK_DATES[WEEK_DAYS.indexOf(jsDay)]}
                    </Text>
                  </View>
                  {hasCourse && <View style={[styles.dayDot, isActive && { backgroundColor: 'rgba(255,255,255,0.9)' }]} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Sessions list for selected day */}
          {daySessions.length === 0 ? (
            <View style={styles.noSessionCard}>
              <Ionicons name="sunny-outline" size={26} color="#FCD34D" />
              <Text style={styles.noSessionText}>Aucun cours ce jour</Text>
            </View>
          ) : (
            <View style={styles.timeline}>
              {daySessions.map((s, idx) => {
                const [c1, c2] = SESSION_COLORS[idx % SESSION_COLORS.length];
                return (
                  <View key={s.id} style={styles.timelineRow}>
                    {/* Time column */}
                    <View style={styles.timeCol}>
                      <Text style={styles.timeStart}>{s.start_time?.slice(0, 5) || '--:--'}</Text>
                      <View style={[styles.timeLine, { backgroundColor: c1 }]} />
                      <Text style={styles.timeEnd}>{s.end_time?.slice(0, 5) || '--:--'}</Text>
                    </View>
                    {/* Session card */}
                    <TouchableOpacity
                      style={styles.timelineCard}
                      onPress={() => navigation.navigate('Présences', { session: s })}
                      activeOpacity={0.82}
                    >
                      <View style={[styles.timelineCardBar, { backgroundColor: c1 }]} />
                      <View style={styles.timelineCardBody}>
                        <View style={styles.timelineCardTop}>
                          <Text style={styles.timelineSubject} numberOfLines={1}>
                            {s.subject_name || s.subject || 'Cours'}
                          </Text>
                          <LinearGradient colors={[c1, c2]} style={styles.presencePill}>
                            <Ionicons name="checkbox-outline" size={11} color="#fff" />
                            <Text style={styles.presencePillText}>Présence</Text>
                          </LinearGradient>
                        </View>
                        <View style={styles.timelineCardMeta}>
                          {s.class_name && (
                            <View style={styles.metaChip}>
                              <Ionicons name="people-outline" size={11} color={c1} />
                              <Text style={[styles.metaChipText, { color: c1 }]}>{s.class_name}</Text>
                            </View>
                          )}
                          {(s.room_name || s.room) && (
                            <View style={styles.metaChip}>
                              <Ionicons name="location-outline" size={11} color={colors.textTertiary} />
                              <Text style={styles.metaChipText}>{s.room_name || s.room}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Mes classes ─────────────────────────────────────────── */}
        {classes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionAccent} />
                <Text style={styles.sectionTitle}>Mes classes</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Classes')}>
                <Text style={styles.seeAll}>Voir tout</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.classGrid}>
              {classes.slice(0, 4).map((cls, idx) => {
                const [c1, c2] = SESSION_COLORS[idx % SESSION_COLORS.length];
                return (
                  <TouchableOpacity
                    key={cls.id}
                    style={styles.classCard}
                    onPress={() => navigation.navigate('Classes')}
                    activeOpacity={0.8}
                  >
                    <LinearGradient colors={[c1 + '22', c2 + '11']} style={styles.classCardGrad}>
                      <LinearGradient colors={[c1, c2]} style={styles.classCardIcon}>
                        <Ionicons name="people" size={18} color="#fff" />
                      </LinearGradient>
                      <Text style={styles.classCardName} numberOfLines={1}>{cls.name}</Text>
                      <Text style={styles.classCardSub} numberOfLines={1}>{cls.level_name || cls.level || '—'}</Text>
                      <View style={styles.classCardBadge}>
                        <Ionicons name="person-outline" size={10} color={c1} />
                        <Text style={[styles.classCardBadgeText, { color: c1 }]}>{cls.max_students} max</Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Services rapides ──────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionAccent} />
            <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Services</Text>
          </View>
          <View style={styles.servicesGrid}>
            {[
              { label: 'Présences',  desc: 'Pointer la classe',  icon: 'checkbox-outline',     screen: 'Présences', color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
              { label: 'Notes',      desc: 'Saisir les notes',   icon: 'bar-chart-outline',    screen: 'Notes',     color: '#059669', bg: '#ECFDF5', border: '#86EFAC' },
              { label: 'Planning',   desc: 'Emploi du temps',    icon: 'calendar-outline',     screen: 'Planning',  color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
              { label: 'Messages',   desc: 'Communication',      icon: 'chatbubbles-outline',  screen: 'Messages',  color: '#DB2777', bg: '#FDF2F8', border: '#FBCFE8' },
              { label: 'E-Learning', desc: 'Cours, quiz, examens', icon: 'easel-outline',      screen: 'ELearningHome', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
            ].map((svc) => (
              <TouchableOpacity
                key={svc.screen}
                style={[styles.serviceCard, { backgroundColor: svc.bg, borderColor: svc.border }]}
                onPress={() => navigation.navigate(svc.screen)}
                activeOpacity={0.8}
              >
                <View style={[styles.serviceIconWrap, { backgroundColor: `${svc.color}18` }]}>
                  <Ionicons name={svc.icon} size={22} color={svc.color} />
                </View>
                <Text style={[styles.serviceLabel, { color: svc.color }]}>{svc.label}</Text>
                <Text style={styles.serviceDesc}>{svc.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Évaluations non verrouillées ────────────────────────── */}
        {pendingEvals.length > 0 && (
          <View style={[styles.section, { marginBottom: 32 }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionAccent, { backgroundColor: '#7C3AED' }]} />
                <Text style={styles.sectionTitle}>Évaluations</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Notes')}>
                <Text style={styles.seeAll}>Voir tout</Text>
              </TouchableOpacity>
            </View>
            {pendingEvals.slice(0, 3).map((ev) => (
              <TouchableOpacity key={ev.id} style={styles.evalCard} onPress={() => navigation.navigate('Notes')} activeOpacity={0.8}>
                <LinearGradient colors={['#EDE9FE', '#DDD6FE']} style={styles.evalIcon}>
                  <Ionicons name="document-text-outline" size={18} color="#7C3AED" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.evalTitle}>{ev.title}</Text>
                  <Text style={styles.evalSub}>{ev.subject_name || ''}{ev.eval_type ? ` · ${ev.eval_type}` : ''}</Text>
                </View>
                <View style={styles.evalBadge}>
                  <Text style={styles.evalBadgeText}>/{ev.max_score}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: spacing.sm, gap: 10 },
  greeting: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 2 },
  userName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  empIdRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  empId: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 5, right: 5, backgroundColor: '#EF4444', borderRadius: 5, minWidth: 11, height: 11, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 7, fontWeight: '800' },
  avatarBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  statCard: { flex: 1, alignItems: 'center', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 4, gap: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 9, color: 'rgba(255,255,255,0.72)', fontWeight: '700', textAlign: 'center' },

  // Sections
  section: { paddingHorizontal: spacing.md, marginTop: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionAccent: { width: 4, height: 18, borderRadius: 2, backgroundColor: '#2563EB' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  seeAll: { fontSize: 13, color: colors.primary, fontWeight: '700' },

  // Day picker
  dayPicker: { gap: 8, paddingBottom: 4, paddingHorizontal: 2 },
  dayBtn: { alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 6, borderRadius: 14, backgroundColor: '#fff', minWidth: 46, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  dayBtnActive: { backgroundColor: '#2563EB' },
  dayBtnLabel: { fontSize: 10, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
  dayBtnLabelActive: { color: 'rgba(255,255,255,0.85)' },
  dayBtnNum: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  dayBtnNumActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  dayBtnNumToday: { backgroundColor: '#DBEAFE' },
  dayBtnNumText: { fontSize: 13, fontWeight: '800', color: colors.text },
  dayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#2563EB' },

  // No session
  noSessionCard: { alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 28, marginTop: 8 },
  noSessionText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },

  // Timeline
  timeline: { gap: 10, marginTop: 8 },
  timelineRow: { flexDirection: 'row', gap: 10 },
  timeCol: { width: 46, alignItems: 'center', paddingTop: 4 },
  timeStart: { fontSize: 11, fontWeight: '800', color: colors.text },
  timeLine: { flex: 1, width: 2, borderRadius: 1, marginVertical: 3, minHeight: 20 },
  timeEnd: { fontSize: 10, color: colors.textTertiary, fontWeight: '600' },
  timelineCard: { flex: 1, flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2 },
  timelineCardBar: { width: 4 },
  timelineCardBody: { flex: 1, padding: 12, gap: 8 },
  timelineCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  timelineSubject: { flex: 1, fontSize: 13, fontWeight: '800', color: colors.text },
  presencePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  presencePillText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  timelineCardMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F8FAFC', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  metaChipText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },

  // Classes grid
  classGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  classCard: { width: '47%', borderRadius: 16, overflow: 'hidden' },
  classCardGrad: { padding: 14, gap: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  classCardIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  classCardName: { fontSize: 13, fontWeight: '800', color: colors.text },
  classCardSub: { fontSize: 11, color: colors.textSecondary },
  classCardBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  classCardBadgeText: { fontSize: 10, fontWeight: '700' },

  // Service cards
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  serviceCard: { width: '47.5%', borderRadius: 18, padding: 16, borderWidth: 1.5, gap: 5 },
  serviceIconWrap: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  serviceLabel: { fontSize: 13, fontWeight: '800', lineHeight: 18 },
  serviceDesc: { fontSize: 11, color: colors.textTertiary },

  // Evaluations
  evalCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: spacing.md, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  evalIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  evalTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  evalSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  evalBadge: { backgroundColor: '#EDE9FE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  evalBadgeText: { fontSize: 12, fontWeight: '800', color: '#7C3AED' },
});
