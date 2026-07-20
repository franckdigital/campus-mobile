import React, { useCallback } from 'react';
import ContentListScreen from '../../../components/teacher/ContentListScreen';
import ContentCard from '../../../components/teacher/ContentCard';
import elearningService from '../../../services/elearning';

const ACCENT = '#059669';
const GRADIENT = ['#064E3B', '#059669', '#10B981'];

const EXAM_TYPE_LABEL = { MID: 'Partiel', FINAL: 'Examen final', SUPP: 'Rattrapage', TP: 'TP noté', CONCOURS: 'Concours' };

export default function TeacherExamsScreen({ navigation }) {
  const fetchItems = useCallback(async () => {
    const res = await elearningService.getSecureExams({ page_size: 100, ordering: '-created_at' });
    return res?.results || res || [];
  }, []);

  return (
    <ContentListScreen
      navigation={navigation}
      title="Examens sécurisés"
      gradient={GRADIENT}
      accentColor={ACCENT}
      fetchItems={fetchItems}
      searchPlaceholder="Rechercher un examen..."
      searchKeys={['title', 'subject_name']}
      stats={(items) => [
        { label: 'Total', value: items.length },
        { label: 'Publiés', value: items.filter((i) => i.is_published).length },
        { label: 'Brouillons', value: items.filter((i) => !i.is_published).length },
      ]}
      emptyIcon="shield-checkmark-outline"
      emptyTitle="Aucun examen"
      onFabPress={() => navigation.navigate('TeacherExamForm')}
      renderItem={({ item }) => (
        <ContentCard
          icon="shield-checkmark-outline"
          iconColor={ACCENT}
          title={item.title || EXAM_TYPE_LABEL[item.exam_type]}
          sub={[item.class_name, item.subject_name].filter(Boolean).join(' · ')}
          meta={[
            { icon: 'pricetag-outline', text: EXAM_TYPE_LABEL[item.exam_type] || item.exam_type },
            { icon: 'time-outline', text: `${item.duration_minutes} min` },
            ...(item.webcam_required ? [{ icon: 'videocam-outline', text: 'Webcam' }] : []),
          ]}
          statusLabel={item.is_published ? '✓ Publié' : '⏳ Brouillon'}
          statusColor={item.is_published ? '#059669' : '#B45309'}
          borderColor={item.is_published ? '#059669' : ACCENT}
          onPress={() => navigation.navigate('TeacherExamForm', { exam: item })}
        />
      )}
    />
  );
}
