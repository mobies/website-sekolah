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
    // Return role as 'owner' if valid
    return { isValid: snapshot.exists(), uid: uid, role: snapshot.exists() ? 'owner' : undefined };
  } catch (error) {
    logger.error("Error checking owner validity:", error);
    throw new HttpsError('internal', 'Error checking owner status.');
  }
});

// ... (getAdminUidByEmail remains the same)

/**
 * Memverifikasi apakah user yang login memiliki otoritas admin atau owner untuk tenant tertentu.
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
    // 1. Cek apakah user adalah Owner (otoritas tertinggi)
    const ownerRef = db.ref(`owners/${uid}`);
    const ownerSnapshot = await ownerRef.once('value');
    if (ownerSnapshot.exists()) {
      return { isValid: true, role: 'owner' };
    }

    // 2. Cek di path settings internal tenant (Primary Source for Admin)
    const settingsRef = db.ref(`tenants/${tenantId}/settings/adminUid`);
    const snapshot = await settingsRef.once('value');
    
    if (snapshot.exists() && snapshot.val() === uid) {
      return { isValid: true, role: 'admin' };
    }

    // 3. Cek di tenant-lists (Secondary/Fallback Source for Admin)
    const listRef = db.ref(`tenant-lists/${tenantId}/adminUid`);
    const listSnapshot = await listRef.once('value');

    if (listSnapshot.exists() && listSnapshot.val() === uid) {
      return { isValid: true, role: 'admin' };
    }

    return { isValid: false, reason: 'UID mismatch or not authorized' };
  } catch (error) {
    logger.error(`Error verifying admin/owner for tenant ${tenantId}:`, error);
    throw new HttpsError('internal', 'Verification process failed.');
  }
});

/**
 * Set editor role untuk staff berdasarkan email.
 * Simpan data editor ke /editor/{tenantId}/{uid}
 */
export const setEditorRole = onCall({
  cors: true,
  region: "us-central1"
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be logged in.');
  }

  const { tenantId, email, staffName, staffId } = request.data;
  
  // Validasi input
  if (!tenantId || !email) {
    throw new HttpsError('invalid-argument', 'Tenant ID and email are required.');
  }

  const adminUid = request.auth.uid;
  const db = admin.database();
  const auth = admin.auth();

  try {
    // 1. Verify admin/owner authority
    const ownerRef = db.ref(`owners/${adminUid}`);
    const ownerSnapshot = await ownerRef.once('value');
    let isAuthorized = ownerSnapshot.exists();

    if (!isAuthorized) {
      const settingsRef = db.ref(`tenants/${tenantId}/settings/adminUid`);
      const settingsSnapshot = await settingsRef.once('value');
      isAuthorized = settingsSnapshot.exists() && settingsSnapshot.val() === adminUid;
    }

    if (!isAuthorized) {
      const listRef = db.ref(`tenant-lists/${tenantId}/adminUid`);
      const listSnapshot = await listRef.once('value');
      isAuthorized = listSnapshot.exists() && listSnapshot.val() === adminUid;
    }

    if (!isAuthorized) {
      throw new HttpsError('permission-denied', 'Not authorized to set editor role.');
    }

    // 2. Lookup UID dari email
    let targetUid: string;
    try {
      const userRecord = await auth.getUserByEmail(email);
      targetUid = userRecord.uid;
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        throw new HttpsError('not-found', `User dengan email ${email} tidak ditemukan. Pastikan user sudah terdaftar di Firebase.`);
      }
      throw error;
    }

    // 3. Simpan editor data ke /editor/{tenantId}/{uid}
    const editorData = {
      uid: targetUid,
      email: email,
      staffName: staffName || '',
      staffId: staffId || '',
      createdAt: new Date().toISOString(),
      createdBy: adminUid,
      tenantId: tenantId
    };

    await db.ref(`editor/${tenantId}/${targetUid}`).set(editorData);

    logger.info(`Editor role set for ${email} (${targetUid}) in tenant ${tenantId}`);

    return {
      success: true,
      message: `Editor berhasil diaktifkan untuk ${email}`,
      uid: targetUid,
      email: email
    };
  } catch (error: any) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error(`Error setting editor role for ${email}:`, error);
    throw new HttpsError('internal', 'Error setting editor role: ' + error.message);
  }
});

/**
 * Remove editor role untuk staff.
 * Hapus data dari /editor/{tenantId}/{uid}
 */
export const removeEditorRole = onCall({
  cors: true,
  region: "us-central1"
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be logged in.');
  }

  const { tenantId, uid, email } = request.data;

  if (!tenantId || (!uid && !email)) {
    throw new HttpsError('invalid-argument', 'Tenant ID dan UID atau email diperlukan.');
  }

  const adminUid = request.auth.uid;
  const db = admin.database();
  const auth = admin.auth();

  try {
    // 1. Verify admin/owner authority
    const ownerRef = db.ref(`owners/${adminUid}`);
    const ownerSnapshot = await ownerRef.once('value');
    let isAuthorized = ownerSnapshot.exists();

    if (!isAuthorized) {
      const settingsRef = db.ref(`tenants/${tenantId}/settings/adminUid`);
      const settingsSnapshot = await settingsRef.once('value');
      isAuthorized = settingsSnapshot.exists() && settingsSnapshot.val() === adminUid;
    }

    if (!isAuthorized) {
      const listRef = db.ref(`tenant-lists/${tenantId}/adminUid`);
      const listSnapshot = await listRef.once('value');
      isAuthorized = listSnapshot.exists() && listSnapshot.val() === adminUid;
    }

    if (!isAuthorized) {
      throw new HttpsError('permission-denied', 'Not authorized to remove editor role.');
    }

    let targetUid = uid;
    if (!targetUid && email) {
      try {
        const userRecord = await auth.getUserByEmail(email);
        targetUid = userRecord.uid;
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          throw new HttpsError('not-found', `User dengan email ${email} tidak ditemukan.`);
        }
        throw error;
      }
    }

    if (!targetUid) {
      throw new HttpsError('invalid-argument', 'UID or valid email is required to remove editor role.');
    }

    // 2. Hapus editor data
    await db.ref(`editor/${tenantId}/${targetUid}`).remove();

    logger.info(`Editor role removed for UID ${targetUid} in tenant ${tenantId}`);

    return {
      success: true,
      message: `Editor berhasil dinonaktifkan untuk UID ${targetUid}`,
      uid: targetUid
    };
  } catch (error: any) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error(`Error removing editor role for ${uid || email}:`, error);
    throw new HttpsError('internal', 'Error removing editor role: ' + error.message);
  }
});
