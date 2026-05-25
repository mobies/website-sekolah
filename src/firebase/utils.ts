import { ref, set, push, increment, update, serverTimestamp } from "firebase/database";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import { rtdb, storage } from "./config";

/**
 * RTDB Helpers
 */
export const getRootRef = (path: string) => {
  return ref(rtdb, path.startsWith('/') ? path.slice(1) : path);
};

export const getDBRef = (tenantId: string, path: string) => {
  return ref(rtdb, `tenants/${tenantId}/${path.startsWith('/') ? path.slice(1) : path}`);
};

/**
 * Activity Logging & Stats Helpers
 * Uses atomic updates to maintain counts and logs efficiently.
 */
export const logActivity = async (tenantId: string, activity: {
  action: 'TAMBAH' | 'EDIT' | 'HAPUS' | 'RESTORE';
  target: 'BERITA' | 'AGENDA' | 'PENGUMUMAN' | 'GALERI' | 'SLIDESHOW' | 'SETTINGS' | 'TENANT';
  title: string;
}) => {
  const logsRef = getDBRef(tenantId, 'logs');
  const newLogRef = push(logsRef);

  await set(newLogRef, {
    ...activity,
    timestamp: serverTimestamp()
  });
};

export const updateCounter = async (tenantId: string, key: string, value: number) => {
  const statsRef = getDBRef(tenantId, 'stats');
  await update(statsRef, {
    [key]: increment(value)
  });
};

/**
 * Storage Helpers
 */
export const getStorageRef = (tenantId: string, path: string) => {
  return storageRef(storage, `${tenantId}/${path.startsWith('/') ? path.slice(1) : path}`);
};

export const getFileUrl = async (tenantId: string, path: string) => {
  try {
    const fileRef = getStorageRef(tenantId, path);
    return await getDownloadURL(fileRef);
  } catch (error) {
    console.error("Error getting file URL:", error);
    return null;
  }
};
