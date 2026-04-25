// Central Tawk.to widget config + loader.
// Update `TAWK_TO_ID` here and every caller picks it up.

export const TAWK_TO_ID = "69d12d7f9680621c33789831/1jlchjfg2";

// Lazy-load the Tawk widget the first time it's needed, then maximize.
// Subsequent calls only call `.maximize()` on the already-loaded widget.
export const openTawkChat = () => {
  if (typeof window === "undefined") return;

  if (window.Tawk_API?.maximize) {
    window.Tawk_API.showWidget?.();
    window.Tawk_API.maximize();
    return;
  }

  window.Tawk_API = window.Tawk_API || {};
  window.Tawk_LoadStart = new Date();

  const existing = document.querySelector('script[data-tawk-loader="1"]');
  if (existing) return; // already loading

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://embed.tawk.to/${TAWK_TO_ID}`;
  script.charset = "UTF-8";
  script.setAttribute("crossorigin", "*");
  script.setAttribute("data-tawk-loader", "1");
  document.head.appendChild(script);
  script.onload = () => {
    setTimeout(() => window.Tawk_API?.maximize?.(), 1200);
  };
};
