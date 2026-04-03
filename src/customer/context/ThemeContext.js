import { createContext, useContext, useEffect, useState, useCallback } from "react";

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("vb_theme") || "dark";
  });

  // Update native status bar and navigation bar
  const updateStatusBar = useCallback(async (currentTheme) => {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;

      const { StatusBar, Style } = await import("@capacitor/status-bar");
      const colors = currentTheme === "light"
        ? { backgroundColor: "#FFFFFF", style: Style.Light, navBarColor: "#FFFFFF", navBarLight: true }
        : { backgroundColor: "#0B0B0B", style: Style.Dark, navBarColor: "#0B0B0B", navBarLight: false };

      await StatusBar.setBackgroundColor({ color: colors.backgroundColor });
      await StatusBar.setStyle({ style: colors.style });
      await StatusBar.setOverlaysWebView({ overlay: false });

      // Update Android navigation bar via JavaScript interface
      if (window.AndroidNavigationBar?.setColor) {
        window.AndroidNavigationBar.setColor(colors.navBarColor, colors.navBarLight);
      }
    } catch (e) {
      // Silently fail on web or if plugin not available
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("vb_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    updateStatusBar(theme);
  }, [theme, updateStatusBar]);

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
