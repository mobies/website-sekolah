import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import { auth, rtdb } from './config';
import { useTenant } from './TenantContext';

export const useIsOwner = () => {
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const { tenantId } = useTenant();

  useEffect(() => {
    setLoading(true);
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user && tenantId) {
        const ownerRef = ref(rtdb, `owners/${user.uid}`);
        const unsubscribeOwner = onValue(ownerRef, (snapshot) => {
          setIsOwner(snapshot.exists());
          setLoading(false);
        }, (error) => {
          console.error("Error checking owner status:", error);
          setIsOwner(false);
          setLoading(false);
        });
        return () => unsubscribeOwner();
      } else {
        setIsOwner(false);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [tenantId]);

  return { isOwner, loading };
};
