// Device-local drafts/outbox only. The authenticated server remains authoritative.
export function isNetworkFailure(error: unknown): boolean {
  if (typeof error === 'object' && error !== null && 'status' in error && Number(error.status) >= 500 && (!('code' in error) || !error.code)) return true;
  const message = error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error);
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed|network connection.*lost/i.test(message);
}
export type PendingSale = {
  id: string;
  shopId: string;
  data: Record<string, unknown>;
  created: string;
  rejection?: string;
};
const DB = "storestock-offline-v1";
// Upgrade old cache keys that included bearer tokens, preserving every draft
// and unsynced request. These opaque namespaces confer no server access.
export async function removeLegacyTokenKeys() {
  const db = await open();
  try {
    const keys = await new Promise<IDBValidKey[]>((resolve,reject)=>{
      const request=db.transaction('records','readonly').objectStore('records').getAllKeys();
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    const prefixes=[...new Set(keys.map(String).map(key=>key.split(':')[0]).filter(key=>/^[a-f0-9-]{36}$/i.test(key)))];
    for(const prefix of prefixes){
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('legacy-cache:'+prefix));
      const replacement='legacy-'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
      await new Promise<void>((resolve,reject)=>{
        const tx=db.transaction('records','readwrite'),store=tx.objectStore('records'),request=store.openCursor();
        request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;const key=String(cursor.key);if(key.startsWith(prefix+':')){store.put(cursor.value,replacement+key.slice(prefix.length));cursor.delete();}cursor.continue();};
        tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });
    }
  } finally {db.close();}
}
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

// Call only after the server has verified access to this shop. Reauthentication
// changes the session token; a pending bill must keep its original request ID.
export async function recoverShopPending(shopId: string, namespace: string) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("records", "readwrite");
      const records = tx.objectStore("records");
      const request = records.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const sale = cursor.value as PendingSale;
        const key = String(cursor.key);
        if (sale?.shopId === shopId && sale.id && key.endsWith(':sale:' + sale.id)) {
          const nextKey = namespace + ':sale:' + sale.id;
          if (key !== nextKey) { records.put(sale, nextKey); cursor.delete(); }
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
