import React, { createContext, useContext, useState, useCallback } from 'react';
import notificationsService from '../services/notifications';

const NotificationContext = createContext({ unreadCount: 0, refreshCount: () => {} });

export function NotificationProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshCount = useCallback(async () => {
    try {
      const res = await notificationsService.getUnreadCount();
      setUnreadCount(res?.count ?? 0);
    } catch {
      // non-fatal
    }
  }, []);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
