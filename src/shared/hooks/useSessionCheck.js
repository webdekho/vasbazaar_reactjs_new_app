import { useEffect, useRef } from 'react';
import { isSessionValid, trackUserActivity, getRemainingSessionTime } from '../services/sessionManager';

export function useSessionCheck(onSessionExpired, intervalMs = 60000) {
  const callbackRef = useRef(onSessionExpired);
  callbackRef.current = onSessionExpired;

  useEffect(() => {
    // Track activity on user interactions
    const handleActivity = () => trackUserActivity();
    const events = ['click', 'keydown', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    // Periodic session check
    const timer = setInterval(() => {
      if (!isSessionValid()) {
        callbackRef.current?.();
      }
    }, intervalMs);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
      clearInterval(timer);
    };
  }, [intervalMs]);

  return { isSessionValid, getRemainingSessionTime };
}

export default useSessionCheck;
