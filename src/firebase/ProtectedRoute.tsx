import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './config';
import { Spinner } from 'react-bootstrap';
import { useTenant } from './TenantContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, redirectTo }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const { tenantId } = useTenant();
  const location = useLocation();

  useEffect(() => {
    // Wait for tenantId detection
    if (tenantId === undefined) return;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // 1. Basic Auth check
        const isAuth = !!user;
        
        // 2. Admin Verification check from Session Storage
        // This avoids calling the DB/Cloud Function on every page navigation
        const isTenantAdminVerified = sessionStorage.getItem(`admin_verified_${tenantId}`) === 'true';
        const isOwnerVerified = sessionStorage.getItem('owner_verified') === 'true';
        
        // If logged in via Firebase but not verified as Admin/Owner, 
        // we force them to go to the login page to trigger the Cloud Function check.
        setAuthenticated(isAuth && (isTenantAdminVerified || isOwnerVerified));
      } else {
        setAuthenticated(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId]);

  if (loading) {
    return (
      <div className="vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center">
           <Spinner animation="border" variant="success" className="mb-2" />
           <p className="text-muted small">Memeriksa hak akses...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    // We append the current location so we can redirect back after login if needed
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
