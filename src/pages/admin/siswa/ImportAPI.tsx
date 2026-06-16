import React, { useState } from 'react';
import { Modal, Button, Form, Alert, Table, Spinner } from 'react-bootstrap';
import { ref as dbRef, update } from 'firebase/database';
import { rtdb as database } from '../../../firebase/config';
import { toast } from '../../../utils/alerts';

interface APISiswaData {
  nisn: string;
  nama: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  gender: 'L' | 'P';
  email?: string;
}

interface ValidationError {
  nisn?: string;
  error: string;
}

interface ImportAPIProps {
  show: boolean;
  onHide: () => void;
  tenantId: string;
}

const ImportAPI: React.FC<ImportAPIProps> = ({ show, onHide, tenantId }) => {
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [parsedData, setParsedData] = useState<APISiswaData[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'preview' | 'confirm'>('input');
  const [importStats, setImportStats] = useState({ total: 0, success: 0, failed: 0 });

  const validateRow = (row: any): { data?: APISiswaData; error?: string } => {
    const nisn = (row.nisn || '').trim();
    const nama = (row.nama || '').trim();
    const tempat_lahir = (row.tempat_lahir || '').trim();
    const tanggal_lahir = (row.tanggal_lahir || '').trim();
    let gender = (row.gender || '').trim().toUpperCase();
    const email = (row.email || '').trim();

    // Convert gender variations
    if (gender === 'LAKI-LAKI' || gender === 'M' || gender === 'MALE') gender = 'L';
    if (gender === 'PEREMPUAN' || gender === 'F' || gender === 'FEMALE') gender = 'P';

    if (!nisn) return { error: 'NISN harus diisi' };
    if (!/^\d{10}$/.test(nisn)) return { error: 'NISN harus 10 digit' };
    if (!nama) return { error: 'Nama harus diisi' };
    if (nama.length > 100) return { error: 'Nama max 100 karakter' };
    if (!tempat_lahir) return { error: 'Tempat lahir harus diisi' };
    if (tempat_lahir.length > 50) return { error: 'Tempat lahir max 50 karakter' };
    if (!tanggal_lahir) return { error: 'Tanggal lahir harus diisi' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal_lahir)) return { error: 'Tanggal lahir format YYYY-MM-DD' };
    if (gender !== 'L' && gender !== 'P') return { error: 'Gender harus L atau P' };
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Email tidak valid' };

    return {
      data: {
        nisn,
        nama,
        tempat_lahir,
        tanggal_lahir,
        gender: gender as 'L' | 'P',
        email: email || undefined
      }
    };
  };

  const handleFetchAPI = async () => {
    if (!apiUrl.trim()) {
      toast.fire({ icon: 'error', title: 'URL API harus diisi' });
      return;
    }

    setLoading(true);
    setErrors([]);
    setParsedData([]);

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      if (apiKey.trim()) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(apiUrl, { headers });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const jsonData = await response.json();
      const dataArray = Array.isArray(jsonData) ? jsonData : jsonData.data || jsonData.siswa || [];

      if (!Array.isArray(dataArray)) {
        throw new Error('Response bukan array, pastikan API mengembalikan array JSON');
      }

      const newErrors: ValidationError[] = [];
      const validRows: APISiswaData[] = [];

      dataArray.forEach((row) => {
        const validation = validateRow(row);
        if (validation.error) {
          newErrors.push({ nisn: row.nisn, error: validation.error });
        } else if (validation.data) {
          validRows.push(validation.data);
        }
      });

      setParsedData(validRows);
      setErrors(newErrors);

      if (validRows.length > 0) {
        setStep('preview');
        toast.fire({ 
          icon: 'success', 
          title: `${validRows.length} data valid, ${newErrors.length} error` 
        });
      } else {
        toast.fire({ icon: 'error', title: 'Tidak ada data valid' });
      }
    } catch (err) {
      console.error(err);
      const errorMsg = err instanceof Error ? err.message : 'Gagal fetch API';
      toast.fire({ icon: 'error', title: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    setLoading(true);

    try {
      const updates: { [key: string]: any } = {};
      let successCount = 0;

      for (const row of parsedData) {
        const path = `tenants/${tenantId}/references/siswa/${row.nisn}`;
        const rowData: any = {
          nisn: row.nisn,
          nama: row.nama,
          tempat_lahir: row.tempat_lahir,
          tanggal_lahir: row.tanggal_lahir,
          gender: row.gender,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        // Only add email if it has a value (Firebase doesn't accept undefined)
        if (row.email && row.email.trim()) {
          rowData.email = row.email;
        }
        updates[path] = rowData;
        successCount++;
      }

      await update(dbRef(database), updates);
      setImportStats({ total: parsedData.length, success: successCount, failed: 0 });
      setStep('confirm');
      toast.fire({ icon: 'success', title: `${successCount} data siswa berhasil diimport` });

      setTimeout(() => {
        onHide();
      }, 2000);
    } catch (err) {
      console.error(err);
      toast.fire({ icon: 'error', title: 'Gagal mengimport data' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Import Data Siswa dari API JSON</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {step === 'input' && (
          <div>
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold">URL API</Form.Label>
              <Form.Control
                type="url"
                placeholder="https://api.example.com/siswa"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                disabled={loading}
              />
              <Form.Text className="text-muted">
                API harus mengembalikan array JSON dengan field: nisn, nama, tempat_lahir, tanggal_lahir, gender
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-0">
              <Form.Label className="fw-bold">API Key (Opsional)</Form.Label>
              <Form.Control
                type="password"
                placeholder="Masukkan API key jika diperlukan"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={loading}
              />
              <Form.Text className="text-muted">
                Akan dikirim di header Authorization: Bearer {'{apiKey}'}
              </Form.Text>
            </Form.Group>
          </div>
        )}

        {step === 'preview' && (
          <div>
            {errors.length > 0 && (
              <Alert variant="warning">
                <strong>Ditemukan {errors.length} error:</strong>
                <ul className="mb-0 mt-2">
                  {errors.slice(0, 5).map((err, idx) => (
                    <li key={idx}>
                      NISN {err.nisn}: {err.error}
                    </li>
                  ))}
                  {errors.length > 5 && <li>... dan {errors.length - 5} error lainnya</li>}
                </ul>
              </Alert>
            )}

            <Alert variant="info">
              <strong>Siap import {parsedData.length} data siswa</strong>
            </Alert>

            <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <Table striped bordered hover size="sm">
                <thead className="table-dark">
                  <tr>
                    <th>NISN</th>
                    <th>Nama</th>
                    <th>Tempat Lahir</th>
                    <th>Tgl Lahir</th>
                    <th>Gender</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 5).map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.nisn}</td>
                      <td>{row.nama}</td>
                      <td>{row.tempat_lahir}</td>
                      <td>{row.tanggal_lahir}</td>
                      <td>{row.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            {parsedData.length > 5 && (
              <p className="text-muted mt-2 small">... menampilkan 5 dari {parsedData.length} data</p>
            )}
          </div>
        )}

        {step === 'confirm' && (
          <Alert variant="success">
            <strong>✓ Import Berhasil</strong>
            <p className="mb-0 mt-2">
              Total: {importStats.total} | Berhasil: {importStats.success} | Gagal: {importStats.failed}
            </p>
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button 
          variant="secondary" 
          onClick={onHide}
          disabled={loading || step === 'confirm'}
        >
          {step === 'confirm' ? 'Tutup' : 'Batal'}
        </Button>
        {step === 'input' && (
          <Button 
            variant="primary" 
            onClick={handleFetchAPI}
            disabled={loading || !apiUrl.trim()}
          >
            {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
            Fetch & Preview
          </Button>
        )}
        {step === 'preview' && (
          <Button 
            variant="primary" 
            onClick={handleConfirmImport}
            disabled={loading || parsedData.length === 0}
          >
            {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
            Konfirmasi Import
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default ImportAPI;
