import { useState, useEffect, useCallback } from 'react';
import { notificationService } from '../../customer/services/notificationService';

export function useNotificationCount(pollIntervalMs = 300000) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await notificationService.getNotifications(0);
      if (res.success && res.data) {
        const total = res.data.totalRecords || res.data.length || 0;
        setCount(total);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    refresh();
    if (pollIntervalMs > 0) {
      const timer = setInterval(refresh, pollIntervalMs);
      return () => clearInterval(timer);
    }
  }, [refresh, pollIntervalMs]);

  return { count, refresh };
}

export default useNotificationCount;
