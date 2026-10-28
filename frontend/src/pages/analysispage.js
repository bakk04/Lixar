import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';

const SAMPLE_IMAGES = [
  { name: 'asian_fake_1.JPG', src: '/samples/images/asian_fake_1.JPG', domain: 'asian', label: '동양인 Fake' },
  { name: 'asian_fake_2.JPG', src: '/samples/images/asian_fake_2.JPG', domain: 'asian', label: '동양인 Fake' },
  { name: 'western_fake_1.JPG', src: '/samples/images/western_fake_1.JPG', domain: 'western', label: '서양인 Fake' },
  { name: 'western_fake_2.JPG', src: '/samples/images/western_fake_2.JPG', domain: 'western', label: '서양인 Fake' },
];

const AnalysisPage = ({ sessionUser, onLogout, setSessionUser }) => {
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState([]);

  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedSample, setSelectedSample] = useState(null);

  const [versionType, setVersionType] = useState('v2');
  const [modelType, setModelType] = useState('fast');
  const [domainType, setDomainType] = useState('western');

  const [result, setResult] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const pollingTimer = useRef(null);
  const isMounted = useRef(true);
  const fileInputRef = useRef(null);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await axios.get('/image/history');
      if (response.data.status === "success") {
        setHistory(response.data.context || []);
      }
    } catch (e) {
      console.log("History load error");
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    const syncSession = async () => {
      if (!sessionUser) {
        try {
          const response = await axios.get('/auth/check');
          if (response.data && response.data.user) setSessionUser(response.data.user);
        } catch (error) {
          console.log("Session verification error");
        }
      }
    };
    syncSession();
    fetchHistory();

    return () => {
      isMounted.current = false;
      if (pollingTimer.current) {
        clearInterval(pollingTimer.current);
        pollingTimer.current = null;
      }
    };
  }, [sessionUser, setSessionUser, fetchHistory]);

  const startPolling = useCallback((imageId) => {
    if (!imageId) return;
    if (pollingTimer.current) clearInterval(pollingTimer.current);

    pollingTimer.current = setInterval(async () => {
      if (!isMounted.current) return;
      try {
        const response = await axios.get(`/inference/image/${imageId}`);
        const data = response.data;
        if (data.status === 'SUCCESS' || data.prob !== undefined || data.analysis !== undefined) {
          clearInterval(pollingTimer.current);
          pollingTimer.current = null;
          setResult({ ...data, image_id: imageId });
          setIsAnalyzing(false);
          setStatusMessage('');
          fetchHistory();
        } else if (data.status === 'FAILED' || data.status === 'ERROR') {
          clearInterval(pollingTimer.current);
          pollingTimer.current = null;
          setIsAnalyzing(false);
          setStatusMessage('');
          alert(data.result_msg || "Analysis failed on server.");
        } else if (data.status === 'WARNING') {
          clearInterval(pollingTimer.current);
          pollingTimer.current = null;
          setResult({ ...data, status: 'WARNING' });
          setIsAnalyzing(false);
          setStatusMessage('');
          fetchHistory();
        } else {
          setStatusMessage(data.message || "Deep neural feature extraction in progress...");
        }
      } catch (err) {
        setResult(null);
      }
    }, 2000);
  }, [fetchHistory]);

  const handlePredict = async () => {
    if (modelType === 'pro' && !sessionUser) {
      alert("Pro model inference requires authentication. Please sign in.");
      navigate('/login');
      return;
    }
    if (!file) return alert("Please select or upload an image first.");

    const formData = new FormData();
    formData.append('imagefile', file);
    formData.append('model_type', modelType);
    formData.append('domain_type', domainType === 'western' ? '서양인' : '동양인');
    formData.append('version_type', versionType);

    setIsAnalyzing(true);
    setStatusMessage('Submitting to neural inference pipeline...');
    setResult(null);

    try {
      const response = await axios.post('/inference/image', formData);
      const imageId = response.data?.image_id || response.data;
      if (imageId) startPolling(imageId);
      else setIsAnalyzing(false);
    } catch (err) {
      setIsAnalyzing(false);
      setStatusMessage('');
      alert("Failed to submit image for inference.");
    }
  };

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setResult(null);
    setStatusMessage('');
    setSelectedSample(null);
  };

  const handleSelectSample = async (sample) => {
    try {
      const res = await fetch(sample.src);
      const blob = await res.blob();
      const loadedFile = new File([blob], sample.name, { type: blob.type });
      if (sample.domain === 'asian') setVersionType('v2');
      setDomainType(sample.domain);
      handleFileSelect(loadedFile);
      setSelectedSample(sample.name);
    } catch (e) {
      alert("Failed to load sample image.");
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} history records?`)) return;

    try {
      const deletePromises = selectedIds.map(id =>
        axios.delete(`/image/history/${id}`)
      );
      await Promise.all(deletePromises);
      alert("Selected records deleted successfully.");
      fetchHistory();
      setSelectedIds([]);
      setIsEditMode(false);
    } catch (error) {
      console.error(error);
      alert("Failed to delete records from server.");
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F4F5FB',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      <Header sessionUser={sessionUser} onLogout={onLogout} />

      <main style={{
        flex: 1,
        padding: '10px 44px 30px',
        maxWidth: '1600px',
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        gap: '24px',
        boxSizing: 'border-box'
      }}>
        {/* Left Sidebar: Recent Scan History */}
        <aside style={{
          width: '290px',
          backgroundColor: '#FFFFFF',
          borderRadius: '26px',
          padding: '24px',
          boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
          border: '1px solid rgba(226, 230, 243, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0
        }}>
          <button
            onClick={() => {
              setFile(null);
              setPreviewUrl(null);
              setResult(null);
              setStatusMessage('');
              setSelectedSample(null);
              if (pollingTimer.current) clearInterval(pollingTimer.current);
            }}
            style={{
              backgroundColor: '#5854EE',
              color: '#FFFFFF',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              marginBottom: '20px',
              cursor: 'pointer',
              fontWeight: '800',
              fontSize: '13px',
              boxShadow: '0 4px 14px rgba(88, 84, 238, 0.3)'
            }}
          >
            + New Image Scan
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1D2138', margin: 0 }}>Scan History</h3>
            {sessionUser && history.length > 0 && (
              <button
                onClick={() => { setIsEditMode(!isEditMode); setSelectedIds([]); }}
                style={{ background: 'none', border: 'none', color: '#5854EE', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}
              >
                {isEditMode ? 'Cancel' : 'Edit'}
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sessionUser ? (
              history.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#8E93B0', fontSize: '12px', marginTop: '40px' }}>No previous scans</div>
              ) : (
                history.map((item, index) => {
                  const p = item.prob ?? item.score ?? item.analysis?.prob ?? -1;
                  const isSelected = selectedIds.includes(item.image_id);
                  let itemLabel = item.label || (p > 0.5 ? 'FAKE' : 'REAL');

                  return (
                    <div key={item.image_id || index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isEditMode && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.image_id)}
                          style={{ accentColor: '#5854EE' }}
                        />
                      )}
                      <div
                        onClick={() => !isEditMode && navigate('/analysis-detail', { state: { image_id: item.image_id } })}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 12px',
                          backgroundColor: '#F9FAFD',
                          borderRadius: '12px',
                          border: isSelected ? '1.5px solid #5854EE' : '1px solid #EFF1F7',
                          cursor: isEditMode ? 'default' : 'pointer'
                        }}
                      >
                        <div style={{ width: '42px', height: '42px', backgroundColor: '#EFF1F7', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                          {item.image_loc ? <img src={item.image_loc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🖼️'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '700' }}>
                            {item.version_type?.toUpperCase() || 'V2'} · {item.model_type?.toUpperCase() || 'FAST'}
                          </div>
                          <div style={{ fontSize: '10px', color: '#A0A5BD' }}>{item.created_at?.slice(0, 10)}</div>
                          <div style={{
                            fontSize: '11px',
                            fontWeight: '800',
                            color: itemLabel === 'FAKE' ? '#FF4772' : '#10B981'
                          }}>
                            {itemLabel}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              <div style={{ textAlign: 'center', color: '#8E93B0', fontSize: '12px', padding: '30px 10px' }}>
                Sign in to view and save your scan history.
              </div>
            )}
          </div>

          {isEditMode && (
            <button
              onClick={handleDeleteSelected}
              disabled={selectedIds.length === 0}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: selectedIds.length > 0 ? '#FF4772' : '#EFF1F7',
                color: selectedIds.length > 0 ? '#FFFFFF' : '#8E93B0',
                border: 'none',
                borderRadius: '10px',
                cursor: selectedIds.length > 0 ? 'pointer' : 'not-allowed',
                marginTop: '10px',
                fontWeight: '700',
                fontSize: '12px'
              }}
            >
              Delete Selected ({selectedIds.length})
            </button>
          )}
        </aside>

        {/* Center: Upload & Scanner Studio */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Sample Row */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            padding: '16px 20px',
            boxShadow: '0 8px 24px rgba(66, 71, 112, 0.04)',
            border: '1px solid rgba(226, 230, 243, 0.8)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#8E93B0', letterSpacing: '0.8px', whiteSpace: 'nowrap' }}>
              SAMPLE IMAGES
            </span>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
              {SAMPLE_IMAGES.map((s) => {
                const isFake = s.label.includes('Fake');
                const isSelected = selectedSample === s.name;
                return (
                  <div
                    key={s.name}
                    onClick={() => handleSelectSample(s)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      borderRadius: '10px',
                      backgroundColor: isSelected ? 'rgba(88, 84, 238, 0.08)' : '#EFF1F7',
                      border: isSelected ? '1.5px solid #5854EE' : '1px solid transparent',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#1D2138',
                      flexShrink: 0
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isFake ? '#FF4772' : '#10B981' }} />
                    <span>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dual Panel Upload / Result Studio */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flex: 1 }}>
            {/* Upload Box */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
              }}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '26px',
                padding: '24px',
                boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
                border: dragActive ? '2px solid #5854EE' : '1px solid rgba(226, 230, 243, 0.8)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                minHeight: '380px',
                position: 'relative'
              }}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" style={{ maxWidth: '95%', maxHeight: '340px', objectFit: 'contain', borderRadius: '12px' }} />
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(88, 84, 238, 0.08)',
                    color: '#5854EE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '26px',
                    margin: '0 auto 16px'
                  }}>
                    +
                  </div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: '800', color: '#1D2138' }}>Image Upload</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#8E93B0' }}>Drag and drop your image or browse</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => handleFileSelect(e.target.files[0])} />
            </div>

            {/* Inference Result Box */}
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '26px',
              padding: '24px',
              boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
              border: '1px solid rgba(226, 230, 243, 0.8)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '380px'
            }}>
              {isAnalyzing ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    border: '3px solid #E2E6F3',
                    borderTop: '3px solid #5854EE',
                    borderRadius: '50%',
                    margin: '0 auto 16px',
                    animation: 'rotateSlow 0.8s linear infinite'
                  }} />
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#1D2138' }}>AI Scanning Image...</div>
                  <div style={{ fontSize: '12px', color: '#8E93B0', marginTop: '6px' }}>{statusMessage || "Analyzing..."}</div>
                </div>
              ) : result ? (
                result.status === 'WARNING' ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <div style={{ fontSize: '24px', color: '#FF9B38', marginBottom: '8px' }}>⚠</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#FF9B38' }}>Analysis Notice</div>
                    <div style={{ fontSize: '13px', color: '#8E93B0', marginTop: '6px' }}>{result.result_msg}</div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#A0A5BD', letterSpacing: '2px' }}>VERDICT</div>
                    <div style={{
                      fontSize: '64px',
                      fontWeight: '900',
                      color: result.label === 'FAKE' ? '#FF4772' : '#10B981',
                      margin: '6px 0',
                      lineHeight: 1
                    }}>
                      {result.label || (result.score > 0.5 ? 'FAKE' : 'REAL')}
                    </div>
                    <button
                      onClick={() => navigate('/analysis-detail', { state: { image_id: result.image_id } })}
                      style={{
                        marginTop: '20px',
                        padding: '10px 24px',
                        backgroundColor: '#5854EE',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(88, 84, 238, 0.3)'
                      }}
                    >
                      View Detailed Inspection ❯
                    </button>
                  </div>
                )
              ) : (
                <div style={{ textAlign: 'center', color: '#A0A5BD', fontSize: '13px', fontWeight: '600' }}>
                  Select an image and click Start Analysis.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Settings Panel */}
        <aside style={{
          width: '280px',
          backgroundColor: '#FFFFFF',
          borderRadius: '26px',
          padding: '24px',
          boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
          border: '1px solid rgba(226, 230, 243, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div>
            <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: '800', color: '#1D2138', borderBottom: '1px solid #EFF1F7', paddingBottom: '12px' }}>
              Model Settings
            </h3>

            {/* Version */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#1D2138', marginBottom: '8px' }}>Version</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => { setVersionType('v1'); setDomainType('western'); }}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px',
                    border: versionType === 'v1' ? '1.5px solid #5854EE' : '1px solid #E2E6F3',
                    backgroundColor: versionType === 'v1' ? 'rgba(88,84,238,0.06)' : '#FFFFFF',
                    color: versionType === 'v1' ? '#5854EE' : '#8E93B0',
                    fontWeight: '700', fontSize: '12px', cursor: 'pointer'
                  }}
                >
                  V1
                </button>
                <button
                  onClick={() => setVersionType('v2')}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px',
                    border: versionType === 'v2' ? '1.5px solid #5854EE' : '1px solid #E2E6F3',
                    backgroundColor: versionType === 'v2' ? 'rgba(88,84,238,0.06)' : '#FFFFFF',
                    color: versionType === 'v2' ? '#5854EE' : '#8E93B0',
                    fontWeight: '700', fontSize: '12px', cursor: 'pointer'
                  }}
                >
                  V2 (Multi)
                </button>
              </div>
            </div>

            {/* Domain */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#1D2138', marginBottom: '8px' }}>Domain</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setDomainType('western')}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px',
                    border: domainType === 'western' ? '1.5px solid #5854EE' : '1px solid #E2E6F3',
                    backgroundColor: domainType === 'western' ? 'rgba(88,84,238,0.06)' : '#FFFFFF',
                    color: domainType === 'western' ? '#5854EE' : '#8E93B0',
                    fontWeight: '700', fontSize: '12px', cursor: 'pointer'
                  }}
                >
                  Western
                </button>
                <button
                  onClick={() => setDomainType('asian')}
                  disabled={versionType === 'v1'}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px',
                    border: domainType === 'asian' ? '1.5px solid #5854EE' : '1px solid #E2E6F3',
                    backgroundColor: domainType === 'asian' ? 'rgba(88,84,238,0.06)' : '#FFFFFF',
                    color: domainType === 'asian' ? '#5854EE' : '#8E93B0',
                    fontWeight: '700', fontSize: '12px',
                    cursor: versionType === 'v1' ? 'not-allowed' : 'pointer',
                    opacity: versionType === 'v1' ? 0.5 : 1
                  }}
                >
                  Asian
                </button>
              </div>
            </div>

            {/* Mode */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#1D2138', marginBottom: '8px' }}>Inference Mode</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={() => setModelType('fast')}
                  style={{
                    padding: '10px 14px', borderRadius: '10px',
                    border: modelType === 'fast' ? '1.5px solid #5854EE' : '1px solid #E2E6F3',
                    backgroundColor: modelType === 'fast' ? 'rgba(88,84,238,0.06)' : '#FFFFFF',
                    color: modelType === 'fast' ? '#5854EE' : '#1D2138',
                    textAlign: 'left', fontWeight: '700', fontSize: '12px', cursor: 'pointer'
                  }}
                >
                  ⚡ FAST (Recommended)
                </button>
                <button
                  onClick={() => setModelType('pro')}
                  style={{
                    padding: '10px 14px', borderRadius: '10px',
                    border: modelType === 'pro' ? '1.5px solid #5854EE' : '1px solid #E2E6F3',
                    backgroundColor: modelType === 'pro' ? 'rgba(88,84,238,0.06)' : '#FFFFFF',
                    color: modelType === 'pro' ? '#5854EE' : '#1D2138',
                    textAlign: 'left', fontWeight: '700', fontSize: '12px', cursor: 'pointer'
                  }}
                >
                  🎯 PRO (High Accuracy)
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handlePredict}
            disabled={isAnalyzing}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: '#5854EE',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '14px',
              fontWeight: '800',
              fontSize: '14px',
              cursor: isAnalyzing ? 'not-allowed' : 'pointer',
              boxShadow: '0 6px 20px rgba(88, 84, 238, 0.35)'
            }}
          >
            {isAnalyzing ? "Scanning..." : "Start Analysis ❯"}
          </button>
        </aside>
      </main>

      <Footer />
    </div>
  );
};

export default AnalysisPage;