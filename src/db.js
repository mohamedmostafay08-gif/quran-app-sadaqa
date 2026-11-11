// غلاف بسيط لـ IndexedDB
const DB_NAME = 'quran-app';
const DB_VERSION = 1;

// الـ stores حسب نموذج البيانات في الخطة
const STORES = {
  ayahs: { keyPath: 'id' },              // { id: رقم السورة, ayahs: [...] }
  words: { keyPath: 'id' },              // (المرحلة 6) كلمات السورة
  bookmarks: { keyPath: 'id' },          // { id: 's:a', surah, ayah, createdAt }
  notes: { keyPath: 'id' },              // { id: 's:a', surah, ayah, text, color, updatedAt }
  memorize: { keyPath: 'id' },           // { id: 's:a', level, interval, due }
  khatma: { keyPath: 'id' },             // { id, type, start, days, progress }
  settings: { keyPath: 'key' },          // { key, value }
  downloads: { keyPath: 'id' },          // { id: 'reciter:surah', status, bytes }
};

let dbPromise;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, opts] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, opts);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => console.warn('IndexedDB blocked');
  });
  return dbPromise;
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name, mode = 'readonly') {
  const db = await openDB();
  return db.transaction(name, mode).objectStore(name);
}

export const db = {
  async get(name, key) { return wrap((await store(name)).get(key)); },
  async all(name) { return wrap((await store(name)).getAll()); },
  async keys(name) { return wrap((await store(name)).getAllKeys()); },
  async put(name, value) { return wrap((await store(name, 'readwrite')).put(value)); },
  async del(name, key) { return wrap((await store(name, 'readwrite')).delete(key)); },
  async clear(name) { return wrap((await store(name, 'readwrite')).clear()); },
  async count(name) { return wrap((await store(name)).count()); },
  /** كتابة مجموعة قيم في معاملة واحدة */
  async putMany(name, values) {
    const conn = await openDB();
    return new Promise((resolve, reject) => {
      const tx = conn.transaction(name, 'readwrite');
      const os = tx.objectStore(name);
      for (const v of values) os.put(v);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  },
};
