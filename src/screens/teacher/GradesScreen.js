import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import gradesService from '../../services/grades';
import teacherService from '../../services/teacher';
import apiClient from '../../services/apiClient';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, radius } from '../../theme/colors';

const GRADIENT = ['#4C1D95', '#6D28D9', '#8B5CF6'];
const ACCENT   = '#8B5CF6';

const SEMESTERS = [
  { label: 'Semestre 1', value: 'S1' },
  { label: 'Semestre 2', value: 'S2' },
];

const EVAL_TYPE_COLORS = {
  DEVOIR:        '#3B82F6',
  TP:            '#10B981',
  EXAMEN:        '#F59E0B',
  RATTRAPAGE:    '#EF4444',
  INTERROGATION: '#8B5CF6',
};

function gradeColor(score, maxScore) {
  if (score == null) return colors.textTertiary;
  const r = score / (maxScore || 20);
  if (r >= 0.75) return '#059669';
  if (r >= 0.5)  return '#D97706';
  return '#DC2626';
}

// ─────────────────────────────────────────────────────────────────────────────

export default function TeacherGradesScreen({ navigation }) {
  const [classGroups, setClassGroups]         = useState([]);
  const [selectedClass, setSelectedClass]     = useState(null);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [classesLoading, setClassesLoading]   = useState(true);

  const [selectedSemester, setSelectedSemester]     = useState('');
  const [showSemesterPicker, setShowSemesterPicker] = useState(false);

  const [students, setStudents]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState(null);

  // ── Fetch teacher's classes (same pattern as CoursesScreen) ───────────────
  const fetchClasses = useCallback(async () => {
    setClassesLoading(true);
    try {
      const me = await teacherService.getMe().catch(() => null);
      const teacherId = me?.id;

      const [sessRes, sitesRes] = await Promise.allSettled([
        teacherService.getSessions(teacherId ? { teacher_id: teacherId } : {}),
        apiClient.get('/sites/').then((r) => r.data),
      ]);

      const sessions = sessRes.status === 'fulfilled'
        ? (sessRes.value?.results || sessRes.value || []) : [];
      const sitesRaw = sitesRes.status === 'fulfilled'
        ? (sitesRes.value?.results || sitesRes.value || []) : [];

      const siteMap = {};
      sitesRaw.forEach((s) => { siteMap[s.id] = s.name; });

      const classMap = {};
      sessions.forEach((s) => {
        const cid = s.class_obj;
        if (!cid || classMap[cid]) return;
        classMap[cid] = {
          id:        cid,
          name:      s.class_name || s.class_obj_name || `Classe ${String(cid).slice(0, 6)}`,
          site_id:   s.site_id || null,
          site_name: s.site_id ? (siteMap[s.site_id] || 'Site inconnu') : 'Autre',
        };
      });

      const grouped = {};
      Object.values(classMap).forEach((cls) => {
        if (!grouped[cls.site_name]) grouped[cls.site_name] = { site_name: cls.site_name, data: [] };
        grouped[cls.site_name].data.push(cls);
      });

      const groups = Object.values(grouped);
      setClassGroups(groups);

      if (groups.length > 0 && groups[0].data.length > 0) {
        const first = groups[0].data[0];
        setSelectedClass(first);
        loadGrades(first.id, '');
      }
    } catch (e) {
      console.log('fetchClasses error:', e.message);
    } finally {
      setClassesLoading(false);
    }
  }, []);

  // ── Load and aggregate grades for the selected class ──────────────────────
  const loadGrades = async (classId, semester) => {
    setLoading(true);
    setStudents([]);
    try {
      const evalsData = await gradesService.getEvaluations({ class_group: classId });
      const allEvals = evalsData?.results || evalsData || [];
      // semester_name from serializer = 'Semestre 1' / 'Semestre 2' (semester.label)
      const LABEL = { S1: 'Semestre 1', S2: 'Semestre 2' };
      const evals = semester
        ? allEvals.filter((ev) => !ev.semester_name || ev.semester_name === LABEL[semester])
        : allEvals;

      if (evals.length === 0) {
        setStudents([]);
        return;
      }

      const gradeResults = await Promise.allSettled(
        evals.map((ev) =>
          gradesService.getStudentsGrades(ev.id).then((g) => ({
            ev,
            list: g?.students || g || [],
          }))
        )
      );

      const studentMap = {};
      gradeResults.forEach((res) => {
        if (res.status !== 'fulfilled') return;
        const { ev, list } = res.value;
        list.forEach((s) => {
          const sid = String(s.student_id || s.id);
          if (!studentMap[sid]) {
            studentMap[sid] = { id: sid, name: s.student_name || 'Étudiant', grades: [] };
          }
          if (s.score != null && s.score !== '') {
            studentMap[sid].grades.push({
              evalTitle:   ev.title,
              evalType:    ev.eval_type,
              subjectName: ev.subject_name || '',
              score:       parseFloat(s.score),
              maxScore:    parseFloat(ev.max_score || 20),
            });
          }
        });
      });

      const studentList = Object.values(studentMap).map((stu) => {
        const normalised = stu.grades.map((g) => (g.score / g.maxScore) * 20);
        const average = normalised.length
          ? normalised.reduce((a, b) => a + b, 0) / normalised.length
          : null;
        return { ...stu, average };
      });

      studentList.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(studentList);
    } catch (e) {
      console.log('loadGrades error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  React.useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const selectClass = (cls) => {
    setShowClassPicker(false);
    if (selectedClass?.id === cls.id) return;
    setSelectedClass(cls);
    setSelectedStudent(null);
    loadGrades(cls.id, selectedSemester);
  };

  const selectSemester = (opt) => {
    setShowSemesterPicker(false);
    const val = opt?.value ?? '';
    setSelectedSemester(val);
    setSelectedStudent(null);
    if (selectedClass) loadGrades(selectedClass.id, val);
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (selectedClass) loadGrades(selectedClass.id, selectedSemester);
    else { fetchClasses(); setRefreshing(false); }
  };

  // ── Student detail view ────────────────────────────────────────────────────
  if (selectedStudent) {
    const avg = selectedStudent.average;
    const ac  = avg != null ? gradeColor(avg, 20) : colors.textTertiary;

    return (
      <View style={st.container}>
        <LinearGradient colors={GRADIENT} style={st.header}>
          <SafeAreaView edges={['top']}>
            <View style={st.headerRow}>
              <TouchableOpacity style={st.iconBtn} onPress={() => setSelectedStudent(null)}>
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={st.headerTitle} numberOfLines={1}>{selectedStudent.name}</Text>
                <Text style={st.headerSub}>
                  {selectedClass?.name}
                  {avg != null ? `  ·  Moy. ${avg.toFixed(2)}/20` : ''}
                </Text>
              </View>
              {avg != null && (
                <View style={[st.avgBadge, { backgroundColor: ac + '22', borderColor: ac + '55' }]}>
                  <Text style={[st.avgVal, { color: ac }]}>{avg.toFixed(2)}</Text>
                  <Text style={[st.avgMax, { color: ac }]}>/20</Text>
                </View>
              )}
            </View>
          </SafeAreaView>
        </LinearGradient>

        <FlatList
          data={selectedStudent.grades}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={st.list}
          ListEmptyComponent={
            <EmptyState icon="document-text-outline" title="Aucune note" subtitle="Aucune évaluation notée pour cet étudiant" />
          }
          renderItem={({ item }) => {
            const tc = EVAL_TYPE_COLORS[item.evalType] || ACCENT;
            const sc = gradeColor(item.score, item.maxScore);
            return (
              <View style={st.gradeCard}>
                <View style={[st.evalTypeTag, { backgroundColor: tc + '18', borderColor: tc + '44' }]}>
                  <Text style={[st.evalTypeText, { color: tc }]}>{item.evalType}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={st.gradeTitleText} numberOfLines={1}>{item.evalTitle}</Text>
                  {!!item.subjectName && (
                    <Text style={st.gradeSubText} numberOfLines={1}>{item.subjectName}</Text>
                  )}
                </View>
                <View style={st.scoreBox}>
                  <Text style={[st.scoreVal, { color: sc }]}>{item.score.toFixed(2)}</Text>
                  <Text style={st.scoreMax}>/{item.maxScore}</Text>
                </View>
              </View>
            );
          }}
        />
      </View>
    );
  }

  // ── Main list view ─────────────────────────────────────────────────────────
  const semesterLabel = selectedSemester
    ? (SEMESTERS.find((s) => s.value === selectedSemester)?.label || selectedSemester)
    : 'Tous les semestres';

  return (
    <View style={st.container}>
      <LinearGradient colors={GRADIENT} style={st.header}>
        <SafeAreaView edges={['top']}>
          <View style={st.headerRow}>
            <TouchableOpacity style={st.iconBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={st.headerTitle}>Notes des Étudiants</Text>
              <Text style={st.headerSub}>
                {selectedClass ? selectedClass.name : 'Sélectionnez une classe'}
              </Text>
            </View>
          </View>

          {/* Class picker trigger */}
          <TouchableOpacity
            style={st.filterTrigger}
            onPress={() => { setShowSemesterPicker(false); setShowClassPicker((v) => !v); }}
            activeOpacity={0.8}
          >
            {classesLoading
              ? <ActivityIndicator size="small" color={ACCENT} />
              : <Ionicons name="people-outline" size={16} color={ACCENT} />
            }
            <Text
              style={[st.filterText, !selectedClass && { color: 'rgba(255,255,255,0.5)', fontWeight: '400' }]}
              numberOfLines={1}
            >
              {selectedClass?.name || 'Choisir une classe…'}
            </Text>
            <Ionicons name={showClassPicker ? 'chevron-up' : 'chevron-down'} size={14} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>

          {/* Semester picker trigger */}
          <TouchableOpacity
            style={[st.filterTrigger, { marginTop: 6 }]}
            onPress={() => { setShowClassPicker(false); setShowSemesterPicker((v) => !v); }}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={16} color={ACCENT} />
            <Text
              style={[st.filterText, !selectedSemester && { color: 'rgba(255,255,255,0.5)', fontWeight: '400' }]}
              numberOfLines={1}
            >
              {semesterLabel}
            </Text>
            <Ionicons name={showSemesterPicker ? 'chevron-up' : 'chevron-down'} size={14} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>

          <View style={{ paddingBottom: spacing.sm }} />
        </SafeAreaView>
      </LinearGradient>

      {/* Class dropdown */}
      {showClassPicker && (
        <View style={st.dropdown}>
          <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {classGroups.length === 0 ? (
              <Text style={st.dropdownEmpty}>Aucune classe disponible</Text>
            ) : (
              classGroups.map((group) => (
                <View key={group.site_name}>
                  <View style={st.siteHeader}>
                    <Ionicons name="business-outline" size={11} color={colors.textTertiary} />
                    <Text style={st.siteHeaderText}>{group.site_name}</Text>
                  </View>
                  {group.data.map((cls) => {
                    const active = selectedClass?.id === cls.id;
                    return (
                      <TouchableOpacity
                        key={cls.id}
                        style={[st.dropdownOption, active && { backgroundColor: ACCENT + '12' }]}
                        onPress={() => selectClass(cls)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={active ? 'checkmark-circle' : 'ellipse-outline'}
                          size={16}
                          color={active ? ACCENT : colors.textTertiary}
                        />
                        <Text style={[st.dropdownOptionText, active && { color: ACCENT, fontWeight: '700' }]}>
                          {cls.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      )}

      {/* Semester dropdown */}
      {showSemesterPicker && (
        <View style={st.dropdown}>
          {[{ label: 'Tous les semestres', value: '' }, ...SEMESTERS].map((s) => {
            const active = selectedSemester === s.value;
            return (
              <TouchableOpacity
                key={s.value || '__all__'}
                style={[st.dropdownOption, active && { backgroundColor: ACCENT + '12' }]}
                onPress={() => selectSemester(s)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={active ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={active ? ACCENT : colors.textTertiary}
                />
                <Text style={[st.dropdownOptionText, active && { color: ACCENT, fontWeight: '700' }]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Content */}
      {!selectedClass ? (
        <EmptyState
          icon="people-outline"
          title="Aucune classe sélectionnée"
          subtitle="Choisissez une classe pour afficher les notes des étudiants"
        />
      ) : loading ? (
        <View style={st.center}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(i) => i.id}
          contentContainerStyle={st.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ACCENT]} />}
          ListHeaderComponent={
            students.length > 0 ? (
              <Text style={st.listHeader}>
                {students.length} étudiant{students.length !== 1 ? 's' : ''}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="document-text-outline"
              title="Aucune note"
              subtitle="Aucun étudiant noté dans cette classe"
            />
          }
          renderItem={({ item }) => {
            const avg = item.average;
            const ac  = avg != null ? gradeColor(avg, 20) : colors.textTertiary;
            return (
              <TouchableOpacity
                style={st.studentCard}
                onPress={() => {
                  setShowClassPicker(false);
                  setShowSemesterPicker(false);
                  setSelectedStudent(item);
                }}
                activeOpacity={0.75}
              >
                <View style={[st.avatar, { backgroundColor: ACCENT + '22' }]}>
                  <Text style={[st.avatarText, { color: ACCENT }]}>
                    {(item.name || '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={st.studentName} numberOfLines={1}>{item.name}</Text>
                  <Text style={st.studentSub}>
                    {item.grades.length} note{item.grades.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={st.studentRight}>
                  {avg != null ? (
                    <View style={[st.avgPill, { backgroundColor: ac + '18', borderColor: ac + '44' }]}>
                      <Text style={[st.avgPillText, { color: ac }]}>{avg.toFixed(2)}/20</Text>
                    </View>
                  ) : (
                    <Text style={st.noGrade}>—</Text>
                  )}
                  <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:      { paddingHorizontal: spacing.lg },
  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: spacing.sm, paddingBottom: spacing.md },
  iconBtn:     { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },

  filterTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 2,
  },
  filterText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#fff' },

  dropdown: {
    backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md,
    marginHorizontal: spacing.md, marginTop: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
    zIndex: 100,
  },
  siteHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  siteHeaderText: {
    fontSize: 10, fontWeight: '700', color: colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  dropdownOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  dropdownOptionText: { flex: 1, fontSize: 14, color: colors.text },
  dropdownEmpty: { fontSize: 13, color: colors.textTertiary, fontStyle: 'italic', padding: 16, textAlign: 'center' },

  list:       { padding: spacing.md, gap: spacing.sm, paddingBottom: 100 },
  listHeader: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },

  studentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: radius.lg,
    padding: spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  avatar:      { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontSize: 16, fontWeight: '700' },
  studentName: { fontSize: 14, fontWeight: '700', color: colors.text },
  studentSub:  { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  studentRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avgPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  avgPillText: { fontSize: 12, fontWeight: '700' },
  noGrade:     { fontSize: 16, color: colors.textTertiary, fontWeight: '600' },

  avgBadge: {
    flexDirection: 'row', alignItems: 'baseline',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1.5,
  },
  avgVal: { fontSize: 18, fontWeight: '800' },
  avgMax: { fontSize: 11, fontWeight: '600', marginLeft: 1 },

  gradeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: radius.lg,
    padding: spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  evalTypeTag: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, alignSelf: 'flex-start',
  },
  evalTypeText:   { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  gradeTitleText: { fontSize: 13, fontWeight: '700', color: colors.text },
  gradeSubText:   { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  scoreBox:       { flexDirection: 'row', alignItems: 'baseline', gap: 1 },
  scoreVal:       { fontSize: 17, fontWeight: '800' },
  scoreMax:       { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
});
