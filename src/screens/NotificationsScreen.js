import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import notificationsService from '../services/notifications';
import { colors, spacing, radius } from '../theme/colors';

const NOTIF_ICONS = {
  ABSENCE:  { icon: 'calendar-outline',        color: '#EF4444', bg: '#FEE2E2' },
  GRADE:    { icon: 'bar-chart-outline',        color: '#7C3AED', bg: '#EDE9FE' },
  PAYMENT:  { icon: 'wallet-outline',           color: '#059669', bg: '#D1FAE5' },
  SYSTEM:   { icon: 'information-circle-outline', color: '#0EA5E9', bg: '#E0F2FE' },
  MESSAGE:  { icon: 'chatbubble-outline',       color: '#D97706', bg: '#FEF3C7' },
  DEFAULT:  { icon: 'notifications-outline',   color: '#6B7280', bg: '#F1F5F9' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'À l\'instant';
  if (mins < 60) return `Il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `Il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
}

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [filter, setFilter]               = useState('all');

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationsService.getAll();
      setNotifications(res?.results || res || []);
    } catch (e) {
      console.log('notif error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  const onRefresh = () => { setRefreshing(true); fetchNotifications(); };

  const markRead = async (id) => {
    try {
      await notificationsService.markRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await notificationsService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {}
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const filtered = filter === 'all' ? notifications : notifications.filter((n) => !n.is_read);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1E1B4B', '#4338CA', '#4F46E5']} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <Text style={styles.headerSub}>{unreadCount} non lu{unreadCount > 1 ? 'es' : 'e'}</Text>
              )}
            </View>
            {unreadCount > 0 && (
              <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
                <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
                <Text style={styles.markAllText}>Tout lire</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Filter */}
          <View style={styles.filterRow}>
            {[['all', `Toutes (${notifications.length})`], ['unread', `Non lues (${unreadCount})`]].map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.filterTab, filter === key && styles.filterTabActive]}
                onPress={() => setFilter(key)}
              >
                <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <LinearGradient colors={['#EDE9FE', '#DDD6FE']} style={styles.emptyIcon}>
                <Ionicons name="notifications-off-outline" size={36} color="#7C3AED" />
              </LinearGradient>
              <Text style={styles.emptyTitle}>Aucune notification</Text>
              <Text style={styles.emptyText}>Vous êtes à jour !</Text>
            </View>
          }
          renderItem={({ item }) => {
            const typeKey = item.notification_type || item.type || 'DEFAULT';
            const cfg = NOTIF_ICONS[typeKey.toUpperCase()] || NOTIF_ICONS.DEFAULT;
            return (
              <TouchableOpacity
                style={[styles.notifCard, !item.is_read && styles.notifCardUnread]}
                onPress={() => markRead(item.id)}
                activeOpacity={0.85}
              >
                {!item.is_read && <View style={styles.unreadDot} />}
                <View style={[styles.notifIcon, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={20} color={cfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.notifTitle, !item.is_read && styles.notifTitleUnread]}>
                    {item.title || item.subject || 'Notification'}
                  </Text>
                  <Text style={styles.notifBody} numberOfLines={2}>
                    {item.message || item.body || ''}
                  </Text>
                  <Text style={styles.notifTime}>{timeAgo(item.created_at || item.sent_at)}</Text>
                </View>
                {!item.is_read && (
                  <View style={[styles.unreadBadge, { backgroundColor: cfg.color }]} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: spacing.sm, marginBottom: spacing.sm },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md },
  markAllText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.1)' },
  filterTabActive: { backgroundColor: '#fff' },
  filterText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  filterTextActive: { color: '#4338CA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 14, color: colors.textSecondary },
  notifCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1, position: 'relative' },
  notifCardUnread: { backgroundColor: '#FAFAFF', borderWidth: 1, borderColor: '#DDD6FE' },
  unreadDot: { position: 'absolute', top: 12, left: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: '#4F46E5' },
  notifIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  notifTitleUnread: { fontWeight: '700' },
  notifBody: { fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  notifTime: { fontSize: 11, color: colors.textTertiary, marginTop: 4 },
  unreadBadge: { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },
});
