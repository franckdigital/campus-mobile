import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../theme/colors';

// Shared "left-border card" list item used across teacher e-learning modules
// (cours, quiz, devoirs, examens, classes virtuelles) — icon + title/sub,
// optional meta chips row, optional status pill, chevron.
export default function ContentCard({
  onPress, icon, iconColor, iconBg, title, sub, meta = [], statusLabel, statusColor, borderColor,
}) {
  return (
    <TouchableOpacity style={[styles.card, { borderLeftColor: borderColor || iconColor || colors.primary }]} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: iconBg || (iconColor ? iconColor + '18' : colors.divider) }]}>
          <Ionicons name={icon} size={18} color={iconColor || colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {!!sub && <Text style={styles.sub} numberOfLines={1}>{sub}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </View>
      {meta.length > 0 && (
        <View style={styles.metaRow}>
          {meta.map((m, i) => (
            <View key={i} style={styles.metaChip}>
              {!!m.icon && <Ionicons name={m.icon} size={11} color={colors.textTertiary} />}
              <Text style={styles.metaText}>{m.text}</Text>
            </View>
          ))}
        </View>
      )}
      {!!statusLabel && (
        <View style={[styles.statusRow, { backgroundColor: (statusColor || colors.textTertiary) + '18' }]}>
          <Text style={[styles.statusText, { color: statusColor || colors.textTertiary }]}>{statusLabel}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, gap: 10, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, color: colors.textSecondary },
  statusRow: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.md, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: '700' },
});
