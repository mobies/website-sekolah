import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, rtdb as database } from './config';
import { ref, get } from 'firebase/database';
import { useTenant } from './TenantContext';

interface EditorInfo {
  isEditor: boolean;
  staffId?: string;
  staffName?: string;
  userEmail?: string;
}

/**
 * Hook untuk mengecek apakah user yang login adalah editor
 * Check dari /editor/{tenantId}/{uid} path
 */
export const useEditor = (): EditorInfo => {
  const { tenantId } = useTenant();
  const [editorInfo, setEditorInfo] = useState<EditorInfo>({ isEditor: false });

  useEffect(() => {
    if (!tenantId) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setEditorInfo({ isEditor: false });
        return;
      }

      try {
        // Check /editor/{tenantId}/{uid} path
        const editorRef = ref(database, `editor/${tenantId}/${user.uid}`);
        const snapshot = await get(editorRef);

        if (snapshot.exists()) {
          const editorData = snapshot.val();
          setEditorInfo({
            isEditor: true,
            staffId: editorData.staffId,
            staffName: editorData.staffName,
            userEmail: editorData.email
          });
        } else {
          setEditorInfo({ isEditor: false, userEmail: user.email || undefined });
        }
      } catch (error) {
        console.error('Error checking editor status:', error);
        setEditorInfo({ isEditor: false, userEmail: user.email || undefined });
      }
    });

    return () => unsubscribe();
  }, [tenantId]);

  return editorInfo;
};
