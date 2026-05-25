/**
 * Utility function to compress, resize, and convert images to WebP format client-side.
 * Enforces a maximum resolution of 1200x800 while maintaining aspect ratio.
 */
export const convertToWebP = (file: File, initialQuality: number = 0.7): Promise<Blob> => {
  const MAX_WIDTH = 1200;
  const MAX_HEIGHT = 800;
  const MAX_SIZE_BYTES = 200 * 1024; // 200KB

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
        do {
          blob = await new Promise<Blob | null>((res) => {
            canvas.toBlob((b) => res(b), 'image/webp', quality);
          });
          
          if (!blob) break;
          
          if (blob.size > MAX_SIZE_BYTES && quality > 0.1) {
            quality -= 0.05; // Reduce quality by 5% each step
          } else {
            break;
          }
        } while (quality > 0.1);

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
