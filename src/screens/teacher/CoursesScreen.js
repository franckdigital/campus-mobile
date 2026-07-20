import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, SectionList, FlatList,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import gradesService from '../../services/grades';
import teacherService from '../../services/teacher';
import apiClient from '../../services/apiClient';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, radius } from '../../theme/colors';

const ACCENT   = '#8B5CF6';
const GRADIENT = ['#4C1D95', '#6D28D9', '#8B5CF6'];

const TABS = [
  { key: 'lessons',     label: 'Cours',       icon: 'book-outline' },
  { key: 'evaluations', label: 'Évaluations', icon: 'clipboard-outline' },
];

const EVAL_CFG = {
  DEVOIR:     { label: 'Devoirs',           icon: 'document-text-outline',  color: '#3B82F6', bg: '#EFF6FF' },
  TP:         { label: 'Travaux Pratiques', icon: 'flask-outline',          color: '#10B981', bg: '#ECFDF5' },
  EXAMEN:     { label: 'Examens',           icon: 'school-outline',         color: '#F59E0B', bg: '#FFFBEB' },
  RATTRAPAGE: { label: 'Rattrapages',       icon: 'refresh-circle-outline', color: '#EF4444', bg: '#FEF2F2' },
};
const TYPE_ORDER = ['DEVOIR', 'TP', 'EXAMEN', 'RATTRAPAGE'];

function groupBy(arr, getKey) {
  const map = {};
  arr.forEach((item) => {
    const k = getKey(item);
    if (!map[k]) map[k] = [];
    map[k].push(item);
  });
  return map;
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function TeacherCoursesScreen({ navigation }) {
  // ── Classes (flat list from teacher sessions) ─────────────────────────────
  const [classes, setClasses]               = useState([]);
  // Grouped by site for display in picker: [{ site_name, data: [class] }]
  const [classGroups, setClassGroups]       = useState([]);
  const [selectedClass, setSelectedClass]   = useState(null);
  const [showClassPicker, setShowClassPicker] = useState(false);

  // ── Content ───────────────────────────────────────────────────────────────
  const [tab, setTab]                 = useState('lessons');
  const [lessons, setLessons]         = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [loadingContent, setLoadingContent] = useState(false);

  // ── Global loading ────────────────────────────────────────────────────────
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* ── Build class list from teacher sessions ──────────────────────────────── */
  const fetchClasses = useCallback(async () => {
    try {
      const me = await teacherService.getMe().catch(() => null);
      const teacherId = me?.id;

      const [sessRes, sitesRes] = await Promise.allSettled([
        teacherService.getSessions(teacherId ? { teacher_id: teacherId } : {}),
        apiClient.get('/sites/').then((r) => r.data),
      ]);

      const sessions = sessRes.status === 'fulfilled'
        ? (sessRes.value?.results || sessRes.value || []) : [];
      const rawSites = sitesRes.status === 'fulfilled'
        ? (sitesRes.value?.results || sitesRes.value || []) : [];

      // Build site name map
      const siteNameMap = {};
      rawSites.forEach((s) => { siteNameMap[s.id] = s.name; });

      // Unique classes from sessions, keyed by class UUID
      const classMap = {};
      sessions.forEach((s) => {
        const cid = s.class_obj;
        if (cid && !classMap[cid]) {
          classMap[cid] = {
            id: cid,
            name: s.class_name || String(cid),
            site_id: s.site_id || null,
            site_name: s.site_id ? (siteNameMap[s.site_id] || s.site_id) : null,
          };
        }
      });
      const allClasses = Object.values(classMap);
      setClasses(allClasses);

      // Group by site for the picker sections
      const bySite = groupBy(allClasses, (c) => c.site_name || 'Sans site');
      const groups = Object.entries(bySite).map(([site_name, data]) => ({ site_name, data }));
      setClassGroups(groups);

      // Auto-select first class and load its content
      if (allClasses.length > 0) {
        const first = allClasses[0];
        setSelectedClass(first);
        await loadContent(first.id);
      }
    } catch (e) { console.log('courses init error', e.message); }
    finally { setLoading(false); setRefreshing(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const onRefresh = () => { setRefreshing(true); fetchClasses(); };

  /* ── Load sessions + evaluations for a class ─────────────────────────────── */
  const loadContent = async (classId) => {
    setLoadingContent(true);
    setLessons([]);
    setEvaluations([]);
    try {
      const [sessRes, evalRes] = await Promise.allSettled([
        teacherService.getClassSchedule(classId),
        gradesService.getEvaluations({ class_group: classId }),
      ]);
      setLessons(sessRes.status === 'fulfilled'
        ? (sessRes.value?.results || sessRes.value || []) : []);
      setEvaluations(evalRes.status === 'fulfilled'
        ? (evalRes.value?.results || evalRes.value || []) : []);
    } catch (e) { console.log('class content error', e.message); }
    finally { setLoadingContent(false); }
  };

  /* ── Class selection ─────────────────────────────────────────────────────── */
  const selectClass = (cls) => {
    setShowClassPicker(false);
    if (selectedClass?.id === cls.id) return;
    setSelectedClass(cls);
    loadContent(cls.id);
  };

  /* ── Evaluation SectionList sections ─────────────────────────────────────── */
  const evalSections = (() => {
    const grouped = groupBy(evaluations, (e) => e.eval_type || 'DEVOIR');
    return TYPE_ORDER
      .filter((k) => (grouped[k] || []).length > 0)
      .map((k) => ({ typeKey: k, ...EVAL_CFG[k], data: grouped[k] }));
  })();

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <View style={st.container}>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <LinearGradient colors={GRADIENT} style={st.header}>
        <SafeAreaView edges={['top']}>

          {/* Title row */}
          <View style={st.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={st.iconBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={st.headerTitle}>Cours & Évaluations</Text>
            <View style={{ width: 38 }} />
          </View>

          {/* Class picker — same pattern as attendance */}
          <Text style={st.pickerLabel}>Classe</Text>
          <TouchableOpacity
            style={st.selector}
            onPress={() => setShowClassPicker((p) => !p)}
            activeOpacity={0.85}
          >
            <Ionicons name="people-outline" size={14} color="rgba(255,255,255,0.85)" />
            <Text style={st.selectorText} numberOfLines={1}>
              {selectedClass?.name || 'Choisir une classe'}
            </Text>
            <Ionicons
              name={showClassPicker ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="rgba(255,255,255,0.85)"
            />
          </TouchableOpacity>

          {/* Dropdown — classes grouped by site (like sections) */}
          {showClassPicker && (
            <View style={st.pickerList}>
              {classGroups.length === 0 ? (
                <View style={st.pickerEmpty}>
                  <Text style={st.pickerEmptyText}>Aucune classe disponible</Text>
                </View>
              ) : (
                classGroups.map((group) => (
                  <View key={group.site_name}>
                    {/* Site header inside the dropdown */}
                    <View style={st.pickerSiteHeader}>
                      <Ionicons name="business-outline" size={10} color="rgba(255,255,255,0.5)" />
                      <Text style={st.pickerSiteText}>{group.site_name}</Text>
                    </View>
                    {group.data.map((cls, idx) => {
                      const isActive = cls.id === selectedClass?.id;
                      const isLast   = idx === group.data.length - 1;
                      return (
                        <TouchableOpacity
                          key={cls.id}
                          style={[
                            st.pickerItem,
                            isActive && st.pickerItemActive,
                            isLast && { borderBottomWidth: 0 },
                          ]}
                          onPress={() => selectClass(cls)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[st.pickerItemText, isActive && st.pickerItemTextActive]}
                            numberOfLines={1}
                          >
                            {cls.name}
                          </Text>
                          {isActive && (
                            <Ionicons name="checkmark-circle" size={16} color={ACCENT} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))
              )}
            </View>
          )}

          {/* Tabs — shown only when a class is selected */}
          {selectedClass && (
            <View style={st.tabs}>
              {TABS.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[st.tab, tab === t.key && st.tabActive]}
                  onPress={() => setTab(t.key)}
                >
                  <Ionicons
                    name={t.icon}
                    size={14}
                    color={tab === t.key ? ACCENT : 'rgba(255,255,255,0.7)'}
                  />
                  <Text style={[st.tabText, tab === t.key && st.tabTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={st.center}><ActivityIndicator color={ACCENT} size="large" /></View>
      ) : !selectedClass ? (
        <EmptyState
          icon="people-outline"
          title="Choisissez une classe"
          subtitle="Sélectionnez une classe pour voir les cours et évaluations"
        />
      ) : loadingContent ? (
        <View style={st.center}><ActivityIndicator color={ACCENT} size="large" /></View>
      ) : tab === 'lessons' ? (

        /* ── COURS TAB ─ sessions planifiées ────────────────────────────── */
        lessons.length === 0 ? (
          <EmptyState
            icon="book-outline"
            title="Aucun cours planifié"
            subtitle={`Aucune séance programmée pour ${selectedClass.name}`}
          />
        ) : (
          <FlatList
            data={lessons}
            keyExtractor={(i) => String(i.id)}
            contentContainerStyle={st.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
            renderItem={({ item }) => (
              <View style={[st.card, { borderLeftColor: ACCENT }]}>
                <LinearGradient colors={['#EDE9FE', '#DDD6FE']} style={st.cardIcon}>
                  <Ionicons name="book-outline" size={18} color={ACCENT} />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={st.cardTitle}>{item.subject_name || item.subject || 'Cours'}</Text>
                  <View style={st.metaRow}>
                    {item.day_name ? (
                      <View style={st.metaChip}>
                        <Ionicons name="calendar-outline" size={10} color={colors.textTertiary} />
                        <Text style={st.metaText}>{item.day_name}</Text>
                      </View>
                    ) : null}
                    {item.start_time ? (
                      <View style={st.metaChip}>
                        <Ionicons name="time-outline" size={10} color={colors.textTertiary} />
                        <Text style={st.metaText}>
                          {item.start_time.slice(0, 5)}{item.end_time ? ` – ${item.end_time.slice(0, 5)}` : ''}
                        </Text>
                      </View>
                    ) : null}
                    {item.room_name ? (
                      <View style={st.metaChip}>
                        <Ionicons name="location-outline" size={10} color={colors.textTertiary} />
                        <Text style={st.metaText}>{item.room_name}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={[st.typeTag, { backgroundColor: '#EDE9FE', borderColor: '#DDD6FE' }]}>
                  <Text style={[st.typeTagText, { color: ACCENT }]}>Séance</Text>
                </View>
              </View>
            )}
          />
        )
      ) : (

        /* ── ÉVALUATIONS TAB ─ groupées par type ────────────────────────── */
        evalSections.length === 0 ? (
          <EmptyState
            icon="clipboard-outline"
            title="Aucune évaluation"
            subtitle={`Aucune évaluation pour ${selectedClass.name}`}
          />
        ) : (
          <SectionList
            sections={evalSections}
            keyExtractor={(i) => String(i.id)}
            contentContainerStyle={st.list}
            stickySectionHeadersEnabled={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
            renderSectionHeader={({ section }) => (
              <View style={[st.evalHeader, { backgroundColor: section.bg, borderLeftColor: section.color }]}>
                <Ionicons name={section.icon} size={14} color={section.color} />
                <Text style={[st.evalHeaderTitle, { color: section.color }]}>{section.label}</Text>
                <View style={[st.evalCountBadge, { backgroundColor: section.color }]}>
                  <Text style={st.evalCountText}>{section.data.length}</Text>
                </View>
              </View>
            )}
            renderItem={({ item, section }) => (
              <View style={[st.card, { borderLeftColor: section.color }]}>
                <View style={[st.cardIcon, { backgroundColor: section.bg }]}>
                  <Ionicons name={section.icon} size={18} color={section.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.cardTitle}>{item.title}</Text>
                  {item.subject_name ? (
                    <Text style={st.cardSub} numberOfLines={1}>{item.subject_name}</Text>
                  ) : null}
                  <View style={st.metaRow}>
                    {item.date ? (
                      <View style={st.metaChip}>
                        <Ionicons name="calendar-outline" size={10} color={colors.textTertiary} />
                        <Text style={st.metaText}>{item.date}</Text>
                      </View>
                    ) : null}
                    <View style={st.metaChip}>
                      <Ionicons name="trophy-outline" size={10} color={colors.textTertiary} />
                      <Text style={st.metaText}>/{item.max_score || 20} · coeff {item.coefficient || 1}</Text>
                    </View>
                    {item.is_locked ? (
                      <View style={[st.metaChip, { backgroundColor: '#FFFBEB' }]}>
                        <Ionicons name="lock-closed-outline" size={10} color="#D97706" />
                        <Text style={[st.metaText, { color: '#D97706' }]}>Verrouillé</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={[st.scoreBox, { backgroundColor: section.bg, borderColor: section.color + '33' }]}>
                  <Text style={[st.scoreNum, { color: section.color }]}>{item.grades_count || 0}</Text>
                  <Text style={[st.scoreLabel, { color: section.color }]}>notes</Text>
                </View>
              </View>
            )}
          />
        )
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.background },
  header:      { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, paddingBottom: 12 },
  iconBtn:     { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },

  pickerLabel: { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },

  // Class selector button
  selector:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 6 },
  selectorText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#fff' },

  // Dropdown list
  pickerList:   { backgroundColor: 'rgba(0,0,0,0.30)', borderRadius: 12, marginBottom: 6, overflow: 'hidden' },

  // Site section header inside dropdown
  pickerSiteHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: 'rgba(0,0,0,0.2)' },
  pickerSiteText:   { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.7 },

  // Class items in dropdown
  pickerItem:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  pickerItemActive:     { backgroundColor: 'rgba(255,255,255,0.92)' },
  pickerItemText:       { flex: 1, fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  pickerItemTextActive: { color: ACCENT },
  pickerEmpty:          { padding: 14, alignItems: 'center' },
  pickerEmptyText:      { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' },

  // Tabs
  tabs:         { flexDirection: 'row', gap: spacing.sm, paddingTop: 4, paddingBottom: spacing.sm },
  tab:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.15)' },
  tabActive:    { backgroundColor: '#fff' },
  tabText:      { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.75)' },
  tabTextActive: { color: ACCENT },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:   { padding: spacing.md, paddingBottom: 32, gap: 6 },

  // Eval section header
  evalHeader:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderLeftWidth: 3, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, marginBottom: 4 },
  evalHeaderTitle: { flex: 1, fontSize: 14, fontWeight: '800' },
  evalCountBadge:  { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  evalCountText:   { fontSize: 11, fontWeight: '800', color: '#fff' },

  // Shared card
  card:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.sm, borderLeftWidth: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1, marginBottom: 2 },
  cardIcon:  { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  cardSub:   { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  typeTag:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  typeTagText: { fontSize: 10, fontWeight: '700' },

  metaRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  metaChip:  { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F8FAFC', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  metaText:  { fontSize: 10, color: colors.textTertiary },

  scoreBox:   { alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, minWidth: 44 },
  scoreNum:   { fontSize: 16, fontWeight: '800' },
  scoreLabel: { fontSize: 9, fontWeight: '600', marginTop: -2 },
});
