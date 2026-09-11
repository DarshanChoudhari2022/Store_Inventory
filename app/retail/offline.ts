// Device-local drafts/outbox only. The authenticated server remains authoritative.
export type PendingSale = {
  id: string;
  shopId: string;
  data: Record<string, unknown>;
  created: string;
  rejection?: string;
};
const DB = "storestock-offline-v1";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("records");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function readLocal<T>(key: string): Promise<T | undefined> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("records", "readonly");
      const r = tx.objectStore("records").get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
export async function writeLocal(key: string, value: unknown) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("records", "readwrite");
      tx.objectStore("records").put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function clearLocalSession(session: string) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("records", "readwrite");
      const r = tx.objectStore("records").openCursor();
      r.onsuccess = () => {
        const c = r.result;
        if (c) {
          if (String(c.key).startsWith(session + ":")) c.delete();
          c.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function listLocal<T>(prefix: string): Promise<T[]> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const values: T[] = [];
      const tx = db.transaction("records", "readonly");
      const r = tx.objectStore("records").openCursor();
      r.onsuccess = () => {
        const c = r.result;
        if (c) {
          if (String(c.key).startsWith(prefix)) values.push(c.value);
          c.continue();
        }
      };
      tx.oncomplete = () => resolve(values);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function removeLocal(key: string) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("records", "readwrite");
      tx.objectStore("records").delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
