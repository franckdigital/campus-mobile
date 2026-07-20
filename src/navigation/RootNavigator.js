import React, { useEffect, useState } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import AppNavigator from './AppNavigator';
import { navigateFromNotification } from '../hooks/usePushNotifications';

export default function RootNavigator() {
  const navigationRef = useNavigationContainerRef();
  // Notification en attente quand l'app était tuée (killed state)
  const [pendingNotification, setPendingNotification] = useState(null);

  useEffect(() => {
    // L'utilisateur a tapé une notification alors que l'app était fermée
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification) {
        setPendingNotification(response.notification);
      }
    });
  }, []);

  // Dès que le navigateur est prêt, on traite la notification en attente
  const handleNavigatorReady = () => {
    if (pendingNotification) {
      navigateFromNotification(navigationRef, pendingNotification);
      setPendingNotification(null);
    }
  };

  return (
    <NavigationContainer ref={navigationRef} onReady={handleNavigatorReady}>
      <AppNavigator navigationRef={navigationRef} />
    </NavigationContainer>
  );
}
