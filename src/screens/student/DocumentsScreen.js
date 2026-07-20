import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Linking,
} from 'react-native';
import Alert from '../../utils/appAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import documentsService from '../../services/documents';
import studentService from '../../services/student';
import EmptyState from '../../components/common/EmptyState';
import { colors, spacing, radius } from '../../theme/colors';

const TABS = [
  { key: 'files', label: 'Mes fichiers', icon: 'folder-outline' },
  { key: 'ged', label: 'Documents', icon: 'documents-outline' },
];

const FILE_TYPE_ICONS = {
  DIPLOMA: { icon: 'ribbon-outline', color: '#7C3AED', bg: '#EDE9FE' },
  TRANSCRIPT: { icon: 'school-outline', color: '#0EA5E9', bg: '#E0F2FE' },
  ID: { icon: 'card-outline', color: '#F59E0B', bg: '#FEF3C7' },
  PHOTO: { icon: 'image-outline', color: '#10B981', bg: '#D1FAE5' },
  ENROLLMENT: { icon: 'document-text-outline', color: '#4F46E5', bg: '#EEF2FF' },
  OTHER: { icon: 'attach-outline', color: '#6B7280', bg: '#F3F4F6' },
};

function getFileTypeStyle(type) {
  return FILE_TYPE_ICONS[type] || FILE_TYPE_ICONS.OTHER;
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StudentDocumentsScreen({ navigation }) {
  const [tab, setTab] = useState('files');
  const [files, setFiles] = useState([]);
  const [gedDocs, setGedDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [studentId, setStudentId] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const me = await studentService.getMe();
      setStudentId(me.id);
      const [f, g] = await Promise.allSettled([
        documentsService.getStudentFiles({ student: me.id }),
        documentsService.getStudentDocuments({ student: me.id }),
      ]);
      if (f.status === 'fulfilled') setFiles(f.value?.results || f.value || []);
      if (g.status === 'fulfilled') setGedDocs(g.value?.results || g.value || []);
    } catch (e) {
      console.log('Documents error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const openFile = async (url) => {
    if (!url) { Alert.alert('Erreur', 'URL du fichier non disponible.'); return; }
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert('Erreur', 'Impossible d\'ouvrir ce fichier.');
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir ce fichier.');
    }
  };

  const grouped = files.reduce((acc, f) => {
    const key = f.file_type || 'OTHER';
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#3730A3', '#4F46E5', '#6D28D9']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Documents</Text>
            <View style={{ width: 38 }} />
          </View>
          <View style={styles.tabs}>
            {TABS.map((t) => (
              <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
                <Ionicons name={t.icon} size={14} color={tab === t.key ? colors.primary : 'rgba(255,255,255,0.7)'} />
                <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : tab === 'files' ? (
        <FlatList
          data={Object.keys(grouped)}
          keyExtractor={(k) => k}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="folder-open-outline" title="Aucun fichier" subtitle="Vos documents seront affichés ici" />}
          renderItem={({ item: typeKey }) => {
            const style = getFileTypeStyle(typeKey);
            const typeFiles = grouped[typeKey];
            const label = {
              DIPLOMA: 'Diplômes', TRANSCRIPT: 'Relevés de notes', ID: 'Pièces d\'identité',
              PHOTO: 'Photos', ENROLLMENT: 'Inscriptions', OTHER: 'Autres',
            }[typeKey] || typeKey;
            return (
              <View style={styles.group}>
                <View style={styles.groupHeader}>
                  <View style={[styles.groupIcon, { backgroundColor: style.bg }]}>
                    <Ionicons name={style.icon} size={16} color={style.color} />
                  </View>
                  <Text style={styles.groupTitle}>{label}</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{typeFiles.length}</Text>
                  </View>
                </View>
                {typeFiles.map((file) => (
                  <TouchableOpacity key={file.id} style={styles.fileCard} onPress={() => openFile(file.file_url || file.file)}>
                    <View style={[styles.fileIcon, { backgroundColor: style.bg }]}>
                      <Ionicons name={style.icon} size={20} color={style.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fileName} numberOfLines={1}>{file.name || file.original_name || `Fichier #${file.id}`}</Text>
                      <Text style={styles.fileMeta}>
                        {file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString('fr-FR') : ''}
                        {file.file_size ? ` · ${formatSize(file.file_size)}` : ''}
                      </Text>
                    </View>
                    <Ionicons name="download-outline" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          data={gedDocs}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="documents-outline" title="Aucun document" subtitle="Les documents officiels apparaîtront ici" />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.gedCard} onPress={() => openFile(item.file_url || item.file)}>
              <View style={styles.gedIconWrap}>
                <Ionicons name="document-text-outline" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gedTitle} numberOfLines={1}>{item.title || item.name || `Document #${item.id}`}</Text>
                <Text style={styles.gedSub} numberOfLines={1}>{item.document_type_name || item.category || ''}</Text>
                {item.created_at && (
                  <Text style={styles.gedDate}>{new Date(item.created_at).toLocaleDateString('fr-FR')}</Text>
                )}
              </View>
              <Ionicons name="open-outline" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, paddingBottom: spacing.md },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.md },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.15)' },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  tabTextActive: { color: colors.primary },
  list: { padding: spacing.md, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  group: { gap: 8 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  groupIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  groupTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
  countBadge: { backgroundColor: colors.divider, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  fileIcon: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fileName: { fontSize: 14, fontWeight: '600', color: colors.text },
  fileMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  gedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  gedIconWrap: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  gedTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  gedSub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  gedDate: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
});
