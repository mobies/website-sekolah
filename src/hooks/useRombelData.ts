import { rtdb as database } from '../firebase/config';
import { ref as dbRef, get, update } from 'firebase/database';

interface RombelData {
  name: string;
  wali_kelas: string;
  members?: string[] | null;
  createdAt?: number;
  updatedAt?: number;
}

interface RombelItem extends RombelData {
  id: string; // composite: tahunAjaranNama_idKelas
  tahunAjaranNama: string;
  idKelas: string;
}

/**
 * Custom hook for rombel data management
 * Handles CRUD + student member sync to both rombel and siswa records
 */
export const useRombelData = () => {
  /**
   * Load all rombels for a specific tahun ajaran
   */
  const loadRombelList = async (
    tenantId: string,
    tahunAjaranNama: string
  ): Promise<RombelItem[]> => {
    try {
      const path = `tenants/${tenantId}/references/rombel/${tahunAjaranNama}`;
      const snapshot = await get(dbRef(database, path));

      if (!snapshot.exists()) {
        return [];
      }

      const items: RombelItem[] = [];
      const data = snapshot.val();

      // data structure: { "kelas1": {...}, "kelas2": {...} }
      Object.entries(data).forEach(([idKelas, rombelData]: any) => {
        items.push({
          id: `${tahunAjaranNama}_${idKelas}`,
          tahunAjaranNama,
          idKelas,
          ...(rombelData as RombelData)
        });
      });

      return items;
    } catch (err) {
      console.error('Error loading rombel list:', err);
      throw err;
    }
  };

  /**
   * Get single rombel data
   */
  const getRombel = async (
    tenantId: string,
    tahunAjaranNama: string,
    idKelas: string
  ): Promise<RombelData | null> => {
    try {
      const path = `tenants/${tenantId}/references/rombel/${tahunAjaranNama}/${idKelas}`;
      const snapshot = await get(dbRef(database, path));

      if (!snapshot.exists()) {
        return null;
      }

      return snapshot.val() as RombelData;
    } catch (err) {
      console.error('Error getting rombel:', err);
      throw err;
    }
  };

  /**
   * Create or update rombel
   */
  const saveRombel = async (
    tenantId: string,
    tahunAjaranNama: string,
    idKelas: string,
    data: { name: string; wali_kelas: string; members?: string[] | null }
  ): Promise<void> => {
    try {
      const path = `tenants/${tenantId}/references/rombel/${tahunAjaranNama}/${idKelas}`;

      const dataToSave: RombelData = {
        name: data.name,
        wali_kelas: data.wali_kelas,
        members: data.members || null,
        updatedAt: Date.now(),
        createdAt: (await getRombel(tenantId, tahunAjaranNama, idKelas))?.createdAt || Date.now()
      };

      await update(dbRef(database, path), dataToSave);
    } catch (err) {
      console.error('Error saving rombel:', err);
      throw err;
    }
  };

  /**
   * Delete rombel and remove from all students' rombel records
   */
  const deleteRombel = async (
    tenantId: string,
    tahunAjaranNama: string,
    idKelas: string
  ): Promise<void> => {
    try {
      // Get rombel data first to know who to update
      const rombel = await getRombel(tenantId, tahunAjaranNama, idKelas);
      if (!rombel) return;

      const updates: any = {};

      // Delete rombel itself
      const rombelPath = `tenants/${tenantId}/references/rombel/${tahunAjaranNama}/${idKelas}`;
      updates[rombelPath] = null;

      // Remove rombel reference from all members
      if (rombel.members && Array.isArray(rombel.members)) {
        rombel.members.forEach(nisn => {
          const siswaRombelPath = `tenants/${tenantId}/references/siswa/${nisn}/rombel/${tahunAjaranNama}/${idKelas}`;
          updates[siswaRombelPath] = null;
        });
      }

      await update(dbRef(database), updates);
    } catch (err) {
      console.error('Error deleting rombel:', err);
      throw err;
    }
  };

  /**
   * Add student to rombel
   * Updates both rombel/members and siswa/rombel records
   */
  const addStudentToRombel = async (
    tenantId: string,
    tahunAjaranNama: string,
    idKelas: string,
    nisn: string
  ): Promise<void> => {
    try {
      const rombel = await getRombel(tenantId, tahunAjaranNama, idKelas);
      if (!rombel) throw new Error('Rombel not found');

      // Check if already in rombel
      if (rombel.members && rombel.members.includes(nisn)) {
        throw new Error('Siswa sudah ada di rombel ini');
      }

      // Check if student exists
      const siswaPath = `tenants/${tenantId}/references/siswa/${nisn}`;
      const siswaSnapshot = await get(dbRef(database, siswaPath));
      if (!siswaSnapshot.exists()) {
        throw new Error('Siswa tidak ditemukan');
      }

      const updates: any = {};

      // Update rombel members array
      const members = rombel.members || [];
      const rombelPath = `tenants/${tenantId}/references/rombel/${tahunAjaranNama}/${idKelas}/members`;
      updates[rombelPath] = [...members, nisn];

      // Update siswa rombel record
      const siswaRombelPath = `tenants/${tenantId}/references/siswa/${nisn}/rombel/${tahunAjaranNama}/${idKelas}`;
      updates[siswaRombelPath] = true;

      await update(dbRef(database), updates);
    } catch (err) {
      console.error('Error adding student to rombel:', err);
      throw err;
    }
  };

  /**
   * Remove student from rombel
   * Updates both rombel/members and siswa/rombel records
   */
  const removeStudentFromRombel = async (
    tenantId: string,
    tahunAjaranNama: string,
    idKelas: string,
    nisn: string
  ): Promise<void> => {
    try {
      const rombel = await getRombel(tenantId, tahunAjaranNama, idKelas);
      if (!rombel) throw new Error('Rombel not found');

      const updates: any = {};

      // Update rombel members array (remove nisn)
      if (rombel.members && rombel.members.includes(nisn)) {
        const updatedMembers = rombel.members.filter(m => m !== nisn);
        const rombelPath = `tenants/${tenantId}/references/rombel/${tahunAjaranNama}/${idKelas}/members`;
        updates[rombelPath] = updatedMembers.length > 0 ? updatedMembers : null;
      }

      // Remove siswa rombel record
      const siswaRombelPath = `tenants/${tenantId}/references/siswa/${nisn}/rombel/${tahunAjaranNama}/${idKelas}`;
      updates[siswaRombelPath] = null;

      await update(dbRef(database), updates);
    } catch (err) {
      console.error('Error removing student from rombel:', err);
      throw err;
    }
  };

  /**
   * Move student from one rombel to another (same tahun ajaran)
   */
  const moveStudentToRombel = async (
    tenantId: string,
    tahunAjaranNama: string,
    oldKelas: string,
    newKelas: string,
    nisn: string
  ): Promise<void> => {
    try {
      const oldRombel = await getRombel(tenantId, tahunAjaranNama, oldKelas);
      const newRombel = await getRombel(tenantId, tahunAjaranNama, newKelas);

      if (!oldRombel) throw new Error('Rombel asal tidak ditemukan');
      if (!newRombel) throw new Error('Rombel tujuan tidak ditemukan');

      const updates: any = {};

      // Remove from old rombel
      if (oldRombel.members && oldRombel.members.includes(nisn)) {
        const oldMembers = oldRombel.members.filter(m => m !== nisn);
        const oldPath = `tenants/${tenantId}/references/rombel/${tahunAjaranNama}/${oldKelas}/members`;
        updates[oldPath] = oldMembers.length > 0 ? oldMembers : null;
      }

      // Add to new rombel
      const newMembers = newRombel.members || [];
      if (!newMembers.includes(nisn)) {
        const newPath = `tenants/${tenantId}/references/rombel/${tahunAjaranNama}/${newKelas}/members`;
        updates[newPath] = [...newMembers, nisn];
      }

      // Update siswa rombel record (remove old, add new)
      const oldSiswaPath = `tenants/${tenantId}/references/siswa/${nisn}/rombel/${tahunAjaranNama}/${oldKelas}`;
      updates[oldSiswaPath] = null;

      const newSiswaPath = `tenants/${tenantId}/references/siswa/${nisn}/rombel/${tahunAjaranNama}/${newKelas}`;
      updates[newSiswaPath] = true;

      await update(dbRef(database), updates);
    } catch (err) {
      console.error('Error moving student to rombel:', err);
      throw err;
    }
  };

  /**
   * Bulk add students to rombel
   */
  const bulkAddStudentsToRombel = async (
    tenantId: string,
    tahunAjaranNama: string,
    idKelas: string,
    nisns: string[]
  ): Promise<{ success: string[]; failed: { nisn: string; error: string }[] }> => {
    const results = { success: [] as string[], failed: [] as { nisn: string; error: string }[] };

    for (const nisn of nisns) {
      try {
        await addStudentToRombel(tenantId, tahunAjaranNama, idKelas, nisn);
        results.success.push(nisn);
      } catch (err: any) {
        results.failed.push({ nisn, error: err.message || 'Unknown error' });
      }
    }

    return results;
  };

  /**
   * Bulk remove students from rombel
   */
  const bulkRemoveStudentsFromRombel = async (
    tenantId: string,
    tahunAjaranNama: string,
    idKelas: string,
    nisns: string[]
  ): Promise<{ success: string[]; failed: { nisn: string; error: string }[] }> => {
    const results = { success: [] as string[], failed: [] as { nisn: string; error: string }[] };

    for (const nisn of nisns) {
      try {
        await removeStudentFromRombel(tenantId, tahunAjaranNama, idKelas, nisn);
        results.success.push(nisn);
      } catch (err: any) {
        results.failed.push({ nisn, error: err.message || 'Unknown error' });
      }
    }

    return results;
  };

  /**
   * Get available rombels for a tahun ajaran (for move operations)
   */
  const getAvailableRombels = async (
    tenantId: string,
    tahunAjaranNama: string,
    excludeKelas?: string
  ): Promise<Array<{ idKelas: string; name: string }>> => {
    try {
      const rombels = await loadRombelList(tenantId, tahunAjaranNama);
      return rombels
        .filter(r => (excludeKelas ? r.idKelas !== excludeKelas : true))
        .map(r => ({ idKelas: r.idKelas, name: r.name }));
    } catch (err) {
      console.error('Error getting available rombels:', err);
      return [];
    }
  };

  return {
    loadRombelList,
    getRombel,
    saveRombel,
    deleteRombel,
    addStudentToRombel,
    removeStudentFromRombel,
    moveStudentToRombel,
    bulkAddStudentsToRombel,
    bulkRemoveStudentsFromRombel,
    getAvailableRombels
  };
};
