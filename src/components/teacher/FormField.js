import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../theme/colors';

export function TextField({ label, required, multiline, value, onChangeText, placeholder, keyboardType, accentColor = colors.primary, ...rest }) {
  return (
    <View style={styles.wrap}>
      {!!label && <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMultiline]}
        {...rest}
      />
    </View>
  );
}

export function ToggleRow({ label, description, value, onValueChange, accentColor = colors.primary }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, paddingRight: spacing.sm }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {!!description && <Text style={styles.toggleDesc}>{description}</Text>}
      </View>
      <Switch value={!!value} onValueChange={onValueChange} trackColor={{ false: colors.border, true: accentColor + '88' }} thumbColor={value ? accentColor : '#fff'} />
    </View>
  );
}

export function SectionLabel({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function FilePickerRow({ label, fileName, onPick, onClear, accentColor = colors.primary, icon = 'document-attach-outline' }) {
  return (
    <View style={styles.wrap}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity style={styles.fileField} onPress={onPick} activeOpacity={0.7}>
        <Ionicons name={icon} size={18} color={accentColor} />
        <Text style={[styles.fileText, !fileName && { color: colors.textTertiary }]} numberOfLines={1}>
          {fileName || 'Choisir un fichier...'}
        </Text>
        {!!fileName && onClear && (
          <TouchableOpacity onPress={onClear} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, marginBottom: spacing.sm },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  toggleDesc: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  sectionLabel: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: spacing.sm, marginBottom: spacing.sm },

  fileField: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  fileText: { flex: 1, fontSize: 13, color: colors.text },
});
