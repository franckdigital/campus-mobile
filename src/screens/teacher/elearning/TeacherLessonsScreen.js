import React, { useCallback } from 'react';
import ContentListScreen from '../../../components/teacher/ContentListScreen';
import ContentCard from '../../../components/teacher/ContentCard';
import elearningService from '../../../services/elearning';

const ACCENT = '#DB2777';
const GRADIENT = ['#9D174D', '#DB2777', '#BE185D'];

export default function TeacherLessonsScreen({ navigation }) {
  const fetchItems = useCallback(async () => {
    const res = await elearningService.getLessons({ page_size: 100, ordering: '-created_at' });
    return res?.results || res || [];
  }, []);

  return (
    <ContentListScreen
      navigation={navigation}
      title="Cours"
      gradient={GRADIENT}
      accentColor={ACCENT}
      fetchItems={fetchItems}
      searchPlaceholder="Rechercher un cours..."
      searchKeys={['title', 'subject_name']}
      stats={(items) => [
        { label: 'Total', value: items.length },
        { label: 'Publiés', value: items.filter((i) => i.is_published).length },
        { label: 'Brouillons', value: items.filter((i) => !i.is_published).length },
      ]}
      emptyIcon="book-outline"
      emptyTitle="Aucun cours"
      onFabPress={() => navigation.navigate('TeacherLessonForm')}
      renderItem={({ item }) => (
        <ContentCard
          icon="book-outline"
          iconColor={ACCENT}
          title={item.title}
          sub={[item.class_name, item.subject_name].filter(Boolean).join(' · ')}
          meta={item.chapter_title ? [{ icon: 'layers-outline', text: item.chapter_title }] : []}
          statusLabel={item.is_published ? '✓ Publié' : '⏳ Brouillon'}
          statusColor={item.is_published ? '#059669' : '#B45309'}
          borderColor={item.is_published ? '#059669' : ACCENT}
          onPress={() => navigation.navigate('TeacherLessonForm', { lesson: item })}
        />
      )}
    />
  );
}
