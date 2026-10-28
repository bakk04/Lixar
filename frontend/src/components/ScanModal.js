import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const SAMPLE_IMAGES = [
  { name: 'asian_fake_1.JPG', src: '/samples/images/asian_fake_1.JPG', domain: 'asian', label: '동양인 Fake' },
  { name: 'asian_fake_2.JPG', src: '/samples/images/asian_fake_2.JPG', domain: 'asian', label: '동양인 Fake' },
  { name: 'western_fake_1.JPG', src: '/samples/images/western_fake_1.JPG', domain: 'western', label: '서양인 Fake' },
  { name: 'western_fake_2.JPG', src: '/samples/images/western_fake_2.JPG', domain: 'western', label: '서양인 Fake' },
];

const SAMPLE_VIDEOS = [
  { name: 'western_fake.mp4', src: '/samples/videos/western_fake.mp4', domain: 'western', label: '서양인 Fake' },
  { name: 'western_real.mp4', src: '/samples/videos/western_real.mp4', domain: 'western', label: '서양인 Real' },
];

const ScanModal = ({ isOpen, onClose, sessionUser, initialMode = 'image', onScanComplete }) => {
  const navigate = useNavigate();
  const [scanType, setScanType] = useState(initialMode); // 'image' or 'video'
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [result, setResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Settings
  const [versionType, setVersionType] = useState('v2');
  const [modelType, setModelType] = useState('fast');
  const [domainType, setDomainType] = useState('western');

  const pollingRef = useRef(null);
  const isMounted = useRef(true);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setScanType(initialMode);
  }, [initialMode]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const resetState = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setResult(null);
    setStatusMessage('');
    setIsAnalyzing(false);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFile = (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setResult(null);
    setStatusMessage('');
  };

  const handleSampleSelect = async (sample) => {
    try {
      const res = await fetch(sample.src);
      const blob = await res.blob();
      const loadedFile = new File([blob], sample.name, { type: blob.type });
      if (sample.domain === 'asian') setVersionType('v2');
      setDomainType(sample.domain);
      handleFile(loadedFile);
    } catch (e) {
      alert("Failed to load sample asset.");
    }
  };

  const startPolling = (id, type) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      if (!isMounted.current) return;
      try {
        const endpoint = type === 'image' ? `/inference/image/${id}` : `/inference/video/${id}`;
        const response = await axios.get(endpoint);
        const data = response.data;

        if (data.status === 'SUCCESS') {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          setResult({ ...data, id, type });
          setIsAnalyzing(false);
          setStatusMessage('');
          if (onScanComplete) onScanComplete();
          window.dispatchEvent(new CustomEvent('lixar:scan_completed', { detail: { id, type, data } }));
        } else if (data.status === 'FAILED' || data.status === 'ERROR') {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          setIsAnalyzing(false);
          setStatusMessage('');
          alert(data.result_msg || "Analysis failed on server.");
        } else if (data.status === 'WARNING') {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          setResult({ ...data, status: 'WARNING', id, type });
          setIsAnalyzing(false);
          setStatusMessage('');
          if (onScanComplete) onScanComplete();
          window.dispatchEvent(new CustomEvent('lixar:scan_completed', { detail: { id, type, data } }));
        } else {
          setStatusMessage(data.message || (type === 'image' ? "Extracting facial features..." : "Processing video frames..."));
        }
      } catch (err) {
        console.error(err);
      }
    }, 2000);
  };

  const handleStartScan = async () => {
    if (modelType === 'pro' && !sessionUser) {
      alert("Pro model inference requires authentication. Please sign in.");
      navigate('/login');
      return;
    }
    if (!file) {
      alert(scanType === 'image' ? "Please upload an image first." : "Please upload a video first.");
      return;
    }

    const formData = new FormData();
    if (scanType === 'image') formData.append('imagefile', file);
    else formData.append('videofile', file);

    formData.append('model_type', modelType);
    formData.append('domain_type', domainType === 'western' ? '서양인' : '동양인');
    formData.append('version_type', versionType);
    formData.append('sync', 'true');

    setIsAnalyzing(true);
    setStatusMessage('Analyzing facial synthesis via MS-EffGCViT...');
    setResult(null);

    try {
      const endpoint = scanType === 'image' ? '/inference/image' : '/inference/video';
      const response = await axios.post(endpoint, formData);
      const scanId = response.data?.image_id || response.data?.video_id || response.data;

      if (response.data?.analysis && response.data.status === 'success') {
        const data = response.data;
        setResult({
          ...data,
          id: scanId,
          type: scanType,
          status: 'SUCCESS',
          score: data.analysis.prob,
          face_conf: data.analysis.face_conf,
          face_ratio: data.analysis.face_ratio,
          face_brightness: data.analysis.face_brightness
        });
        setIsAnalyzing(false);
        setStatusMessage('');
        if (onScanComplete) onScanComplete();
        return;
      }

      if (scanId) {
        startPolling(scanId, scanType);
      } else {
        setIsAnalyzing(false);
      }
    } catch (err) {
      setIsAnalyzing(false);
      setStatusMessage('');
      const msg = err.response?.data?.detail || "Inference request failed.";
      alert(`Error: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(23, 26, 46, 0.45)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
      animation: 'fadeIn 0.2s ease'
    }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '26px',
        width: '100%',
        maxWidth: '920px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 24px 60px rgba(29, 33, 56, 0.2)',
        border: '1px solid rgba(226, 230, 243, 0.9)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '24px 34px',
          borderBottom: '1px solid #EFF1F7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6C66FA 0%, #5854EE 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#1D2138' }}>
                LIXAR AI Scan Studio
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#8E93B0' }}>
                Upload media to detect deepfake manipulation, artifacts, and facial synthesis.
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            style={{
              background: '#EFF1F7',
              border: 'none',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#8E93B0',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E2E6F3'; e.currentTarget.style.color = '#1D2138'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#EFF1F7'; e.currentTarget.style.color = '#8E93B0'; }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '30px 34px', display: 'flex', gap: '30px' }}>
          {/* Left: Upload and Preview zone */}
          <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Type selector tabs */}
            <div style={{
              display: 'flex',
              backgroundColor: '#EFF1F7',
              borderRadius: '14px',
              padding: '4px',
              gap: '4px'
            }}>
              <button
                onClick={() => { setScanType('image'); resetState(); }}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: scanType === 'image' ? '#FFFFFF' : 'transparent',
                  color: scanType === 'image' ? '#5854EE' : '#8E93B0',
                  fontWeight: '700',
                  fontSize: '13px',
                  boxShadow: scanType === 'image' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                🖼️ Image Scan
              </button>
              <button
                onClick={() => { setScanType('video'); resetState(); }}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: scanType === 'video' ? '#FFFFFF' : 'transparent',
                  color: scanType === 'video' ? '#5854EE' : '#8E93B0',
                  fontWeight: '700',
                  fontSize: '13px',
                  boxShadow: scanType === 'video' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                🎬 Video Scan
              </button>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFile(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              style={{
                height: '240px',
                border: dragActive ? '2px solid #5854EE' : '2px dashed #D7DBEC',
                borderRadius: '20px',
                backgroundColor: dragActive ? 'rgba(88, 84, 238, 0.04)' : '#F9FAFD',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.2s'
              }}
            >
              {previewUrl ? (
                scanType === 'image' ? (
                  <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <video src={previewUrl} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                )
              ) : (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(88, 84, 238, 0.08)',
                    color: '#5854EE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                    fontSize: '24px'
                  }}>
                    +
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#1D2138' }}>
                    Drag & drop or <span style={{ color: '#5854EE' }}>Browse</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#8E93B0', marginTop: '6px' }}>
                    {scanType === 'image' ? 'Supports JPG, PNG, WEBP (up to 20MB)' : 'Supports MP4, MOV, WEBM (up to 100MB)'}
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept={scanType === 'image' ? 'image/*' : 'video/*'}
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files[0])}
              />
            </div>

            {/* Quick Sample Selector */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#8E93B0', marginBottom: '8px' }}>
                OR TRY SAMPLE ASSETS
              </div>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {(scanType === 'image' ? SAMPLE_IMAGES : SAMPLE_VIDEOS).map((sample, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSampleSelect(sample)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      backgroundColor: '#EFF1F7',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#1D2138',
                      flexShrink: 0,
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E2E6F3'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EFF1F7'}
                  >
                    <span>{sample.label.includes('Fake') ? '🔴' : '🟢'}</span>
                    <span>{sample.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Configuration and Action */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Version Type */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1D2138', marginBottom: '8px' }}>
                  Model Engine Version
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => { setVersionType('v1'); setDomainType('western'); }}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '12px',
                      border: versionType === 'v1' ? '2px solid #5854EE' : '1px solid #E2E6F3',
                      backgroundColor: versionType === 'v1' ? 'rgba(88, 84, 238, 0.06)' : '#FFFFFF',
                      color: versionType === 'v1' ? '#5854EE' : '#8E93B0',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    V1 Engine
                  </button>
                  <button
                    onClick={() => setVersionType('v2')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '12px',
                      border: versionType === 'v2' ? '2px solid #5854EE' : '1px solid #E2E6F3',
                      backgroundColor: versionType === 'v2' ? 'rgba(88, 84, 238, 0.06)' : '#FFFFFF',
                      color: versionType === 'v2' ? '#5854EE' : '#8E93B0',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    V2 (Multi-Scale) ✨
                  </button>
                </div>
              </div>

              {/* Domain Type */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1D2138', marginBottom: '8px' }}>
                  Target Domain
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setDomainType('western')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '12px',
                      border: domainType === 'western' ? '2px solid #5854EE' : '1px solid #E2E6F3',
                      backgroundColor: domainType === 'western' ? 'rgba(88, 84, 238, 0.06)' : '#FFFFFF',
                      color: domainType === 'western' ? '#5854EE' : '#8E93B0',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Western
                  </button>
                  <button
                    onClick={() => setDomainType('asian')}
                    disabled={versionType === 'v1'}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '12px',
                      border: domainType === 'asian' ? '2px solid #5854EE' : '1px solid #E2E6F3',
                      backgroundColor: domainType === 'asian' ? 'rgba(88, 84, 238, 0.06)' : '#FFFFFF',
                      color: domainType === 'asian' ? '#5854EE' : '#8E93B0',
                      fontWeight: '700',
                      cursor: versionType === 'v1' ? 'not-allowed' : 'pointer',
                      opacity: versionType === 'v1' ? 0.5 : 1
                    }}
                  >
                    Asian (V2 only)
                  </button>
                </div>
              </div>

              {/* Model Mode */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1D2138', marginBottom: '8px' }}>
                  Inference Mode
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div
                    onClick={() => setModelType('fast')}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '14px',
                      border: modelType === 'fast' ? '2px solid #5854EE' : '1px solid #E2E6F3',
                      backgroundColor: modelType === 'fast' ? 'rgba(88, 84, 238, 0.04)' : '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#1D2138' }}>FAST MODE</div>
                      <div style={{ fontSize: '11px', color: '#8E93B0' }}>Optimized latency · Real-time inference</div>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#5854EE', backgroundColor: 'rgba(88,84,238,0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                      DEFAULT
                    </span>
                  </div>

                  <div
                    onClick={() => setModelType('pro')}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '14px',
                      border: modelType === 'pro' ? '2px solid #5854EE' : '1px solid #E2E6F3',
                      backgroundColor: modelType === 'pro' ? 'rgba(88, 84, 238, 0.04)' : '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#1D2138' }}>PRO PRECISION</div>
                      <div style={{ fontSize: '11px', color: '#8E93B0' }}>Full multi-scale ensemble · Members only</div>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#FF9B38', backgroundColor: 'rgba(255,155,56,0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                      PRO
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Analysis Action / State */}
            <div style={{ marginTop: '20px' }}>
              {isAnalyzing ? (
                <div style={{
                  padding: '18px',
                  backgroundColor: '#F4F5FB',
                  borderRadius: '16px',
                  textAlign: 'center'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    border: '3px solid #E2E6F3',
                    borderTop: '3px solid #5854EE',
                    borderRadius: '50%',
                    margin: '0 auto 10px',
                    animation: 'rotateSlow 0.8s linear infinite'
                  }} />
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#1D2138' }}>
                    {statusMessage || "Analyzing neural artifacts..."}
                  </div>
                  <div style={{ fontSize: '11px', color: '#8E93B0', marginTop: '4px' }}>
                    Live polling Celery async task queue
                  </div>
                </div>
              ) : result ? (
                <div style={{
                  padding: '18px',
                  backgroundColor: result.status === 'WARNING' ? 'rgba(255, 155, 56, 0.08)' : result.label === 'FAKE' ? 'rgba(255, 71, 114, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                  borderRadius: '16px',
                  border: `1px solid ${result.status === 'WARNING' ? '#FF9B38' : result.label === 'FAKE' ? '#FF4772' : '#10B981'}`,
                  textAlign: 'center'
                }}>
                  {result.status === 'WARNING' ? (
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#FF9B38' }}>Notice</div>
                      <div style={{ fontSize: '12px', color: '#8E93B0', marginTop: '4px' }}>{result.result_msg || "Face was not clearly detected in the frame."}</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{
                        fontSize: '26px',
                        fontWeight: '900',
                        color: result.label === 'FAKE' ? '#FF4772' : '#10B981'
                      }}>
                        {result.label || 'ANALYZED'}
                      </div>
                      <div style={{ fontSize: '13px', color: '#8E93B0', marginTop: '4px' }}>
                        Probability: {((result.prob ?? result.score ?? 0) * 100).toFixed(1)}%
                      </div>
                      <button
                        onClick={() => {
                          handleClose();
                          if (scanType === 'image') {
                            navigate('/analysis-detail', { state: { image_id: result.id || result.image_id } });
                          } else {
                            navigate('/video-timeline', { state: { video_id: result.id || result.video_id, ...result } });
                          }
                        }}
                        style={{
                          marginTop: '12px',
                          padding: '8px 18px',
                          backgroundColor: '#5854EE',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: '700',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Inspect Full Evidence & Timeline →
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleStartScan}
                  style={{
                    width: '100%',
                    padding: '16px',
                    backgroundColor: '#5854EE',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '16px',
                    fontSize: '15px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(88, 84, 238, 0.35)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4743DE'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#5854EE'}
                >
                  Start Deepfake Analysis ❯
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScanModal;
