import React, { useState, useEffect } from 'react';
import { Carousel, Container } from 'react-bootstrap';
import { useTenant } from '../firebase/TenantContext';
import { getDBRef } from '../firebase/utils';
import { onValue } from 'firebase/database';
import ProgressiveImage from './ProgressiveImage';
import { FaFacebook, FaInstagram, FaTwitter, FaYoutube, FaLinkedin, FaTiktok, FaTelegram, FaWhatsapp, FaPinterest, FaGithub, FaDiscord, FaLink } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';

interface Slide {
  id: string;
  url: string;
  title: string;
  subtitle: string;
  objectFit?: 'cover' | 'contain' | 'fill';
}

interface SocialMediaItem {
  url: string;
  active: boolean;
}

interface HeroLogo {
  id: string;
  url: string;
  align: 'left' | 'right';
  active: boolean;
}

const Hero: React.FC = () => {
  const { tenantId } = useTenant();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [socialMedia, setSocialMedia] = useState<Record<string, SocialMediaItem> | null>(null);
  const [heroLogos, setHeroLogos] = useState<HeroLogo[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    const settingsRef = getDBRef(tenantId, 'settings/heroSlides');
    const socialRef = getDBRef(tenantId, 'settings/socialMedia');
    const heroLogoRef = getDBRef(tenantId, 'settings/heroLogos');
    
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      let rawSlides: Slide[] = [];

      if (data && data.length > 0) {
        rawSlides = data;
      } else if (data) { // Handle object structure from Firebase
        rawSlides = Object.values(data).filter((slide: any) =>
          slide && typeof slide === 'object' && slide.id && slide.url
        ) as Slide[];
      } else {
        rawSlides = [
          {
            id: '1',
            url: 'https://images.unsplash.com/photo-1523050335392-9bef867a0578?q=80&w=1920&auto=format&fit=crop',
            title: 'Selamat Datang',
            subtitle: 'Madrasah Tsanawiyah Negeri 1 Garut',
            objectFit: 'cover'
          }
        ];
      }
      setSlides(rawSlides);
    });

    const unsubSocial = onValue(socialRef, (snapshot) => {
      setSocialMedia(snapshot.val() || null);
    });

    const unsubHeroLogos = onValue(heroLogoRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setHeroLogos([]);
        return;
      }
      const list = Array.isArray(data) ? data : Object.values(data);
      setHeroLogos(list as HeroLogo[]);
    });

    return () => {
      unsubscribe();
      unsubSocial();
      unsubHeroLogos();
    };
  }, [tenantId]);

  const activeHeroLogos = heroLogos.filter(item => item.active && item.url);
  const leftHeroLogos = activeHeroLogos.filter(item => item.align === 'left');
  const rightHeroLogos = activeHeroLogos.filter(item => item.align === 'right');

  return (
    <div className="position-relative">
      {socialMedia && (
        <div className="position-absolute top-0 end-0 p-4" style={{ zIndex: 10, maxWidth: '240px' }}>
          <div className="d-flex flex-wrap justify-content-start gap-2">
            {Object.entries(socialMedia).map(([platform, data]) => {
              if (!data.active || !data.url) return null;
              let Icon = FaLink;
              let iconColor = '#666666';
              if (platform === 'facebook') { Icon = FaFacebook; iconColor = '#1877F2'; }
              else if (platform === 'instagram') { Icon = FaInstagram; iconColor = '#E4405F'; }
              else if (platform === 'youtube') { Icon = FaYoutube; iconColor = '#FF0000'; }
              else if (platform === 'twitter') { Icon = FaTwitter; iconColor = '#1DA1F2'; }
              else if (platform === 'x') { Icon = FaXTwitter; iconColor = '#000000'; }
              else if (platform === 'linkedin') { Icon = FaLinkedin; iconColor = '#0A66C2'; }
              else if (platform === 'tiktok') { Icon = FaTiktok; iconColor = '#000000'; }
              else if (platform === 'telegram') { Icon = FaTelegram; iconColor = '#26A5E4'; }
              else if (platform === 'whatsapp') { Icon = FaWhatsapp; iconColor = '#25D366'; }
              else if (platform === 'pinterest') { Icon = FaPinterest; iconColor = '#E60023'; }
              else if (platform === 'github') { Icon = FaGithub; iconColor = '#333333'; }
              else if (platform === 'discord') { Icon = FaDiscord; iconColor = '#5865F2'; }

              return (
                <a key={platform} href={data.url} target="_blank" rel="noopener noreferrer" className="hero-social-icon shadow" title={platform} style={{ color: iconColor }}>
                  <Icon size={18} />
                </a>
              );
            })}
          </div>
        </div>
      )}
      <Carousel fade interval={5000} className="bg-dark hero-carousel">
        {slides.map((slide) => (
          <Carousel.Item key={slide.id} style={{ height: 'calc(100vh - 61px)' }}>
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
                  objectFit: slide.objectFit || 'cover',
                  zIndex: 0
                }}
                placeholderColor="#212529"
              />
              <div className="h-100 d-flex align-items-center justify-content-center text-white position-relative" 
                   style={{ 
                     backgroundColor: 'rgba(0,0,0,0.1)',
                     zIndex: 1
                   }}>
                <Container className="text-center" style={{ textShadow: '0 4px 12px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8)' }}>
                  <h1 className="display-3 fw-bold mb-3 animate-up"><span style={{ fontSize: '80%' }}>{slide.title}</span></h1>
                  <p className="lead mb-4 fs-4 animate-up-delayed"><span style={{ fontSize: '150%' }}>{slide.subtitle}</span></p>
                </Container>
              </div>
              {activeHeroLogos.length > 0 && (
                <div className="hero-logo-overlay">
                  <div className="hero-logo-column hero-logo-column-left">
                    {leftHeroLogos.map(item => (
                      <img key={item.id} src={item.url} alt="Hero Logo" className="hero-bottom-logo" />
                    ))}
                  </div>
                  <div className="hero-logo-column hero-logo-column-right">
                    {rightHeroLogos.map(item => (
                      <img key={item.id} src={item.url} alt="Hero Logo" className="hero-bottom-logo" />
                    ))}
                  </div>
                </div>
              )}
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
        .hero-social-icon {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #ffffff;
          border-radius: 50%;
          transition: all 0.3s ease;
          border: 1px solid rgba(255,255,255,0.8);
        }
        .hero-social-icon:hover {
          background-color: #f8f9fa;
          transform: translateY(-3px);
          box-shadow: 0 6px 12px rgba(0,0,0,0.2) !important;
        }
        .hero-logo-overlay {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 25%;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding: 1rem 2rem 1.75rem;
          background: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.12) 45%, rgba(0,0,0,0.25) 100%);
          z-index: 2;
          pointer-events: none;
        }
        .hero-logo-column {
          display: flex;
          gap: 1rem;
          align-items: flex-end;
          flex-wrap: wrap;
          width: 48%;
          pointer-events: none;
        }
        .hero-logo-column-left {
          justify-content: flex-start;
        }
        .hero-logo-column-right {
          justify-content: flex-end;
          margin-left: auto;
        }
        .hero-bottom-logo {
          max-width: 180px;
          max-height: 72px;
          object-fit: contain;
          filter: drop-shadow(0 6px 14px rgba(0,0,0,0.65)) drop-shadow(0 2px 6px rgba(0,0,0,0.5));
        }
        @media (max-width: 768px) {
          .hero-logo-overlay {
            padding: 0.75rem 1rem 1.25rem;
          }
          .hero-logo-column {
            width: 50%;
            gap: 0.75rem;
          }
          .hero-bottom-logo {
            max-width: 120px;
            max-height: 52px;
          }
        }
      `}</style>
    </div>
  );
};

export default Hero;
