import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, StatusBar, SectionList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import parentService from '../../services/parent';
import attendanceService from '../../services/attendance';
import { colors, spacing, radius } from '../../theme/colors';

const PARENT_GRADIENT = ['#064E3B', '#065F46', '#059669'];

const STATUS_MAP = {
  PRESENT: { label: 'Présent',  color: '#059669', bg: '#D1FAE5', icon: 'checkmark-circle' },
  ABSENT:  { label: 'Absent',   color: '#EF4444', bg: '#FEE2E2', icon: 'close-circle'     },
  LATE:    { label: 'Retard',   color: '#D97706', bg: '#FEF3C7', icon: 'time'              },
  EXCUSED: { label: 'Excusé',   color: '#0EA5E9', bg: '#E0F2FE', icon: 'shield-checkmark' },
};

const MONTHS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];

function getRecordDate(rec) {
  const raw = rec.session_date || rec.date || rec.attendance_session_date;
  return raw ? new Date(raw) : null;
}

function formatDayHeader(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatTime(rec) {
  if (rec.check_in_time) {
    return new Date(rec.check_in_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  if (rec.session_start_time || rec.start_time) {
    return rec.session_start_time || rec.start_time;
  }
  return null;
}

// ── View mode toggle ──────────────────────────────────────────────────────────
function ViewToggle({ mode, onChange }) {
  const options = [
    { key: 'day',   label: 'Jour'   },
    { key: 'month', label: 'Mois'   },
    { key: 'year',  label: 'Année'  },
  ];
  return (
    <View style={styles.toggleRow}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.key}
          style={[styles.toggleBtn, mode === o.key && styles.toggleBtnActive]}
          onPress={() => onChange(o.key)}
        >
          <Text style={[styles.toggleText, mode === o.key && styles.toggleTextActive]}>
            {o.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, bg, icon }) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
    </View>
  );
}

// ── Record row ────────────────────────────────────────────────────────────────
function RecordRow({ rec }) {
  const cfg     = STATUS_MAP[rec.status] || STATUS_MAP.PRESENT;
  const subject = rec.subject_name || rec.session_subject || '—';
  const time    = formatTime(rec);

  return (
    <View style={styles.recordCard}>
      <View style={[styles.statusIcon, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon} size={20} color={cfg.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.recordSubject}>{subject}</Text>
        {time && <Text style={styles.recordTime}>{time}</Text>}
        {rec.notes ? <Text style={styles.recordNotes} numberOfLines={1}>{rec.notes}</Text> : null}
      </View>
      <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
        <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
    </View>
  );
}

// ── Month summary row (month view) ────────────────────────────────────────────
function MonthRow({ label, stats, onPress }) {
  return (
    <TouchableOpacity style={styles.monthCard} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.monthLabel}>{label}</Text>
      <View style={styles.monthStats}>
        {[
          ['P', stats.present, '#059669'],
          ['A', stats.absent,  '#EF4444'],
          ['R', stats.late,    '#D97706'],
          ['E', stats.excused, '#0EA5E9'],
        ].map(([letter, count, color]) => (
          <View key={letter} style={styles.monthStat}>
            <Text style={[styles.monthStatNum, { color }]}>{count}</Text>
            <Text style={[styles.monthStatLetter, { color }]}>{letter}</Text>
          </View>
        ))}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

export default function ParentAttendanceScreen() {
  const [children,   setChildren]   = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [records,    setRecords]     = useState([]);
  const [loading,    setLoading]     = useState(true);
  const [refreshing, setRefreshing]  = useState(false);

  // Filters
  const [viewMode,   setViewMode]   = useState('day');    // 'day' | 'month' | 'year'
  const [statusFilter, setStatusFilter] = useState('all');
  const [drillMonth, setDrillMonth] = useState(null);     // 'YYYY-MM' for drill-down in month view

  // Current year for year view
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const fetchChildren = useCallback(async () => {
    try {
      const res = await parentService.getMyStudents();
      const list = res?.results || res || [];
      setChildren(list);
      if (list.length > 0) loadAttendance(list[0]);
    } catch (e) {
      console.log('parent attendance', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadAttendance = async (child) => {
    setSelected(child);
    setDrillMonth(null);
    try {
      const rec = await attendanceService.getRecords({ student: child.id, page_size: 500 });
      setRecords(rec?.results || rec || []);
    } catch (e) {
      console.log('load attendance error', e.message);
    }
  };

  useEffect(() => { fetchChildren(); }, [fetchChildren]);
  const onRefresh = () => { setRefreshing(true); fetchChildren(); };

  // ── Aggregations ─────────────────────────────────────────────────────────
  const presentCount = records.filter((r) => r.status === 'PRESENT').length;
  const absentCount  = records.filter((r) => r.status === 'ABSENT').length;
  const lateCount    = records.filter((r) => r.status === 'LATE').length;
  const excusedCount = records.filter((r) => r.status === 'EXCUSED').length;

  // Filtered by status
  const statusFiltered = useMemo(
    () => (statusFilter === 'all' ? records : records.filter((r) => r.status === statusFilter)),
    [records, statusFilter]
  );

  // ── DAY view: group by date ───────────────────────────────────────────────
  const daySections = useMemo(() => {
    const map = {};
    statusFiltered.forEach((rec) => {
      const d = getRecordDate(rec);
      if (!d) return;
      const key = d.toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(rec);
    });
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateStr, data]) => ({ title: formatDayHeader(dateStr), data }));
  }, [statusFiltered]);

  // ── MONTH view: group by month ─────────────────────────────────────────────
  const monthSummaries = useMemo(() => {
    const map = {};
    records.forEach((rec) => {
      const d = getRecordDate(rec);
      if (!d || d.getFullYear() !== selectedYear) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map[key]) map[key] = { present: 0, absent: 0, late: 0, excused: 0, records: [] };
      map[key].records.push(rec);
      if (rec.status === 'PRESENT') map[key].present++;
      else if (rec.status === 'ABSENT') map[key].absent++;
      else if (rec.status === 'LATE') map[key].late++;
      else if (rec.status === 'EXCUSED') map[key].excused++;
    });
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, val]) => ({ key, ...val }));
  }, [records, selectedYear]);

  // Drilled month (day sections within a month)
  const drillSections = useMemo(() => {
    if (!drillMonth) return [];
    const monthRecords = records.filter((rec) => {
      const d = getRecordDate(rec);
      if (!d) return false;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === drillMonth;
    });
    const map = {};
    monthRecords.forEach((rec) => {
      const d = getRecordDate(rec);
      const dateKey = d.toISOString().slice(0, 10);
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(rec);
    });
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateStr, data]) => ({ title: formatDayHeader(dateStr), data }));
  }, [records, drillMonth]);

  // ── YEAR view: one row per month ───────────────────────────────────────────
  const yearSummary = useMemo(() => {
    const result = MONTHS_FR.map((name, idx) => {
      const mo = String(idx + 1).padStart(2, '0');
      const key = `${selectedYear}-${mo}`;
      const found = monthSummaries.find((m) => m.key === key);
      return { month: idx, name, key, ...(found || { present: 0, absent: 0, late: 0, excused: 0, records: [] }) };
    });
    return result.filter((m) => m.records.length > 0 || m.month <= now.getMonth());
  }, [monthSummaries, selectedYear, now]);

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderDaySections(sections) {
    if (sections.length === 0) {
      return (
        <View style={styles.emptyList}>
          <Ionicons name="calendar-outline" size={40} color={colors.textTertiary} />
          <Text style={styles.emptyText}>Aucun enregistrement</Text>
        </View>
      );
    }
    return (
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => <RecordRow rec={item} />}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 32 }}
        scrollEnabled={false}
      />
    );
  }

  function renderMonthView() {
    if (drillMonth) {
      const [yr, mo] = drillMonth.split('-');
      return (
        <View>
          <TouchableOpacity style={styles.backBtn} onPress={() => setDrillMonth(null)}>
            <Ionicons name="arrow-back" size={18} color={colors.primary} />
            <Text style={styles.backBtnText}>
              {MONTHS_FR[parseInt(mo, 10) - 1]} {yr}
            </Text>
          </TouchableOpacity>
          {renderDaySections(drillSections)}
        </View>
      );
    }

    if (monthSummaries.length === 0) {
      return (
        <View style={styles.emptyList}>
          <Ionicons name="calendar-outline" size={40} color={colors.textTertiary} />
          <Text style={styles.emptyText}>Aucun enregistrement pour {selectedYear}</Text>
        </View>
      );
    }

    return (
      <View style={{ paddingHorizontal: spacing.md, paddingBottom: 32 }}>
        {monthSummaries.map((m) => {
          const [yr, mo] = m.key.split('-');
          const label = `${MONTHS_FR[parseInt(mo, 10) - 1]} ${yr}`;
          return (
            <MonthRow
              key={m.key}
              label={label}
              stats={m}
              onPress={() => setDrillMonth(m.key)}
            />
          );
        })}
      </View>
    );
  }

  function renderYearView() {
    if (yearSummary.length === 0) {
      return (
        <View style={styles.emptyList}>
          <Ionicons name="bar-chart-outline" size={40} color={colors.textTertiary} />
          <Text style={styles.emptyText}>Aucun enregistrement pour {selectedYear}</Text>
        </View>
      );
    }

    const totalPresent  = yearSummary.reduce((s, m) => s + m.present, 0);
    const totalAbsent   = yearSummary.reduce((s, m) => s + m.absent, 0);
    const totalLate     = yearSummary.reduce((s, m) => s + m.late, 0);
    const totalExcused  = yearSummary.reduce((s, m) => s + m.excused, 0);
    const total         = totalPresent + totalAbsent + totalLate + totalExcused;
    const attendanceRate = total > 0 ? Math.round(((totalPresent + totalLate) / total) * 100) : 0;

    return (
      <View style={{ paddingHorizontal: spacing.md, paddingBottom: 32 }}>
        {/* Year summary card */}
        <View style={styles.yearSummaryCard}>
          <Text style={styles.yearSummaryTitle}>Bilan {selectedYear}</Text>
          <View style={styles.yearRate}>
            <Text style={[styles.yearRateNum, { color: attendanceRate >= 80 ? '#059669' : '#EF4444' }]}>
              {attendanceRate}%
            </Text>
            <Text style={styles.yearRateLabel}>taux de présence</Text>
          </View>
          <View style={styles.yearStatRow}>
            {[
              ['Présences', totalPresent + totalLate, '#059669'],
              ['Absences',  totalAbsent,  '#EF4444'],
              ['Excusés',   totalExcused, '#0EA5E9'],
            ].map(([label, val, color]) => (
              <View key={label} style={styles.yearStatItem}>
                <Text style={[styles.yearStatVal, { color }]}>{val}</Text>
                <Text style={styles.yearStatLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Monthly breakdown */}
        {yearSummary.map((m) => (
          <TouchableOpacity
            key={m.key}
            style={styles.yearMonthRow}
            onPress={() => { setViewMode('month'); setDrillMonth(m.key); }}
            activeOpacity={0.7}
          >
            <Text style={styles.yearMonthName}>{m.name}</Text>
            <View style={styles.yearBarWrap}>
              <View style={[styles.yearBar, { width: `${Math.min(100, (m.present + m.late) / Math.max(1, m.present + m.absent + m.late + m.excused) * 100)}%` }]} />
            </View>
            <Text style={styles.yearMonthCount}>{m.present + m.late + m.absent + m.excused}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={PARENT_GRADIENT} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <Text style={styles.headerTitle}>Absences & Présences</Text>
          {selected && (
            <Text style={styles.headerSub}>
              {selected.user
                ? `${selected.user.first_name} ${selected.user.last_name}`
                : selected.full_name}
            </Text>
          )}
          {children.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childTabs}>
              {children.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.tab, selected?.id === c.id && styles.tabActive]}
                  onPress={() => loadAttendance(c)}
                >
                  <Text style={[styles.tabText, selected?.id === c.id && styles.tabTextActive]}>
                    {c.user?.first_name || 'Enfant'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#059669" size="large" /></View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />}
          contentContainerStyle={{ paddingBottom: 32 }}
          stickyHeaderIndices={[0]}
        >
          {/* Sticky controls section */}
          <View style={styles.controls}>
            {/* Stats grid */}
            <View style={styles.statsGrid}>
              <StatCard label="Présences" value={presentCount} color="#059669" bg="#D1FAE5" icon="checkmark-circle" />
              <StatCard label="Absences"  value={absentCount}  color="#EF4444" bg="#FEE2E2" icon="close-circle"     />
              <StatCard label="Retards"   value={lateCount}    color="#D97706" bg="#FEF3C7" icon="time"              />
              <StatCard label="Excusés"   value={excusedCount} color="#0EA5E9" bg="#E0F2FE" icon="shield-checkmark" />
            </View>

            {/* Alert banner */}
            {absentCount >= 3 && (
              <View style={styles.alertBanner}>
                <Ionicons name="warning" size={20} color="#D97706" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitle}>
                    Attention — {absentCount} absence{absentCount > 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.alertText}>Un nombre élevé peut affecter la scolarité.</Text>
                </View>
              </View>
            )}

            {/* View mode toggle */}
            <ViewToggle mode={viewMode} onChange={(m) => { setViewMode(m); setDrillMonth(null); }} />

            {/* Year picker (shown in month + year views) */}
            {viewMode !== 'day' && (
              <View style={styles.yearPicker}>
                <TouchableOpacity
                  onPress={() => setSelectedYear((y) => y - 1)}
                  style={styles.yearArrow}
                >
                  <Ionicons name="chevron-back" size={18} color={colors.primary} />
                </TouchableOpacity>
                <Text style={styles.yearLabel}>{selectedYear}</Text>
                <TouchableOpacity
                  onPress={() => setSelectedYear((y) => y + 1)}
                  style={styles.yearArrow}
                  disabled={selectedYear >= now.getFullYear()}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={selectedYear >= now.getFullYear() ? colors.textTertiary : colors.primary}
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Status filter chips (day view only) */}
            {viewMode === 'day' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8, paddingVertical: 4 }}>
                {[['all','Tous'],['PRESENT','Présences'],['ABSENT','Absences'],['LATE','Retards'],['EXCUSED','Excusés']].map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.chip, statusFilter === key && styles.chipActive]}
                    onPress={() => setStatusFilter(key)}
                  >
                    <Text style={[styles.chipText, statusFilter === key && styles.chipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Content */}
          {viewMode === 'day'   && renderDaySections(daySections)}
          {viewMode === 'month' && renderMonthView()}
          {viewMode === 'year'  && renderYearView()}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header:         { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  headerTitle:    { fontSize: 22, fontWeight: '700', color: '#fff', paddingTop: spacing.sm },
  headerSub:      { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  childTabs:      { marginTop: spacing.sm },
  tab:            { paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.15)' },
  tabActive:      { backgroundColor: '#fff' },
  tabText:        { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  tabTextActive:  { color: '#059669' },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },

  controls:       { backgroundColor: colors.background },
  statsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md },
  statCard:       { width: '47%', borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', gap: 4 },
  statValue:      { fontSize: 26, fontWeight: '700' },
  statLabel:      { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  alertBanner:    { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginHorizontal: spacing.md, backgroundColor: '#FEF3C7', borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: '#FDE68A', marginBottom: spacing.sm },
  alertTitle:     { fontSize: 13, fontWeight: '700', color: '#92400E' },
  alertText:      { fontSize: 12, color: '#B45309', marginTop: 2 },

  // View toggle
  toggleRow:      { flexDirection: 'row', marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: '#E8EDF5', borderRadius: radius.full, padding: 3 },
  toggleBtn:      { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: radius.full },
  toggleBtnActive:{ backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  toggleText:     { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  toggleTextActive:{ color: colors.primary },

  // Year picker
  yearPicker:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 8, marginBottom: spacing.sm },
  yearArrow:      { padding: 6 },
  yearLabel:      { fontSize: 16, fontWeight: '700', color: colors.text, minWidth: 50, textAlign: 'center' },

  // Status filter chips
  filterRow:      { backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  chip:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.background },
  chipActive:     { backgroundColor: '#059669' },
  chipText:       { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: '#fff' },

  // Section list (day view)
  sectionHeader:  { backgroundColor: colors.background, paddingHorizontal: 0, paddingVertical: 8 },
  sectionTitle:   { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'capitalize' },

  // Record card
  recordCard:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.md, marginBottom: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statusIcon:     { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recordSubject:  { fontSize: 14, fontWeight: '600', color: colors.text },
  recordTime:     { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  recordNotes:    { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  statusBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  statusText:     { fontSize: 11, fontWeight: '700' },

  // Month card
  monthCard:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.md, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  monthLabel:     { fontSize: 14, fontWeight: '600', color: colors.text, width: 100 },
  monthStats:     { flex: 1, flexDirection: 'row', gap: 12, justifyContent: 'center' },
  monthStat:      { alignItems: 'center' },
  monthStatNum:   { fontSize: 16, fontWeight: '700' },
  monthStatLetter:{ fontSize: 10, fontWeight: '600' },

  // Back button (month drill-down)
  backBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtnText:    { fontSize: 14, fontWeight: '600', color: colors.primary },

  // Year view
  yearSummaryCard: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  yearSummaryTitle:{ fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  yearRate:        { alignItems: 'center', marginBottom: 16 },
  yearRateNum:     { fontSize: 48, fontWeight: '800' },
  yearRateLabel:   { fontSize: 12, color: colors.textSecondary, marginTop: -4 },
  yearStatRow:     { flexDirection: 'row', gap: 24 },
  yearStatItem:    { alignItems: 'center' },
  yearStatVal:     { fontSize: 20, fontWeight: '700' },
  yearStatLabel:   { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  yearMonthRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.md, marginBottom: 6 },
  yearMonthName:   { width: 72, fontSize: 13, fontWeight: '600', color: colors.text },
  yearBarWrap:     { flex: 1, height: 8, backgroundColor: '#EDE9FE', borderRadius: 4, overflow: 'hidden', marginHorizontal: 10 },
  yearBar:         { height: 8, backgroundColor: '#059669', borderRadius: 4 },
  yearMonthCount:  { width: 28, fontSize: 12, fontWeight: '600', color: colors.textSecondary, textAlign: 'right', marginRight: 4 },

  // Empty state
  emptyList:      { alignItems: 'center', paddingTop: 40, gap: 10, paddingHorizontal: spacing.md },
  emptyText:      { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
});
