import React from 'react';
import { Modal, Button, Alert } from 'react-bootstrap';

interface ImportPPDBProps {
  show: boolean;
  onHide: () => void;
  tenantId: string;
}

const ImportPPDB: React.FC<ImportPPDBProps> = ({ show, onHide }) => {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Import dari Sistem PPDB</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="info" className="text-center">
          <h5>🚀 Fitur Sedang Dikembangkan</h5>
          <p className="mb-0 mt-3">
            Integrasi dengan Sistem PPDB akan tersedia di versi berikutnya.
          </p>
          <small className="text-muted d-block mt-2">
            Untuk saat ini, gunakan metode import lain:
            <ul className="mt-2 mb-0">
              <li>Upload CSV/Excel</li>
              <li>Import dari API JSON</li>
              <li>Input manual melalui formulir</li>
            </ul>
          </small>
        </Alert>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Tutup
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ImportPPDB;
