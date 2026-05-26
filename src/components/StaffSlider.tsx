import React, { useState, useEffect } from 'react';
import { Container, Card } from 'react-bootstrap';
import { ref, query, orderByChild, limitToLast, get } from 'firebase/database';
import { rtdb as database } from '../firebase/config';
import { useTenant } from '../firebase/TenantContext';
import ProgressiveImage from './ProgressiveImage';
import { Link } from 'react-router-dom';

interface StaffItem {
  id: string;
  name: string;
  photo: string;
  type: string;
  subject?: string;
  isActive: boolean;
  deleted?: boolean;
  createdAt: number;
}

const StaffSlider: React.FC = () => {
  const { tenantId, terms } = useTenant();
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    const fetchStaff = async () => {
      try {
        const staffRef = ref(database, `tenants/${tenantId}/staff`);
        // Fetch more items to ensure enough active, non-deleted staff for shuffling
        const staffQuery = query(staffRef, orderByChild('createdAt'), limitToLast(30)); // Fetch last 30 to shuffle
        const snapshot = await get(staffQuery);
        if (snapshot.exists()) {
          const data = snapshot.val();
          let list = Object.keys(data)
            .map(key => ({ id: key, ...data[key] }))
            .filter(item => item.isActive && !item.deleted);
          
          // Random Shuffle and limit to 6
          list = list.sort(() => Math.random() - 0.5).slice(0, 6);
          setStaff(list);
        }
      } catch (error) {
        console.error("Error fetching staff for slider:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStaff();
  }, [tenantId]);

  if (loading || staff.length === 0) return null;

  return (
    <section className="py-5 bg-light">
      <Container>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
             <h3 className="fw-bold mb-0 border-start border-4 border-success ps-3">Guru & Staf</h3>
             <p className="text-muted small mb-0 ps-3">Mengenal lebih dekat tenaga kependidikan {terms.school}.</p>
          </div>
          <Link to="/guru-dan-staf" className="btn btn-outline-success btn-sm rounded-pill px-3 fw-bold">Lihat Semua</Link>
        </div>
        
        <div className="staff-slider-container">
          <div className="staff-track">
            {staff.map(item => (
              <div key={item.id} className="staff-card-wrapper">
                <Card className="border-0 shadow-sm h-100 rounded-4 overflow-hidden staff-card">
                  <div className="position-relative staff-image-container">
                    <ProgressiveImage
                      src={item.photo}
                      alt={item.name}
                      style={{ height: '100%', width: '100%' }}
                    />
                    <div className="position-absolute bottom-0 start-0 w-100 p-2 bg-gradient-dark text-white">
                       <div className="fw-bold small text-truncate" title={item.name}>{item.name}</div>
                    </div>
                  </div>
                  <Card.Body className="p-2 text-center">
                    <div className="text-success fw-bold extra-small text-uppercase">{item.type}</div>
                    <div className="text-muted extra-small text-truncate px-1">{item.subject || '-'}</div>
                  </Card.Body>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </Container>

      <style>{`
        .staff-slider-container {
          overflow-x: auto;
          padding: 10px 5px 25px;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .staff-slider-container::-webkit-scrollbar {
          display: none;
        }
        
        .staff-track {
          display: flex;
          gap: 20px;
          justify-content: flex-start;
        }

        .staff-card-wrapper {
          flex: 0 0 calc(20% - 15px); /* Default 5 items */
          min-width: 180px;
        }

        .staff-card {
          transition: all 0.3s ease;
        }

        .staff-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important;
        }

        .staff-image-container {
          height: 220px;
          background-color: #f8f9fa;
        }

        .bg-gradient-dark {
          background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
        }

        .extra-small {
          font-size: 0.7rem;
        }

        @media (max-width: 1200px) {
          .staff-card-wrapper { flex: 0 0 calc(25% - 14px); } /* 4 items */
        }

        @media (max-width: 992px) {
          .staff-card-wrapper { flex: 0 0 calc(33.333% - 10px); } /* 3 items */
        }

        @media (max-width: 576px) {
          .staff-card-wrapper { flex: 0 0 50%; } /* 2 items */
          .staff-track { gap: 15px; }
        }
      `}</style>
    </section>
  );
};

export default StaffSlider;
