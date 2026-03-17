import { STORAGE_KEYS } from '../constants/app';

const AUTH_KEYS = [
  STORAGE_KEYS.sessionToken,
  STORAGE_KEYS.sessionExpiry,
  STORAGE_KEYS.tempToken,
  STORAGE_KEYS.lastActivity,
];

export const softLogout = () => {
  AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
  return { success: true, type: 'soft' };
};

export const hardLogout = () => {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  return { success: true, type: 'hard' };
};

export const selectiveLogout = (preserveKeys = [STORAGE_KEYS.userData, STORAGE_KEYS.profilePhoto]) => {
  const allKeys = Object.values(STORAGE_KEYS);
  allKeys.filter((k) => !preserveKeys.includes(k)).forEach((k) => localStorage.removeItem(k));
  return { success: true, type: 'selective', preserved: preserveKeys };
};

export const performLogout = (strategy = 'soft', options = {}) => {
  let result;
  switch (strategy) {
    case 'hard':
      result = hardLogout();
      break;
    case 'selective':
      result = selectiveLogout(options.preserveKeys);
      break;
    default:
      result = softLogout();
  }
  if (result.success && typeof options.onLogoutComplete === 'function') {
    options.onLogoutComplete(result);
  }
  return result;
};
