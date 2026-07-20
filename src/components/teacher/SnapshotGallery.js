import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../theme/colors';

function fmt(d) {
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Mirrors campus-react's webcam-proctoring snapshot gallery in CorrectionHub —
// thumbnails with face/phone-detection badges and AI analysis, tap for a
// full-screen viewer.
export default function SnapshotGallery({ snapshots, loading, webcamRequired }) {
  const [viewing, setViewing] = useState(null);

  if (loading) {
    return <ActivityIndicator color="#2563eb" style={{ paddingVertical: 24 }} />;
  }

  if (!snapshots.length) {
    return (
      <Text style={styles.emptyText}>
        {webcamRequired
          ? "Aucune capture alors que la webcam était obligatoire pour cet examen — l'étudiant n'a peut-être pas autorisé sa caméra, ou la connexion a coupé les envois."
          : "Aucune capture — la webcam n'était pas requise pour cet examen."}
      </Text>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {snapshots.map((snap) => {
        const anomaly = snap.face_detected === false || snap.phone_detected;
        return (
          <TouchableOpacity
            key={snap.id}
            style={[styles.card, anomaly && styles.cardAnomaly]}
            onPress={() => setViewing(snap)}
            activeOpacity={0.8}
          >
            <View style={styles.thumbWrap}>
              <Image source={{ uri: snap.image }} style={styles.thumb} />
              {anomaly && (
                <View style={styles.anomalyDot}>
                  <Ionicons name="shield-outline" size={11} color="#fff" />
                </View>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.time}>{fmt(snap.taken_at)}</Text>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: snap.face_detected === false ? '#fee2e2' : '#dcfce7' }]}>
                  <Text style={[styles.badgeText, { color: snap.face_detected === false ? '#dc2626' : '#059669' }]}>
                    {snap.face_detected === false ? 'Visage non détecté' : 'Visage détecté'}
                  </Text>
                </View>
                {!!snap.phone_detected && (
                  <View style={[styles.badge, { backgroundColor: '#fee2e2' }]}>
                    <Text style={[styles.badgeText, { color: '#dc2626' }]}>Téléphone détecté</Text>
                  </View>
                )}
              </View>
              {!!snap.ai_analysis && (
                <Text style={[styles.analysis, anomaly && { color: '#991b1b' }]} numberOfLines={2}>{snap.ai_analysis}</Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <TouchableOpacity style={styles.lightboxBackdrop} activeOpacity={1} onPress={() => setViewing(null)}>
          <ScrollView contentContainerStyle={styles.lightboxScroll} maximumZoomScale={3} minimumZoomScale={1}>
            {viewing && (
              <TouchableOpacity activeOpacity={1} style={styles.lightboxCard} onPress={() => {}}>
                <Image source={{ uri: viewing.image }} style={styles.lightboxImage} resizeMode="contain" />
                <View style={styles.lightboxInfo}>
                  <Text style={styles.lightboxTime}>{fmt(viewing.taken_at)}</Text>
                  <View style={styles.badgeRow}>
                    <View style={[styles.badge, { backgroundColor: viewing.face_detected === false ? '#fee2e2' : '#dcfce7' }]}>
                      <Text style={[styles.badgeText, { color: viewing.face_detected === false ? '#dc2626' : '#059669' }]}>
                        {viewing.face_detected === false ? 'Visage non détecté' : 'Visage détecté'}
                      </Text>
                    </View>
                    {!!viewing.phone_detected && (
                      <View style={[styles.badge, { backgroundColor: '#fee2e2' }]}>
                        <Text style={[styles.badgeText, { color: '#dc2626' }]}>Téléphone détecté</Text>
                      </View>
                    )}
                  </View>
                  {!!viewing.ai_analysis && <Text style={styles.lightboxAnalysis}>{viewing.ai_analysis}</Text>}
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setViewing(null)} hitSlop={8}>
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          </ScrollView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyText: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', paddingVertical: 20, paddingHorizontal: spacing.md },
  card: { flexDirection: 'row', gap: 10, padding: 8, borderRadius: radius.md, backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.divider },
  cardAnomaly: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  thumbWrap: { width: 88, height: 66, borderRadius: radius.sm, overflow: 'hidden', flexShrink: 0 },
  thumb: { width: '100%', height: '100%' },
  anomalyDot: { position: 'absolute', top: 3, right: 3, width: 16, height: 16, borderRadius: 8, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
  time: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  badgeRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 4 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  analysis: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },

  lightboxBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.85)', alignItems: 'center', justifyContent: 'center' },
  lightboxScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, width: '100%' },
  lightboxCard: { width: '100%', maxWidth: 480, backgroundColor: '#fff', borderRadius: radius.lg, overflow: 'hidden' },
  lightboxImage: { width: '100%', height: 320, backgroundColor: '#000' },
  lightboxInfo: { padding: spacing.md, gap: 4 },
  lightboxTime: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  lightboxAnalysis: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  closeBtn: { position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(15,23,42,0.6)', alignItems: 'center', justifyContent: 'center' },
});
