import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import notificationsService from '../../services/notifications';
import { useNotifications } from '../../contexts/NotificationContext';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, radius } from '../../theme/colors';

const GRADIENT = ['#7C2D12', '#B45309', '#D97706'];

const NOTIF_ICONS = {
  GRADE:      { icon: 'star-outline',               color: '#7C3AED', bg: '#F5F3FF' },
  PAYMENT:    { icon: 'wallet-outline',              color: '#059669', bg: '#D1FAE5' },
  ATTENDANCE: { icon: 'checkbox-outline',            color: '#0891B2', bg: '#E0F2FE' },
  DOCUMENT:   { icon: 'document-text-outline',       color: '#6366F1', bg: '#EEF2FF' },
  MESSAGE:    { icon: 'chatbubbles-outline',          color: '#EA580C', bg: '#FFF7ED' },
  SYSTEM:     { icon: 'information-circle-outline',  color: '#64748B', bg: '#F1F5F9' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1)  return 'À l\'instant';
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h / 24)}j`;
}

function groupByDate(list) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const groups = {};
  list.forEach((n) => {
    const d = n.created_at ? new Date(n.created_at) : null;
    let key = 'Anciennes';
    if (d) {
      const day = new Date(d); day.setHours(0, 0, 0, 0);
      if (day.getTime() === today.getTime()) key = "Aujourd'hui";
      else if (day.getTime() === yesterday.getTime()) key = 'Hier';
      else key = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(n);
  });
  return groups;
}

export default function TeacherNotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);
  const { refreshCount } = useNotifications();

  const fetchData = useCallback(async () => {
    try {
      const [all, count] = await Promise.allSettled([
        notificationsService.getAll(),
        notificationsService.getUnreadCount(),
      ]);
      if (all.status === 'fulfilled')   setNotifications(all.value?.results || all.value || []);
      if (count.status === 'fulfilled') { setUnread(count.value?.count || 0); refreshCount(); }
    } catch (e) {
      console.log('Notifications error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const markRead = async (id) => {
    try {
      await notificationsService.markRead(id);
      setNotifications((p) => p.map((n) => n.id === id ? { ...n, is_read: true } : n));
      setUnread((p) => Math.max(0, p - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await notificationsService.markAllRead();
      setNotifications((p) => p.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch {}
  };

  const grouped = groupByDate(notifications);
  const sections = Object.entries(grouped);

  const flatData = sections.flatMap(([title, items]) => [
    { type: 'header', title },
    ...items.map((n) => ({ type: 'item', ...n })),
  ]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={GRADIENT} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Notifications</Text>
              {unread > 0 && <Text style={styles.headerSub}>{unread} non lue{unread > 1 ? 's' : ''}</Text>}
            </View>
            {unread > 0 && (
              <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
                <Text style={styles.markAllText}>Tout lire</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.warning} size="large" /></View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(item, i) => item.type === 'header' ? `h-${item.title}` : String(item.id || i)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.warning} />}
          ListEmptyComponent={<EmptyState icon="notifications-outline" title="Aucune notification" subtitle="Vos notifications apparaîtront ici" />}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <Text style={styles.sectionTitle}>{item.title}</Text>;
            }
            const cfg = NOTIF_ICONS[item.notification_type] || NOTIF_ICONS.SYSTEM;
            return (
              <TouchableOpacity
                style={[styles.notifCard, !item.is_read && styles.notifCardUnread]}
                onPress={() => { if (!item.is_read) markRead(item.id); }}
                activeOpacity={0.75}
              >
                {!item.is_read && <View style={styles.unreadAccent} />}
                <View style={[styles.notifIcon, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.notifTopRow}>
                    <Text style={styles.notifTitle} numberOfLines={1}>{item.title || item.notification_type}</Text>
                    {!item.is_read && <View style={styles.unreadDot} />}
                  </View>
                  {item.body && <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>}
                  <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: spacing.sm },
  iconBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  markAllBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  markAllText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  list: { padding: spacing.md, gap: 6, paddingBottom: 32 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 4, marginLeft: 2 },

  notifCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1, overflow: 'hidden' },
  notifCardUnread: { backgroundColor: '#FFFBEB' },
  unreadAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: '#D97706' },
  notifIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  notifTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  notifTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D97706' },
  notifBody: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  notifTime: { fontSize: 11, color: colors.textTertiary, marginTop: 4 },
});
