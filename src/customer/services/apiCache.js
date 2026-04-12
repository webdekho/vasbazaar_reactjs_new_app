/**
 * PERFORMANCE FIX: Persistent API cache with request deduplication.
 *
 * Problem: getUserProfile() was called from ~6 places simultaneously,
 * services/ads/notifications fetched repeatedly on every navigation.
 *
 * Solution: Cache GET responses with configurable TTL using localStorage
 * for persistence across page reloads. If an identical request is already
 * in-flight, return the same Promise (deduplication).
 * After mutations (recharge, payment), call invalidate() to bust cache.
 */

const CACHE_PREFIX = "vb_api_cache_";
const inflight = new Map();

// Helper to get from localStorage
const getFromStorage = (key) => {
  try {
    const item = localStorage.getItem(CACHE_PREFIX + key);
    if (item) {
      return JSON.parse(item);
    }
  } catch (e) {
    // Ignore parse errors
  }
  return null;
};

// Helper to save to localStorage
const saveToStorage = (key, data) => {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    // Ignore storage errors (quota exceeded, etc.)
  }
};

// Helper to remove from localStorage
const removeFromStorage = (key) => {
  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch (e) {
    // Ignore errors
  }
};

/**
 * Wraps an async fetcher with caching and in-flight deduplication.
 * @param {string} key - Unique cache key (e.g. "getUserProfile")
 * @param {Function} fetcher - Async function that returns the API response
 * @param {number} ttlMs - Time-to-live in milliseconds (default 30s)
 * @returns {Promise} Cached or fresh response
 */
export const cachedFetch = async (key, fetcher, ttlMs = 30000) => {
  // Return cached data if still valid (from localStorage)
  const entry = getFromStorage(key);
  if (entry && Date.now() - entry.timestamp < ttlMs) {
    return entry.data;
  }

  // Deduplicate: if same request is already in-flight, reuse its Promise
  if (inflight.has(key)) {
    return inflight.get(key);
  }

  // Make fresh request
  const promise = fetcher().then((result) => {
    // Only cache successful responses
    if (result && result.success) {
      saveToStorage(key, result);
    }
    inflight.delete(key);
    return result;
  }).catch((err) => {
    inflight.delete(key);
    throw err;
  });

  inflight.set(key, promise);
  return promise;
};

/** Invalidate a specific cache entry (use after mutations) */
export const invalidate = (key) => {
  removeFromStorage(key);
};

/** Invalidate all cache entries (use on logout or major state change) */
export const invalidateAll = () => {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    // Ignore errors
  }
};
