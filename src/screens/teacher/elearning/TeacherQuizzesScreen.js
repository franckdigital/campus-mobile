import React, { useCallback } from 'react';
import ContentListScreen from '../../../components/teacher/ContentListScreen';
import ContentCard from '../../../components/teacher/ContentCard';
import elearningService from '../../../services/elearning';

const ACCENT = '#7C3AED';
const GRADIENT = ['#4C1D95', '#6D28D9', '#8B5CF6'];

export default function TeacherQuizzesScreen({ navigation }) {
  const fetchItems = useCallback(async () => {
    const res = await elearningService.getQuizzes({ page_size: 100, ordering: '-created_at' });
    return res?.results || res || [];
  }, []);

  return (
    <ContentListScreen
      navigation={navigation}
      title="Évaluations"
      gradient={GRADIENT}
      accentColor={ACCENT}
      fetchItems={fetchItems}
      searchPlaceholder="Rechercher un quiz..."
      searchKeys={['title', 'subject_name']}
      stats={(items) => [
        { label: 'Total', value: items.length },
        { label: 'Publiés', value: items.filter((i) => i.is_published).length },
        { label: 'Brouillons', value: items.filter((i) => !i.is_published).length },
      ]}
      emptyIcon="list-outline"
      emptyTitle="Aucune évaluation"
      onFabPress={() => navigation.navigate('TeacherQuizForm')}
      renderItem={({ item }) => (
        <ContentCard
          icon="list-outline"
          iconColor={ACCENT}
          title={item.title}
          sub={[item.class_name, item.subject_name].filter(Boolean).join(' · ')}
          meta={[
            { icon: 'help-circle-outline', text: `${item.question_count || 0} question${item.question_count === 1 ? '' : 's'}` },
            { icon: 'time-outline', text: item.time_limit_minutes ? `${item.time_limit_minutes} min` : 'Sans limite' },
          ]}
          statusLabel={item.is_published ? '✓ Publié' : '⏳ Brouillon'}
          statusColor={item.is_published ? '#059669' : '#B45309'}
          borderColor={item.is_published ? '#059669' : ACCENT}
          onPress={() => navigation.navigate('TeacherQuizForm', { quiz: item })}
        />
      )}
    />
  );
}
