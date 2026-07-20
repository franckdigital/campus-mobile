import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

const variantMap = {
  success: { bg: colors.successLight, text: colors.success },
  warning: { bg: colors.warningLight, text: '#B45309' },
  danger: { bg: colors.dangerLight, text: colors.danger },
  info: { bg: colors.infoLight, text: colors.info },
  primary: { bg: '#EEF2FF', text: colors.primary },
  default: { bg: colors.divider, text: colors.textSecondary },
};

const statusMap = {
  // Finance
  PAID: 'success', PARTIAL: 'warning', OVERDUE: 'danger', SENT: 'info', DRAFT: 'default', CANCELLED: 'default',
  // Attendance
  PRESENT: 'success', ABSENT: 'danger', LATE: 'warning', EXCUSED: 'info',
  // Requests
  APPROVED: 'success', REJECTED: 'danger', PENDING: 'warning',
  // Students
  ACTIVE: 'success', GRADUATED: 'info', SUSPENDED: 'warning', WITHDRAWN: 'danger',
  // Submissions
  SUBMITTED: 'info', GRADED: 'success',
  // Payments
  VALIDATED: 'success', FAILED: 'danger',
};

const labelMap = {
  PAID: 'Payé', PARTIAL: 'Partiel', OVERDUE: 'En retard', SENT: 'Envoyé',
  DRAFT: 'Brouillon', CANCELLED: 'Annulé', PRESENT: 'Présent', ABSENT: 'Absent',
  LATE: 'En retard', EXCUSED: 'Excusé', APPROVED: 'Approuvé', REJECTED: 'Rejeté',
  PENDING: 'En attente', ACTIVE: 'Actif', GRADUATED: 'Diplômé', SUSPENDED: 'Suspendu',
  WITHDRAWN: 'Retiré', SUBMITTED: 'Soumis', GRADED: 'Noté', VALIDATED: 'Validé',
  FAILED: 'Échoué',
};

export default function Badge({ status, label, variant, style }) {
  const v = variant || statusMap[status] || 'default';
  const { bg, text } = variantMap[v] || variantMap.default;
  const displayLabel = label || labelMap[status] || status || '';

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: text }]}>{displayLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
