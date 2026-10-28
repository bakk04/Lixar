import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';

const AnalysisDetailPage = ({ sessionUser, onLogout }) => {
  const { state } = useLocation();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      const imageId = state?.image_id;
      const videoId = state?.video_id;

      if (!imageId && !videoId) {
        setLoading(false);
        return;
      }

      try {
        if (imageId) {
          const res = await axios.get(`/image/history/${imageId}`);
          setData(res.data.context);
        } else {
          const res = await axios.get(`/video/history/${videoId}`);
          setData(res.data.context);
        }
      } catch (e) {
        console.error("Detail fetch error", e);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [state]);

  if (loading) {
    return (
      <div style={{ backgroundColor: '#F4F5FB', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ width: '38px', height: '38px', border: '3px solid #E2E6F3', borderTop: '3px solid #5854EE', borderRadius: '50%', animation: 'rotateSlow 0.8s linear infinite' }} />
        <p style={{ marginTop: '16px', fontSize: '14px', fontWeight: '700', color: '#1D2138' }}>Loading detailed metrics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ backgroundColor: '#F4F5FB', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '40px', textAlign: 'center', boxShadow: '0 10px 30px rgba(66,71,112,0.06)' }}>
          <p style={{ fontSize: '16px', fontWeight: '700', color: '#1D2138', marginBottom: '20px' }}>
            Analysis data not found or invalid session route.
          </p>
          <button
            onClick={() => navigate('/overview')}
            style={{ padding: '10px 24px', backgroundColor: '#5854EE', color: '#FFFFFF', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '700' }}
          >
            Return to Overview
          </button>
        </div>
      </div>
    );
  }

  const prob = data.prob ?? data.score ?? data.analysis?.prob ?? data.result_prob ?? -1;
  const face_conf = data.face_conf ?? data.face_confidence ?? data.conf ?? data.analysis?.face_conf ?? 0;
  const face_ratio = data.face_ratio ?? data.ratio ?? data.analysis?.face_ratio ?? 0;
  const face_brightness = data.face_brightness ?? data.brightness ?? data.analysis?.face_brightness ?? 0;

  let label = 'UNKNOWN';
  if (data.label && data.label !== 'UNKNOWN') {
    label = data.label.toUpperCase();
  } else if (prob !== -1) {
    label = prob > 0.5 ? 'FAKE' : 'REAL';
  }

  const isInvalid = prob === -1;
  const displayProb = isInvalid ? 'N/A' : (Number(prob) * 100).toFixed(1) + '%';

  const brightnessColor = face_brightness < 20 ? '#FF4772' : '#10B981';
  const ratioColor = face_ratio >= 3 ? '#10B981' : '#FF4772';

  const mediaLoc = data.video_loc || data.media_loc || data.image_loc || '';
  const mediaSrc = mediaLoc.startsWith('blob') ? mediaLoc : mediaLoc;
  const isVideo = !!data.video_loc || (data.score !== undefined && !data.image_loc) || window.location.pathname.includes('video');
  const isWarning = data.status?.toUpperCase() === 'WARNING';

  const handleImageHeatmap = () => {
    navigate('/image-heatmap', {
      state: {
        image_id: data.image_id || data.id,
        image_loc: data.image_loc,
        model_type: data.model_type || 'fast',
        prob,
        label,
      },
    });
  };

  const handleVideoHeatmap = () => {
    navigate('/video-timeline', {
      state: {
        ...data,
      },
    });
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
            ← Back to Overview
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ padding: '6px 14px', backgroundColor: '#FFFFFF', borderRadius: '12px', fontSize: '12px', fontWeight: '700', color: '#5854EE', border: '1px solid rgba(88, 84, 238, 0.2)' }}>
              {data.version_type?.toUpperCase() || 'V2'}
            </span>
            <span style={{ padding: '6px 14px', backgroundColor: '#FFFFFF', borderRadius: '12px', fontSize: '12px', fontWeight: '700', color: '#5854EE', border: '1px solid rgba(88, 84, 238, 0.2)' }}>
              {data.domain_type || 'Western'}
            </span>
            <span style={{ padding: '6px 14px', backgroundColor: '#FFFFFF', borderRadius: '12px', fontSize: '12px', fontWeight: '700', color: '#5854EE', border: '1px solid rgba(88, 84, 238, 0.2)' }}>
              {data.model_type?.toUpperCase() || 'FAST'}
            </span>
          </div>
        </div>

        {/* 2-Column Split: Media Player View (Left) & Metrics Scorecard (Right) */}
        <div style={{ display: 'flex', gap: '26px', alignItems: 'stretch' }}>
          {/* Media Player Card */}
          <div style={{
            flex: 1.2,
            backgroundColor: '#FFFFFF',
            borderRadius: '26px',
            padding: '28px',
            boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
            border: '1px solid rgba(226, 230, 243, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{
              width: '100%',
              height: '420px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#F9FAFD',
              borderRadius: '18px',
              overflow: 'hidden',
              border: '1px solid #EFF1F7'
            }}>
              {isVideo && mediaLoc ? (
                <video src={mediaSrc} controls autoPlay muted style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : mediaLoc ? (
                <img src={mediaSrc} alt="Analyzed media" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <div style={{ color: '#8E93B0', fontSize: '13px' }}>Media not available</div>
              )}
            </div>

            {/* Explainability Launch Action */}
            {isVideo && mediaLoc && (
              <button
                onClick={handleVideoHeatmap}
                style={{
                  marginTop: '20px',
                  width: '100%',
                  padding: '14px',
                  backgroundColor: '#5854EE',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '14px',
                  fontSize: '13px',
                  fontWeight: '800',
                  letterSpacing: '0.8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(88, 84, 238, 0.3)'
                }}
              >
                Inspect Frame-by-Frame Timeline & CAM Heatmap →
              </button>
            )}

            {!isVideo && mediaLoc && !isWarning && (
              <button
                onClick={handleImageHeatmap}
                style={{
                  marginTop: '20px',
                  width: '100%',
                  padding: '14px',
                  backgroundColor: '#5854EE',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '14px',
                  fontSize: '13px',
                  fontWeight: '800',
                  letterSpacing: '0.8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(88, 84, 238, 0.3)'
                }}
              >
                Generate CAM Forgery Heatmap (EigenGradCAM / LayerCAM) →
              </button>
            )}
          </div>

          {/* Right Metrics Scorecard */}
          <div style={{ flex: 0.8, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {isWarning ? (
              <div style={{
                flex: 1,
                backgroundColor: '#FFFFFF',
                borderRadius: '26px',
                padding: '36px',
                boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
                border: '1px solid rgba(226, 230, 243, 0.8)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
              }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(255, 155, 56, 0.1)', color: '#FF9B38', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '16px' }}>
                  ⚠
                </div>
                <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#FF9B38', margin: '0 0 10px' }}>
                  Face Localization Notice
                </h3>
                <p style={{ fontSize: '14px', color: '#8E93B0', lineHeight: '1.6', margin: 0 }}>
                  {data.result_msg || "A clear human face could not be isolated for deepfake feature analysis."}
                </p>
              </div>
            ) : (
              <>
                {/* Final Verdict Card */}
                <div style={{
                  flex: 1,
                  backgroundColor: '#FFFFFF',
                  borderRadius: '26px',
                  padding: '32px',
                  boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
                  border: '1px solid rgba(226, 230, 243, 0.8)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#A0A5BD', letterSpacing: '2px' }}>
                    FINAL NEURAL VERDICT
                  </div>
                  <h1 style={{
                    fontSize: '68px',
                    fontWeight: '900',
                    color: label === 'FAKE' ? '#FF4772' : '#10B981',
                    margin: '8px 0',
                    lineHeight: 1
                  }}>
                    {label}
                  </h1>
                  <div style={{ width: '40px', height: '3px', backgroundColor: label === 'FAKE' ? '#FF4772' : '#10B981', borderRadius: '2px', margin: '10px 0' }} />

                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#8E93B0' }}>MANIPULATION PROBABILITY</div>
                  <div style={{ fontSize: '38px', fontWeight: '900', color: '#1D2138', marginTop: '2px' }}>
                    {displayProb}
                  </div>
                </div>

                {/* Sub-metrics Card */}
                <div style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '24px',
                  padding: '24px',
                  boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
                  border: '1px solid rgba(226, 230, 243, 0.8)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#A0A5BD', letterSpacing: '1.5px' }}>
                    DETAILED FACIAL METRICS
                  </div>

                  {/* Brightness */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                      <span style={{ color: '#8E93B0' }}>Face Brightness</span>
                      <span style={{ color: brightnessColor }}>{Number(face_brightness).toFixed(1)}%</span>
                    </div>
                    <div style={{ width: '100%', height: '5px', backgroundColor: '#EFF1F7', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(face_brightness, 100)}%`, height: '100%', backgroundColor: brightnessColor }} />
                    </div>
                  </div>

                  {/* Face Ratio */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                      <span style={{ color: '#8E93B0' }}>Face Area Ratio</span>
                      <span style={{ color: ratioColor }}>{Number(face_ratio).toFixed(1)}%</span>
                    </div>
                    <div style={{ width: '100%', height: '5px', backgroundColor: '#EFF1F7', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(face_ratio, 100)}%`, height: '100%', backgroundColor: ratioColor }} />
                    </div>
                  </div>

                  {/* Confidence */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                      <span style={{ color: '#8E93B0' }}>Model Confidence</span>
                      <span style={{ color: '#5854EE' }}>{Number(face_conf).toFixed(1)}%</span>
                    </div>
                    <div style={{ width: '100%', height: '5px', backgroundColor: '#EFF1F7', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${face_conf}%`, height: '100%', backgroundColor: '#5854EE' }} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AnalysisDetailPage;