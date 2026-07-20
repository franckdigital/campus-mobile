import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, Modal, FlatList, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import elearningService from '../../../services/elearning';
import EmptyState from '../../../components/common/EmptyState';
import { colors, spacing, radius } from '../../../theme/colors';

function classroomStatus(c) {
  if (c.is_ended) return 'ended';
  const now = new Date();
  const start = new Date(c.start_time);
  const end = new Date(start.getTime() + (c.duration_minutes || 60) * 60000);
  if (now < start) return 'upcoming';
  if (now <= end) return 'live';
  return 'ended';
}

const STATUS_INFO = {
  live: { label: 'EN DIRECT', bg: '#D1FAE5', color: '#059669' },
  upcoming: { label: 'À VENIR', bg: '#DBEAFE', color: '#2563EB' },
  ended: { label: 'TERMINÉE', bg: '#F1F5F9', color: '#64748B' },
};

const SEGMENT_STATUS_INFO = {
  PLANIFIEE: { label: 'Planifiée', bg: '#DBEAFE', color: '#2563EB' },
  EN_ATTENTE: { label: 'En attente', bg: '#FEF3C7', color: '#D97706' },
  EN_COURS: { label: 'En cours', bg: '#D1FAE5', color: '#059669' },
  TERMINEE: { label: 'Terminée', bg: '#F1F5F9', color: '#64748B' },
  ANNULEE: { label: 'Annulée', bg: '#FEE2E2', color: '#DC2626' },
};

function formatTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function ChatModal({ visible, classroomId, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef();

  const load = useCallback(async () => {
    try {
      const res = await elearningService.getClassroomChat(classroomId);
      setMessages(res?.results ?? res ?? []);
    } catch (e) {
      console.log('Chat load error:', e.message);
    }
  }, [classroomId]);

  useEffect(() => {
    if (!visible) return;
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [visible, load]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await elearningService.sendClassroomChat(classroomId, text.trim());
      setText('');
      await load();
    } catch (e) {
      console.log('Chat send error:', e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.chatContainer} edges={['top', 'bottom']}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatTitle}>Chat en direct</Text>
          <TouchableOpacity onPress={onClose} style={styles.chatCloseBtn}>
            <Ionicons name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item, i) => String(item.id ?? i)}
            contentContainerStyle={styles.chatList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={<EmptyState icon="chatbubbles-outline" title="Aucun message" subtitle="Démarrez la conversation" />}
            renderItem={({ item }) => (
              <View style={styles.chatMsg}>
                <Text style={styles.chatSender}>{item.sender_name || 'Anonyme'}</Text>
                <View style={styles.chatBubble}>
                  <Text style={styles.chatBubbleText}>{item.message}</Text>
                </View>
              </View>
            )}
          />
          <View style={styles.chatInputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Écrire un message..."
              style={styles.chatInput}
              onSubmitEditing={send}
            />
            <TouchableOpacity style={styles.chatSendBtn} onPress={send} disabled={sending || !text.trim()}>
              {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={16} color="#fff" />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export default function ClassroomDetailScreen({ route, navigation }) {
  const { classroomId } = route.params || {};
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [joining, setJoining] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await elearningService.getClassroomById(classroomId);
      setClassroom(res);
    } catch (e) {
      console.log('Classroom detail error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#2563EB" size="large" /></View>;
  }
  if (!classroom) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={{ padding: spacing.md }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnLight}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        </SafeAreaView>
        <EmptyState icon="alert-circle-outline" title="Classe introuvable" />
      </View>
    );
  }

  const st = STATUS_INFO[classroomStatus(classroom)];
  const segments = (classroom.segments || []).slice().sort((a, b) => a.sequence - b.sequence);
  const doneSegments = segments.filter((s) => s.status === 'TERMINEE').length;
  const progressPercent = segments.length > 0 ? Math.round((doneSegments / segments.length) * 100) : 0;

  const joinSegment = async (segment) => {
    setJoining(segment.id);
    try {
      const res = await elearningService.joinSegment(segment.id);
      const url = res?.meeting_url || segment.meeting_url || classroom.join_url;
      if (url) Linking.openURL(url);
    } catch (e) {
      console.log('Join segment error:', e.message);
    } finally {
      setJoining(null);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1E3A8A', '#2563EB', '#3B82F6']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
              <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
            </View>
            <TouchableOpacity onPress={() => setChatOpen(true)} style={styles.backBtn}>
              <Ionicons name="chatbubbles-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>{classroom.title}</Text>
          {classroom.subject_name ? <Text style={styles.subtitle}>{classroom.subject_name}</Text> : null}
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 32, gap: spacing.sm }}>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Date & heure</Text>
              <Text style={styles.infoValue}>{formatDateTime(classroom.start_time)}</Text>
            </View>
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Durée</Text>
              <Text style={styles.infoValue}>{classroom.duration_minutes} min</Text>
            </View>
          </View>
        </View>

        {classroomStatus(classroom) === 'ended' && (
          <TouchableOpacity
            style={[styles.recordingBtn, !classroom.recording_url && styles.recordingBtnDisabled]}
            disabled={!classroom.recording_url}
            onPress={() => classroom.recording_url && Linking.openURL(classroom.recording_url)}
          >
            <Ionicons name="play-circle-outline" size={18} color={classroom.recording_url ? '#2563EB' : colors.textTertiary} />
            <Text style={[styles.recordingBtnText, !classroom.recording_url && { color: colors.textTertiary }]}>
              {classroom.recording_url ? 'Voir l\'enregistrement' : 'Enregistrement non disponible'}
            </Text>
          </TouchableOpacity>
        )}

        {classroomStatus(classroom) === 'live' && classroom.join_url && (
          <TouchableOpacity style={styles.mainJoinBtn} onPress={() => Linking.openURL(classroom.join_url)}>
            <Ionicons name="radio" size={16} color="#fff" />
            <Text style={styles.mainJoinBtnText}>Rejoindre la classe</Text>
          </TouchableOpacity>
        )}

        {segments.length > 0 && (
          <>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Progression du cours</Text>
              <Text style={styles.progressValue}>{doneSegments}/{segments.length} sessions · {progressPercent}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Sessions</Text>
        {segments.length === 0 ? (
          <EmptyState icon="calendar-outline" title="Aucune session planifiée" />
        ) : (
          segments.map((seg) => {
            const segSt = SEGMENT_STATUS_INFO[seg.status] || SEGMENT_STATUS_INFO.PLANIFIEE;
            return (
              <View key={seg.id} style={styles.segmentCard}>
                <View style={styles.segmentBadgeCircle}>
                  <Text style={styles.segmentBadgeCircleText}>{seg.sequence}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.segmentTitleRow}>
                    <Text style={styles.segmentTitle}>Session {seg.sequence}</Text>
                    <View style={[styles.segStatusBadge, { backgroundColor: segSt.bg }]}>
                      <Text style={[styles.segStatusText, { color: segSt.color }]}>{segSt.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.segmentMeta}>
                    {formatTime(seg.start_time)} – {formatTime(seg.end_time)} ({seg.duration_minutes} min)
                  </Text>
                </View>
                {seg.status === 'EN_COURS' && (
                  <TouchableOpacity style={styles.segJoinBtn} onPress={() => joinSegment(seg)} disabled={joining === seg.id}>
                    {joining === seg.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.segJoinBtnText}>Rejoindre</Text>}
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <ChatModal visible={chatOpen} classroomId={classroomId} onClose={() => setChatOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  backBtnLight: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.divider, alignItems: 'center', justifyContent: 'center' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full },
  statusText: { fontSize: 11, fontWeight: '700' },
  title: { fontSize: 19, fontWeight: '800', color: '#fff', marginTop: spacing.md },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 3 },

  infoCard: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md },
  infoRow: { flexDirection: 'row', gap: spacing.lg },
  infoBlock: { flex: 1 },
  infoLabel: { fontSize: 11, color: colors.textTertiary, marginBottom: 3 },
  infoValue: { fontSize: 14, fontWeight: '700', color: colors.text },

  recordingBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EEF2FF', borderRadius: radius.md, paddingVertical: 12 },
  recordingBtnDisabled: { backgroundColor: colors.divider },
  recordingBtnText: { fontSize: 13, fontWeight: '700', color: '#2563EB' },

  mainJoinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#059669', borderRadius: radius.md, paddingVertical: 14 },
  mainJoinBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  progressLabel: { fontSize: 12, color: colors.textSecondary },
  progressValue: { fontSize: 12, fontWeight: '700', color: colors.text },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.divider, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#2563EB', borderRadius: 3 },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  segmentCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  segmentBadgeCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  segmentBadgeCircleText: { fontSize: 13, fontWeight: '800', color: '#2563EB' },
  segmentTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  segmentTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  segStatusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  segStatusText: { fontSize: 9, fontWeight: '700' },
  segmentMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  segJoinBtn: { backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md },
  segJoinBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  chatContainer: { flex: 1, backgroundColor: '#fff' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  chatTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  chatCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.divider, alignItems: 'center', justifyContent: 'center' },
  chatList: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  chatMsg: { gap: 2 },
  chatSender: { fontSize: 11, fontWeight: '700', color: '#DB2777' },
  chatBubble: { backgroundColor: '#fdf2f8', borderRadius: radius.md, padding: 10, alignSelf: 'flex-start', maxWidth: '85%' },
  chatBubbleText: { fontSize: 13, color: colors.text },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  chatInput: { flex: 1, backgroundColor: colors.divider, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 },
  chatSendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#DB2777', alignItems: 'center', justifyContent: 'center' },
});
