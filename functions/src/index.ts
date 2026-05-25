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
