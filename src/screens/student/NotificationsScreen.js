import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import Alert from '../../utils/appAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import notificationsService from '../../services/notifications';
import { useNotifications } from '../../contexts/NotificationContext';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, radius } from '../../theme/colors';

const NOTIF_ICONS = {
  GRADE:      { icon: 'bar-chart-outline',       color: '#4F46E5', bg: '#EEF2FF' },
  PAYMENT:    { icon: 'wallet-outline',           color: '#059669', bg: '#F0FDF4' },
  ATTENDANCE: { icon: 'checkbox-outline',         color: '#0891B2', bg: '#ECFEFF' },
  DOCUMENT:   { icon: 'document-text-outline',    color: '#7C3AED', bg: '#EDE9FE' },
  MESSAGE:    { icon: 'chatbubbles-outline',       color: '#EA580C', bg: '#FFF7ED' },
  SYSTEM:     { icon: 'information-circle-outline',color: '#64748B', bg: '#F1F5F9' },
};

function getIconCfg(type) {
  return NOTIF_ICONS[type] || NOTIF_ICONS.SYSTEM;
}

// Échéancier de scolarité reminders are urgent (risk of losing e-learning
// access / évaluation access) — surfaced in a distinct red/white card above
// everything else instead of blending into the normal date-grouped list.
function isEcheancierReminder(n) {
  return n.notification_type === 'REMINDER' && n.data?.category === 'echeancier_reminder';
}

function groupByDate(notifications) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = {};
  notifications.forEach((n) => {
    const d = new Date(n.created_at || n.timestamp || Date.now());
    d.setHours(0, 0, 0, 0);
    let key;
    if (d.getTime() === today.getTime()) key = "Aujourd'hui";
    else if (d.getTime() === yesterday.getTime()) key = 'Hier';
    else key = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(n);
  });

  return Object.entries(groups).map(([title, data]) => ({ title, data }));
}

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const { refreshCount } = useNotifications();

  const fetchData = useCallback(async () => {
    try {
      const res = await notificationsService.getAll();
      setNotifications(res?.results || res || []);
      refreshCount();
    } catch (e) {
      console.log('Notifications error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleMarkRead = async (id) => {
    try {
      await notificationsService.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {}
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await notificationsService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de marquer toutes les notifications comme lues.');
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const priorityNotifs = notifications.filter(isEcheancierReminder);
  const groups = groupByDate(notifications.filter((n) => !isEcheancierReminder(n)));

  const renderPriorityItem = (item) => {
    const time = item.created_at || item.timestamp
      ? new Date(item.created_at || item.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : '';
    return (
      <TouchableOpacity
        key={String(item.id)}
        style={styles.priorityCard}
        onPress={() => !item.is_read && handleMarkRead(item.id)}
        activeOpacity={0.85}
      >
        <View style={styles.priorityIconWrap}>
          <Ionicons name="alert-circle" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.notifTopRow}>
            <Text style={styles.priorityTitle} numberOfLines={1}>{item.title || 'Rappel'}</Text>
            <Text style={styles.priorityTime}>{time}</Text>
          </View>
          <Text style={styles.priorityMessage} numberOfLines={3}>
            {item.message || item.body || ''}
          </Text>
        </View>
        {!item.is_read && <View style={styles.priorityUnreadDot} />}
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }) => {
    const cfg = getIconCfg(item.notification_type || item.type);
    const time = item.created_at || item.timestamp
      ? new Date(item.created_at || item.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.is_read && styles.notifCardUnread]}
        onPress={() => !item.is_read && handleMarkRead(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.notifIconWrap, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={20} color={cfg.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.notifTopRow}>
            <Text style={[styles.notifTitle, !item.is_read && styles.notifTitleUnread]} numberOfLines={1}>
              {item.title || 'Notification'}
            </Text>
            <Text style={styles.notifTime}>{time}</Text>
          </View>
          <Text style={styles.notifMessage} numberOfLines={2}>
            {item.message || item.body || ''}
          </Text>
        </View>
        {!item.is_read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const renderGroup = ({ item: group }) => (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{group.title}</Text>
      {group.data.map((n) => (
        <React.Fragment key={String(n.id)}>
          {renderItem({ item: n })}
        </React.Fragment>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#3730A3', '#4F46E5', '#6D28D9']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <Text style={styles.headerSub}>{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</Text>
              )}
            </View>
            {unreadCount > 0 && (
              <TouchableOpacity
                style={styles.markAllBtn}
                onPress={handleMarkAllRead}
                disabled={markingAll}
              >
                {markingAll
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.markAllText}>Tout lire</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.title}
          renderItem={renderGroup}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            priorityNotifs.length > 0 ? (
              <View style={styles.group}>
                {priorityNotifs.map(renderPriorityItem)}
              </View>
            ) : null
          }
          ListEmptyComponent={
            priorityNotifs.length === 0 ? (
              <EmptyState
                icon="notifications-off-outline"
                title="Aucune notification"
                subtitle="Vous n'avez aucune notification pour le moment"
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: spacing.sm, paddingBottom: spacing.md },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  markAllBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  markAllText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, paddingBottom: 32, gap: spacing.md },

  group: { gap: 8 },
  groupTitle: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: 2 },

  notifCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#fff', borderRadius: radius.lg, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  notifCardUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  notifIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  notifTitle: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.text },
  notifTitleUnread: { fontWeight: '700' },
  notifTime: { fontSize: 11, color: colors.textTertiary, marginLeft: 8 },
  notifMessage: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6, flexShrink: 0 },

  // Échéancier de scolarité reminders — red frame, white text, always above
  // the rest regardless of date.
  priorityCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#DC2626', borderRadius: radius.lg, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  priorityIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: 'rgba(255,255,255,0.2)' },
  priorityTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#fff' },
  priorityTime: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginLeft: 8 },
  priorityMessage: { fontSize: 13, color: 'rgba(255,255,255,0.92)', lineHeight: 18 },
  priorityUnreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', marginTop: 6, flexShrink: 0 },
});
