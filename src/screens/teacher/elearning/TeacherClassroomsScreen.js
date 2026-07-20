import React, { useCallback } from 'react';
import ContentListScreen from '../../../components/teacher/ContentListScreen';
import ContentCard from '../../../components/teacher/ContentCard';
import elearningService from '../../../services/elearning';
import { colors } from '../../../theme/colors';

const ACCENT = '#2563EB';
const GRADIENT = ['#1E3A8A', '#1D4ED8', '#2563EB'];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function TeacherClassroomsScreen({ navigation }) {
  const fetchItems = useCallback(async () => {
    const res = await elearningService.getClassrooms({ page_size: 100, ordering: '-start_time' });
    return res?.results || res || [];
  }, []);

  return (
    <ContentListScreen
      navigation={navigation}
      title="Classes virtuelles"
      gradient={GRADIENT}
      accentColor={ACCENT}
      fetchItems={fetchItems}
      searchPlaceholder="Rechercher une session..."
      searchKeys={['title', 'subject_name']}
      stats={(items) => [
        { label: 'Total', value: items.length },
        { label: 'À venir', value: items.filter((i) => !i.is_ended && new Date(i.start_time) >= new Date()).length },
        { label: 'Terminées', value: items.filter((i) => i.is_ended).length },
      ]}
      emptyIcon="videocam-outline"
      emptyTitle="Aucune classe virtuelle"
      onFabPress={() => navigation.navigate('TeacherClassroomForm')}
      renderItem={({ item }) => (
        <ContentCard
          icon="videocam-outline"
          iconColor={ACCENT}
          title={item.title}
          sub={[item.class_name, item.subject_name].filter(Boolean).join(' · ')}
          meta={[
            { icon: 'calendar-outline', text: fmtDate(item.start_time) },
            { icon: 'time-outline', text: `${item.duration_minutes} min` },
            { icon: 'globe-outline', text: item.provider },
          ]}
          statusLabel={item.is_ended ? '✓ Terminée' : '● Programmée'}
          statusColor={item.is_ended ? colors.success : ACCENT}
          borderColor={item.is_ended ? colors.success : ACCENT}
          onPress={() => navigation.navigate('TeacherClassroomForm', { classroom: item })}
        />
      )}
    />
  );
}
