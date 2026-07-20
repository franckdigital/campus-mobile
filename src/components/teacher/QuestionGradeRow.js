import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../../theme/colors';

const QTYPE_SHORT = { QCU: 'QCU', QCM: 'QCM', TRUEFALSE: 'V/F', TEXT: 'Texte', NUMERIC: 'Calcul', MATCHING: 'Assoc.', ORDERING: 'Ordre' };

const STATUS_STYLE = {
  correct:   { bg: '#f0fdf4', color: '#059669', icon: '✓' },
  incorrect: { bg: '#fef2f2', color: '#ef4444', icon: '✗' },
  pending:   { bg: '#fffbeb', color: '#d97706', icon: '⏳' },
  manual:    { bg: '#f0fdf4', color: '#059669', icon: '✎' },
  missing:   { bg: '#f8fafc', color: '#94a3b8', icon: '—' },
};

// Mirrors campus-react's QuestionGradeRow (CorrectionHub.jsx) — one row per
// question in a "Notation par question" panel: auto-graded questions show
// their computed status/points read-only, TEXT (or unanswered) questions
// get a manual point-entry input.
export default function QuestionGradeRow({ q, idx, ans, earned, maxPts, status, manualVal, onManualChange, accentColor = colors.primary }) {
  const st = STATUS_STYLE[status] || STATUS_STYLE.missing;
  const needsInput = q.question_type === 'TEXT' || !ans;
  const isInput = needsInput && !!onManualChange;

  return (
    <View style={styles.row}>
      <View style={[styles.badge, { backgroundColor: accentColor + '18' }]}>
        <Text style={[styles.badgeText, { color: accentColor }]}>{idx + 1}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.topLine}>
          <View style={styles.typeTag}><Text style={styles.typeTagText}>{QTYPE_SHORT[q.question_type] || q.question_type}</Text></View>
          <Text style={styles.qText} numberOfLines={2}>{q.text}</Text>
        </View>
        {!!ans?.text_response && (
          <Text style={styles.answerPreview} numberOfLines={2}>↳ {ans.text_response}</Text>
        )}
      </View>
      <View style={styles.right}>
        <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
          <Text style={[styles.statusPillText, { color: st.color }]}>{st.icon}</Text>
        </View>
        {isInput ? (
          <View style={styles.inputRow}>
            <TextInput
              value={manualVal != null ? String(manualVal) : ''}
              onChangeText={onManualChange}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { borderColor: accentColor + '40', color: accentColor }]}
            />
            <Text style={styles.maxText}>/{maxPts}</Text>
          </View>
        ) : (
          <Text style={[styles.earnedText, { color: status === 'correct' || status === 'manual' ? '#059669' : status === 'incorrect' ? '#ef4444' : '#94a3b8' }]}>
            {earned != null ? earned : '—'}<Text style={styles.maxTextInline}>/{maxPts}</Text>
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  badge: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  typeTag: { backgroundColor: colors.divider, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  typeTagText: { fontSize: 9, fontWeight: '700', color: colors.textSecondary },
  qText: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.text },
  answerPreview: { fontSize: 11, fontStyle: 'italic', color: colors.textSecondary, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  statusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  input: { width: 48, paddingHorizontal: 6, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  maxText: { fontSize: 11, fontWeight: '700', color: colors.textTertiary },
  earnedText: { fontSize: 14, fontWeight: '800' },
  maxTextInline: { fontSize: 11, fontWeight: '400', color: colors.textTertiary },
});
