import { useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

// Status bar colors matching app theme
const COLORS = {
  dark: {
    backgroundColor: '#0B0B0B',
    style: Style.Dark, // Light text on dark background
  },
  light: {
    backgroundColor: '#FFFFFF',
    style: Style.Light, // Dark text on light background
  },
};

export const useStatusBar = (theme = 'dark') => {
  const updateStatusBar = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const colors = COLORS[theme] || COLORS.dark;

      // Set status bar color
      await StatusBar.setBackgroundColor({ color: colors.backgroundColor });

      // Set status bar style (text/icon color)
      await StatusBar.setStyle({ style: colors.style });

      // Make status bar overlay the webview (for transparent effect)
      await StatusBar.setOverlaysWebView({ overlay: false });
    } catch (error) {
      console.warn('StatusBar update failed:', error);
    }
  }, [theme]);

  useEffect(() => {
    updateStatusBar();
  }, [updateStatusBar]);

  return { updateStatusBar };
};

export default useStatusBar;
