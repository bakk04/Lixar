import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';

const normalizeFrame = (f, i) => {
  const raw = f.score ?? f.fake_score ?? 0;
  const fake_score = raw <= 1 ? raw * 100 : raw;
  const ts = f.frame_time != null
    ? new Date(f.frame_time * 1000).toISOString().substr(14, 5)
    : f.timestamp ?? `00:${String(i * 2).padStart(2, '0')}`;
  return { ...f, fake_score, frame_index: f.frame_index ?? i, timestamp: ts };
};

const VideoTimelinePage = ({ sessionUser, onLogout }) => {
  const { state: data } = useLocation();
  const navigate = useNavigate();
  const [timelineData, setTimelineData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const videoId = data?.video_id || data?.id;
  const mediaLoc = data?.video_loc || '';
  const mediaSrc = mediaLoc.startsWith('blob') ? mediaLoc : mediaLoc;

  const canvasRef = useRef(null);
  const barsRef = useRef(null);
  const barRefs = useRef([]);

  useEffect(() => {
    const fetchTimelineDetails = async () => {
      if (!videoId) { setIsLoading(false); return; }
      try {
        const response = await axios.get(`/inference/video/${videoId}/detail`);
        const d = response.data;
        let frames = [];
        if (d?.frames?.length) frames = d.frames;
        else if (d?.timeline?.length) frames = d.timeline;
        if (frames.length) {
          setTimelineData(frames.map(normalizeFrame));
        } else {
          setTimelineData([]);
        }
      } catch {
        setTimelineData([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTimelineDetails();
  }, [videoId]);

  const fakeCount = timelineData.filter(f => f.fake_score > 50).length;
  const totalCount = timelineData.length;
  const fakeRatio = totalCount ? (fakeCount / totalCount) * 100 : 0;
  const realRatio = 100 - fakeRatio;

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const barsEl = barsRef.current;
    if (!canvas || !barsEl || timelineData.length < 2) return;
    if (barRefs.current.length !== timelineData.length) return;
    if (barRefs.current.some(r => !r)) return;

    const barsRect = barsEl.getBoundingClientRect();
    const W = barsRect.width;
    const H = barsRect.height;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const points = barRefs.current.map((barEl, i) => {
      const barRect = barEl.getBoundingClientRect();
      const x = barRect.left - barsRect.left + barRect.width / 2;
      const y = barRect.top - barsRect.top;
      return { x, y, isFake: timelineData[i].fake_score > 50 };
    });

    const BAR_TOP = 20;
    const BAR_BOTTOM = H - 24;
    const BAR_H = BAR_BOTTOM - BAR_TOP;
    const y50 = BAR_BOTTOM - (50 / 100) * BAR_H;

    // 50% Threshold line
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255, 71, 114, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(points[0].x, y50);
    ctx.lineTo(points[points.length - 1].x, y50);
    ctx.stroke();
    ctx.restore();

    // Connecting line curve
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = 'rgba(88, 84, 238, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();

    // Dots
    points.forEach((pt) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = pt.isFake ? 'rgba(255,71,114,0.2)' : 'rgba(16,185,129,0.2)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = pt.isFake ? '#FF4772' : '#10B981';
      ctx.fill();
    });
  }, [timelineData]);

  useEffect(() => {
    if (isLoading || !timelineData.length) return;
    const t1 = setTimeout(drawCanvas, 100);
    const t2 = setTimeout(drawCanvas, 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [timelineData, isLoading, drawCanvas]);

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
            ← Back to Results
          </button>

          <span style={{ padding: '6px 14px', backgroundColor: '#FFFFFF', borderRadius: '12px', fontSize: '12px', fontWeight: '700', color: '#5854EE', border: '1px solid rgba(88, 84, 238, 0.2)' }}>
            Video Chronological Timeline
          </span>
        </div>

        {/* Top Media & Forgery Ratio Card */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '26px',
          padding: '28px',
          boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
          border: '1px solid rgba(226, 230, 243, 0.8)',
          display: 'flex',
          gap: '32px',
          alignItems: 'center'
        }}>
          <div style={{
            flex: 1.2,
            height: '280px',
            backgroundColor: '#F9FAFD',
            borderRadius: '18px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #EFF1F7'
          }}>
            <video src={mediaSrc} controls style={{ maxWidth: '100%', maxHeight: '100%' }} />
          </div>

          <div style={{ flex: 0.8 }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#A0A5BD', letterSpacing: '1.5px', marginBottom: '20px' }}>
              FORGERY RATIO BREAKDOWN
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
              {/* Donut chart */}
              <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="70" cy="70" r="54" fill="none" stroke="#10B981" strokeWidth="14" opacity="0.9" />
                <circle
                  cx="70" cy="70" r="54" fill="none"
                  stroke="#FF4772" strokeWidth="14"
                  strokeDasharray={`${(fakeRatio / 100) * 2 * Math.PI * 54} ${2 * Math.PI * 54}`}
                  strokeLinecap="butt"
                />
                <text
                  x="70" y="70"
                  textAnchor="middle" dominantBaseline="central"
                  fill="#1D2138" fontSize="24" fontWeight="900"
                  style={{ transform: 'rotate(90deg)', transformOrigin: '70px 70px' }}
                >
                  {fakeRatio.toFixed(0)}%
                </text>
              </svg>

              {/* Legend */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#FF4772' }} />
                  <span style={{ color: '#8E93B0', fontSize: '13px', fontWeight: '700', width: '45px' }}>FAKE</span>
                  <span style={{ color: '#FF4772', fontSize: '18px', fontWeight: '900' }}>{fakeRatio.toFixed(1)}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#10B981' }} />
                  <span style={{ color: '#8E93B0', fontSize: '13px', fontWeight: '700', width: '45px' }}>REAL</span>
                  <span style={{ color: '#10B981', fontSize: '18px', fontWeight: '900' }}>{realRatio.toFixed(1)}%</span>
                </div>
                <div style={{ fontSize: '12px', color: '#A0A5BD', fontWeight: '700', marginTop: '4px' }}>
                  {fakeCount} / {totalCount} FRAMES MANIPULATED
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Bar Chart & Frame Cards */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '26px',
          padding: '30px',
          boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
          border: '1px solid rgba(226, 230, 243, 0.8)'
        }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#A0A5BD', letterSpacing: '1.5px', marginBottom: '22px' }}>
            FRAME-BY-FRAME RISK MATRIX
          </div>

          {isLoading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#8E93B0', fontSize: '14px' }}>
              Calculating frame-level risk metrics...
            </div>
          ) : timelineData.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#8E93B0', fontSize: '14px' }}>
              No facial frames detected in this video file.
            </div>
          ) : (
            <div>
              {/* Chart container */}
              <div style={{
                position: 'relative',
                backgroundColor: '#F9FAFD',
                borderRadius: '16px',
                border: '1px solid #EFF1F7'
              }}>
                <div
                  ref={barsRef}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    height: '180px',
                    padding: '24px 34px',
                    boxSizing: 'border-box'
                  }}
                >
                  {timelineData.map((frame, i) => {
                    const isFakeUnit = frame.fake_score > 50;
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '8px' }}>
                        <div
                          ref={el => barRefs.current[i] = el}
                          style={{
                            width: '28%',
                            height: `${Math.max(frame.fake_score, 6)}%`,
                            backgroundColor: isFakeUnit ? '#FF4772' : '#10B981',
                            borderRadius: '4px 4px 0 0',
                            boxShadow: isFakeUnit ? '0 2px 8px rgba(255, 71, 114, 0.25)' : '0 2px 8px rgba(16, 185, 129, 0.25)'
                          }}
                        />
                        <span style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '700' }}>{frame.timestamp}</span>
                      </div>
                    );
                  })}
                </div>

                <canvas
                  ref={canvasRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none'
                  }}
                />
              </div>

              {/* Quick Heatmap Launchers per Frame */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '14px' }}>
                {timelineData.map((frame, i) => {
                  const isFake = frame.fake_score > 50;
                  return (
                    <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                      <button
                        onClick={() => navigate('/heatmap', {
                          state: {
                            video_id: videoId,
                            frame_index: frame.frame_index,
                            timestamp: frame.timestamp,
                            fake_score: frame.fake_score,
                            model_type: data.model_type || 'fast',
                            video_name: data.video_name,
                          }
                        })}
                        style={{
                          width: '100%',
                          padding: '6px 0',
                          backgroundColor: isFake ? 'rgba(255, 71, 114, 0.08)' : 'rgba(88, 84, 238, 0.08)',
                          color: isFake ? '#FF4772' : '#5854EE',
                          border: `1px solid ${isFake ? 'rgba(255, 71, 114, 0.3)' : 'rgba(88, 84, 238, 0.3)'}`,
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: '800',
                          cursor: 'pointer'
                        }}
                      >
                        CAM
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Frame summary list */}
              <div style={{ marginTop: '26px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {timelineData.map((frame, idx) => {
                  const isFake = frame.fake_score > 50;
                  return (
                    <div key={idx} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px 20px',
                      backgroundColor: '#F9FAFD',
                      borderRadius: '14px',
                      border: '1px solid #EFF1F7'
                    }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#1D2138' }}>TIMESTAMP {frame.timestamp}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontSize: '13px', color: '#8E93B0', fontWeight: '600' }}>
                          Score: <b style={{ color: isFake ? '#FF4772' : '#10B981' }}>{Number(frame.fake_score).toFixed(1)}%</b>
                        </span>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '800',
                          backgroundColor: isFake ? 'rgba(255, 71, 114, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          color: isFake ? '#FF4772' : '#10B981'
                        }}>
                          {isFake ? 'MANIPULATED' : 'VERIFIED'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default VideoTimelinePage;