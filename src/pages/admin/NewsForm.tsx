import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Form, Row, Col, Spinner, Modal } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { FaSave, FaArrowLeft, FaCloudUploadAlt, FaSyncAlt } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import ProgressiveImage from '../../components/ProgressiveImage';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, getStorageRef, logActivity, updateTimeStats, updateCategoryStats, uploadBytesWithCache } from '../../firebase/utils';
import { useIsOwner } from '../../firebase/useIsOwner';
import { convertToWebP, convertUrlToWebP } from '../../firebase/imageUtils';
import type { ImageMetadata } from '../../firebase/imageUtils';
import { getImageMetadata, getStoragePathFromDownloadURL } from '../../firebase/imageUtils';
import { onValue, serverTimestamp, ref as dbRef, update } from 'firebase/database';
import { getDownloadURL, ref, deleteObject } from 'firebase/storage';
import { rtdb as database, storage } from '../../firebase/config';
import { showAlert, toast, showConfirm } from '../../utils/alerts';

const NewsForm: React.FC = () => {
  const { tenantId } = useTenant();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const { isOwner } = useIsOwner();


  const [formData, setFormData] = useState({
    title: '',
    category: 'berita',
    content: '',
    status: 'published' as 'published' | 'draft',
    date: new Date().toISOString().split('T')[0],
    imageUrl: '',
    thumbnail: '',
    coverObjectFit: 'cover' as 'cover' | 'contain' | 'fill',
  });
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [originalData, setOriginalData] = useState<any>(null);
  const [coverImageMetadata, setCoverImageMetadata] = useState<ImageMetadata | null>(null);

  // Re-conversion state
  const [isReconverting, setIsReconverting] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [reconvertedBlob, setReconvertedBlob] = useState<Blob | null>(null);
  const [reconvertedPreviewUrl, setReconvertedPreviewUrl] = useState<string | null>(null);

  // Helper to format bytes
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
      const newsRef = getDBRef(tenantId, `news/${id}`);
      onValue(newsRef, async (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setFormData(data);
          setOriginalData(data);
          const imageUrl = data.thumbnail || data.imageUrl;
          if (imageUrl) {
            setImagePreview(imageUrl);
            const storagePath = getStoragePathFromDownloadURL(imageUrl);
            if (storagePath) {
              const metadata = await getImageMetadata(storagePath);
              setCoverImageMetadata(metadata);
            } else {
              setCoverImageMetadata(null);
            }
          } else {
            setImagePreview(null);
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
      setCoverImageMetadata(null); // Clear old metadata
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setLoading(true);
    try {
      let thumbnailUrl = formData.thumbnail || formData.imageUrl || '';

      if (imageFile) {
        const webpBlob = await convertToWebP(imageFile, { maxSizeBytes: 100 * 1024 });
        const fileName = `${Date.now()}_news.webp`;
        const fileRef = getStorageRef(tenantId, `news/${fileName}`);
        await uploadBytesWithCache(fileRef, webpBlob);
        thumbnailUrl = await getDownloadURL(fileRef);

        if (isEdit && originalData?.thumbnail) {
          try {
            const oldImageRef = ref(storage, originalData.thumbnail);
            await deleteObject(oldImageRef);
          } catch (deleteError: any) {
            if (deleteError.code !== 'storage/object-not-found') {
              console.error("Gagal menghapus gambar lama:", deleteError);
            }
          }
        }
      } else if (isOwner && isEdit && originalData?.thumbnail) {
        // Owner reupload image with caching even without uploading new image
        try {
          const response = await fetch(originalData.thumbnail);
          const blob = await response.blob();
          const fileName = `${Date.now()}_news_recache.webp`;
          const fileRef = getStorageRef(tenantId, `news/${fileName}`);
          await uploadBytesWithCache(fileRef, blob);
          const newUrl = await getDownloadURL(fileRef);
          thumbnailUrl = newUrl;

          // Update thumbnail URL in RTDB
          await update(dbRef(database), {
            [`tenants/${tenantId}/news/${id}/thumbnail`]: newUrl,
            [`tenants/${tenantId}/news_search_index/${id}/img`]: newUrl
          });

          // Delete old image
          const oldImageRef = ref(storage, originalData.thumbnail);
          await deleteObject(oldImageRef);

          console.log(`Owner berhasil mengunggah ulang gambar. URL Lama: ${originalData.thumbnail}, URL Baru: ${newUrl}`);
        } catch (error) {
          console.error('Error recaching image for owner:', error);
        }
      }

      const newsData = { ...formData, thumbnail: thumbnailUrl, updatedAt: serverTimestamp(), year: new Date(formData.date).getFullYear(), month: new Date(formData.date).getMonth() + 1, day: new Date(formData.date).getDate(), deleted: false };
      const searchIndexData = { t: formData.title.toLowerCase(), title: formData.title, date: formData.date, c: formData.category, img: thumbnailUrl, deleted: false };
      const updates: any = {};

      if (isEdit) {
        if (originalData && originalData.category !== formData.category) {
          await updateCategoryStats(tenantId, 'news', originalData.category, -1);
          await updateCategoryStats(tenantId, 'news', formData.category, 1);
        }
        updates[`tenants/${tenantId}/news/${id}`] = { ...newsData, createdAt: originalData?.createdAt || serverTimestamp() };
        updates[`tenants/${tenantId}/news_search_index/${id}`] = searchIndexData;
        await logActivity(tenantId, { action: 'EDIT', target: 'BERITA', title: formData.title });
      } else {
        const timestampId = Date.now().toString();
        updates[`tenants/${tenantId}/news/${timestampId}`] = { ...newsData, createdAt: serverTimestamp() };
        updates[`tenants/${tenantId}/news_search_index/${timestampId}`] = searchIndexData;
        await updateTimeStats(tenantId, 'news', formData.date, 1);
        await updateCategoryStats(tenantId, 'news', formData.category, 1);
        await logActivity(tenantId, { action: 'TAMBAH', target: 'BERITA', title: formData.title });
      }

      await update(dbRef(database), updates);
      toast.fire({ icon: 'success', title: 'Berita berhasil disimpan' });
      navigate('/dashboard/berita');
    } catch (error) {
      console.error(error);
      showAlert('Gagal', 'Gagal menyimpan berita.', 'error');
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
      const fileName = `${Date.now()}_news_reconverted.webp`;
      const fileRef = getStorageRef(tenantId, `news/${fileName}`);
      await uploadBytesWithCache(fileRef, reconvertedBlob);
      const newUrl = await getDownloadURL(fileRef);
      
      const updates: any = {};
      updates[`tenants/${tenantId}/news/${id}/thumbnail`] = newUrl;
      updates[`tenants/${tenantId}/news_search_index/${id}/img`] = newUrl;
      await update(dbRef(database), updates);
      
      try {
        const oldImageRef = ref(storage, originalData.thumbnail);
        await deleteObject(oldImageRef);
      } catch (deleteError: any) {
        if (deleteError.code !== 'storage/object-not-found') {
          // console.error("Gagal menghapus gambar lama setelah rekonversi:", deleteError);
        }
      }

      setFormData(prev => ({ ...prev, thumbnail: newUrl }));
      setImagePreview(newUrl);
      const newMetadata = await getImageMetadata(getStoragePathFromDownloadURL(newUrl)!);
      setCoverImageMetadata(newMetadata);
      
      setShowPreviewModal(false);
      setReconvertedBlob(null);
      if(reconvertedPreviewUrl) URL.revokeObjectURL(reconvertedPreviewUrl);
      setReconvertedPreviewUrl(null);

      await logActivity(tenantId, { action: 'EDIT', target: 'BERITA', title: `Rekonversi gambar untuk: ${formData.title}` });
      toast.fire({ icon: 'success', title: 'Gambar berhasil dikonversi ulang' });

    } catch (error: any) {
      showAlert('Gagal Menyimpan', error.message, 'error');
    } finally {
      setIsReconverting(false);
    }
  };

  const needsReconversion = coverImageMetadata && (coverImageMetadata.fileExtension !== 'webp' || coverImageMetadata.sizeBytes > 102400);

  if (fetching) return <DashboardLayout><div className="text-center py-5"><Spinner animation="border" variant="success" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <Container fluid className="p-0">
        <div className="d-flex align-items-center mb-4">
          <Button onClick={() => navigate(-1)} variant="light" className="btn-icon me-3"><FaArrowLeft /></Button>
          <div><h4 className="fw-bold mb-1">{isEdit ? 'Edit Berita' : 'Tambah Berita'}</h4></div>
        </div>

        <Form onSubmit={handleSubmit}>
          <Row>
            <Col lg={8}>
              <Card className="border-0 shadow-sm mb-4">
                <Card.Body className="p-4">
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold small">Judul Berita</Form.Label>
                    <Form.Control value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold small">Isi Berita</Form.Label>
                    <Form.Control as="textarea" rows={15} value={formData.content} onChange={(e) => setFormData({...formData, content: e.target.value})} required />
                  </Form.Group>
                </Card.Body>
              </Card>
            </Col>
            <Col lg={4}>
              <Card className="border-0 shadow-sm mb-4">
                <Card.Body className="p-4">
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold small">Kategori</Form.Label>
                    <Form.Select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                      <option value="berita">Berita Umum</option>
                      <option value="prestasi">Prestasi</option>
                      <option value="kegiatan">Kegiatan</option>
                      <option value="opini">Opini/Artikel</option>
                    </Form.Select>
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold small">Tanggal Publikasi</Form.Label>
                    <Form.Control type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                  </Form.Group>
                  <Form.Group className="mb-4">
                    <Form.Label className="fw-bold small">Status</Form.Label>
                    <div>
                      <Form.Check inline type="radio" label="Draft" name="status" checked={formData.status === 'draft'} onChange={() => setFormData({...formData, status: 'draft'})} />
                      <Form.Check inline type="radio" label="Published" checked={formData.status === 'published'} onChange={() => setFormData({...formData, status: 'published'})} />
                    </div>
                  </Form.Group>
                  <hr />
                  <Button type="submit" variant="success" className="w-100 py-2 fw-bold" disabled={loading}>
                    {loading ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />} Simpan
                  </Button>
                </Card.Body>
              </Card>

              <Card className="border-0 shadow-sm">
                <Card.Body className="p-4">
                  <Form.Label className="fw-bold small d-block text-start mb-3">Gambar Sampul</Form.Label>
                  <div className="mb-3 bg-light rounded d-flex align-items-center justify-content-center border position-relative" style={{ height: '200px', overflow: 'hidden' }}>
                    {imagePreview ? (
                      <ProgressiveImage
                        src={imagePreview}
                        style={{ width: '100%', height: '100%', objectFit: formData.coverObjectFit }}
                        alt="Cover"
                      />
                    ) : (
                      <FaCloudUploadAlt className="text-muted fs-1" />
                    )}
                  </div>

                  {coverImageMetadata && (
                    <div className="d-flex justify-content-between align-items-center mt-n2 mb-2">
                      <span className="text-muted small">
                        {formatBytes(coverImageMetadata.sizeBytes)} .{coverImageMetadata.fileExtension}
                      </span>
                      {needsReconversion && (
                        <Button variant="outline-warning" size="sm" onClick={handleReconvertClick} disabled={isReconverting}>
                          {isReconverting ? <Spinner size="sm" /> : <FaSyncAlt />}
                        </Button>
                      )}
                    </div>
                  )}

                  <input type="file" id="news-img" className="d-none" accept="image/*" onChange={handleImageChange} />
                  <Button onClick={() => document.getElementById('news-img')?.click()} variant="outline-success" size="sm" className="w-100 mb-3">Pilih Gambar</Button>
                  
                  <Form.Group>
                    <Form.Label className="fw-bold small text-muted">Tampilan Gambar</Form.Label>
                    <Form.Select size="sm" value={formData.coverObjectFit} onChange={(e) => setFormData({...formData, coverObjectFit: e.target.value as any})}>
                      <option value="cover">Cover</option>
                      <option value="contain">Contain</option>
                      <option value="fill">Fill</option>
                    </Form.Select>
                  </Form.Group>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Form>
      </Container>

      <Modal show={showPreviewModal} onHide={() => setShowPreviewModal(false)} centered contentClassName="bg-transparent border-0">
        <Modal.Header closeButton closeVariant="white" className="border-0"></Modal.Header>
        <Modal.Body className="text-center">
          {reconvertedPreviewUrl && <img src={reconvertedPreviewUrl} className="img-fluid rounded shadow-lg" alt="Preview Konversi" />}
          <p className="text-white small mt-3">Pratinjau hasil konversi. Ukuran file baru: {reconvertedBlob ? formatBytes(reconvertedBlob.size) : '0 Bytes'}</p>
        </Modal.Body>
        <Modal.Footer className="border-0 justify-content-center">
          <Button variant="light" onClick={() => setShowPreviewModal(false)}>Batal</Button>
          <Button variant="success" onClick={handleSaveReconvertedImage} disabled={isReconverting}>
            {isReconverting ? <Spinner size="sm" /> : "Simpan & Ganti Gambar"}
          </Button>
        </Modal.Footer>
      </Modal>

    </DashboardLayout>
  );
};

export default NewsForm;
