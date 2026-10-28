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

const HeatmapPage = ({ sessionUser, onLogout }) => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { video_id, frame_index, timestamp, fake_score, model_type, video_name } = state || {};

  const [tempBranch, setTempBranch] = useState('low');
  const [tempModel, setTempModel] = useState(model_type || 'fast');
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
    setTempBranch(branch);
    setTempModel(m);
    requestHeatmap(branch, m);
  };

  const requestHeatmap = async (branch, m) => {
    if (video_id == null) { setErrorMsg('video_id is missing.'); setStatus('error'); return; }
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
      const res = await axios.post(`/explain/video/${video_id}/frame/${frame_index ?? 0}`, body);
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
        const res = await axios.get(`/explain/frame/result/${tid}`);
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

  const isFake = (fake_score ?? 0) > 50;
  const isProcessing = status === 'submitting' || status === 'polling';

  if (!state) return (
    <div style={{ backgroundColor: '#F4F5FB', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '40px', textAlign: 'center', boxShadow: '0 10px 30px rgba(66,71,112,0.06)' }}>
        <p style={{ fontSize: '16px', fontWeight: '700', color: '#1D2138', marginBottom: '20px' }}>No frame data available.</p>
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
        maxWidth: '1200px',
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
            ← Back to Timeline
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ padding: '6px 14px', backgroundColor: isFake ? 'rgba(255,71,114,0.1)' : 'rgba(16,185,129,0.1)', borderRadius: '12px', fontSize: '12px', fontWeight: '800', color: isFake ? '#FF4772' : '#10B981', border: `1px solid ${isFake ? 'rgba(255,71,114,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
              {isFake ? 'FAKE' : 'REAL'}
            </span>
            <span style={{ padding: '6px 14px', backgroundColor: '#FFFFFF', borderRadius: '12px', fontSize: '12px', fontWeight: '700', color: '#5854EE', border: '1px solid rgba(88, 84, 238, 0.2)' }}>
              Frame Forgery Trace
            </span>
          </div>
        </div>

        {/* 5 Stats Pills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' }}>
          {[
            { label: 'VIDEO', value: video_name || `ID_${video_id}` },
            { label: 'TIMESTAMP', value: timestamp || `#${frame_index}`, color: '#5854EE' },
            { label: 'FRAME INDEX', value: `#${frame_index ?? 0}` },
            { label: 'FORGERY RISK', value: `${Number(fake_score ?? 0).toFixed(1)}%`, color: isFake ? '#FF4772' : '#10B981' },
            { label: 'VERDICT', value: isFake ? 'FAKE' : 'REAL', color: isFake ? '#FF4772' : '#10B981' }
          ].map((item, i) => (
            <div key={i} style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '16px', boxShadow: '0 8px 24px rgba(66, 71, 112, 0.04)', border: '1px solid rgba(226, 230, 243, 0.8)' }}>
              <div style={{ fontSize: '10px', color: '#8E93B0', fontWeight: '800', letterSpacing: '1px' }}>{item.label}</div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: item.color || '#1D2138', marginTop: '2px' }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Heatmap CAM Viewer Card */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '26px',
          padding: '28px',
          boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
          border: '1px solid rgba(226, 230, 243, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '480px'
        }}>
          {(status === 'idle' || status === 'error') && !isProcessing && (
            <div style={{ textAlign: 'center', maxWidth: '380px' }}>
              {status === 'error' && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ color: '#FF4772', fontSize: '14px', fontWeight: '800' }}>{errorMsg}</div>
                  {errorDetail && <div style={{ color: '#8E93B0', fontSize: '11px', marginTop: '4px' }}>{errorDetail}</div>}
                </div>
              )}

              <div style={{ fontSize: '11px', fontWeight: '800', color: '#8E93B0', marginBottom: '8px' }}>
                SELECT CAM EXPLAINER BRANCH
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '18px' }}>
                {Object.keys(BRANCH_OPTIONS).map(branch => (
                  <button
                    key={branch}
                    onClick={() => setTempBranch(branch)}
                    style={{
                      padding: '10px 24px',
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
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
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
                  fontSize: '14px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(88, 84, 238, 0.3)'
                }}
              >
                Generate Frame CAM Heatmap ❯
              </button>
            </div>
          )}

          {isProcessing && (
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
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#1D2138' }}>
                Extracting Frame Artifacts...
              </div>
              <div style={{ fontSize: '12px', color: '#8E93B0', marginTop: '4px' }}>
                {elapsed}s elapsed · Polling Celery async worker
              </div>
            </div>
          )}

          {status === 'done' && heatmapSrc && (
            <div style={{ textAlign: 'center', width: '100%' }}>
              <img
                src={heatmapSrc}
                alt="Frame Heatmap"
                style={{ maxWidth: '100%', maxHeight: '520px', borderRadius: '16px', objectFit: 'contain' }}
              />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
                <a
                  href={heatmapSrc}
                  download={`frame_${frame_index}_cam.png`}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: '#5854EE',
                    color: '#FFFFFF',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    textDecoration: 'none'
                  }}
                >
                  Download Frame CAM
                </a>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default HeatmapPage;