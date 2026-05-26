import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

admin.initializeApp();

/**
 * Memeriksa apakah pengguna adalah Owner yang sah.
 */
export const authIsOwnerValid = onCall({
  cors: true,
  region: "us-central1"
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be logged in.');
  }

  const uid = request.auth.uid;
  const db = admin.database();
  
  try {
    const snapshot = await db.ref(`owners/${uid}`).once('value');
    return { isValid: snapshot.exists(), uid: uid };
  } catch (error) {
    logger.error("Error checking owner validity:", error);
    throw new HttpsError('internal', 'Error checking owner status.');
  }
});

/**
 * Mengambil UID user berdasarkan email.
 * Digunakan oleh Owner untuk memverifikasi Admin Sekolah.
 */
export const getAdminUidByEmail = onCall({
  cors: true,
  region: "us-central1"
}, async (request) => {
  // Hanya user terautentikasi yang bisa memanggil (Owner)
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be logged in.');
  }

  const email = request.data.email;
  if (!email) {
    throw new HttpsError('invalid-argument', 'Email is required.');
  }

  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    return {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      exists: true
    };
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      return { exists: false };
    }
    logger.error("Error fetching user by email:", error);
    throw new HttpsError('internal', 'Error searching for user.');
  }
});

/**
 * Memverifikasi apakah user yang login memiliki otoritas admin untuk tenant tertentu.
 */
export const verifyAdminRole = onCall({
  cors: true,
  region: "us-central1"
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be logged in.');
  }

  const { tenantId } = request.data;
  if (!tenantId) {
    throw new HttpsError('invalid-argument', 'Tenant ID is required.');
  }

  const uid = request.auth.uid;
  const db = admin.database();

  try {
    // 1. Cek di path settings internal tenant (Primary Source)
    const settingsRef = db.ref(`tenants/${tenantId}/settings/adminUid`);
    const snapshot = await settingsRef.once('value');
    
    if (snapshot.exists() && snapshot.val() === uid) {
      return { isValid: true, role: 'admin' };
    }

    // 2. Cek di tenant-lists (Secondary/Fallback Source)
    const listRef = db.ref(`tenant-lists/${tenantId}/adminUid`);
    const listSnapshot = await listRef.once('value');

    if (listSnapshot.exists() && listSnapshot.val() === uid) {
      return { isValid: true, role: 'admin' };
    }

    return { isValid: false, reason: 'UID mismatch or not authorized' };
  } catch (error) {
    logger.error(`Error verifying admin for tenant ${tenantId}:`, error);
    throw new HttpsError('internal', 'Verification process failed.');
  }
});
