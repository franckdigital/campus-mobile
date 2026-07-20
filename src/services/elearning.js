import apiClient from './apiClient';

const q = (params = {}) => {
  const s = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return s ? `?${s}` : '';
};

// Some create/update endpoints accept an optional file (subject_file, attachment...).
// Screens pass a FormData when a file is attached, a plain object otherwise —
// this picks the right Content-Type for either case.
const multipartConfig = (data) =>
  typeof FormData !== 'undefined' && data instanceof FormData
    ? { headers: { 'Content-Type': 'multipart/form-data' } }
    : undefined;

export const elearningService = {
  getLessons: (params) => apiClient.get(`/elearning/lessons/${q(params)}`).then((r) => r.data),
  getLessonById: (id) => apiClient.get(`/elearning/lessons/${id}/`).then((r) => r.data),
  createLesson: (data) => apiClient.post('/elearning/lessons/', data).then((r) => r.data),
  updateLesson: (id, data) => apiClient.patch(`/elearning/lessons/${id}/`, data).then((r) => r.data),
  deleteLesson: (id) => apiClient.delete(`/elearning/lessons/${id}/`).then((r) => r.data),
  publishLesson: (id) => apiClient.post(`/elearning/lessons/${id}/publish/`).then((r) => r.data),

  getChapters: (params) => apiClient.get(`/elearning/chapters/${q(params)}`).then((r) => r.data),
  createChapter: (data) => apiClient.post('/elearning/chapters/', data).then((r) => r.data),
  updateChapter: (id, data) => apiClient.patch(`/elearning/chapters/${id}/`, data).then((r) => r.data),
  deleteChapter: (id) => apiClient.delete(`/elearning/chapters/${id}/`).then((r) => r.data),

  getAssignments: (params) => apiClient.get(`/elearning/assignments/${q(params)}`).then((r) => r.data),
  getAssignmentById: (id) => apiClient.get(`/elearning/assignments/${id}/`).then((r) => r.data),
  createAssignment: (data) => apiClient.post('/elearning/assignments/', data, multipartConfig(data)).then((r) => r.data),
  updateAssignment: (id, data) => apiClient.patch(`/elearning/assignments/${id}/`, data, multipartConfig(data)).then((r) => r.data),
  deleteAssignment: (id) => apiClient.delete(`/elearning/assignments/${id}/`).then((r) => r.data),
  publishAssignment: (id) => apiClient.post(`/elearning/assignments/${id}/publish/`).then((r) => r.data),
  getSubmissions: (id) => apiClient.get(`/elearning/assignments/${id}/submissions/`).then((r) => r.data),

  submitAssignment: async (assignmentId, formData) => {
    const res = await apiClient.post(`/elearning/assignments/${assignmentId}/submit/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  gradeSubmission: (submissionId, data) =>
    apiClient.post(`/elearning/submissions/${submissionId}/correct/`, data, multipartConfig(data)).then((r) => r.data),

  getZoomMeetings: (params) => apiClient.get(`/elearning/zoom-meetings/${q(params)}`).then((r) => r.data),

  // ── Cours autonomes (Course > CourseSection > CourseChapter > CourseLesson) ──
  getCourses: (params) => apiClient.get(`/elearning/courses/${q(params)}`).then((r) => r.data),
  getCourseById: (id) => apiClient.get(`/elearning/courses/${id}/`).then((r) => r.data),
  markCourseLessonComplete: (lessonId) =>
    apiClient.post(`/elearning/course-lessons/${lessonId}/mark-complete/`).then((r) => r.data),
  getMyCompletedCourseLessons: () =>
    apiClient.get('/elearning/course-lessons/my-completed/').then((r) => r.data),

  // ── Classes virtuelles (VirtualClassroom + MeetingSegment "sessions") ──
  getClassrooms: (params) => apiClient.get(`/elearning/classrooms/${q(params)}`).then((r) => r.data),
  getClassroomById: (id) => apiClient.get(`/elearning/classrooms/${id}/`).then((r) => r.data),
  createClassroom: (data) => apiClient.post('/elearning/classrooms/', data).then((r) => r.data),
  updateClassroom: (id, data) => apiClient.patch(`/elearning/classrooms/${id}/`, data).then((r) => r.data),
  deleteClassroom: (id) => apiClient.delete(`/elearning/classrooms/${id}/`).then((r) => r.data),
  endClassroom: (id) => apiClient.post(`/elearning/classrooms/${id}/end/`).then((r) => r.data),
  getClassroomChat: (id) => apiClient.get(`/elearning/classrooms/${id}/chat/`).then((r) => r.data),
  sendClassroomChat: (id, message) =>
    apiClient.post(`/elearning/classrooms/${id}/chat/send/`, { message }).then((r) => r.data),

  joinSegment: (segmentId) =>
    apiClient.post(`/elearning/meeting-segments/${segmentId}/join/`).then((r) => r.data),
  leaveSegment: (segmentId) =>
    apiClient.post(`/elearning/meeting-segments/${segmentId}/leave/`).then((r) => r.data),

  // ── Quiz intelligents (Évaluations) ──
  getQuizzes: (params) => apiClient.get(`/elearning/quizzes/${q(params)}`).then((r) => r.data),
  getQuizById: (id) => apiClient.get(`/elearning/quizzes/${id}/`).then((r) => r.data),
  createQuiz: (data) => apiClient.post('/elearning/quizzes/', data, multipartConfig(data)).then((r) => r.data),
  updateQuiz: (id, data) => apiClient.patch(`/elearning/quizzes/${id}/`, data, multipartConfig(data)).then((r) => r.data),
  deleteQuiz: (id) => apiClient.delete(`/elearning/quizzes/${id}/`).then((r) => r.data),
  takeQuiz: (quizId) => apiClient.get(`/elearning/quizzes/${quizId}/take/`).then((r) => r.data),
  startQuizAttempt: (quizId) => apiClient.post(`/elearning/quizzes/${quizId}/start-attempt/`).then((r) => r.data),
  getMyQuizAttempts: (quizId) => apiClient.get(`/elearning/quizzes/${quizId}/my-attempts/`).then((r) => r.data),
  getQuizAttemptById: (id) => apiClient.get(`/elearning/quiz-attempts/${id}/`).then((r) => r.data),
  getQuizAttempts: (params) => apiClient.get(`/elearning/quiz-attempts/${q(params)}`).then((r) => r.data),
  submitQuizAttempt: (attemptId, answers) =>
    apiClient.post(`/elearning/quiz-attempts/${attemptId}/submit/`, { answers }).then((r) => r.data),
  gradeQuizAttemptText: (attemptId, data) =>
    apiClient.post(`/elearning/quiz-attempts/${attemptId}/grade-text/`, data).then((r) => r.data),

  getQuestions: (params) => apiClient.get(`/elearning/quiz-questions/${q(params)}`).then((r) => r.data),
  createQuestion: (data) => apiClient.post('/elearning/quiz-questions/', data).then((r) => r.data),
  updateQuestion: (id, data) => apiClient.patch(`/elearning/quiz-questions/${id}/`, data).then((r) => r.data),
  deleteQuestion: (id) => apiClient.delete(`/elearning/quiz-questions/${id}/`).then((r) => r.data),
  createChoice: (data) => apiClient.post('/elearning/quiz-choices/', data).then((r) => r.data),
  updateChoice: (id, data) => apiClient.patch(`/elearning/quiz-choices/${id}/`, data).then((r) => r.data),
  deleteChoice: (id) => apiClient.delete(`/elearning/quiz-choices/${id}/`).then((r) => r.data),

  // ── Examens sécurisés ──
  getSecureExams: (params) => apiClient.get(`/elearning/exams/${q(params)}`).then((r) => r.data),
  getSecureExamById: (id) => apiClient.get(`/elearning/exams/${id}/`).then((r) => r.data),
  createSecureExam: (data) => apiClient.post('/elearning/exams/', data, multipartConfig(data)).then((r) => r.data),
  updateSecureExam: (id, data) => apiClient.patch(`/elearning/exams/${id}/`, data, multipartConfig(data)).then((r) => r.data),
  deleteSecureExam: (id) => apiClient.delete(`/elearning/exams/${id}/`).then((r) => r.data),
  publishSecureExam: (id) => apiClient.post(`/elearning/exams/${id}/publish/`).then((r) => r.data),
  getExamSessions: (examId) => apiClient.get(`/elearning/exams/${examId}/sessions/`).then((r) => r.data),
  gradeExamSession: (sessionId, data) =>
    apiClient.post(`/elearning/exam-sessions/${sessionId}/grade/`, data, multipartConfig(data)).then((r) => r.data),
  startExamSession: (examId) => apiClient.post(`/elearning/exams/${examId}/start-session/`).then((r) => r.data),
  logExamEvent: (examId, eventType, details = {}) =>
    apiClient.post(`/elearning/exams/${examId}/log-event/`, { event_type: eventType, details }).then((r) => r.data),
  getExamRanking: (examId) => apiClient.get(`/elearning/exams/${examId}/ranking/`).then((r) => r.data),
  submitExamFile: (sessionId, formData) =>
    apiClient.post(`/elearning/exam-sessions/${sessionId}/submit-file/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
  uploadExamSnapshot: (sessionId, formData) =>
    apiClient.post(`/elearning/exams/sessions/${sessionId}/snapshot/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
  getExamSessionSnapshots: (sessionId) =>
    apiClient.get(`/elearning/exams/sessions/${sessionId}/snapshot/`).then((r) => r.data),
};

export default elearningService;
