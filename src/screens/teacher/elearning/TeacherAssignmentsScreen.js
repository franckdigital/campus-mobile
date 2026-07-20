import React, { useCallback } from 'react';
import ContentListScreen from '../../../components/teacher/ContentListScreen';
import ContentCard from '../../../components/teacher/ContentCard';
import elearningService from '../../../services/elearning';

const ACCENT = '#DB2777';
const GRADIENT = ['#9D174D', '#DB2777', '#BE185D'];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function TeacherAssignmentsScreen({ navigation }) {
  const fetchItems = useCallback(async () => {
    const res = await elearningService.getAssignments({ page_size: 100, ordering: '-created_at' });
    return res?.results || res || [];
  }, []);

  return (
    <ContentListScreen
      navigation={navigation}
      title="Devoirs & Exercices"
      gradient={GRADIENT}
      accentColor={ACCENT}
      fetchItems={fetchItems}
      searchPlaceholder="Rechercher un devoir..."
      searchKeys={['title', 'subject_name']}
      stats={(items) => [
        { label: 'Total', value: items.length },
        { label: 'Publiés', value: items.filter((i) => i.status === 'PUBLISHED').length },
        { label: 'Brouillons', value: items.filter((i) => i.status === 'DRAFT').length },
      ]}
      emptyIcon="clipboard-outline"
      emptyTitle="Aucun devoir"
      onFabPress={() => navigation.navigate('TeacherAssignmentForm')}
      renderItem={({ item }) => (
        <ContentCard
          icon="clipboard-outline"
          iconColor={ACCENT}
          title={item.title}
          sub={[item.class_name, item.subject_name].filter(Boolean).join(' · ')}
          meta={[
            { icon: 'people-outline', text: `${item.submission_count || 0} rendu${item.submission_count === 1 ? '' : 's'}` },
            { icon: 'time-outline', text: fmtDate(item.due_date) },
          ]}
          statusLabel={item.status === 'PUBLISHED' ? '✓ Publié' : item.status === 'CLOSED' ? '● Fermé' : '⏳ Brouillon'}
          statusColor={item.status === 'PUBLISHED' ? '#059669' : item.status === 'CLOSED' ? '#DC2626' : '#B45309'}
          borderColor={item.status === 'PUBLISHED' ? '#059669' : ACCENT}
          onPress={() => navigation.navigate('TeacherAssignmentForm', { assignment: item })}
        />
      )}
    />
  );
}
