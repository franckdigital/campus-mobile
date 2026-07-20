import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme/colors';

// In-app PDF viewer for exam subjects — deliberately never falls back to
// Linking.openURL (unlike LessonPlayerScreen.js's WebView pattern this is
// based on): leaving the app to view the PDF externally is exactly what
// trips the exam's AppState-based fraud detector (see SecureExamTakeScreen.js).
// Android's system WebView doesn't reliably render a raw PDF `uri` source
// (unlike iOS's WKWebView), so the PDF is routed through Google Docs
// Viewer's embed endpoint for consistent in-app rendering on both platforms.
export default function PdfViewerModal({ visible, url, onClose }) {
  const [loading, setLoading] = useState(true);
  if (!visible || !url) return null;
  const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.header}>
        <Text style={styles.title}>Sujet de l'examen</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1 }}>
        {loading && <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.primary} />}
        <WebView
          source={{ uri: viewerUrl }}
          onLoadEnd={() => setLoading(false)}
          style={{ flex: 1 }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 48, paddingBottom: spacing.sm, paddingHorizontal: spacing.md,
    backgroundColor: '#1e293b',
  },
  title: { fontSize: 14, fontWeight: '800', color: '#fff' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
});
