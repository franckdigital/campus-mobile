import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerAlertHandler } from '../../utils/appAlert';
import { colors, spacing, radius } from '../../theme/colors';

const VARIANTS = {
  danger:  { icon: 'alert-circle',            iconBg: '#FEE2E2', iconColor: '#EF4444', accent: '#EF4444' },
  error:   { icon: 'close-circle',            iconBg: '#FEE2E2', iconColor: '#EF4444', accent: '#EF4444' },
  warning: { icon: 'warning',                 iconBg: '#FEF3C7', iconColor: '#D97706', accent: '#D97706' },
  success: { icon: 'checkmark-circle',        iconBg: '#D1FAE5', iconColor: '#059669', accent: '#059669' },
  info:    { icon: 'information-circle',      iconBg: '#EEF2FF', iconColor: colors.primary, accent: colors.primary },
};

// Auto-picks a visual tone from the RN Alert.alert(title, message, buttons)
// signature so the ~100 existing call sites across the app don't need to
// pass anything new — only the import (Alert -> appAlert) changes.
function pickVariant(title, buttons) {
  if (buttons?.some((b) => b.style === 'destructive')) return VARIANTS.danger;
  const t = (title || '').toLowerCase();
  if (/erreur|échec|error/.test(t)) return VARIANTS.error;
  if (/requis|invalide|attention|manquant/.test(t)) return VARIANTS.warning;
  if (/succès|enregistr|généré|soumis|ajouté|créé|envoyé|mis à jour/.test(t)) return VARIANTS.success;
  return VARIANTS.info;
}

export default function AppAlertHost() {
  const [visible, setVisible] = useState(false);
  const [content, setContent] = useState({ title: '', message: '', buttons: [{ text: 'OK' }] });
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    registerAlertHandler((title, message, buttons) => {
      setContent({
        title: title || '',
        message: message || '',
        buttons: buttons && buttons.length ? buttons : [{ text: 'OK' }],
      });
      setVisible(true);
    });
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 280 }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scale, { toValue: 0.85, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const dismiss = (btn) => {
    setVisible(false);
    // Let the close animation start before firing the caller's handler —
    // mirrors native Alert's dismiss-then-callback ordering closely enough,
    // and avoids the next screen's own state updates fighting the modal's
    // exit animation.
    setTimeout(() => btn?.onPress?.(), 120);
  };

  const cfg = pickVariant(content.title, content.buttons);
  const hasCancelable = content.buttons.some((b) => b.style === 'cancel');
  const stacked = content.buttons.length > 2;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent onRequestClose={() => hasCancelable && dismiss(content.buttons.find((b) => b.style === 'cancel'))}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <View style={[styles.iconWrap, { backgroundColor: cfg.iconBg }]}>
            <Ionicons name={cfg.icon} size={32} color={cfg.iconColor} />
          </View>

          {!!content.title && <Text style={styles.title}>{content.title}</Text>}
          {!!content.message && <Text style={styles.message}>{content.message}</Text>}

          <View style={[styles.btnRow, stacked && styles.btnCol]}>
            {content.buttons.map((btn, i) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              const btnColor = isDestructive ? '#EF4444' : cfg.accent;
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    stacked ? styles.btnFull : styles.btnFlex,
                    isCancel ? styles.cancelBtn : [styles.confirmBtn, { backgroundColor: btnColor }],
                  ]}
                  onPress={() => dismiss(btn)}
                  activeOpacity={0.8}
                >
                  <Text style={isCancel ? styles.cancelText : styles.confirmText}>{btn.text || 'OK'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 20,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    width: '100%',
  },
  btnCol: {
    flexDirection: 'column',
  },
  btnFlex: { flex: 1 },
  btnFull: { width: '100%' },
  cancelBtn: {
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  confirmBtn: {
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
