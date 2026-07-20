import { useState, useEffect, useCallback } from 'react';
import teacherService from '../services/teacher';

// Which class+subject pairs the logged-in teacher may create e-learning
// content for (ClassSubjectTeacher assignments) — the picker source of truth
// shared by every teacher e-learning create/edit form.
export default function useTeacherClassSubjects() {
  const [teacherId, setTeacherId] = useState(null);
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await teacherService.getMe();
      setTeacherId(me?.id || null);
      if (me?.id) {
        const res = await teacherService.getClassSubjects(me.id);
        setPairs(res?.results || res || []);
      }
    } catch (e) {
      console.log('useTeacherClassSubjects error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const options = pairs.map((p) => ({
    label: `${p.class_name} — ${p.subject_name}`,
    value: `${p.class_obj}|${p.subject}`,
    class_obj: p.class_obj,
    subject: p.subject,
  }));

  return { teacherId, pairs, options, loading, reload: load };
}
