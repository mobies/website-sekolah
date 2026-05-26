import { ref, set, push, increment, update, serverTimestamp } from "firebase/database";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import { rtdb, storage } from "./config";

/**
 * RTDB Helpers
 */
export const getRootRef = (path: string) => ref(rtdb, path);

export const getDBRef = (tenantId: string, path: string) => {
  return ref(rtdb, `tenants/${tenantId}/${path.startsWith('/') ? path.slice(1) : path}`);
};

export const logActivity = async (tenantId: string, data: {
  action: 'TAMBAH' | 'EDIT' | 'HAPUS' | 'RESTORE' | 'PULIHKAN' | 'HAPUS_PERMANEN' | 'UBAH_STATUS',
  target: 'BERITA' | 'AGENDA' | 'PENGUMUMAN' | 'GALERI' | 'SETTINGS' | 'SLIDESHOW' | 'VIDEO' | 'PROFIL' | 'STAFF',
  title: string
}) => {
  try {
    const logsRef = getDBRef(tenantId, 'logs');
    const newLogRef = push(logsRef);
    await set(newLogRef, {
      ...data,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
};

export const updateCounter = async (tenantId: string, key: string, value: number) => {
  const statsRef = getDBRef(tenantId, 'stats');
  await update(statsRef, {
    [key]: increment(value)
  });
};

export const updateTimeStats = async (
  tenantId: string, 
  category: 'news' | 'agenda' | 'announcement', 
  dateStr: string, 
  value: number
) => {
  const date = new Date(dateStr);
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  const updates: any = {};
  const basePath = `stats/${category}`;
  
  updates[`${basePath}/total`] = increment(value);
  updates[`${basePath}/years/${year}/total`] = increment(value);
  updates[`${basePath}/years/${year}/months/${month}/total`] = increment(value);
  updates[`${basePath}/years/${year}/months/${month}/days/${day}`] = increment(value);

  await update(getDBRef(tenantId, ''), updates);
};

export const updateCategoryStats = async (
  tenantId: string,
  categoryType: 'news' | 'agenda' | 'announcement',
  categoryName: string,
  value: number
) => {
  if (!categoryName) return;
  const updates: any = {};
  updates[`stats/${categoryType}/categories/${categoryName.toLowerCase()}`] = increment(value);
  await update(getDBRef(tenantId, ''), updates);
};

/**
 * Storage Helpers
 */
export const getStorageRef = (tenantId: string, path: string) => {
  return storageRef(storage, `${tenantId}/${path.startsWith('/') ? path.slice(1) : path}`);
};

export const getFileURL = async (tenantId: string, path: string) => {
  try {
    const fileRef = getStorageRef(tenantId, path);
    return await getDownloadURL(fileRef);
  } catch (error) {
    console.error("Error getting file URL:", error);
    return null;
  }
};
