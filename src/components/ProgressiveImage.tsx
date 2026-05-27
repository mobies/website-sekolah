import React, { useState, useEffect } from 'react';
import { Spinner } from 'react-bootstrap';
import type { ImageMetadata } from '../firebase/imageUtils'; // Import ImageMetadata

interface ProgressiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  placeholderColor?: string;
  imageMetadata?: ImageMetadata; // New prop for metadata
}

// Helper function to format bytes
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  alt,
  className,
  style,
  placeholderColor = '#f8f9fa',
  imageMetadata, // Destructure new prop
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    setIsLoaded(false);
    const img = new Image();
    if (src) {
      img.src = src;
      img.onload = () => {
        setCurrentSrc(src);
        setIsLoaded(true);
      };
      img.onerror = () => { // Add error handling for image loading
        setCurrentSrc(undefined); // Clear src on error
        setIsLoaded(true); // Treat as loaded to stop spinner, perhaps show broken image icon
      };
    } else {
      setIsLoaded(true); // If no src, consider it loaded (no image to load)
    }
  }, [src]);

  return (
    <div
      className={`progressive-image-container ${className || ''}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: isLoaded ? 'transparent' : placeholderColor,
        display: 'inline-block',
        width: style?.width || '100%',
        height: style?.height || 'auto',
        ...style
      }}
    >
      {!isLoaded && (
        <div
          className="d-flex align-items-center justify-content-center"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1
          }}
        >
          <Spinner animation="grow" variant="success" size="sm" />
        </div>
      )}

      {currentSrc && (
        <>
          <img
            {...props}
            src={currentSrc}
            alt={alt}
            style={{
              ...style,
              opacity: isLoaded ? 1 : 0,
              transition: 'opacity 0.5s ease-in-out',
              width: '100%',
              height: '100%',
              display: 'block'
            }}
          />
          {isLoaded && imageMetadata && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                backgroundColor: 'rgba(0,0,0,0.6)',
                color: 'white',
                fontSize: '0.75em',
                padding: '2px 5px',
                borderRadius: '3px 0 0 0',
                zIndex: 2,
                display: 'flex',
                gap: '5px',
                alignItems: 'center'
              }}
            >
              <span>{formatBytes(imageMetadata.sizeBytes)}</span>
              <span>.{imageMetadata.fileExtension}</span>
            </div>
          )}
        </>
      )}

      <style>{`
        .progressive-image-container img {
          object-fit: cover;
        }
      `}</style>
    </div>
  );
};

export default ProgressiveImage;
