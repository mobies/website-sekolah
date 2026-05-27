import React, { createContext, useContext, useState, useEffect } from 'react';
import { onValue } from 'firebase/database';
import { getDBRef } from './utils';

interface Terminology {
  school: string;     // Sekolah or Madrasah
  student: string;    // Siswa or Santri
  headmaster: string; // Kepala Lembaga or Kepala Madrasah
  berita: string;     // Berita or Kabar
}

interface TenantContextType {
  tenantId: string | undefined; // Changed to undefined for loading state
  domain: string;
  isDefault: boolean;
  level: string; // SD, MI, SMP, MTs, SMA, SMK, MA
  terms: Terminology;
  getStoragePath: (path: string) => string;
  getDatabasePath: (path: string) => string;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenantId, setTenantId] = useState<string | undefined>(undefined); // Start with undefined
  const [domain, setDomain] = useState<string>('');
  const [isDefault, setIsDefault] = useState<boolean>(true);
  const [level] = useState<string>('');
  const [terms] = useState<Terminology>({
    school: 'Sekolah',
    student: 'Siswa',
    headmaster: 'Kepala Lembaga',
    berita: 'Berita'
  });

  useEffect(() => {
    const hostname = window.location.hostname;
    let parts = hostname.split('.');
    
    // Jika ada www. di depan, kita buang agar mengambil nama domain aslinya
    if (parts[0] === 'www' && parts.length > 1) {
      parts.shift();
    }
    
    const detectedId = parts[0];
    
    // Simulating delay for robustness check
    setTimeout(() => {
        setTenantId(detectedId || '');
        setDomain(hostname);
        setIsDefault(hostname.includes('localhost') || hostname.includes('127.0.0.1'));
    }, 100);
  }, []);

  // Update Document Title & Favicon from Database Settings
  useEffect(() => {
    if (!tenantId) return;

    const settingsRef = getDBRef(tenantId, 'settings');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        if (data.schoolName) {
          document.title = data.schoolName;
        }
        if (data.logo) {
          let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.getElementsByTagName('head')[0].appendChild(link);
          }
          link.href = data.logo;
        }
      }
    });

    return () => unsubscribe();
  }, [tenantId]);

  const getStoragePath = (path: string) => tenantId ? `${tenantId}/${path.startsWith('/') ? path.slice(1) : path}` : '';
  const getDatabasePath = (path: string) => tenantId ? `tenants/${tenantId}/${path.startsWith('/') ? path.slice(1) : path}` : '';

  return (
    <TenantContext.Provider value={{ tenantId, domain, isDefault, level, terms, getStoragePath, getDatabasePath }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
