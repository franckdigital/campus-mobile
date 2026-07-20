import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import DashboardScreen from '../screens/teacher/DashboardScreen';
import ClassesScreen from '../screens/teacher/ClassesScreen';
import AttendanceScreen from '../screens/teacher/AttendanceScreen';
import GradesScreen from '../screens/teacher/GradesScreen';
import CoursesScreen from '../screens/teacher/CoursesScreen';
import ProfileScreen from '../screens/teacher/ProfileScreen';
import NotificationsScreen from '../screens/teacher/NotificationsScreen';
import ScheduleScreen from '../screens/teacher/ScheduleScreen';

import TeacherELearningHomeScreen from '../screens/teacher/elearning/TeacherELearningHomeScreen';
import TeacherSessionFormScreen from '../screens/teacher/elearning/TeacherSessionFormScreen';
import TeacherLessonsScreen from '../screens/teacher/elearning/TeacherLessonsScreen';
import TeacherLessonFormScreen from '../screens/teacher/elearning/TeacherLessonFormScreen';
import TeacherClassroomsScreen from '../screens/teacher/elearning/TeacherClassroomsScreen';
import TeacherClassroomFormScreen from '../screens/teacher/elearning/TeacherClassroomFormScreen';
import TeacherQuizzesScreen from '../screens/teacher/elearning/TeacherQuizzesScreen';
import TeacherQuizFormScreen from '../screens/teacher/elearning/TeacherQuizFormScreen';
import TeacherQuizQuestionsScreen from '../screens/teacher/elearning/TeacherQuizQuestionsScreen';
import TeacherAssignmentsScreen from '../screens/teacher/elearning/TeacherAssignmentsScreen';
import TeacherAssignmentFormScreen from '../screens/teacher/elearning/TeacherAssignmentFormScreen';
import TeacherExamsScreen from '../screens/teacher/elearning/TeacherExamsScreen';
import TeacherExamFormScreen from '../screens/teacher/elearning/TeacherExamFormScreen';
import TeacherCorrectionsHomeScreen from '../screens/teacher/elearning/TeacherCorrectionsHomeScreen';
import TeacherAssignmentSubmissionsScreen from '../screens/teacher/elearning/TeacherAssignmentSubmissionsScreen';
import TeacherQuizAttemptsScreen from '../screens/teacher/elearning/TeacherQuizAttemptsScreen';
import TeacherExamSessionsScreen from '../screens/teacher/elearning/TeacherExamSessionsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TEACHER_COLOR = '#D97706';

function TeacherTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: TEACHER_COLOR,
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          paddingBottom: 8,
          paddingTop: 6,
          height: 64,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Accueil: focused ? 'home' : 'home-outline',
            Classes: focused ? 'people' : 'people-outline',
            Présences: focused ? 'checkbox' : 'checkbox-outline',
            Notes: focused ? 'create' : 'create-outline',
            Cours: focused ? 'book' : 'book-outline',
          };
          return <Ionicons name={icons[route.name] || 'ellipse-outline'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Accueil" component={DashboardScreen} />
      <Tab.Screen name="Classes" component={ClassesScreen} />
      <Tab.Screen name="Présences" component={AttendanceScreen} />
      <Tab.Screen name="Notes" component={GradesScreen} />
      <Tab.Screen name="Cours" component={CoursesScreen} />
    </Tab.Navigator>
  );
}

export default function TeacherNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TeacherTabs" component={TeacherTabs} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Planning" component={ScheduleScreen} />

      <Stack.Screen name="ELearningHome" component={TeacherELearningHomeScreen} />
      <Stack.Screen name="TeacherSessionForm" component={TeacherSessionFormScreen} />
      <Stack.Screen name="TeacherLessons" component={TeacherLessonsScreen} />
      <Stack.Screen name="TeacherLessonForm" component={TeacherLessonFormScreen} />
      <Stack.Screen name="TeacherClassrooms" component={TeacherClassroomsScreen} />
      <Stack.Screen name="TeacherClassroomForm" component={TeacherClassroomFormScreen} />
      <Stack.Screen name="TeacherQuizzes" component={TeacherQuizzesScreen} />
      <Stack.Screen name="TeacherQuizForm" component={TeacherQuizFormScreen} />
      <Stack.Screen name="TeacherQuizQuestions" component={TeacherQuizQuestionsScreen} />
      <Stack.Screen name="TeacherAssignments" component={TeacherAssignmentsScreen} />
      <Stack.Screen name="TeacherAssignmentForm" component={TeacherAssignmentFormScreen} />
      <Stack.Screen name="TeacherExams" component={TeacherExamsScreen} />
      <Stack.Screen name="TeacherExamForm" component={TeacherExamFormScreen} />
      <Stack.Screen name="TeacherCorrectionsHome" component={TeacherCorrectionsHomeScreen} />
      <Stack.Screen name="TeacherAssignmentSubmissions" component={TeacherAssignmentSubmissionsScreen} />
      <Stack.Screen name="TeacherQuizAttempts" component={TeacherQuizAttemptsScreen} />
      <Stack.Screen name="TeacherExamSessions" component={TeacherExamSessionsScreen} />
    </Stack.Navigator>
  );
}
