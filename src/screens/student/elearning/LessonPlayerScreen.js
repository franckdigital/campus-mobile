import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Linking,
} from 'react-native';
import Alert from '../../../utils/appAlert';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import elearningService from '../../../services/elearning';
import { colors, spacing, radius } from '../../../theme/colors';

const DOC_LABELS = { ppt: 'PowerPoint', word: 'Word', html5: 'HTML5' };

// Some lesson videos are domain-restricted by their YouTube owner to the
// production site — an embed loaded from any other origin gets rejected with
// "Error 153". Declaring that origin explicitly (both as the `origin` query
// param YouTube's player checks, and as the WebView's baseUrl) satisfies it.
const EMBED_ORIGIN = 'https://campus.numerix.digital';

function toEmbedUrl(url) {
  if (!url) return '';
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?playsinline=1&modestbranding=1&rel=0&origin=${encodeURIComponent(EMBED_ORIGIN)}`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
}

function htmlWrap(bodyHtml) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>html,body{margin:0;padding:0;background:#000;height:100%;}video,audio{width:100%;}
  body{display:flex;align-items:center;justify-content:center;}</style></head>
  <body>${bodyHtml}</body></html>`;
}

// YouTube/Vimeo embeds return "Error 153" when the WebView navigates its main
// frame directly to the embed URL — the player only accepts being loaded
// inside an <iframe> from a real parent document, so we wrap it in one.
function iframeWrap(embedUrl) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden;}iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0;}</style></head>
  <body><iframe src="${embedUrl}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></body></html>`;
}

export default function LessonPlayerScreen({ route, navigation }) {
  const { lesson, courseId, isCompleted, allLessons = [], completedIds: initialCompletedIds = [] } = route.params || {};
  const [completed, setCompleted] = useState(!!isCompleted);
  const [completedIds, setCompletedIds] = useState(initialCompletedIds);
  const [marking, setMarking] = useState(false);
  const [webLoading, setWebLoading] = useState(true);

  const currentIndex = allLessons.findIndex((l) => l.id === lesson.id);
  const nextLesson = currentIndex >= 0 ? allLessons[currentIndex + 1] : null;

  const markComplete = async () => {
    setMarking(true);
    try {
      await elearningService.markCourseLessonComplete(lesson.id);
      setCompleted(true);
      setCompletedIds((prev) => (prev.includes(lesson.id) ? prev : [...prev, lesson.id]));
    } catch (e) {
      Alert.alert('Erreur', e.message || 'Impossible de marquer la leçon comme terminée');
    } finally {
      setMarking(false);
    }
  };

  const goToNext = () => {
    if (!nextLesson) return;
    navigation.push('LessonPlayer', {
      lesson: nextLesson,
      courseId,
      isCompleted: completedIds.includes(nextLesson.id),
      allLessons,
      completedIds,
    });
  };

  const renderContent = () => {
    switch (lesson.content_type) {
      case 'text':
        return (
          <ScrollView style={styles.textWrap} contentContainerStyle={{ padding: spacing.md }}>
            <Text style={styles.textContent}>{lesson.text_content}</Text>
          </ScrollView>
        );
      case 'image':
        return lesson.document_file ? (
          <Image source={{ uri: lesson.document_file }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={styles.center}><Text style={styles.emptyText}>Image non disponible</Text></View>
        );
      case 'video':
        if (lesson.video_file) {
          return (
            <View style={styles.webviewWrap}>
              {webLoading && <ActivityIndicator style={StyleSheet.absoluteFill} color="#fff" />}
              <WebView
                source={{ html: htmlWrap(`<video src="${lesson.video_file}" controls autoplay playsinline style="width:100%;height:100%;"></video>`) }}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                onLoadEnd={() => setWebLoading(false)}
                style={styles.webview}
              />
            </View>
          );
        }
        if (lesson.external_embed_url) {
          return (
            <View style={styles.webviewWrap}>
              {webLoading && <ActivityIndicator style={StyleSheet.absoluteFill} color="#fff" />}
              <WebView
                source={{ html: iframeWrap(toEmbedUrl(lesson.external_embed_url)), baseUrl: EMBED_ORIGIN }}
                originWhitelist={['*']}
                allowsInlineMediaPlayback
                allowsFullscreenVideo
                mediaPlaybackRequiresUserAction={false}
                onLoadEnd={() => setWebLoading(false)}
                style={styles.webview}
              />
              <TouchableOpacity style={styles.openExternalBtn} onPress={() => Linking.openURL(lesson.external_embed_url)}>
                <Ionicons name="logo-youtube" size={14} color="#fff" />
                <Text style={styles.openExternalText}>Regarder sur YouTube</Text>
              </TouchableOpacity>
            </View>
          );
        }
        return <View style={styles.center}><Text style={styles.emptyText}>Vidéo non disponible</Text></View>;
      case 'audio':
        return lesson.video_file ? (
          <View style={styles.audioWrap}>
            <Ionicons name="musical-notes" size={48} color="#DB2777" style={{ opacity: 0.5, marginBottom: spacing.md }} />
            <WebView
              source={{ html: htmlWrap(`<audio src="${lesson.video_file}" controls autoplay style="width:90%;"></audio>`) }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              style={styles.audioWebview}
            />
          </View>
        ) : (
          <View style={styles.center}><Text style={styles.emptyText}>Audio non disponible</Text></View>
        );
      case 'pdf':
        return lesson.document_file ? (
          <View style={styles.webviewWrap}>
            {webLoading && <ActivityIndicator style={StyleSheet.absoluteFill} color="#DB2777" />}
            <WebView
              source={{ uri: lesson.document_file }}
              onLoadEnd={() => setWebLoading(false)}
              style={styles.webview}
            />
            <TouchableOpacity style={styles.openExternalBtn} onPress={() => Linking.openURL(lesson.document_file)}>
              <Ionicons name="open-outline" size={14} color="#fff" />
              <Text style={styles.openExternalText}>Ouvrir dans le navigateur</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.center}><Text style={styles.emptyText}>Document non disponible</Text></View>
        );
      case 'ppt':
      case 'word':
      case 'html5':
        return lesson.document_file ? (
          <View style={styles.docWrap}>
            <Ionicons name="document-attach-outline" size={48} color="#DB2777" style={{ opacity: 0.6, marginBottom: spacing.md }} />
            <Text style={styles.docLabel}>Document {DOC_LABELS[lesson.content_type]} disponible</Text>
            <TouchableOpacity style={styles.docOpenBtn} onPress={() => Linking.openURL(lesson.document_file)}>
              <Ionicons name="open-outline" size={16} color="#fff" />
              <Text style={styles.docOpenBtnText}>Ouvrir le document</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.center}><Text style={styles.emptyText}>Document non disponible</Text></View>
        );
      case 'youtube':
      case 'vimeo':
        return (
          <View style={styles.webviewWrap}>
            {webLoading && <ActivityIndicator style={StyleSheet.absoluteFill} color="#fff" />}
            <WebView
              source={{ html: iframeWrap(toEmbedUrl(lesson.external_embed_url)), baseUrl: EMBED_ORIGIN }}
              originWhitelist={['*']}
              allowsInlineMediaPlayback
              allowsFullscreenVideo
              mediaPlaybackRequiresUserAction={false}
              onLoadEnd={() => setWebLoading(false)}
              style={styles.webview}
            />
            <TouchableOpacity style={styles.openExternalBtn} onPress={() => Linking.openURL(lesson.external_embed_url)}>
              <Ionicons name={lesson.content_type === 'youtube' ? 'logo-youtube' : 'logo-vimeo'} size={14} color="#fff" />
              <Text style={styles.openExternalText}>Regarder sur {lesson.content_type === 'youtube' ? 'YouTube' : 'Vimeo'}</Text>
            </TouchableOpacity>
          </View>
        );
      case 'iframe':
        return lesson.external_embed_url ? (
          <View style={styles.webviewWrap}>
            {webLoading && <ActivityIndicator style={StyleSheet.absoluteFill} color="#DB2777" />}
            <WebView
              source={{ uri: lesson.external_embed_url }}
              onLoadEnd={() => setWebLoading(false)}
              style={styles.webview}
            />
          </View>
        ) : (
          <View style={styles.center}><Text style={styles.emptyText}>Contenu non disponible</Text></View>
        );
      default:
        return <View style={styles.center}><Text style={styles.emptyText}>Type de contenu non supporté</Text></View>;
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{lesson.title}</Text>
          {nextLesson ? (
            <TouchableOpacity style={styles.nextBtn} onPress={goToNext}>
              <Text style={styles.nextBtnText}>Suivant</Text>
              <Ionicons name="chevron-forward" size={16} color="#DB2777" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 38 }} />
          )}
        </View>
      </SafeAreaView>

      <View style={styles.playerArea}>{renderContent()}</View>

      <View style={styles.footer}>
        {lesson.duration_seconds > 0 && (
          <View style={styles.durationChip}>
            <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.durationText}>{Math.round(lesson.duration_seconds / 60)} min</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.completeBtn, completed && styles.completeBtnDone]}
          onPress={markComplete}
          disabled={completed || marking}
        >
          {marking ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name={completed ? 'checkmark-circle' : 'checkmark-circle-outline'} size={18} color="#fff" />
          )}
          <Text style={styles.completeBtnText}>{completed ? 'Terminée' : 'Marquer comme terminée'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerSafe: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.divider, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.text, marginHorizontal: 8 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 10, paddingRight: 6, height: 38, borderRadius: 10, backgroundColor: '#FCE7F3' },
  nextBtnText: { fontSize: 13, fontWeight: '700', color: '#DB2777' },

  playerArea: { flex: 1, backgroundColor: '#000' },
  webviewWrap: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
  audioWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fdf2f8', padding: spacing.lg },
  audioWebview: { width: '100%', height: 60, backgroundColor: 'transparent' },
  image: { flex: 1, width: '100%', backgroundColor: '#000' },
  textWrap: { flex: 1, backgroundColor: '#fff' },
  textContent: { fontSize: 15, lineHeight: 23, color: colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  emptyText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  docWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fdf2f8', padding: spacing.lg },
  docLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  docOpenBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DB2777', paddingHorizontal: 20, paddingVertical: 12, borderRadius: radius.md },
  docOpenBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  openExternalBtn: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full },
  openExternalText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.divider },
  durationChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.divider, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.md },
  durationText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  completeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#DB2777', borderRadius: radius.md, paddingVertical: 12 },
  completeBtnDone: { backgroundColor: colors.success },
  completeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
