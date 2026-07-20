import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../../theme/colors';

// Shared header + scroll + sticky save-button shell for every teacher
// e-learning create/edit form (lesson, quiz, assignment, exam, classroom,
// session...), so each form only has to describe its own fields.
export default function FormScreen({
  title, subtitle, gradient, accentColor,
  onBack, onSave, saving, saveLabel = 'Enregistrer',
  onDelete, deleting,
  children,
}) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={gradient} style={styles.header}>
          <SafeAreaView edges={['top']}>
            <View style={styles.headerRow}>
              <TouchableOpacity style={styles.iconBtn} onPress={onBack} hitSlop={8}>
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                {!!subtitle && <Text style={styles.headerSub} numberOfLines={1}>{subtitle}</Text>}
              </View>
              {onDelete && (
                <TouchableOpacity style={styles.iconBtn} onPress={onDelete} disabled={deleting} hitSlop={8}>
                  {deleting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="trash-outline" size={20} color="#fff" />}
                </TouchableOpacity>
              )}
            </View>
          </SafeAreaView>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: accentColor }, saving && { opacity: 0.7 }]}
            onPress={onSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>{saveLabel}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  iconBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 },

  content: { padding: spacing.md, paddingBottom: 32 },

  footer: { padding: spacing.md, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn: { borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
