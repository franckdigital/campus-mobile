import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import elearningService from '../../../services/elearning';
import EmptyState from '../../../components/common/EmptyState';
import { colors, spacing, radius } from '../../../theme/colors';

const CONTENT_ICONS = {
  video: 'play-circle-outline',
  audio: 'musical-notes-outline',
  pdf: 'document-text-outline',
  ppt: 'easel-outline',
  word: 'document-outline',
  image: 'image-outline',
  text: 'reader-outline',
  youtube: 'logo-youtube',
  vimeo: 'play-circle-outline',
  iframe: 'link-outline',
  html5: 'code-slash-outline',
};

export default function CourseDetailScreen({ route, navigation }) {
  const { courseId, courseTitle } = route.params || {};
  const [course, setCourse] = useState(null);
  const [completedIds, setCompletedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState({});

  const fetchData = useCallback(async () => {
    try {
      const [courseRes, completedRes] = await Promise.allSettled([
        elearningService.getCourseById(courseId),
        elearningService.getMyCompletedCourseLessons(),
      ]);
      if (courseRes.status === 'fulfilled') {
        setCourse(courseRes.value);
        const sections = courseRes.value?.sections || [];
        if (sections.length) setOpenSections({ [sections[0].id]: true });
      }
      if (completedRes.status === 'fulfilled') setCompletedIds(completedRes.value || []);
    } catch (e) {
      console.log('Course detail error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  const allLessons = (course?.sections || []).flatMap((s) => (s.chapters || []).flatMap((c) => c.lessons || []));
  const totalCount = allLessons.length;
  const doneCount = allLessons.filter((l) => completedIds.includes(l.id)).length;
  const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const nextLesson = allLessons.find((l) => !completedIds.includes(l.id)) || allLessons[0];

  const openLesson = (lesson) => {
    navigation.navigate('LessonPlayer', {
      lesson,
      courseId,
      isCompleted: completedIds.includes(lesson.id),
      allLessons,
      completedIds,
    });
  };

  const toggleSection = (id) => setOpenSections((v) => ({ ...v, [id]: !v[id] }));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#DB2777" size="large" />
      </View>
    );
  }

  if (!course) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={{ padding: spacing.md }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnLight}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        </SafeAreaView>
        <EmptyState icon="alert-circle-outline" title="Cours introuvable" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <LinearGradient colors={['#9D174D', '#DB2777', '#BE185D']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ width: 38 }} />
          </View>

          {course.thumbnail_url && (
            <Image source={{ uri: course.thumbnail_url }} style={styles.banner} resizeMode="cover" />
          )}

          <Text style={styles.title}>{course.title}</Text>
          {course.subtitle ? <Text style={styles.subtitle}>{course.subtitle}</Text> : null}

          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Votre progression</Text>
            <Text style={styles.progressValue}>{percent}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
          </View>

          {nextLesson && (
            <TouchableOpacity style={styles.continueBtn} onPress={() => openLesson(nextLesson)}>
              <Ionicons name="play" size={16} color="#DB2777" />
              <Text style={styles.continueBtnText}>
                {doneCount > 0 ? `Continuer l'apprentissage · ${percent}%` : 'Commencer le cours'}
              </Text>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </LinearGradient>

      {course.description ? (
        <View style={styles.descCard}>
          <Text style={styles.descText}>{course.description}</Text>
        </View>
      ) : null}

      <View style={styles.programHeader}>
        <Text style={styles.programTitle}>Programme du cours</Text>
        <Text style={styles.programMeta}>{course.sections?.length || 0} sections · {totalCount} leçons</Text>
      </View>

      <View style={styles.sectionsWrap}>
        {(course.sections || []).map((section) => {
          const sectionLessons = (section.chapters || []).flatMap((c) => c.lessons || []);
          const sectionDone = sectionLessons.filter((l) => completedIds.includes(l.id)).length;
          const open = !!openSections[section.id];
          return (
            <View key={section.id} style={styles.sectionCard}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection(section.id)}>
                <View style={styles.sectionIcon}>
                  <Ionicons name="layers-outline" size={16} color="#DB2777" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionSub}>{sectionDone}/{sectionLessons.length} leçons</Text>
                </View>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
              </TouchableOpacity>

              {open && (
                <View style={styles.chaptersWrap}>
                  {(section.chapters || []).map((chapter) => (
                    <View key={chapter.id} style={styles.chapterBlock}>
                      <Text style={styles.chapterTitle}>{chapter.title}</Text>
                      {(chapter.lessons || []).map((lesson) => {
                        const done = completedIds.includes(lesson.id);
                        return (
                          <TouchableOpacity
                            key={lesson.id}
                            style={styles.lessonRow}
                            onPress={() => openLesson(lesson)}
                          >
                            <Ionicons
                              name={done ? 'checkmark-circle' : CONTENT_ICONS[lesson.content_type] || 'document-outline'}
                              size={18}
                              color={done ? colors.success : '#DB2777'}
                            />
                            <Text style={styles.lessonTitle} numberOfLines={1}>{lesson.title}</Text>
                            {lesson.duration_seconds > 0 && (
                              <Text style={styles.lessonDuration}>{Math.round(lesson.duration_seconds / 60)} min</Text>
                            )}
                            {lesson.is_preview_free && (
                              <View style={styles.freeBadge}><Text style={styles.freeBadgeText}>Gratuit</Text></View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        {(!course.sections || course.sections.length === 0) && (
          <EmptyState icon="layers-outline" title="Aucun contenu disponible" subtitle="Ce cours n'a pas encore de leçons publiées" />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  backBtnLight: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.divider, alignItems: 'center', justifyContent: 'center' },

  banner: { width: '100%', height: 120, borderRadius: radius.lg, marginTop: spacing.sm },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: spacing.md },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4 },

  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: 6 },
  progressLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  progressValue: { fontSize: 12, fontWeight: '700', color: '#fff' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 3 },

  continueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: radius.md, paddingVertical: 12, marginTop: spacing.md },
  continueBtnText: { fontSize: 14, fontWeight: '700', color: '#DB2777' },

  descCard: { margin: spacing.md, marginBottom: 0, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md },
  descText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },

  programHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  programTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  programMeta: { fontSize: 11, color: colors.textTertiary },

  sectionsWrap: { paddingHorizontal: spacing.md, gap: spacing.sm },
  sectionCard: { backgroundColor: '#fff', borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.divider },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.md },
  sectionIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FCE7F3', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  sectionSub: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },

  chaptersWrap: { borderTopWidth: 1, borderTopColor: colors.divider, padding: spacing.sm, gap: spacing.sm },
  chapterBlock: { gap: 4 },
  chapterTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, paddingHorizontal: 6, marginBottom: 2 },
  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 8, borderRadius: radius.md },
  lessonTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  lessonDuration: { fontSize: 11, color: colors.textTertiary },
  freeBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full },
  freeBadgeText: { fontSize: 9, fontWeight: '700', color: '#059669' },
});
