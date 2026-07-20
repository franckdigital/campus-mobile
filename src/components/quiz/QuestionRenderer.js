import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../../theme/colors';

const ACCENT = '#7C3AED';
const ACCENT_LIGHT = '#F5F3FF';

function isAnswered(a) {
  return !!(a && (
    (a.choice_ids?.length > 0) || (a.text_response?.trim()) ||
    (a.numeric_response != null && a.numeric_response !== '') ||
    (a.ordering_response?.length > 0) ||
    (Object.keys(a.matching_response || {}).length > 0)
  ));
}

function QCUQuestion({ question, answer, onAnswer }) {
  return (
    <View style={{ gap: 10 }}>
      {question.choices.map((c) => {
        const selected = answer?.choice_ids?.includes(c.id);
        return (
          <TouchableOpacity
            key={c.id}
            style={[styles.choice, selected && styles.choiceSelected]}
            onPress={() => onAnswer(question.id, { choice_ids: [c.id] })}
          >
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected && <View style={styles.radioDot} />}
            </View>
            <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{c.text}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function TrueFalseQuestion({ question, answer, onAnswer }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {question.choices.map((c) => {
        const isVrai = c.text === 'Vrai';
        const selected = answer?.choice_ids?.includes(c.id);
        return (
          <TouchableOpacity
            key={c.id}
            style={[
              styles.tfBtn,
              selected && { borderColor: isVrai ? colors.success : colors.danger, backgroundColor: isVrai ? colors.successLight : colors.dangerLight },
            ]}
            onPress={() => onAnswer(question.id, { choice_ids: [c.id] })}
          >
            <Text style={[styles.tfText, selected && { color: isVrai ? colors.success : colors.danger }]}>
              {isVrai ? '✓ Vrai' : '✗ Faux'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function QCMQuestion({ question, answer, onAnswer }) {
  const selected = answer?.choice_ids || [];
  const toggle = (id) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    onAnswer(question.id, { choice_ids: next });
  };
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.hint}>Plusieurs réponses possibles</Text>
      {question.choices.map((c) => {
        const isSel = selected.includes(c.id);
        return (
          <TouchableOpacity key={c.id} style={[styles.choice, isSel && styles.choiceSelected]} onPress={() => toggle(c.id)}>
            <View style={[styles.checkbox, isSel && styles.checkboxSelected]}>
              {isSel && <Ionicons name="checkmark" size={13} color="#fff" />}
            </View>
            <Text style={[styles.choiceText, isSel && styles.choiceTextSelected]}>{c.text}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function TextQuestion({ question, answer, onAnswer, secure }) {
  return (
    <TextInput
      value={answer?.text_response || ''}
      onChangeText={(t) => onAnswer(question.id, { text_response: t })}
      multiline
      numberOfLines={5}
      placeholder="Rédigez votre réponse ici..."
      placeholderTextColor={colors.textTertiary}
      style={styles.textInput}
      textAlignVertical="top"
      contextMenuHidden={secure}
    />
  );
}

function NumericQuestion({ question, answer, onAnswer, secure }) {
  return (
    <TextInput
      value={answer?.numeric_response != null ? String(answer.numeric_response) : ''}
      onChangeText={(t) => onAnswer(question.id, { numeric_response: t === '' ? null : t.replace(',', '.') })}
      keyboardType="numeric"
      placeholder="Entrez votre réponse numérique..."
      placeholderTextColor={colors.textTertiary}
      style={styles.input}
      contextMenuHidden={secure}
    />
  );
}

function MatchingQuestion({ question, answer, onAnswer, secure }) {
  const resp = answer?.matching_response || {};
  const update = (choiceId, val) => onAnswer(question.id, { matching_response: { ...resp, [choiceId]: val } });
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.hint}>Associez chaque élément avec sa correspondance</Text>
      {question.choices.map((c) => (
        <View key={c.id} style={{ gap: 6 }}>
          <View style={styles.matchLeft}>
            <Text style={styles.matchLeftText}>{c.text}</Text>
          </View>
          <TextInput
            value={resp[c.id] || ''}
            onChangeText={(t) => update(c.id, t)}
            placeholder="Votre association..."
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            contextMenuHidden={secure}
          />
        </View>
      ))}
    </View>
  );
}

function OrderingQuestion({ question, answer, onAnswer }) {
  const initial = question.choices.map((c) => c.id);
  const [order, setOrder] = useState(
    answer?.ordering_response?.length === initial.length ? answer.ordering_response : initial
  );
  const choiceMap = Object.fromEntries(question.choices.map((c) => [c.id, c.text]));

  const move = (idx, delta) => {
    const swapIdx = idx + delta;
    if (swapIdx < 0 || swapIdx >= order.length) return;
    const next = [...order];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setOrder(next);
    onAnswer(question.id, { ordering_response: next });
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.hint}>Ordonnez les éléments dans le bon ordre</Text>
      {order.map((id, idx) => (
        <View key={id} style={styles.orderRow}>
          <View style={styles.orderIdx}><Text style={styles.orderIdxText}>{idx + 1}</Text></View>
          <Text style={styles.orderText} numberOfLines={2}>{choiceMap[id]}</Text>
          <View style={{ gap: 2 }}>
            <TouchableOpacity onPress={() => move(idx, -1)} disabled={idx === 0} style={{ opacity: idx === 0 ? 0.3 : 1 }}>
              <Ionicons name="chevron-up" size={16} color={ACCENT} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => move(idx, 1)} disabled={idx === order.length - 1} style={{ opacity: idx === order.length - 1 ? 0.3 : 1 }}>
              <Ionicons name="chevron-down" size={16} color={ACCENT} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function QuestionRenderer({ question, answer, onAnswer, secure }) {
  const types = {
    QCU: QCUQuestion, QCM: QCMQuestion, TRUEFALSE: TrueFalseQuestion,
    TEXT: TextQuestion, NUMERIC: NumericQuestion, MATCHING: MatchingQuestion, ORDERING: OrderingQuestion,
  };
  const Component = types[question.question_type] || TextQuestion;
  return <Component question={question} answer={answer} onAnswer={onAnswer} secure={secure} />;
}

export { isAnswered };

const styles = StyleSheet.create({
  choice: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 13,
  },
  choiceSelected: { borderColor: ACCENT, backgroundColor: ACCENT_LIGHT },
  choiceText: { flex: 1, fontSize: 14, color: colors.text },
  choiceTextSelected: { color: ACCENT, fontWeight: '600' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: ACCENT },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: ACCENT },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { borderColor: ACCENT, backgroundColor: ACCENT },
  hint: { fontSize: 12, color: colors.textTertiary, fontStyle: 'italic' },
  tfBtn: { flex: 1, paddingVertical: 22, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, alignItems: 'center' },
  tfText: { fontSize: 15, fontWeight: '800', color: colors.textSecondary },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 14, color: colors.text },
  textInput: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, fontSize: 14, color: colors.text, minHeight: 110 },
  matchLeft: { backgroundColor: ACCENT_LIGHT, borderWidth: 1, borderColor: '#DDD6FE', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },
  matchLeftText: { fontSize: 13, fontWeight: '600', color: ACCENT },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  orderIdx: { width: 24, height: 24, borderRadius: 8, backgroundColor: ACCENT_LIGHT, alignItems: 'center', justifyContent: 'center' },
  orderIdxText: { fontSize: 11, fontWeight: '800', color: ACCENT },
  orderText: { flex: 1, fontSize: 13, color: colors.text },
});
