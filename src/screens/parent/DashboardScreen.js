import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import parentService from '../../services/parent';
import { financeService } from '../../services/finance';
import notificationsService from '../../services/notifications';
import usePushNotifications from '../../hooks/usePushNotifications';
import { colors, spacing, radius } from '../../theme/colors';

const GRADIENT = ['#1E3A8A', '#1D4ED8', '#2563EB'];

export default function ParentDashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [children, setChildren] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSite, setSelectedSite] = useState('all');

  const fetchData = useCallback(async () => {
    try {
      const [kids, count] = await Promise.allSettled([
        parentService.getMyStudents(),
        notificationsService.getUnreadCount(),
      ]);
      if (kids.status === 'fulfilled') {
        const list = kids.value?.results || kids.value || [];
        // Enrich each child with real financial totals computed from their invoices
        const summaries = await Promise.allSettled(
          list.map(child => financeService.getStudentFinancialSummary(child.id))
        );
        const enriched = list.map((child, i) => {
          const s = summaries[i].status === 'fulfilled' ? summaries[i].value : null;
          return s ? {
          ...child,
          _tuition: s.tuition_fee,
          _paid: s.total_paid,
          _remaining: s.remaining_balance,
          _configured_tuition: s.configured_tuition_fee,
          _min_enrollment_payment: s.min_enrollment_payment,
          is_enrolled: s.is_enrolled,
        } : child;
        });
        setChildren(enriched);
      }
      if (count.status === 'fulfilled') setUnreadCount(count.value?.count || 0);
    } catch (e) {
      console.log('ParentDashboard', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };
  usePushNotifications(fetchData);

  // Re-sync bell badge when returning from Notifications screen
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      notificationsService.getUnreadCount()
        .then((res) => setUnreadCount(res?.count || 0))
        .catch(() => {});
    });
    return unsub;
  }, [navigation]);

  const firstName = user?.first_name || '';
  const lastName = user?.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim() || 'Parent';
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'P';

  // Unique sites across all children
  const sites = [...new Map(children.filter(c => c.site && c.site_name).map(c => [c.site, c.site_name])).entries()]
    .map(([id, name]) => ({ id, name }));
  const multiSite = sites.length > 1;
  const visibleChildren = selectedSite === 'all' ? children : children.filter(c => String(c.site) === selectedSite);

  const enrolledCount = visibleChildren.filter((c) => c.is_enrolled || c.status === 'ACTIVE').length;
  // Use enriched _remaining when available (computed from real invoices), fallback to stale field
  const totalRemaining = visibleChildren.reduce((acc, c) => acc + parseFloat(c._remaining ?? c.remaining_balance ?? 0), 0);

  if (loading) {
    return (
      <LinearGradient colors={GRADIENT} style={styles.loadingCenter}>
        <ActivityIndicator color="#fff" size="large" />
      </LinearGradient>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      >
        {/* ── Gradient Header ─────────────────────────────────── */}
        <LinearGradient colors={GRADIENT} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <SafeAreaView edges={['top']}>
            {/* Top row */}
            <View style={styles.headerTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.greeting}>Bonjour,</Text>
                <Text style={styles.userName} numberOfLines={1}>{fullName}</Text>
                <Text style={styles.headerSub}>
                  Votre espace parent — suivi de {visibleChildren.length} enfant{visibleChildren.length > 1 ? 's' : ''}
                  {multiSite && selectedSite !== 'all' ? ` · ${sites.find(s => s.id === selectedSite)?.name || ''}` : ''}
                </Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Notifications')}>
                  <Ionicons name="notifications-outline" size={20} color="#fff" />
                  {unreadCount > 0 && (
                    <View style={styles.notifBadge}>
                      <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.avatarBtn} onPress={() => navigation.navigate('Profile')}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* KPI row */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Ionicons name="people-outline" size={22} color="rgba(255,255,255,0.8)" />
                <Text style={styles.kpiValue}>{visibleChildren.length}</Text>
                <Text style={styles.kpiLabel}>Enfants</Text>
              </View>
              <View style={[styles.kpiCard, styles.kpiDivider]}>
                <Ionicons name="checkmark-circle-outline" size={22} color="#86EFAC" />
                <Text style={[styles.kpiValue, { color: '#86EFAC' }]}>{enrolledCount}/{children.length}</Text>
                <Text style={styles.kpiLabel}>Inscrits</Text>
              </View>
              <View style={[styles.kpiCard, styles.kpiDivider]}>
                <Ionicons name="wallet-outline" size={22} color={totalRemaining > 0 ? '#FCA5A5' : '#86EFAC'} />
                <Text style={[styles.kpiValue, { color: totalRemaining > 0 ? '#FCA5A5' : '#86EFAC' }]}>
                  {totalRemaining > 0 ? `${(totalRemaining / 1000).toFixed(0)}k F` : '—'}
                </Text>
                <Text style={styles.kpiLabel}>Reste à payer</Text>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* ── Quick services ────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Accès rapide</Text>
          <View style={styles.servicesGrid}>
            {[
              { label: 'Enfants',      desc: 'Dossiers',       icon: 'people-outline',       screen: 'Enfants',        color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
              {
                label: 'Analyse IA', desc: 'Performances', icon: 'analytics-outline', screen: 'Enfants',
                color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4',
                params: visibleChildren.length === 1 ? { selectedId: visibleChildren[0].id, tab: 'analyse' } : undefined,
              },
              { label: 'Notifications',desc: 'Mes alertes',    icon: 'notifications-outline', screen: 'Notifications',  color: '#DB2777', bg: '#FDF2F8', border: '#FBCFE8' },
              { label: 'Messages',     desc: 'Communication',  icon: 'chatbubbles-outline',   screen: 'Messages',       color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
              { label: 'Profil',       desc: 'Mon compte',     icon: 'person-outline',        screen: 'Profile',        color: '#059669', bg: '#ECFDF5', border: '#86EFAC' },
            ].map((svc) => (
              <TouchableOpacity
                key={svc.label}
                style={[styles.serviceCard, { backgroundColor: svc.bg, borderColor: svc.border }]}
                onPress={() => navigation.navigate(svc.screen, svc.params)}
                activeOpacity={0.8}
              >
                <View style={[styles.serviceIconWrap, { backgroundColor: `${svc.color}18` }]}>
                  <Ionicons name={svc.icon} size={22} color={svc.color} />
                </View>
                <Text style={[styles.serviceLabel, { color: svc.color }]}>{svc.label}</Text>
                <Text style={styles.serviceDesc}>{svc.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Children list ────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Mes enfants</Text>
              <Text style={styles.sectionSub}>Appuyez sur un enfant pour voir son dossier</Text>
            </View>
          </View>

          {/* Site filter — only shown when children are spread across multiple sites */}
          {multiSite && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
              {[{ id: 'all', name: 'Tous les sites' }, ...sites].map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setSelectedSite(s.id)}
                  style={[styles.siteChip, selectedSite === s.id && styles.siteChipActive]}
                >
                  <Ionicons name="location-outline" size={12} color={selectedSite === s.id ? '#1D4ED8' : colors.textSecondary} />
                  <Text style={[styles.siteChipText, selectedSite === s.id && styles.siteChipTextActive]}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {visibleChildren.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={40} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>Aucun enfant lié</Text>
              <Text style={styles.emptySub}>Contactez l'administration</Text>
            </View>
          ) : (
            visibleChildren.map((child) => (
              <ChildCard
                key={child.id}
                child={child}
                onPress={() => navigation.navigate('Enfants', { selectedId: child.id })}
              />
            ))
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function ChildCard({ child, onPress }) {
  const name = child.user?.full_name ||
    `${child.user?.first_name || child.first_name || ''} ${child.user?.last_name || child.last_name || ''}`.trim() ||
    'Enfant';
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const paid            = parseFloat(child._paid ?? child.total_paid ?? 0);
  const isEnrolled      = !!(child.is_enrolled || child.status === 'ACTIVE');
  const configTuition   = parseFloat(child._configured_tuition ?? 0);
  const tuitionPaidCard = paid;
  const tuitionRemCard  = Math.max(0, configTuition - tuitionPaidCard);
  const tuitionPctCard  = configTuition > 0 ? Math.min(100, Math.round((tuitionPaidCard / configTuition) * 100)) : 0;

  return (
    <TouchableOpacity style={styles.childCard} onPress={onPress} activeOpacity={0.75}>
      {isEnrolled && <View style={styles.childCardAccent} />}

      <View style={styles.childCardTop}>
        <View style={styles.childAvatar}>
          <Text style={styles.childAvatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.childName} numberOfLines={1}>{name}</Text>
          {child.matricule && <Text style={styles.childMatricule}>#{child.matricule}</Text>}
          <View style={styles.childBadges}>
            {isEnrolled && (
              <View style={styles.enrolledBadge}>
                <Ionicons name="checkmark" size={10} color="#059669" />
                <Text style={styles.enrolledBadgeText}>Inscrit</Text>
              </View>
            )}
            {child.status === 'ACTIVE' && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Actif</Text>
              </View>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </View>

      {/* Financial progress */}
      <View style={styles.childFinance}>
        {/* Inscription status */}
        <View style={styles.childFinanceRow}>
          <Text style={styles.childFinanceLabel}>Inscription</Text>
          <Text style={[styles.childFinanceSub, { color: isEnrolled ? colors.success : '#D97706', fontWeight: '700' }]}>
            {isEnrolled ? 'Payée ✓' : 'En attente'}
          </Text>
        </View>
        {/* Tuition progress */}
        {configTuition > 0 && (
          <>
            <View style={[styles.childFinanceRow, { marginTop: 8 }]}>
              <Text style={styles.childFinanceLabel}>Scolarité payée</Text>
              <Text style={[styles.childFinancePct, { color: tuitionPctCard === 100 ? colors.success : tuitionPctCard >= 50 ? colors.warning : colors.danger }]}>
                {tuitionPctCard}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {
                width: `${tuitionPctCard}%`,
                backgroundColor: tuitionPctCard === 100 ? colors.success : tuitionPctCard >= 50 ? colors.warning : colors.danger,
              }]} />
            </View>
            <View style={styles.childFinanceRow}>
              <Text style={styles.childFinanceSub}>Payé : {tuitionPaidCard.toLocaleString('fr-FR')} F</Text>
              <Text style={[styles.childFinanceSub, { color: tuitionRemCard > 0 ? colors.danger : colors.success, fontWeight: '600' }]}>
                {tuitionRemCard > 0 ? `Reste ${tuitionRemCard.toLocaleString('fr-FR')} F` : '✓ Soldé'}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Class / Year / Site */}
      {(child.current_class?.name || child.current_class?.academic_year || child.site_name) && (
        <View style={styles.childMeta}>
          {child.current_class?.name && (
            <View style={styles.childMetaItem}>
              <Text style={styles.childMetaLabel}>CLASSE</Text>
              <Text style={styles.childMetaValue}>{child.current_class.name}</Text>
            </View>
          )}
          {child.current_class?.academic_year && (
            <View style={styles.childMetaItem}>
              <Text style={styles.childMetaLabel}>ANNÉE</Text>
              <Text style={styles.childMetaValue}>{child.current_class.academic_year}</Text>
            </View>
          )}
          {child.site_name && (
            <View style={styles.childMetaItem}>
              <Text style={styles.childMetaLabel}>SITE</Text>
              <Text style={styles.childMetaValue} numberOfLines={1}>{child.site_name}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: spacing.md },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  userName: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 1 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  headerBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  notifBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: colors.danger, borderRadius: 6, minWidth: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  notifBadgeText: { color: '#fff', fontSize: 7, fontWeight: '700' },
  avatarBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  kpiRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.lg, marginTop: spacing.lg, overflow: 'hidden' },
  kpiCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, gap: 4 },
  kpiDivider: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.15)' },
  kpiValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  kpiLabel: { fontSize: 10, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },

  section: { padding: spacing.md },
  sectionHeader: { marginBottom: spacing.md },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  sectionSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  serviceCard: { width: '47.5%', borderRadius: 18, padding: 16, borderWidth: 1.5, gap: 5 },
  serviceIconWrap: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  serviceLabel: { fontSize: 13, fontWeight: '800', lineHeight: 18 },
  serviceDesc: { fontSize: 11, color: colors.textTertiary },

  emptyCard: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  emptySub: { fontSize: 13, color: colors.textSecondary },

  siteChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  siteChipActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  siteChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  siteChipTextActive: { color: '#1D4ED8' },

  childCard: { backgroundColor: '#fff', borderRadius: radius.xl, marginBottom: spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3, overflow: 'hidden' },
  childCardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.success },
  childCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, paddingLeft: 20 },
  childAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  childAvatarText: { fontSize: 18, fontWeight: '700', color: colors.primary },
  childName: { fontSize: 16, fontWeight: '700', color: colors.text },
  childMatricule: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  childBadges: { flexDirection: 'row', gap: 6, marginTop: 4 },
  enrolledBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  enrolledBadgeText: { fontSize: 11, fontWeight: '700', color: '#059669' },
  activeBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },

  childFinance: { paddingHorizontal: 20, paddingBottom: spacing.md, gap: 6 },
  childFinanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  childFinanceLabel: { fontSize: 12, color: colors.textSecondary },
  childFinancePct: { fontSize: 13, fontWeight: '700' },
  progressBar: { height: 6, backgroundColor: colors.divider, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  childFinanceSub: { fontSize: 11, color: colors.textSecondary },

  childMeta: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.divider, paddingHorizontal: 20, paddingVertical: 10, gap: 16 },
  childMetaItem: { gap: 2 },
  childMetaLabel: { fontSize: 9, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  childMetaValue: { fontSize: 12, fontWeight: '600', color: colors.text },
});
