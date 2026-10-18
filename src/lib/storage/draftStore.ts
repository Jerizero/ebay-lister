import { Photo, PhotoGroup, Listing } from '@/types';

const DB_NAME = 'ebay-lister-db';
const DB_VERSION = 1;
const STORE_NAME = 'workspace';
const SESSION_KEY = 'active-session';

export type PersistedStep = 'upload' | 'review-groups' | 'grouped' | 'editing';

interface StoredPhoto {
  id: string;
  name: string;
  type: string;
  blob: Blob;
  groupId?: string;
}

interface StoredPhotoGroup {
  id: string;
  photoIds: string[];
  confidence: number;
  aiDescription?: string;
  flagged?: boolean;
}

interface StoredListing extends Omit<Listing, 'photos'> {
  photoIds: string[];
}

interface StoredSession {
  step: PersistedStep;
  photos: StoredPhoto[];
  groups: StoredPhotoGroup[];
  listings: StoredListing[];
  updatedAt: string;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveSessionToDb(params: {
  step: PersistedStep;
  photos: Photo[];
  groups: PhotoGroup[];
  listings: Listing[];
}): Promise<void> {
  const db = await openDb();
  if (!db) return;

  const storedPhotos: StoredPhoto[] = params.photos.map((p) => ({
    id: p.id,
    name: p.file.name || `${p.id}.jpg`,
    type: p.file.type || 'image/jpeg',
    blob: p.file,
    groupId: p.groupId,
  }));

  const storedGroups: StoredPhotoGroup[] = params.groups.map((g) => ({
    id: g.id,
    photoIds: g.photos.map((p) => p.id),
    confidence: g.confidence,
    aiDescription: g.aiDescription,
    flagged: g.flagged,
  }));

  const storedListings: StoredListing[] = params.listings.map((l) => {
    const { photos, ...rest } = l;
    return {
      ...rest,
      photoIds: photos.map((p) => p.id),
    };
  });

  const payload: StoredSession = {
    step: params.step,
    photos: storedPhotos,
    groups: storedGroups,
    listings: storedListings,
    updatedAt: new Date().toISOString(),
  };

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(payload, SESSION_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadSessionFromDb(): Promise<{
  step: PersistedStep;
  photos: Photo[];
  groups: PhotoGroup[];
  listings: Listing[];
  updatedAt: string;
} | null> {
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(SESSION_KEY);

      req.onsuccess = () => {
        const data = req.result as StoredSession | undefined;
        if (!data || !Array.isArray(data.photos) || data.photos.length === 0) {
          resolve(null);
          return;
        }

        const photoMap = new Map<string, Photo>();
        const photos: Photo[] = data.photos.map((sp) => {
          const file =
            sp.blob instanceof File
              ? sp.blob
              : new File([sp.blob], sp.name, { type: sp.type || 'image/jpeg' });
          const url = URL.createObjectURL(file);
          const photo: Photo = {
            id: sp.id,
            file,
            url,
            groupId: sp.groupId,
          };
          photoMap.set(sp.id, photo);
          return photo;
        });

        const groups: PhotoGroup[] = (data.groups || [])
          .map((sg) => ({
            id: sg.id,
            photos: sg.photoIds
              .map((id) => photoMap.get(id))
              .filter((p): p is Photo => Boolean(p)),
            confidence: sg.confidence,
            aiDescription: sg.aiDescription,
            flagged: sg.flagged,
          }))
          .filter((g) => g.photos.length > 0);

        const listings: Listing[] = (data.listings || []).map((sl) => {
          const { photoIds, ...rest } = sl;
          return {
            ...rest,
            photos: photoIds
              .map((id) => photoMap.get(id))
              .filter((p): p is Photo => Boolean(p)),
            createdAt: new Date(rest.createdAt),
            updatedAt: new Date(rest.updatedAt),
          };
        });

        resolve({
          step: data.step === 'editing' ? 'review-groups' : data.step,
          photos,
          groups,
          listings,
          updatedAt: data.updatedAt,
        });
      };

      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function clearSessionFromDb(): Promise<void> {
  const db = await openDb();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(SESSION_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
