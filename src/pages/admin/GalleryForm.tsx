import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Row, Col, Spinner, Modal } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaCloudUploadAlt, FaSyncAlt } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import ProgressiveImage from '../../components/ProgressiveImage';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, getStorageRef, logActivity, updateCounter } from '../../firebase/utils';
import { convertToWebP, convertUrlToWebP } from '../../firebase/imageUtils';
import type { ImageMetadata } from '../../firebase/imageUtils';
import { getImageMetadata, getStoragePathFromDownloadURL } from '../../firebase/imageUtils';
import { onValue, set, push, serverTimestamp, update } from 'firebase/database';
import { uploadBytes, getDownloadURL, ref, deleteObject } from 'firebase/storage';
import { showAlert, toast, showConfirm } from '../../utils/alerts';
import { storage } from '../../firebase/config';

const GalleryForm: React.FC = () => {
  const { tenantId } = useTenant();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    coverImage: '',
    status: 'published' as 'published' | 'draft',
    date: new Date().toISOString().split('T')[0],
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [originalData, setOriginalData] = useState<any>(null);
  const [coverImageMetadata, setCoverImageMetadata] = useState<ImageMetadata | null>(null);
  const [isReconverting, setIsReconverting] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [reconvertedBlob, setReconvertedBlob] = useState<Blob | null>(null);
  const [reconvertedPreviewUrl, setReconvertedPreviewUrl] = useState<string | null>(null);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  useEffect(() => {
    if (isEdit && tenantId) {
      onValue(getDBRef(tenantId, `gallery_albums/${id}`), async (snap) => {
        if (snap.val()) {
          const data = snap.val();
          setFormData(data);
          setOriginalData(data);
          setImagePreview(data.coverImage);
          if (data.coverImage) {
            const storagePath = getStoragePathFromDownloadURL(data.coverImage);
            if (storagePath) {
              const metadata = await getImageMetadata(storagePath);
              setCoverImageMetadata(metadata);
            } else {
              setCoverImageMetadata(null);
            }
          } else {
            setCoverImageMetadata(null);
          }
        }
        setFetching(false);
      }, { onlyOnce: true });
    } else {
      setFetching(false);
      setCoverImageMetadata(null);
    }
  }, [id, tenantId, isEdit]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setCoverImageMetadata(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setLoading(true);
    try {
      let coverUrl = formData.coverImage;
      if (imageFile) {
        const webpBlob = await convertToWebP(imageFile);
        const fileName = `${Date.now()}_cover.webp`;
        const fileRef = getStorageRef(tenantId, `gallery/covers/${fileName}`);
        await uploadBytes(fileRef, webpBlob);
        coverUrl = await getDownloadURL(fileRef);
        if (isEdit && originalData?.coverImage) {
          try {
            await deleteObject(ref(storage, originalData.coverImage));
          } catch (err: any) {
            if (err.code !== 'storage/object-not-found') console.error("Gagal menghapus gambar sampul lama:", err);
          }
        }
      }
      const data = { ...formData, coverImage: coverUrl, updatedAt: serverTimestamp(), deleted: false };
      if (isEdit) {
        await set(getDBRef(tenantId, `gallery_albums/${id}`), { ...data, createdAt: originalData?.createdAt || serverTimestamp() });
        await logActivity(tenantId, { action: 'EDIT', target: 'GALERI', title: formData.title });
      } else {
        const newRef = push(getDBRef(tenantId, 'gallery_albums'));
        await set(newRef, { ...data, createdAt: serverTimestamp() });
        await updateCounter(tenantId, 'totalAlbums', 1);
        await logActivity(tenantId, { action: 'TAMBAH', target: 'GALERI', title: formData.title });
      }
      toast.fire({ icon: 'success', title: 'Album berhasil disimpan' });
      navigate('/dashboard/galeri');
    } catch (error) {
      showAlert('Gagal', 'Terjadi kesalahan.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReconvertClick = async () => {
    if (!imagePreview) return;
    const result = await showConfirm('Konversi Ulang Gambar?', 'Gambar ini akan dikonversi ke format WebP (maks 100KB). Lanjutkan?');
    if (!result.isConfirmed) return;
    setIsReconverting(true);
    try {
      const blob = await convertUrlToWebP(imagePreview);
      setReconvertedBlob(blob);
      setReconvertedPreviewUrl(URL.createObjectURL(blob));
      setShowPreviewModal(true);
    } catch (error: any) {
      showAlert('Gagal Konversi', error.message, 'error');
    } finally {
      setIsReconverting(false);
    }
  };

  const handleSaveReconvertedImage = async () => {
    if (!reconvertedBlob || !tenantId || !isEdit || !originalData) return;
    setIsReconverting(true);
    try {
      const fileName = `${Date.now()}_cover_reconverted.webp`;
      const fileRef = getStorageRef(tenantId, `gallery/covers/${fileName}`);
      await uploadBytes(fileRef, reconvertedBlob);
      const newUrl = await getDownloadURL(fileRef);
      await update(getDBRef(tenantId, `gallery_albums/${id}`), { coverImage: newUrl });
      if (originalData.coverImage) {
        try {
          await deleteObject(ref(storage, originalData.coverImage));
        } catch (err: any) {
          if (err.code !== 'storage/object-not-found') console.error("Gagal menghapus gambar lama:", err);
        }
      }
      setFormData((prev) => ({ ...prev, coverImage: newUrl }));
      setImagePreview(newUrl);
      const newMetadata = await getImageMetadata(getStoragePathFromDownloadURL(newUrl)!);
      setCoverImageMetadata(newMetadata);
      setOriginalData((prev: any) => ({ ...prev, coverImage: newUrl }));
      setShowPreviewModal(false);
      if (reconvertedPreviewUrl) URL.revokeObjectURL(reconvertedPreviewUrl);
      setReconvertedBlob(null);
      setReconvertedPreviewUrl(null);
      await logActivity(tenantId, { action: 'EDIT', target: 'GALERI', title: `Rekonversi sampul untuk: ${formData.title}` });
      toast.fire({ icon: 'success', title: 'Gambar sampul berhasil dikonversi' });
    } catch (error: any) {
      showAlert('Gagal', error.message, 'error');
    } finally {
      setIsReconverting(false);
    }
  };

  const needsReconversion = coverImageMetadata && (coverImageMetadata.fileExtension !== 'webp' || coverImageMetadata.sizeBytes > 102400);

  if (fetching) return <DashboardLayout><div className="text-center py-5"><Spinner animation="border" variant="success" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <Container fluid className="p-0">
        <div className="d-flex align-items-center mb-4"><Button onClick={() => navigate(-1)} variant="light" className="btn-icon me-3"><FaArrowLeft /></Button><div><h4 className="fw-bold mb-1">{isEdit ? 'Edit Album' : 'Tambah Album Baru'}</h4></div></div>
        <Form onSubmit={handleSubmit}>
          <Row>
            <Col lg={8}><Card className="border-0 shadow-sm mb-4"><Card.Body className="p-4"><Form.Group className="mb-3"><Form.Label className="small fw-bold">Judul Album</Form.Label><Form.Control value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required /></Form.Group><Form.Group className="mb-0"><Form.Label className="small fw-bold">Keterangan</Form.Label><Form.Control as="textarea" rows={4} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} /></Form.Group></Card.Body></Card></Col>
            <Col lg={4}>
              <Card className="border-0 shadow-sm mb-4">
                <Card.Body className="p-4 text-center">
                  <Form.Label className="fw-bold small d-block text-start mb-3">Foto Sampul</Form.Label>
                  <div className="mb-3 bg-light rounded d-flex align-items-center justify-content-center border overflow-hidden position-relative" style={{ height: '200px' }}>
                    {imagePreview ? <ProgressiveImage src={imagePreview} className="img-fluid h-100 w-100 object-fit-cover" alt="Cover Preview" /> : <FaCloudUploadAlt className="text-muted fs-1" />}
                  </div>
                  {coverImageMetadata && (<div className="d-flex justify-content-between align-items-center mt-n2 mb-2 text-start"><span className="text-muted small">{formatBytes(coverImageMetadata.sizeBytes)} .{coverImageMetadata.fileExtension}</span>{needsReconversion && (<Button variant="link" className="p-0 text-warning" onClick={handleReconvertClick} disabled={isReconverting}><FaSyncAlt size={14} /></Button>)}</div>)}
                  <input type="file" id="cover-img" className="d-none" accept="image/*" onChange={handleImageChange} />
                  <Button onClick={() => document.getElementById('cover-img')?.click()} variant="outline-success" size="sm" className="w-100 mb-3">Pilih Foto</Button>
                  <hr />
                  <Button type="submit" variant="success" className="w-100 py-2 fw-bold" disabled={loading}>{loading ? <Spinner size="sm" /> : 'Simpan Album'}</Button>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Form>
      </Container>
      <Modal show={showPreviewModal} onHide={() => setShowPreviewModal(false)} centered contentClassName="bg-transparent border-0"><Modal.Header closeButton closeVariant="white" className="border-0"></Modal.Header><Modal.Body className="text-center">{reconvertedPreviewUrl && <img src={reconvertedPreviewUrl} className="img-fluid rounded shadow-lg" alt="Preview Konversi" />}{reconvertedBlob && <p className="text-white small mt-3">Pratinjau hasil konversi. Ukuran file baru: {formatBytes(reconvertedBlob.size)}</p>}</Modal.Body><Modal.Footer className="border-0 justify-content-center"><Button variant="light" onClick={() => setShowPreviewModal(false)}>Batal</Button><Button variant="success" onClick={handleSaveReconvertedImage} disabled={isReconverting}>{isReconverting ? <Spinner size="sm" /> : "Simpan & Ganti Gambar"}</Button></Modal.Footer></Modal>
    </DashboardLayout>
  );
};

export default GalleryForm;
