import React, { useState, useEffect } from 'react';
import { Carousel, Button, Container } from 'react-bootstrap';
import { useTenant } from '../firebase/TenantContext';
import { getDBRef } from '../firebase/utils';
import { onValue } from 'firebase/database';
import ProgressiveImage from './ProgressiveImage';

interface Slide {
  id: string;
  url: string;
  title: string;
  subtitle: string;
}

const Hero: React.FC = () => {
  const { tenantId } = useTenant();
  const [slides, setSlides] = useState<Slide[]>([]);

  useEffect(() => {
    const settingsRef = getDBRef(tenantId, 'settings/heroSlides');
    onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Filter out null values and ensure slide is an object with a valid URL
        const validSlides = Object.values(data).filter((slide: any) => 
          slide && 
          typeof slide === 'object' && 
          slide.id &&
          slide.url && 
          slide.url.startsWith('http')
        );
        
        setSlides(validSlides as Slide[]);
      } else {
        // Fallback slides if none are set
        setSlides([
          {
            id: '1',
            url: 'https://images.unsplash.com/photo-1523050335392-9bef867a0578?q=80&w=1920&auto=format&fit=crop',
            title: 'Selamat Datang',
            subtitle: 'Madrasah Tsanawiyah Negeri 1 Garut'
          }
        ]);
      }
    });
  }, [tenantId]);

  return (
    <>
      <Carousel fade interval={5000} className="bg-dark hero-carousel">
        {slides.map((slide) => (
          <Carousel.Item key={slide.id} style={{ height: '600px' }}>
            <div className="h-100 position-relative overflow-hidden">
              <ProgressiveImage
                src={slide.url}
                alt={slide.title}
                style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  width: '100%', 
                  height: '100%',
                  zIndex: 0
                }}
                placeholderColor="#212529"
              />
              <div className="h-100 d-flex align-items-center justify-content-center text-white position-relative" 
                   style={{ 
                     backgroundColor: 'rgba(0,0,0,0.5)',
                     zIndex: 1
                   }}>
                <Container className="text-center">
                  <h1 className="display-3 fw-bold mb-3 animate-up">{slide.title}</h1>
                  <p className="lead mb-4 fs-4 animate-up-delayed">{slide.subtitle}</p>
                  <Button variant="success" size="lg" className="px-5 py-3 fw-bold rounded-pill shadow">Jelajahi Madrasah</Button>
                </Container>
              </div>
            </div>
          </Carousel.Item>
        ))}
      </Carousel>

      <style>{`
        .hero-carousel .carousel-indicators [data-bs-target] {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          margin: 0 5px;
        }
        .animate-up {
          animation: fadeInUp 1s ease-out;
        }
        .animate-up-delayed {
          animation: fadeInUp 1s ease-out 0.3s both;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

export default Hero;
