import { getDownloadURL, ref, getMetadata } from "firebase/storage";
import { storage } from "./config";

export interface ImageMetadata {
  sizeBytes: number;
  fileExtension: string;
  downloadURL: string;
  cacheControl?: string | null;
}

export const getImageMetadata = async (
  storagePath: string
): Promise<ImageMetadata | null> => {
  if (!storagePath) {
    console.warn("getImageMetadata: storagePath is empty.");
    return null;
  }

  try {
    const imageRef = ref(storage, storagePath);
    const metadata = await getMetadata(imageRef);
    const downloadURL = await getDownloadURL(imageRef);

    const sizeBytes = metadata.size;
    const contentType = metadata.contentType;
    let fileExtension = "unknown";

    if (contentType) {
      const parts = contentType.split("/");
      if (parts.length > 1) {
        fileExtension = parts[1];
      }
    }

    return { sizeBytes, fileExtension, downloadURL, cacheControl: (metadata as any).cacheControl || null };
  } catch (error) {
    console.error("Error fetching image metadata for path:", storagePath, error);
    return null;
  }
};

/**
 * Utility function to compress, resize, and convert images to WebP format client-side.
 * Enforces a maximum resolution of 1200x800 while maintaining aspect ratio.
 * Iteratively reduces quality to meet the target file size.
 */
export const convertToWebP = (
  file: File,
  options: { quality?: number; maxSizeBytes?: number } = {}
): Promise<Blob> => {
  const {
    quality: initialQuality = 0.7,
    maxSizeBytes: MAX_SIZE_BYTES = 100 * 1024
  } = options;

  const MAX_WIDTH = 1200;
  const MAX_HEIGHT = 800;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = async () => {
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        let quality = initialQuality;
        let blob: Blob | null = null;

        // Iterative compression
        for (let q = quality; q >= 0.1; q -= 0.05) {
          blob = await new Promise<Blob | null>((res) => {
            canvas.toBlob((b) => res(b), 'image/webp', q);
          });

          if (blob && blob.size <= MAX_SIZE_BYTES) {
            break; // Target size reached
          }
        }

        if (blob && blob.size > MAX_SIZE_BYTES) {
            const finalSize = (blob.size / 1024).toFixed(1);
            const targetSize = (MAX_SIZE_BYTES / 1024).toFixed(1);
            reject(new Error(`Ukuran gambar (${finalSize}KB) masih terlalu besar setelah kompresi. Target: ${targetSize}KB.`));
            return;
        }

        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas toBlob failed'));
        }
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Converts an image for the hero slideshow.
 * - Converts to WebP at a fixed 90% quality.
 * - Iteratively downsizes dimensions until the file is under 150KB.
 * - Throws an error if the file is too large.
 */
export const convertHeroImage = (file: File): Promise<Blob> => {
  const QUALITY = 0.9;
  const MAX_SIZE_BYTES = 150 * 1024; // 150KB
  const MIN_WIDTH = 400;
  const MIN_HEIGHT = 225;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Failed to get canvas context'));

        let width = img.width;
        let height = img.height;
        let blob: Blob | null = null;

        for (let attempt = 0; attempt < 12; attempt++) {
          canvas.width = Math.round(width);
          canvas.height = Math.round(height);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          blob = await new Promise<Blob | null>((res) => {
            canvas.toBlob((b) => res(b), 'image/webp', QUALITY);
          });

          if (!blob) {
            reject(new Error('Gagal melakukan konversi ke WebP.'));
            return;
          }

          if (blob.size <= MAX_SIZE_BYTES) {
            resolve(blob);
            return;
          }

          const nextWidth = Math.round(width * 0.9);
          const nextHeight = Math.round(height * 0.9);
          if (nextWidth < MIN_WIDTH || nextHeight < MIN_HEIGHT) {
            break;
          }
          width = nextWidth;
          height = nextHeight;
        }

        const actualSize = blob ? (blob.size / 1024).toFixed(1) : 'unknown';
        reject(new Error(`Ukuran file setelah konversi (${actualSize}KB) melebihi batas 150KB pada kualitas 90%.`));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Extracts the Firebase Storage path from a Firebase Storage download URL.
 * Returns null if the URL is not a valid Firebase Storage download URL.
 * Example:
 * https://firebasestorage.googleapis.com/v0/b/project.appspot.com/o/images%2Fitem.webp?alt=media...
 * -> images/item.webp
 */
export const getStoragePathFromDownloadURL = (downloadURL: string): string | null => {
  try {
    const url = new URL(downloadURL);
    if (url.hostname.includes("firebasestorage.googleapis.com")) {
      const path = decodeURIComponent(url.pathname);
      const oIndex = path.indexOf("/o/");
      if (oIndex !== -1) {
        // Path starts after "/o/" and before any query parameters (like ?alt=media)
        let storagePath = path.substring(oIndex + 3);
        const qIndex = storagePath.indexOf("?"); // Remove any query params that might be encoded
        if (qIndex !== -1) {
          storagePath = storagePath.substring(0, qIndex);
        }
        return storagePath;
      }
    }
  } catch (error) {
    console.error("Error parsing download URL:", error);
  }
  return null;
};

export const convertUrlToWebP = async (
  imageUrl: string,
  options: { quality?: number; maxSizeBytes?: number } = {}
): Promise<Blob> => {
  try {
    // Note: This fetch might fail due to CORS if the image is not from Firebase Storage
    // or if the storage rules are not configured to allow cross-origin access.
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Gagal mengunduh gambar: ${response.statusText}`);
    }
    const blob = await response.blob();
    
    // Create a temporary File object to pass to convertToWebP
    const tempFile = new File([blob], "temp_image_file", { type: blob.type });

    // Use the existing utility to convert and compress
    const webpBlob = await convertToWebP(tempFile, options);
    return webpBlob;

  } catch (error) {
    console.error("Gagal melakukan konversi dari URL:", error);
    throw new Error('Proses konversi gambar dari URL gagal.');
  }
};
