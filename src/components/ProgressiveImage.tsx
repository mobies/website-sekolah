import React, { useState, useEffect } from 'react';
import { Spinner } from 'react-bootstrap';

interface ProgressiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  placeholderColor?: string;
}

const ProgressiveImage: React.FC<ProgressiveImageProps> = ({ 
  src, 
  alt, 
  className, 
  style, 
  placeholderColor = '#f8f9fa',
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
