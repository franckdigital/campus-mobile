import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import messagesService from '../../services/messages';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, radius } from '../../theme/colors';
import { useAuth } from '../../contexts/AuthContext';

export default function StudentMessagesScreen({ navigation }) {
  const [view, setView] = useState('list'); // 'list' | 'thread'
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const listRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await messagesService.getConversations();
      setConversations(data?.results || data || []);
    } catch (e) {
      console.log('Messages error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchMessages = useCallback(async (convId) => {
    try {
      const data = await messagesService.getMessages(convId);
      const list = data?.results || data || [];
      setMessages(list.reverse());
      await messagesService.markRead(convId);
    } catch (e) {
      console.log('Thread error:', e.message);
    }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const openConversation = (conv) => {
    setActiveConv(conv);
    setView('thread');
    fetchMessages(conv.id);
  };

  const goBack = () => {
    setView('list');
    setActiveConv(null);
    setMessages([]);
    fetchConversations();
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !activeConv) return;
    const text = newMsg.trim();
    setNewMsg('');
    setSending(true);
    try {
      const sent = await messagesService.sendMessage(activeConv.id, { content: text });
      setMessages((prev) => [...prev, sent]);
      listRef.current?.scrollToEnd({ animated: true });
    } catch (e) {
      setNewMsg(text);
    } finally {
      setSending(false);
    }
  };

  const myId = user?.id;

  if (view === 'thread' && activeConv) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <LinearGradient colors={['#3730A3', '#4F46E5', '#6D28D9']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <SafeAreaView edges={['top']}>
              <View style={styles.headerRow}>
                <TouchableOpacity onPress={goBack} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.headerTitle} numberOfLines={1}>{activeConv.subject || activeConv.title || 'Conversation'}</Text>
                  {activeConv.participants_display && (
                    <Text style={styles.headerSub} numberOfLines={1}>{activeConv.participants_display}</Text>
                  )}
                </View>
              </View>
            </SafeAreaView>
          </LinearGradient>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.threadList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={<View style={styles.center}><Text style={styles.emptyText}>Pas encore de messages</Text></View>}
            renderItem={({ item }) => {
              const isMe = item.sender === myId || item.sender?.id === myId;
              return (
                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                  {!isMe && (
                    <Text style={styles.senderName}>{item.sender_name || item.sender?.username || ''}</Text>
                  )}
                  <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.content}</Text>
                  <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
                    {item.created_at ? new Date(item.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </Text>
                </View>
              );
            }}
          />

          <View style={styles.inputRow}>
            <TextInput
              style={styles.msgInput}
              value={newMsg}
              onChangeText={setNewMsg}
              placeholder="Votre message..."
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={500}
            />
            <TouchableOpacity style={[styles.sendBtn, !newMsg.trim() && { opacity: 0.4 }]} onPress={sendMessage} disabled={!newMsg.trim() || sending}>
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#3730A3', '#4F46E5', '#6D28D9']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Messages</Text>
            <View style={{ width: 38 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchConversations(); }} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="chatbubbles-outline" title="Aucune conversation" subtitle="Vos échanges avec l'administration apparaîtront ici" />}
          renderItem={({ item }) => {
            const unread = item.unread_count || 0;
            return (
              <TouchableOpacity style={styles.convCard} onPress={() => openConversation(item)}>
                <View style={styles.convAvatar}>
                  <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.convSubject, unread > 0 && { fontWeight: '700' }]} numberOfLines={1}>
                    {item.subject || item.title || 'Conversation'}
                  </Text>
                  <Text style={styles.convPreview} numberOfLines={1}>
                    {item.last_message?.content || item.last_message_preview || ''}
                  </Text>
                  {item.last_message?.created_at && (
                    <Text style={styles.convTime}>
                      {new Date(item.last_message.created_at).toLocaleDateString('fr-FR')}
                    </Text>
                  )}
                </View>
                {unread > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{unread}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
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
  header: { paddingHorizontal: spacing.lg, paddingBottom: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: spacing.sm, paddingBottom: spacing.md },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff', flex: 1 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  list: { padding: spacing.md, gap: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: colors.textSecondary },
  convCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  convAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  convSubject: { fontSize: 14, fontWeight: '600', color: colors.text },
  convPreview: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  convTime: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  unreadBadge: { backgroundColor: colors.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  threadList: { padding: spacing.md, gap: 12, paddingBottom: 20 },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 12, gap: 4 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleThem: { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  senderName: { fontSize: 11, fontWeight: '600', color: colors.primary },
  bubbleText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  bubbleTime: { fontSize: 10, color: colors.textTertiary, alignSelf: 'flex-end' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.6)' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.divider },
  msgInput: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, color: colors.text, maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
