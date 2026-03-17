/* ═══════════════════════════════════════════════════════════════
   VASBAZAAR — Centralized Theme Constants
   Futuristic Fintech Design System
   ═══════════════════════════════════════════════════════════════ */

const theme = {
  colors: {
    // Primary backgrounds
    bgMain: '#0B0B0B',
    bgSecondary: '#121212',
    bgCard: '#1A1A1A',

    // Primary gradient
    gradientStart: '#40E0D0',
    gradientEnd: '#007BFF',
    gradient: 'linear-gradient(135deg, #40E0D0, #007BFF)',

    // Text
    textPrimary: '#FFFFFF',
    textSecondary: '#B0B0B0',
    textDisabled: '#6B6B6B',

    // Accent
    success: '#00C853',
    warning: '#FF9800',
    error: '#FF3B30',
    accent: '#40E0D0',

    // Borders / Dividers
    border: '#2A2A2A',
    borderLight: 'rgba(255, 255, 255, 0.06)',

    // Buttons
    btnPrimaryBg: 'linear-gradient(135deg, #40E0D0, #007BFF)',
    btnSecondaryBg: '#1A1A1A',
    btnSecondaryBorder: '#2A2A2A',
    btnDisabledBg: '#2A2A2A',
    btnDisabledText: '#6B6B6B',

    // Inputs
    inputBg: '#121212',
    inputBorder: '#2A2A2A',
    inputFocusBorder: '#007BFF',

    // Overlay
    overlay: 'rgba(0, 0, 0, 0.7)',
  },

  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },

  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    xxl: '28px',
    full: '999px',
  },

  shadows: {
    card: '0 4px 24px rgba(0, 0, 0, 0.3)',
    glow: '0 0 20px rgba(64, 224, 208, 0.15)',
    btnGlow: '0 8px 32px rgba(64, 224, 208, 0.25)',
    elevated: '0 12px 40px rgba(0, 0, 0, 0.4)',
  },

  fonts: {
    family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif",
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
      black: 900,
    },
  },
};

export default theme;
