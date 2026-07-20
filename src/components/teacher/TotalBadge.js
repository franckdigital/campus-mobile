import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { radius, spacing } from '../../theme/colors';

export default function TotalBadge({ earned, max, label = 'Total calculé' }) {
  const pct = max > 0 ? Math.round((earned / max) * 100) : 0;
  const good = pct >= 50;
  const color = good ? '#059669' : '#dc2626';
  const bg = good ? '#f0fdf4' : '#fef2f2';
  const border = good ? '#bbf7d0' : '#fecaca';

  return (
    <View style={[styles.wrap, { backgroundColor: bg, borderColor: border }]}>
      <View>
        <Text style={[styles.label, { color }]}>{label}</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.value, { color }]}>{(+earned).toFixed(2)}</Text>
          <Text style={styles.max}>/ {max} pts</Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.pct, { color }]}>{pct}%</Text>
        <Text style={[styles.pctLabel, { color }]}>{good ? '✓ Validé' : '✗ Insuffisant'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1.5 },
  label: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 },
  value: { fontSize: 22, fontWeight: '800' },
  max: { fontSize: 13, fontWeight: '700', color: '#94a3b8' },
  pct: { fontSize: 26, fontWeight: '800' },
  pctLabel: { fontSize: 10, fontWeight: '700' },
});
