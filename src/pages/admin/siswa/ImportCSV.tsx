import React, { useState } from 'react';
import { Modal, Button, Form, Alert, Table, Spinner } from 'react-bootstrap';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ref as dbRef, update } from 'firebase/database';
import { rtdb as database } from '../../../firebase/config';

import { toast } from '../../../utils/alerts';

interface CSVRow {
  nisn: string;
  nama: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  gender: string;
  email?: string;
  [key: string]: string | undefined;
}

interface ValidationError {
  rowIndex: number;
  nisn?: string;
  error: string;
}

interface ImportCSVProps {
  show: boolean;
  onHide: () => void;
  tenantId: string;
}

const ImportCSV: React.FC<ImportCSVProps> = ({ show, onHide, tenantId }) => {
  const [_file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<CSVRow[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'confirm'>('upload');
  const [importStats, setImportStats] = useState({ total: 0, success: 0, failed: 0 });

  const validateRow = (row: CSVRow, rowIndex: number): ValidationError | null => {
    const nisn = (row.nisn || '').trim();
    const nama = (row.nama || '').trim();
    const tempat_lahir = (row.tempat_lahir || '').trim();
    const tanggal_lahir = (row.tanggal_lahir || '').trim();
    let gender = (row.gender || '').trim().toUpperCase();
    const email = (row.email || '').trim();

    // Convert gender variations to standard L/P
    if (gender === 'LAKI-LAKI' || gender === 'M' || gender === 'MALE') gender = 'L';
    if (gender === 'PEREMPUAN' || gender === 'F' || gender === 'FEMALE') gender = 'P';

    if (!nisn) return { rowIndex, error: 'NISN harus diisi' };
    if (!/^\d{10}$/.test(nisn)) return { rowIndex, nisn, error: 'NISN harus 10 digit' };
    if (!nama) return { rowIndex, nisn, error: 'Nama harus diisi' };
    if (nama.length > 100) return { rowIndex, nisn, error: 'Nama max 100 karakter' };
    if (!tempat_lahir) return { rowIndex, nisn, error: 'Tempat lahir harus diisi' };
    if (tempat_lahir.length > 50) return { rowIndex, nisn, error: 'Tempat lahir max 50 karakter' };
    if (!tanggal_lahir) return { rowIndex, nisn, error: 'Tanggal lahir harus diisi' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal_lahir)) return { rowIndex, nisn, error: 'Tanggal lahir format YYYY-MM-DD' };
    if (gender !== 'L' && gender !== 'P') return { rowIndex, nisn, error: 'Gender harus L atau P' };
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { rowIndex, nisn, error: 'Email tidak valid' };

    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrors([]);
    setParsedData([]);
    setStep('upload');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        let rows: CSVRow[] = [];

        if (selectedFile.name.endsWith('.csv')) {
          // Parse CSV
          Papa.parse(data as string, {
            header: true,
            skipEmptyLines: true,
            complete: (result) => {
              rows = result.data as CSVRow[];
              processRows(rows);
            },
            error: (error: any) => {
              toast.fire({ icon: 'error', title: `Parse error: ${error.message}` });
            }
          });
        } else if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
          // Parse Excel
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          rows = XLSX.utils.sheet_to_json(worksheet) as CSVRow[];
          processRows(rows);
        } else {
          toast.fire({ icon: 'error', title: 'Format file harus CSV atau Excel' });
        }
      } catch (err) {
        console.error(err);
        toast.fire({ icon: 'error', title: 'Gagal membaca file' });
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const processRows = (rows: CSVRow[]) => {
    const newErrors: ValidationError[] = [];
    const validRows: CSVRow[] = [];

    rows.forEach((row, idx) => {
      const error = validateRow(row, idx + 2); // Row 2 onwards (header is row 1)
      if (error) {
        newErrors.push(error);
      } else {
        // Normalize gender
        let gender = (row.gender || '').trim().toUpperCase();
        if (gender === 'LAKI-LAKI' || gender === 'M' || gender === 'MALE') gender = 'L';
        if (gender === 'PEREMPUAN' || gender === 'F' || gender === 'FEMALE') gender = 'P';

        validRows.push({
          nisn: (row.nisn || '').trim(),
          nama: (row.nama || '').trim(),
          tempat_lahir: (row.tempat_lahir || '').trim(),
          tanggal_lahir: (row.tanggal_lahir || '').trim(),
          gender: gender as 'L' | 'P',
          email: (row.email || '').trim()
        });
      }
    });

    setParsedData(validRows);
    setErrors(newErrors);
    if (validRows.length > 0) {
      setStep('preview');
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

      // Close after 2 seconds
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
        <Modal.Title>Import Data Siswa dari CSV/Excel</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {step === 'upload' && (
          <Form.Group className="mb-0">
            <Form.Label className="fw-bold">Pilih File CSV atau Excel</Form.Label>
            <Form.Control
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              disabled={loading}
            />
            <Form.Text className="text-muted d-block mt-2">
              File harus memiliki kolom: NISN, Nama, Tempat Lahir, Tanggal Lahir (YYYY-MM-DD), Gender (L/P), Email (opsional)
            </Form.Text>
          </Form.Group>
        )}

        {step === 'preview' && (
          <div>
            {errors.length > 0 && (
              <Alert variant="warning">
                <strong>Ditemukan {errors.length} error:</strong>
                <ul className="mb-0 mt-2">
                  {errors.slice(0, 5).map((err, idx) => (
                    <li key={idx}>
                      Baris {err.rowIndex}: {err.error}
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

export default ImportCSV;
