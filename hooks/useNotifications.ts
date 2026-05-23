import { useCallback, useState } from 'react';
import { toast } from 'sonner';

export function useNotifications() {
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') return;

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === 'granted') {
      toast.success('Notificações Ativadas!', {
        description: 'Você receberá alertas de novos pedidos na área de trabalho.'
      });
    }
  };

  const showSystemNotification = useCallback((title: string, body: string, tag = 'system-notification') => {
    if (notificationPermission !== 'granted') return;

    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag,
      requireInteraction: true
    });

    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      notification.close();
    };
  }, [notificationPermission]);

  return {
    notificationPermission,
    requestNotificationPermission,
    showSystemNotification
  };
}
