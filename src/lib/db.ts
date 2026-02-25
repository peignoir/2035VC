import type { IgniteEvent, EventPresentation } from '../types';

const DB_NAME = 'ignite-events';
const DB_VERSION = 2;

let dbInstance: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    console.log('[DB] Opening database, version', DB_VERSION);
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      const oldVersion = e.oldVersion;
      console.log('[DB] Upgrading from version', oldVersion, 'to', DB_VERSION);

      if (oldVersion < 1) {
        db.createObjectStore('events', { keyPath: 'id' });
        const presStore = db.createObjectStore('presentations', { keyPath: 'id' });
        presStore.createIndex('eventId', 'eventId', { unique: false });
        db.createObjectStore('logos');
        db.createObjectStore('pdfs');
      }

      if (oldVersion < 2) {
        db.createObjectStore('recordings');
      }
    };

    // Handle blocked upgrade (old connection still open in another tab/HMR)
    request.onblocked = () => {
      console.warn('[DB] Upgrade blocked — another tab holds the old connection. Falling back...');
      // Fall back: open without version requirement so we don't hang forever
      const fallback = indexedDB.open(DB_NAME);
      fallback.onsuccess = (e) => {
        dbInstance = (e.target as IDBOpenDBRequest).result;
        dbInstance.onversionchange = () => {
          dbInstance?.close();
          dbInstance = null;
        };
        console.log('[DB] Fallback opened at version', dbInstance.version);
        resolve(dbInstance);
      };
      fallback.onerror = () => reject(fallback.error);
    };

    request.onsuccess = (e) => {
      dbInstance = (e.target as IDBOpenDBRequest).result;
      console.log('[DB] Opened successfully at version', dbInstance.version);

      // If another context requests a version upgrade, close gracefully
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };

      resolve(dbInstance);
    };
    request.onerror = () => {
      console.error('[DB] Open error:', request.error);
      reject(request.error);
    };
  });
}

function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Events CRUD ──

export async function getAllEvents(): Promise<IgniteEvent[]> {
  const db = await openDb();
  const tx = db.transaction('events', 'readonly');
  const store = tx.objectStore('events');
  const events = await reqToPromise(store.getAll());
  return events.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getEvent(id: string): Promise<IgniteEvent | undefined> {
  const db = await openDb();
  const tx = db.transaction('events', 'readonly');
  const store = tx.objectStore('events');
  return reqToPromise(store.get(id));
}

export async function putEvent(event: IgniteEvent): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('events', 'readwrite');
  tx.objectStore('events').put(event);
  await txComplete(tx);
}

export async function deleteEvent(id: string): Promise<void> {
  const db = await openDb();
  const hasRec = hasRecordingsStore(db);
  const stores = ['events', 'presentations', 'logos', 'pdfs'];
  if (hasRec) stores.push('recordings');
  const tx = db.transaction(stores, 'readwrite');

  tx.objectStore('events').delete(id);
  tx.objectStore('logos').delete(id);

  // Cascade: delete all presentations and their PDFs + recordings
  const presStore = tx.objectStore('presentations');
  const index = presStore.index('eventId');
  const presRequest = index.getAll(id);
  presRequest.onsuccess = () => {
    const presentations: EventPresentation[] = presRequest.result;
    for (const pres of presentations) {
      presStore.delete(pres.id);
      tx.objectStore('pdfs').delete(pres.id);
      if (hasRec) tx.objectStore('recordings').delete(pres.id);
    }
  };

  await txComplete(tx);
}

// ── Presentations CRUD ──

export async function getEventPresentations(eventId: string): Promise<EventPresentation[]> {
  const db = await openDb();
  const tx = db.transaction('presentations', 'readonly');
  const index = tx.objectStore('presentations').index('eventId');
  const presentations = await reqToPromise(index.getAll(eventId));
  return presentations.sort((a, b) => a.order - b.order);
}

export async function putPresentation(pres: EventPresentation): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('presentations', 'readwrite');
  tx.objectStore('presentations').put(pres);
  await txComplete(tx);
}

export async function deletePresentation(id: string): Promise<void> {
  const db = await openDb();
  const stores = ['presentations', 'pdfs'];
  if (hasRecordingsStore(db)) stores.push('recordings');
  const tx = db.transaction(stores, 'readwrite');
  tx.objectStore('presentations').delete(id);
  tx.objectStore('pdfs').delete(id);
  if (hasRecordingsStore(db)) tx.objectStore('recordings').delete(id);
  await txComplete(tx);
}

export async function reorderPresentations(eventId: string, orderedIds: string[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('presentations', 'readwrite');
  const store = tx.objectStore('presentations');
  const index = store.index('eventId');
  const presentations: EventPresentation[] = await reqToPromise(index.getAll(eventId));

  for (const pres of presentations) {
    const newOrder = orderedIds.indexOf(pres.id);
    if (newOrder !== -1 && newOrder !== pres.order) {
      store.put({ ...pres, order: newOrder });
    }
  }

  await txComplete(tx);
}

// ── Logo blobs ──

export async function getLogoBlob(eventId: string): Promise<Blob | undefined> {
  const db = await openDb();
  const tx = db.transaction('logos', 'readonly');
  return reqToPromise(tx.objectStore('logos').get(eventId));
}

export async function putLogoBlob(eventId: string, blob: Blob): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('logos', 'readwrite');
  tx.objectStore('logos').put(blob, eventId);
  await txComplete(tx);
}

export async function deleteLogoBlob(eventId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('logos', 'readwrite');
  tx.objectStore('logos').delete(eventId);
  await txComplete(tx);
}

// ── PDF blobs ──

export async function getPdfBlob(presentationId: string): Promise<Blob | undefined> {
  const db = await openDb();
  const tx = db.transaction('pdfs', 'readonly');
  return reqToPromise(tx.objectStore('pdfs').get(presentationId));
}

export async function putPdfBlob(presentationId: string, blob: Blob): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('pdfs', 'readwrite');
  tx.objectStore('pdfs').put(blob, presentationId);
  await txComplete(tx);
}

// ── Recording blobs ──

function hasRecordingsStore(db: IDBDatabase): boolean {
  return db.objectStoreNames.contains('recordings');
}

export async function getRecordingBlob(presentationId: string): Promise<Blob | undefined> {
  const db = await openDb();
  if (!hasRecordingsStore(db)) return undefined;
  const tx = db.transaction('recordings', 'readonly');
  return reqToPromise(tx.objectStore('recordings').get(presentationId));
}

export async function putRecordingBlob(presentationId: string, blob: Blob): Promise<void> {
  const db = await openDb();
  if (!hasRecordingsStore(db)) {
    console.warn('[DB] recordings store not available — close other tabs and reload');
    return;
  }
  const tx = db.transaction('recordings', 'readwrite');
  tx.objectStore('recordings').put(blob, presentationId);
  await txComplete(tx);
}

export async function deleteRecordingBlob(presentationId: string): Promise<void> {
  const db = await openDb();
  if (!hasRecordingsStore(db)) return;
  const tx = db.transaction('recordings', 'readwrite');
  tx.objectStore('recordings').delete(presentationId);
  await txComplete(tx);
}
