import React, { useState } from 'react';
import { Modal, Button, Row, Col } from 'react-bootstrap';
import { FaFileUpload, FaGlobe, FaFile, FaMagic } from 'react-icons/fa';
import ImportCSV from './ImportCSV';
import ImportAPI from './ImportAPI';
import ImportPPDB from './ImportPPDB';

interface ImportSiswaMenuProps {
  show: boolean;
  onHide: () => void;
  tenantId: string;
}

const ImportSiswaMenu: React.FC<ImportSiswaMenuProps> = ({ show, onHide, tenantId }) => {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  if (selectedMethod === 'csv') {
    return (
      <ImportCSV 
        show={show} 
        onHide={() => {
          setSelectedMethod(null);
          onHide();
        }}
        tenantId={tenantId}
      />
    );
  }

  if (selectedMethod === 'api') {
    return (
      <ImportAPI 
        show={show} 
        onHide={() => {
          setSelectedMethod(null);
          onHide();
        }}
        tenantId={tenantId}
      />
    );
  }

  if (selectedMethod === 'ppdb') {
    return (
      <ImportPPDB 
        show={show} 
        onHide={() => {
          setSelectedMethod(null);
          onHide();
        }}
        tenantId={tenantId}
      />
    );
  }

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Pilih Metode Import Data Siswa</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row className="g-3">
          {/* Manual Input */}
          <Col md={6}>
            <div 
              className="border rounded p-4 text-center cursor-pointer"
              style={{ cursor: 'pointer', transition: 'all 0.3s' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#f8f9fa';
                (e.currentTarget as HTMLElement).style.borderColor = '#0d6efd';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'white';
                (e.currentTarget as HTMLElement).style.borderColor = '#dee2e6';
              }}
              onClick={() => {
                setSelectedMethod(null);
                onHide();
                // Navigate to form or open form modal
                window.location.href = '/dashboard/data-siswa/tambah';
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>
                <FaMagic className="text-primary" />
              </div>
              <h5 className="fw-bold">Input Manual</h5>
              <p className="text-muted small">Tambah siswa satu per satu melalui formulir</p>
            </div>
          </Col>

          {/* PPDB System */}
          <Col md={6}>
            <div 
              className="border rounded p-4 text-center"
              style={{ backgroundColor: '#f0f0f0' }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>
                <FaGlobe className="text-secondary" />
              </div>
              <h5 className="fw-bold">Sistem PPDB</h5>
              <p className="text-muted small">Ambil data dari sistem PPDB</p>
              <small className="text-muted">Fitur akan dikembangkan kemudian</small>
            </div>
          </Col>

          {/* CSV/Excel Upload */}
          <Col md={6}>
            <div 
              className="border rounded p-4 text-center cursor-pointer"
              style={{ cursor: 'pointer', transition: 'all 0.3s' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#f8f9fa';
                (e.currentTarget as HTMLElement).style.borderColor = '#0d6efd';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'white';
                (e.currentTarget as HTMLElement).style.borderColor = '#dee2e6';
              }}
              onClick={() => setSelectedMethod('csv')}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>
                <FaFileUpload className="text-success" />
              </div>
              <h5 className="fw-bold">Upload CSV/Excel</h5>
              <p className="text-muted small">Import dari file CSV atau Excel</p>
            </div>
          </Col>

          {/* API JSON */}
          <Col md={6}>
            <div 
              className="border rounded p-4 text-center cursor-pointer"
              style={{ cursor: 'pointer', transition: 'all 0.3s' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#f8f9fa';
                (e.currentTarget as HTMLElement).style.borderColor = '#0d6efd';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'white';
                (e.currentTarget as HTMLElement).style.borderColor = '#dee2e6';
              }}
              onClick={() => setSelectedMethod('api')}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>
                <FaFile className="text-info" />
              </div>
              <h5 className="fw-bold">Import API JSON</h5>
              <p className="text-muted small">Import dari endpoint API JSON</p>
            </div>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Batal
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ImportSiswaMenu;
