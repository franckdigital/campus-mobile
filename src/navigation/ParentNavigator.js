import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme/colors';

import DashboardScreen from '../screens/parent/DashboardScreen';
import ChildrenScreen from '../screens/parent/ChildrenScreen';
import FinanceScreen from '../screens/parent/FinanceScreen';
import ProfileScreen from '../screens/parent/ProfileScreen';
import GradesScreen from '../screens/parent/GradesScreen';
import NotificationsScreen from '../screens/parent/NotificationsScreen';
import AttendanceScreen from '../screens/parent/AttendanceScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const PARENT_COLOR = '#059669';

const TAB_ICONS = {
  Accueil:  ['home',     'home-outline'],
  Enfants:  ['people',   'people-outline'],
  Présences: ['checkbox', 'checkbox-outline'],
  Finance:  ['wallet',   'wallet-outline'],
  Plus:     ['grid',     'grid-outline'],
};

const MORE_ITEMS = [
  { label: 'Notes enfants', icon: 'bar-chart-outline', screen: 'Notes', color: '#059669', bg: '#D1FAE5' },
  { label: 'Notifications', icon: 'notifications-outline', screen: 'Notifications', color: '#6366F1', bg: '#EEF2FF' },
  { label: 'Mon profil',    icon: 'person-outline', screen: 'Profile', color: '#0891B2', bg: '#E0F2FE' },
];

function MoreScreen({ navigation }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={['#064E3B', '#065F46', '#059669']} style={{ paddingHorizontal: spacing.lg }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', paddingTop: spacing.md, paddingBottom: spacing.lg }}>Menu</Text>
        </SafeAreaView>
      </LinearGradient>
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
        {MORE_ITEMS.map((item) => (
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
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function ParentTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: PARENT_COLOR,
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
          const [a, b] = TAB_ICONS[route.name] || ['ellipse', 'ellipse-outline'];
          return <Ionicons name={focused ? a : b} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Accueil" component={DashboardScreen} />
      <Tab.Screen name="Enfants" component={ChildrenScreen} />
      <Tab.Screen name="Présences" component={AttendanceScreen} />
      <Tab.Screen name="Finance" component={FinanceScreen} />
      <Tab.Screen name="Plus" component={MoreScreen} />
    </Tab.Navigator>
  );
}

export default function ParentNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ParentTabs" component={ParentTabs} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Finance" component={FinanceScreen} />
      <Stack.Screen name="Notes" component={GradesScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
