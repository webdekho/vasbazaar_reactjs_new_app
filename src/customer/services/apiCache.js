/**
 * PERFORMANCE FIX: In-memory API cache with request deduplication.
 *
 * Problem: getUserProfile() was called from ~6 places simultaneously,
 * services/ads/notifications fetched repeatedly on every navigation.
 *
 * Solution: Cache GET responses with configurable TTL. If an identical
 * request is already in-flight, return the same Promise (deduplication).
 * After mutations (recharge, payment), call invalidate() to bust cache.
 */

const cache = new Map();
const inflight = new Map();

/**
 * Wraps an async fetcher with caching and in-flight deduplication.
 * @param {string} key - Unique cache key (e.g. "getUserProfile")
 * @param {Function} fetcher - Async function that returns the API response
 * @param {number} ttlMs - Time-to-live in milliseconds (default 30s)
 * @returns {Promise} Cached or fresh response
 */
export const cachedFetch = async (key, fetcher, ttlMs = 30000) => {
  // Return cached data if still valid
  const entry = cache.get(key);
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
      cache.set(key, { data: result, timestamp: Date.now() });
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
  cache.delete(key);
};

/** Invalidate all cache entries (use on logout or major state change) */
export const invalidateAll = () => {
  cache.clear();
};
