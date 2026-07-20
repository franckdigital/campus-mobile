import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../../theme/colors';

// Without this, an uncaught render error anywhere in the tree unmounts the
// whole app in a release build — a white flash then the app closing, with
// no red-box like in dev to explain why. This turns that into a recoverable
// screen instead, matching the app's own visual language rather than a
// blank crash.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.log('[ErrorBoundary] caught:', error?.message, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
          </View>
          <Text style={styles.title}>Une erreur est survenue</Text>
          <Text style={styles.message}>
            L'écran n'a pas pu s'afficher correctement. Vous pouvez réessayer — si le problème persiste, signalez-le à votre administrateur.
          </Text>
          {__DEV__ && (
            <Text style={styles.debug} numberOfLines={4}>{String(this.state.error?.message || this.state.error)}</Text>
          )}
          <TouchableOpacity style={styles.btn} onPress={this.reset} activeOpacity={0.85}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.btnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 10 },
  iconWrap: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  message: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  debug: { fontSize: 11, color: '#EF4444', textAlign: 'center', marginTop: 6, fontFamily: 'monospace' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 20, paddingVertical: 12, marginTop: 14 },
  btnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
