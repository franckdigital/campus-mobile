import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notificationsService from '../services/notifications';

// Affiche la notification même quand l'app est au premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const PUSH_TOKEN_KEY = 'push_token';

// Canaux Android distincts par type d'événement
const ANDROID_CHANNELS = [
  {
    id: 'payments',
    name: 'Paiements',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0891B2',
    sound: true,
  },
  {
    id: 'attendance',
    name: 'Présences & Absences',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#D97706',
    sound: true,
  },
  {
    id: 'default',
    name: 'Général',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4F46E5',
    sound: true,
  },
];

async function registerForPushNotificationsAsync() {
  // Device.isDevice a un faux-négatif connu sur certains téléphones réels
  // (mauvaise détection via Build.FINGERPRINT côté Android) — plutôt que de
  // bloquer complètement l'enregistrement là-dessus, on continue quand même
  // et on laisse getExpoPushTokenAsync lui-même échouer proprement si le
  // push n'est vraiment pas supporté (simulateur iOS classique, etc.). C'est
  // un cas géré, pas une erreur — un simple log, pas un warning plein écran.
  if (!Device.isDevice) {
    console.log('[push] Device.isDevice=false — on tente quand même l\'enregistrement.');
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    for (const channel of ANDROID_CHANNELS) {
      await Notifications.setNotificationChannelAsync(channel.id, channel);
    }
  }

  try {
    // projectId requis pour les builds de production (EAS)
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (err) {
    console.warn('[push] getExpoPushTokenAsync a échoué:', err?.message || err);
    return null;
  }
}

// Set by SecureExamTakeScreen while a proctored exam is on screen — tapping
// a notification backgrounds+foregrounds the app exactly like switching to
// another app does, which is legitimately caught by the exam's own
// AppState-based anti-cheat detection (see SecureExamTakeScreen.js). Without
// this guard, navigateFromNotification below would *also* fire on that same
// foreground event and forcibly navigate to Finance/Présences/Notifications,
// yanking the student off the secured exam screen right as the suspension
// modal should be appearing — "the detection fires, but it never brings me
// back to the exam" was this: the detection was working, something else was
// immediately navigating away from it.
let examInProgress = false;
export function setExamInProgress(value) {
  examInProgress = value;
}

/**
 * Navigue vers l'écran approprié selon le type de notification.
 * Appelé aussi bien depuis l'état background que killed.
 */
export function navigateFromNotification(navigationRef, notification) {
  if (examInProgress) return;
  if (!navigationRef?.current?.isReady?.()) return;
  const data = notification?.request?.content?.data ?? {};
  const type = (data.notification_type ?? data.type ?? '').toUpperCase();

  try {
    switch (type) {
      case 'PAYMENT':
        // Onglet Finance du parent
        navigationRef.current.navigate('Finance');
        break;
      case 'ATTENDANCE':
      case 'ABSENCE':
        // ABSENCE = absent, ATTENDANCE = retard → les deux vont dans Présences
        navigationRef.current.navigate('Présences');
        break;
      default:
        navigationRef.current.navigate('Notifications');
    }
  } catch {
    // L'écran n'existe pas dans le navigateur courant — pas critique
  }
}

/**
 * Hook principal à appeler une seule fois quand l'utilisateur est authentifié.
 *
 * @param {object} navigationRef  - ref créée par useNavigationContainerRef()
 * @param {function} onNewNotification - callback appelé à chaque notification reçue (foreground)
 */
export default function usePushNotifications(navigationRef, onNewNotification) {
  const notifListener    = useRef(null);
  const responseListener = useRef(null);

  useEffect(() => {
    let active = true;

    (async () => {
      const token = await registerForPushNotificationsAsync();
      if (!active || !token) return;

      // Sauvegarde locale pour le désenregistrement au logout
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

      try {
        await notificationsService.registerDeviceToken(token);
      } catch (err) {
        console.warn('[push] registerDeviceToken (API) a échoué:', err?.response?.status, err?.message || err);
      }
    })();

    // Notification reçue pendant que l'app est au premier plan
    notifListener.current = Notifications.addNotificationReceivedListener(() => {
      onNewNotification?.();
    });

    // Utilisateur a tapé la notification (app en arrière-plan)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      onNewNotification?.();
      navigateFromNotification(navigationRef, response.notification);
    });

    return () => {
      active = false;
      if (notifListener.current)
        Notifications.removeNotificationSubscription(notifListener.current);
      if (responseListener.current)
        Notifications.removeNotificationSubscription(responseListener.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Utilitaire appelé au logout pour désinscrire le token. */
export async function unregisterPushToken() {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (token) {
      await notificationsService.unregisterDeviceToken(token);
      await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
    }
  } catch {
    // Pas critique
  }
}
