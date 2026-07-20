import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../theme/colors';

// Generic "tap to open a list" selector, used across the teacher e-learning
// forms (class+subject, chapter, provider, exam type, question type, room...)
// so each form doesn't reimplement its own dropdown/modal.
export default function SelectField({
  label,
  placeholder = 'Sélectionner...',
  value,
  options = [],
  onChange,
  accentColor = colors.primary,
  searchable = false,
  required = false,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = options.find((o) => o.value === value);
  const filtered = searchable && search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <View style={styles.wrap}>
      {!!label && <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>}
      <TouchableOpacity
        style={[styles.field, disabled && styles.fieldDisabled]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.fieldText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>{label || 'Choisir'}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {searchable && (
              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color={colors.textTertiary} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Rechercher..."
                  placeholderTextColor={colors.textTertiary}
                  style={styles.searchInput}
                />
              </View>
            )}
            <FlatList
              data={filtered}
              keyExtractor={(item, i) => String(item.value ?? i)}
              style={{ maxHeight: 380 }}
              ListEmptyComponent={<Text style={styles.empty}>Aucune option</Text>}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <TouchableOpacity
                    style={styles.option}
                    onPress={() => { onChange(item.value); setOpen(false); setSearch(''); }}
                  >
                    <Text style={[styles.optionText, active && { color: accentColor, fontWeight: '700' }]} numberOfLines={2}>
                      {item.label}
                    </Text>
                    {active && <Ionicons name="checkmark" size={18} color={accentColor} />}
                  </TouchableOpacity>
                );
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 13,
  },
  fieldDisabled: { backgroundColor: colors.divider },
  fieldText: { fontSize: 14, color: colors.text, flex: 1 },
  placeholder: { color: colors.textTertiary },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: 24, maxHeight: '75%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: spacing.md, marginBottom: 0, backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 13, color: colors.text },

  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider },
  optionText: { fontSize: 14, color: colors.text, flex: 1 },
  empty: { fontSize: 13, color: colors.textTertiary, fontStyle: 'italic', padding: spacing.md, textAlign: 'center' },
});
