// IndexedDB cache of the raw /api/data/all/ payload (pre-Decimal JSON), so a
// mobile tab discard can rehydrate instantly without a network round-trip.
// We store the RAW API shape — Decimal objects don't serialize — and re-run
// the DataContext transforms on rehydrate.

const DB_NAME = 'expense-tracker-cache';
const STORE = 'kv';
const SCHEMA_VERSION = 2; // bump to invalidate cached shape (v2: bootstrap payload, no transactions/entries)

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Key the cache by auth token so a different login can't read stale data.
function cacheKey() {
  const token = localStorage.getItem('authToken') || 'anon';
  return `alldata:v${SCHEMA_VERSION}:${token}`;
}

export async function readCachedData() {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(cacheKey());
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('dataCache: read failed', err);
    return null;
  }
}

export async function writeCachedData(rawPayload) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(rawPayload, cacheKey());
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('dataCache: write failed', err);
  }
}
