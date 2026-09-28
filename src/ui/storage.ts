/**
 * The browser side of saving: one IndexedDB store, keyed by slot. Every call
 * fails soft (private windows, blocked storage): the game runs without saves.
 */
import type { SaveFile } from '../sim/save';

const DB = 'survive-story', STORE = 'saves';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  try {
    const db = await open();
    return await new Promise<T | null>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => { db.close(); resolve(req.result ?? null); };
      t.onerror = () => { db.close(); reject(t.error); };
      t.onabort = () => { db.close(); reject(t.error); };
    });
  } catch (e) {
    console.warn('Save storage unavailable:', e);
    return null;
  }
}

export const readSave = (slot = 'auto') => tx<SaveFile>('readonly', (s) => s.get(slot) as IDBRequest<SaveFile>);
export const writeSave = (save: SaveFile, slot = 'auto') => tx<IDBValidKey>('readwrite', (s) => s.put(save, slot));
export const deleteSave = (slot = 'auto') => tx<undefined>('readwrite', (s) => s.delete(slot));
