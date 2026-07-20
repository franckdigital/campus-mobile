import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../services/auth';
import studentService from '../services/student';
import { unregisterPushToken } from '../hooks/usePushNotifications';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // null = not a student / not yet known; true/false once resolved for a student
  const [registrationFeePaid, setRegistrationFeePaid] = useState(null);
  // Échéancier de scolarité — only used to lock e-learning resources for
  // ELEARNING-modality students, see AppNavigator.
  const [studentModality, setStudentModality] = useState(null);
  const [tuitionUpToDate, setTuitionUpToDate] = useState(true);
  const [echeanceOverride, setEcheanceOverride] = useState(false);

  const loadStudentFeeStatus = useCallback(async (profile) => {
    if (profile?.user_type?.toLowerCase() !== 'student') {
      setRegistrationFeePaid(null);
      setStudentModality(null);
      setTuitionUpToDate(true);
      setEcheanceOverride(false);
      return;
    }
    try {
      const student = await studentService.getMe();
      setRegistrationFeePaid(!!student?.registration_fee_paid);
      setStudentModality(student?.modality || null);
      setTuitionUpToDate(student?.tuition_up_to_date ?? true);
      setEcheanceOverride(!!student?.echeance_override);
    } catch {
      // Fail open — the backend still enforces the real gate; don't lock the
      // whole app out just because this lookup failed.
      setRegistrationFeePaid(true);
      setTuitionUpToDate(true);
    }
  }, []);

  const loadUser = useCallback(async () => {
    try {
      const access = await AsyncStorage.getItem('access_token');
      if (!access) { setLoading(false); return; }
      const profile = await authService.getProfile();
      setUser(profile);
      await loadStudentFeeStatus(profile);
    } catch {
      await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
    } finally {
      setLoading(false);
    }
  }, [loadStudentFeeStatus]);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email, password) => {
    const result = await authService.login(email, password);
    setUser(result.user);
    await loadStudentFeeStatus(result.user);
    return result.user;
  };

  const logout = async () => {
    // Désinscrit le token push avant de couper la session
    await unregisterPushToken();
    try {
      await authService.logout();
    } catch {}
    setUser(null);
    setRegistrationFeePaid(null);
    setStudentModality(null);
    setTuitionUpToDate(true);
    setEcheanceOverride(false);
  };

  const refreshUser = async () => {
    const profile = await authService.getProfile();
    setUser(profile);
    await loadStudentFeeStatus(profile);
    return profile;
  };

  const userType = user?.user_type?.toLowerCase();

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout, refreshUser, userType,
      registrationFeePaid, setRegistrationFeePaid,
      studentModality, tuitionUpToDate, echeanceOverride,
      refreshRegistrationFeeStatus: () => loadStudentFeeStatus(user),
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export default AuthContext;
