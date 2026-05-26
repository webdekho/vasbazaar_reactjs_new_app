import { Preferences } from "@capacitor/preferences";

const PIN_KEY = "vb_pin_secure";

export const pinStorage = {
  save: async (pin) => {
    try {
      await Preferences.set({ key: PIN_KEY, value: pin });
      return true;
    } catch {
      return false;
    }
  },

  get: async () => {
    try {
      const { value } = await Preferences.get({ key: PIN_KEY });
      return value || null;
    } catch {
      return null;
    }
  },

  clear: async () => {
    try {
      await Preferences.remove({ key: PIN_KEY });
    } catch {
      // ignore
    }
  },
};
