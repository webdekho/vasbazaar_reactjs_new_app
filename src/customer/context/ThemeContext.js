import { createContext, useContext, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

const ThemeContext = createContext(null);

// Status bar colors matching app theme
const STATUS_BAR_CONFIG = {
  dark: {
    backgroundColor: '#0B0B0B',
    style: Style.Dark, // Light text on dark background
  },
  light: {
    backgroundColor: '#FFFFFF',
    style: Style.Light, // Dark text on light background
  },
};

// Update native status bar based on theme
const updateStatusBar = async (theme) => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const config = STATUS_BAR_CONFIG[theme] || STATUS_BAR_CONFIG.dark;
    await StatusBar.setBackgroundColor({ color: config.backgroundColor });
    await StatusBar.setStyle({ style: config.style });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (error) {
    console.warn('StatusBar update failed:', error);
  }
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("vb_theme") || "dark";
  });

  useEffect(() => {
    localStorage.setItem("vb_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    updateStatusBar(theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ThemeContext unavailable");
  return context;
};
