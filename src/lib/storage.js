/** Tolerate browsers where localStorage is disabled or becomes unavailable.
 * Resolve storage lazily so even access to the property can fail safely.
 */
export function createSafeStore(getStorage = () => globalThis.localStorage) {
  return {
    get(key) {
      try { return getStorage().getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { getStorage().setItem(key, value); return true; } catch { return false; }
    },
    remove(key) {
      try { getStorage().removeItem(key); return true; } catch { return false; }
    }
  };
}
