import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme/colors';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';

import DashboardScreen from '../screens/student/DashboardScreen';
import GradesScreen from '../screens/student/GradesScreen';
import FinanceScreen from '../screens/student/FinanceScreen';
import AttendanceScreen from '../screens/student/AttendanceScreen';
import CoursesScreen from '../screens/student/CoursesScreen';
import ProfileScreen from '../screens/student/ProfileScreen';
import DocumentsScreen from '../screens/student/DocumentsScreen';
import MessagesScreen from '../screens/student/MessagesScreen';
import PlanningScreen from '../screens/student/PlanningScreen';
import StudentCardScreen from '../screens/student/StudentCardScreen';
import NotificationsScreen from '../screens/student/NotificationsScreen';
import ELearningHomeScreen from '../screens/student/elearning/ELearningHomeScreen';
import CoursesListScreen from '../screens/student/elearning/CoursesListScreen';
import CourseDetailScreen from '../screens/student/elearning/CourseDetailScreen';
import LessonPlayerScreen from '../screens/student/elearning/LessonPlayerScreen';
import VirtualClassroomsScreen from '../screens/student/elearning/VirtualClassroomsScreen';
import ClassroomDetailScreen from '../screens/student/elearning/ClassroomDetailScreen';
import AssignmentsScreen from '../screens/student/elearning/AssignmentsScreen';
import AssignmentDetailScreen from '../screens/student/elearning/AssignmentDetailScreen';
import QuizzesScreen from '../screens/student/elearning/QuizzesScreen';
import QuizTakeScreen from '../screens/student/elearning/QuizTakeScreen';
import ExamsScreen from '../screens/student/elearning/ExamsScreen';
import ExamDetailScreen from '../screens/student/elearning/ExamDetailScreen';
import SecureExamTakeScreen from '../screens/student/elearning/SecureExamTakeScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS = {
  Accueil: ['home', 'home-outline'],
  Notes: ['bar-chart', 'bar-chart-outline'],
  Finance: ['wallet', 'wallet-outline'],
  Présence: ['checkbox', 'checkbox-outline'],
  Plus: ['grid', 'grid-outline'],
};

const MORE_GROUPS = [
  {
    title: 'Académique',
    items: [
      { label: 'E-Learning', icon: 'school-outline', screen: 'ELearning', color: '#DB2777', bg: '#FCE7F3', elearningOnly: true },
      { label: 'Cours & Devoirs', icon: 'book-outline', screen: 'Cours', color: '#EA580C', bg: '#FEF3C7' },
      { label: 'Planning', icon: 'calendar-outline', screen: 'Planning', color: '#4F46E5', bg: '#EEF2FF' },
    ],
  },
  {
    title: 'Dossier',
    items: [
      { label: 'Documents', icon: 'folder-open-outline', screen: 'Documents', color: '#7C3AED', bg: '#EDE9FE' },
      { label: 'Carte étudiant', icon: 'card-outline', screen: 'CarteEtudiant', color: '#0284C7', bg: '#E0F2FE' },
      { label: 'Messages', icon: 'chatbubbles-outline', screen: 'Messages', color: '#0EA5E9', bg: '#BAE6FD' },
    ],
  },
  {
    title: 'Compte',
    items: [
      { label: 'Mon profil', icon: 'person-outline', screen: 'Profile', color: '#10B981', bg: '#D1FAE5' },
      { label: 'Notifications', icon: 'notifications-outline', screen: 'Notifications', color: '#6366F1', bg: '#EEF2FF' },
    ],
  },
];

function MoreScreen({ navigation }) {
  const { studentModality, tuitionUpToDate, echeanceOverride } = useAuth();
  const canSeeElearning = (studentModality === 'ELEARNING' || studentModality === 'HYBRIDE')
    && (tuitionUpToDate || echeanceOverride);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={['#3730A3', '#4F46E5', '#6D28D9']} style={{ paddingHorizontal: spacing.lg }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', paddingTop: spacing.md, paddingBottom: spacing.lg }}>Menu</Text>
        </SafeAreaView>
      </LinearGradient>
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        {MORE_GROUPS.map((group) => (
          <View key={group.title} style={{ gap: spacing.sm }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: 4 }}>
              {group.title}
            </Text>
            <View style={{ gap: 8 }}>
              {group.items.filter((item) => !item.elearningOnly || canSeeElearning).map((item) => (
                <TouchableOpacity
                  key={item.screen}
                  onPress={() => navigation.navigate(item.screen)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}
                >
                  <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: item.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={item.icon} size={22} color={item.color} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text }}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function StudentTabs({ initialRouteName }) {
  const { unreadCount } = useNotifications();

  return (
    <Tab.Navigator
      initialRouteName={initialRouteName || 'Accueil'}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
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
          const [a, b] = TAB_ICONS[route.name] || ['ellipse', 'ellipse-outline'];
          const icon = <Ionicons name={focused ? a : b} size={size} color={color} />;
          if (route.name === 'Plus' && unreadCount > 0) {
            return (
              <View>
                {icon}
                <View style={{ position: 'absolute', top: -2, right: -6, backgroundColor: '#EF4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              </View>
            );
          }
          return icon;
        },
      })}
    >
      <Tab.Screen name="Accueil" component={DashboardScreen} />
      <Tab.Screen name="Notes" component={GradesScreen} />
      <Tab.Screen name="Finance" component={FinanceScreen} />
      <Tab.Screen name="Présence" component={AttendanceScreen} />
      <Tab.Screen name="Plus" component={MoreScreen} />
    </Tab.Navigator>
  );
}

export default function StudentNavigator({ initialTab } = {}) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StudentTabs">
        {() => <StudentTabs initialRouteName={initialTab} />}
      </Stack.Screen>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Cours" component={CoursesScreen} />
      <Stack.Screen name="Planning" component={PlanningScreen} />
      <Stack.Screen name="Documents" component={DocumentsScreen} />
      <Stack.Screen name="Messages" component={MessagesScreen} />
      <Stack.Screen name="CarteEtudiant" component={StudentCardScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="ELearning" component={ELearningHomeScreen} />
      <Stack.Screen name="CoursesList" component={CoursesListScreen} />
      <Stack.Screen name="CourseDetail" component={CourseDetailScreen} />
      <Stack.Screen name="LessonPlayer" component={LessonPlayerScreen} />
      <Stack.Screen name="VirtualClassrooms" component={VirtualClassroomsScreen} />
      <Stack.Screen name="ClassroomDetail" component={ClassroomDetailScreen} />
      <Stack.Screen name="Assignments" component={AssignmentsScreen} />
      <Stack.Screen name="AssignmentDetail" component={AssignmentDetailScreen} />
      <Stack.Screen name="Quizzes" component={QuizzesScreen} />
      <Stack.Screen name="QuizTake" component={QuizTakeScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Exams" component={ExamsScreen} />
      <Stack.Screen name="ExamDetail" component={ExamDetailScreen} />
      <Stack.Screen name="SecureExamTake" component={SecureExamTakeScreen} options={{ gestureEnabled: false }} />
    </Stack.Navigator>
  );
}
