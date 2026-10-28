import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';

const POLL_INTERVAL = 2000;

const BRANCH_OPTIONS = {
  low: { branch_level: 'low', explainer_type: 'layercam', display_type: 'heatmap_bbox', overlay_ratio: 0.7, threshold: 0.9 },
  high: { branch_level: 'high', explainer_type: 'eigengradcam', display_type: 'heatmap_bbox', overlay_ratio: 0.7, threshold: 0.9 },
};
const MODEL_OPTIONS = ['fast', 'pro'];

const extractTaskId = (data) => {
  if (typeof data === 'string') return data;
  return data?.task_id || data?.id || null;
};
const toAbsoluteUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('blob')) return path;
  return path;
};

const ImageHeatmapPage = ({ sessionUser, onLogout }) => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { image_id, image_loc, model_type, prob, label } = state || {};

  const [tempBranch, setTempBranch] = useState('low');
  const [tempModel, setTempModel] = useState(model_type || 'fast');
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [status, setStatus] = useState('idle');
  const [heatmapSrc, setHeatmapSrc] = useState(null);
  const [, setTaskId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const pollingRef = useRef(null);
  const timerRef = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      stopPolling();
      clearInterval(timerRef.current);
    };
  }, []);

  const stopPolling = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  };

  const handleBranchSelect = (branch, m) => {
    setSelectedBranch(branch);
    setSelectedModel(m);
    setTempBranch(branch);
    setTempModel(m);
    requestHeatmap(branch, m);
  };

  const requestHeatmap = async (branch, m) => {
    if (image_id == null) { setErrorMsg('image_id is missing.'); setStatus('error'); return; }
    stopPolling();
    clearInterval(timerRef.current);
    setElapsed(0);
    setStatus('submitting');
    setHeatmapSrc(null);
    setErrorMsg('');
    setErrorDetail('');
    setTaskId(null);

    const body = { model_type: m, ...BRANCH_OPTIONS[branch] };

    try {
      const res = await axios.post(`/explain/image/${image_id}`, body);
      const tid = extractTaskId(res.data);
      if (!tid) throw new Error(`Failed to extract task_id: ${JSON.stringify(res.data)}`);
      setTaskId(tid);
      setStatus('polling');
      timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
      startPolling(tid);
    } catch (e) {
      if (!isMounted.current) return;
      const detail = e.response?.data?.detail;
      let msg = typeof detail === 'string' ? detail : e.message || 'Request failed';
      setErrorMsg(`Heatmap request failed (${e.response?.status ?? ''})`);
      setErrorDetail(msg);
      setStatus('error');
    }
  };

  const startPolling = (tid) => {
    let cnt = 0;
    pollingRef.current = setInterval(async () => {
      if (!isMounted.current) return;
      try {
        const res = await axios.get(`/explain/image/result/${tid}`);
        cnt = 0;
        const d = res.data;
        if (d === null || d === undefined) return;
        let loc = null;
        if (typeof d === 'string' && d.trim()) {
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d.trim());
          if (!isUUID) loc = d.trim();
        } else if (typeof d === 'object') {
          loc = d.cam_loc ?? d.result_loc ?? d.image_loc ?? d.heatmap_loc ?? null;
          if (!loc) {
            const st = (d.status || '').toUpperCase();
            if (st === 'FAILED' || st === 'ERROR') {
              stopPolling();
              clearInterval(timerRef.current);
              setErrorMsg('Heatmap generation failed');
              setErrorDetail(d.result_msg || d.message || 'Server error');
              setStatus('error');
              return;
            }
            return;
          }
        }
        if (loc) {
          stopPolling();
          clearInterval(timerRef.current);
          setHeatmapSrc(toAbsoluteUrl(loc));
          setStatus('done');
        }
      } catch (e) {
        cnt++;
        if (cnt >= 5) {
          stopPolling();
          clearInterval(timerRef.current);
          setErrorMsg('Server connection failed');
          setErrorDetail(e.message);
          setStatus('error');
        }
      }
    }, POLL_INTERVAL);
  };

  const isFake = (prob ?? 0) > 0.5;
  const isProcessing = status === 'submitting' || status === 'polling';
  const imageSrc = image_loc ? toAbsoluteUrl(image_loc) : null;

  if (!state) return (
    <div style={{ backgroundColor: '#F4F5FB', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '40px', textAlign: 'center', boxShadow: '0 10px 30px rgba(66,71,112,0.06)' }}>
        <p style={{ fontSize: '16px', fontWeight: '700', color: '#1D2138', marginBottom: '20px' }}>No image session data found.</p>
        <button onClick={() => navigate(-1)} style={{ padding: '10px 24px', backgroundColor: '#5854EE', color: '#FFFFFF', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '700' }}>Back</button>
      </div>
    </div>
  );

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
        maxWidth: '1400px',
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        boxSizing: 'border-box'
      }}>
        {/* Navigation Breadcrumb Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#FFFFFF',
              border: '1px solid rgba(226, 230, 243, 0.9)',
              borderRadius: '12px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '700',
              color: '#1D2138',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(66, 71, 112, 0.04)'
            }}
          >
            ← Back to Detail
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ padding: '6px 14px', backgroundColor: isFake ? 'rgba(255,71,114,0.1)' : 'rgba(16,185,129,0.1)', borderRadius: '12px', fontSize: '12px', fontWeight: '800', color: isFake ? '#FF4772' : '#10B981', border: `1px solid ${isFake ? 'rgba(255,71,114,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
              {label || (isFake ? 'FAKE' : 'REAL')}
            </span>
            <span style={{ padding: '6px 14px', backgroundColor: '#FFFFFF', borderRadius: '12px', fontSize: '12px', fontWeight: '700', color: '#5854EE', border: '1px solid rgba(88, 84, 238, 0.2)' }}>
              Explainable CAM Analysis
            </span>
          </div>
        </div>

        {/* 3 Metric Pills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '16px 20px', boxShadow: '0 8px 24px rgba(66, 71, 112, 0.04)', border: '1px solid rgba(226, 230, 243, 0.7)' }}>
            <div style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '700' }}>MANIPULATION PROBABILITY</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: isFake ? '#FF4772' : '#10B981', marginTop: '2px' }}>
              {((prob ?? 0) * 100).toFixed(1)}%
            </div>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '16px 20px', boxShadow: '0 8px 24px rgba(66, 71, 112, 0.04)', border: '1px solid rgba(226, 230, 243, 0.7)' }}>
            <div style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '700' }}>VERDICT</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: isFake ? '#FF4772' : '#10B981', marginTop: '2px' }}>
              {label || (isFake ? 'FAKE' : 'REAL')}
            </div>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '16px 20px', boxShadow: '0 8px 24px rgba(66, 71, 112, 0.04)', border: '1px solid rgba(226, 230, 243, 0.7)' }}>
            <div style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '700' }}>MODEL INFERENCE MODE</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#1D2138', marginTop: '2px' }}>
              {(selectedModel || model_type || 'fast').toUpperCase()}
            </div>
          </div>
        </div>

        {/* 2-Column Split: Original Image (Left) vs Heatmap CAM Overlay (Right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'stretch' }}>
          {/* Original Image Card */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '26px',
            padding: '24px',
            boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
            border: '1px solid rgba(226, 230, 243, 0.8)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#A0A5BD', letterSpacing: '1px', marginBottom: '16px' }}>
              ORIGINAL INPUT IMAGE
            </div>
            <div style={{
              flex: 1,
              minHeight: '380px',
              backgroundColor: '#F9FAFD',
              borderRadius: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              border: '1px solid #EFF1F7'
            }}>
              {imageSrc ? (
                <img src={imageSrc} alt="Original" style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain' }} />
              ) : (
                <div style={{ color: '#8E93B0', fontSize: '13px' }}>Image preview not available</div>
              )}
            </div>
          </div>

          {/* CAM Heatmap Panel */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '26px',
            padding: '24px',
            boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
            border: '1px solid rgba(226, 230, 243, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#A0A5BD', letterSpacing: '1px' }}>
                FORGERY LOCALIZATION HEATMAP (CAM)
              </div>
              {status === 'done' && heatmapSrc && (
                <a
                  href={heatmapSrc}
                  download={`deepguard_heatmap_${image_id}.png`}
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#5854EE',
                    textDecoration: 'none',
                    backgroundColor: 'rgba(88, 84, 238, 0.08)',
                    padding: '4px 12px',
                    borderRadius: '8px'
                  }}
                >
                  ↓ Save Image
                </a>
              )}
            </div>

            <div style={{
              flex: 1,
              minHeight: '380px',
              backgroundColor: '#F9FAFD',
              borderRadius: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              border: '1px solid #EFF1F7',
              padding: '20px',
              boxSizing: 'border-box'
            }}>
              {/* Option Selection State */}
              {(status === 'idle' || status === 'error') && !isProcessing && (
                <div style={{ textAlign: 'center', maxWidth: '340px' }}>
                  {status === 'error' && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ color: '#FF4772', fontSize: '14px', fontWeight: '800' }}>{errorMsg}</div>
                      {errorDetail && <div style={{ color: '#8E93B0', fontSize: '11px', marginTop: '4px' }}>{errorDetail}</div>}
                    </div>
                  )}

                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#8E93B0', marginBottom: '8px' }}>
                    SELECT CAM EXPLAINER BRANCH
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                    {Object.keys(BRANCH_OPTIONS).map(branch => (
                      <button
                        key={branch}
                        onClick={() => setTempBranch(branch)}
                        style={{
                          padding: '10px 20px',
                          borderRadius: '10px',
                          border: tempBranch === branch ? '2px solid #5854EE' : '1px solid #E2E6F3',
                          backgroundColor: tempBranch === branch ? 'rgba(88, 84, 238, 0.06)' : '#FFFFFF',
                          color: tempBranch === branch ? '#5854EE' : '#8E93B0',
                          fontSize: '12px',
                          fontWeight: '800',
                          cursor: 'pointer'
                        }}
                      >
                        {branch.toUpperCase()}
                        <span style={{ display: 'block', fontSize: '10px', fontWeight: '500', opacity: 0.8 }}>
                          {branch === 'low' ? 'LayerCAM (Local)' : 'EigenGradCAM (Global)'}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#8E93B0', marginBottom: '8px' }}>
                    SELECT INFERENCE MODE
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '22px' }}>
                    {MODEL_OPTIONS.map(m => (
                      <button
                        key={m}
                        onClick={() => setTempModel(m)}
                        style={{
                          padding: '8px 24px',
                          borderRadius: '10px',
                          border: tempModel === m ? '2px solid #5854EE' : '1px solid #E2E6F3',
                          backgroundColor: tempModel === m ? 'rgba(88, 84, 238, 0.06)' : '#FFFFFF',
                          color: tempModel === m ? '#5854EE' : '#8E93B0',
                          fontSize: '12px',
                          fontWeight: '800',
                          cursor: 'pointer'
                        }}
                      >
                        {m.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handleBranchSelect(tempBranch, tempModel)}
                    style={{
                      width: '100%',
                      padding: '14px',
                      backgroundColor: '#5854EE',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(88, 84, 238, 0.3)'
                    }}
                  >
                    Generate Forgery Heatmap ❯
                  </button>
                </div>
              )}

              {/* Processing / Polling State */}
              {isProcessing && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    border: '3px solid #E2E6F3',
                    borderTop: '3px solid #5854EE',
                    borderRadius: '50%',
                    margin: '0 auto 16px',
                    animation: 'rotateSlow 0.8s linear infinite'
                  }} />
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#1D2138' }}>
                    Synthesizing CAM Activation Map...
                  </div>
                  <div style={{ fontSize: '12px', color: '#8E93B0', marginTop: '4px' }}>
                    {elapsed}s elapsed · Polling Celery async task queue
                  </div>
                </div>
              )}

              {/* Completed CAM Image Result */}
              {status === 'done' && heatmapSrc && (
                <div style={{ textAlign: 'center', width: '100%' }}>
                  <img
                    src={heatmapSrc}
                    alt="CAM Heatmap"
                    style={{ maxWidth: '100%', maxHeight: '420px', borderRadius: '12px', objectFit: 'contain' }}
                  />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '14px' }}>
                    {Object.keys(BRANCH_OPTIONS).map(branch => (
                      <button
                        key={branch}
                        onClick={() => handleBranchSelect(branch, selectedModel || tempModel)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: selectedBranch === branch ? '1.5px solid #5854EE' : '1px solid #E2E6F3',
                          backgroundColor: selectedBranch === branch ? 'rgba(88, 84, 238, 0.08)' : '#FFFFFF',
                          color: selectedBranch === branch ? '#5854EE' : '#8E93B0',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        Switch to {branch.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ImageHeatmapPage;