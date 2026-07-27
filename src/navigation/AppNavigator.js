import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import LoadingScreen from '../components/common/LoadingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import StudentNavigator from './StudentNavigator';
import TeacherNavigator from './TeacherNavigator';
import ParentNavigator from './ParentNavigator';
import usePushNotifications from '../hooks/usePushNotifications';

const Stack = createNativeStackNavigator();

/**
 * Enregistre le token push et actualise le compteur de notifs non-lues
 * dès que l'utilisateur est connecté.
 */
function NotificationSetup({ navigationRef }) {
  const { refreshCount } = useNotifications();

  // Charge le compteur au montage
  useEffect(() => { refreshCount(); }, []);

  // onNewNotification : appelé quand une notif arrive en foreground
  usePushNotifications(navigationRef, refreshCount);
  return null;
}

export default function AppNavigator({ navigationRef }) {
  const { user, loading, isEnrolled } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }

  const type = user.user_type?.toLowerCase();
  // isEnrolled is null until resolved for a student — treat that
  // as "not blocked yet" rather than forcing the Finance tab prematurely.
  const studentFeeBlocked = type === 'student' && isEnrolled === false;

  return (
    <>
      {/* Enregistrement push uniquement après authentification */}
      <NotificationSetup navigationRef={navigationRef} />

      {type === 'teacher'
        ? <TeacherNavigator />
        : type === 'parent'
          ? <ParentNavigator />
          // Not yet enrolled (cumulative payments below the minimum
          // threshold), OR échéancier de scolarité en retard for an
          // ELEARNING/HYBRIDE student: the full tab bar stays
          // (Accueil/Notes/Finance/Présence/Plus) so navigation is never a
          // dead end and the student can still reach Finance to pay — only
          // the e-learning module itself is locked (StudentNavigator's "Plus"
          // menu + ELearningHomeScreen already hide/block it based on
          // tuitionUpToDate/echeanceOverride). The backend gate
          // (IsEnrolledOrExempt / élearning permission) still blocks every
          // gated endpoint regardless of which tab they're on.
          : <StudentNavigator initialTab={studentFeeBlocked ? 'Finance' : undefined} />}
    </>
  );
}
