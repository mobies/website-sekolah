import React, { useState } from 'react';
import { FaSyncAlt } from 'react-icons/fa';
import { getStorage, ref as storageRef, getDownloadURL } from 'firebase/storage';
import { getDatabase, ref as dbRef, update } from 'firebase/database';
import { uploadBytesWithCache } from '../firebase/utils';

interface UpdateCacheIconProps {
  imageUrl: string;
  dbPath: string; // Realtime Database path to update image URL after upload
}

const UpdateCacheIcon: React.FC<UpdateCacheIconProps> = ({ imageUrl, dbPath }) => {
  const [loading, setLoading] = useState(false);

  const handleUpdateCache = async () => {
    setLoading(true);
    try {
      // Download old image data as blob
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      // Prepare Firebase Storage references
      const storage = getStorage();

      // Generate new filename with timestamp and same extension
      const urlParts = imageUrl.split('/');
      const oldFilename = urlParts[urlParts.length - 1];
      const dotIndex = oldFilename.lastIndexOf('.');
      const extension = dotIndex !== -1 ? oldFilename.substring(dotIndex) : '';
      const newFilename = `${Date.now()}_updated${extension}`;

      // Extract storage path from URL
      // e.g. https://firebasestorage.googleapis.com/v0/b/YOUR_APP.appspot.com/o/some%2Fpath%2Ffilename.jpg?alt=media

      const startIndex = imageUrl.indexOf('/o/') + 3;
      const endIndex = imageUrl.indexOf('?alt=media');
      const fullPathEncoded = imageUrl.substring(startIndex, endIndex);
      const fullPath = decodeURIComponent(fullPathEncoded);

      // fullPath includes filename, so replace old filename with new filename
      const newPath = fullPath.substring(0, fullPath.lastIndexOf('/') + 1) + newFilename;

      const newFileRef = storageRef(storage, newPath);

      // Upload blob with cache control
      await uploadBytesWithCache(newFileRef, blob);

      // Get new download URL
      const newUrl = await getDownloadURL(newFileRef);

      // Update RTDB path with new URL
      const database = getDatabase();
      await update(dbRef(database), { [dbPath]: newUrl });

      alert('Update cache sukses untuk gambar: ' + dbPath);
    } catch (error) {
      console.error('Gagal update cache gambar:', error);
      alert('Gagal update cache gambar. Lihat console untuk detail.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div onClick={handleUpdateCache} title="Update Cache Gambar" style={{ cursor: 'pointer', display: 'inline-block' }}>
      {loading ? <span>Loading...</span> : <FaSyncAlt color="blue" />}
    </div>
  );
};

export default UpdateCacheIcon;
