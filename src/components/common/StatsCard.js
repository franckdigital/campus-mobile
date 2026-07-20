import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../../theme/colors';

export default function StatsCard({ label, value, icon, gradient, onPress, small }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  const sz = small ? 'small' : 'normal';

  return (
    <Wrapper onPress={onPress} activeOpacity={0.8} style={[styles.card, styles[sz]]}>
      <LinearGradient colors={gradient || colors.gradientPrimary} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={small ? 18 : 22} color="rgba(255,255,255,0.9)" />
        </View>
        <Text style={[styles.value, small && styles.valueSmall]}>{value}</Text>
        <Text style={[styles.label, small && styles.labelSmall]}>{label}</Text>
      </LinearGradient>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    flex: 1,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  normal: { minHeight: 110 },
  small: { minHeight: 85 },
  gradient: {
    flex: 1,
    padding: spacing.md,
    gap: 4,
    justifyContent: 'space-between',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { fontSize: 22, fontWeight: '700', color: '#fff' },
  valueSmall: { fontSize: 18 },
  label: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  labelSmall: { fontSize: 11 },
});
