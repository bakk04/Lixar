import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ScanModal from '../components/ScanModal';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const DashboardPage = ({ sessionUser, onLogout }) => {
  const navigate = useNavigate();
  const [activeTimeline, setActiveTimeline] = useState('3M');
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanModalMode, setScanModalMode] = useState('image');
  const [searchTerm, setSearchTerm] = useState('');
  const [recentScans, setRecentScans] = useState([]);

  // Real system statistics from backend API
  const [systemStats, setSystemStats] = useState({
    totalScans: 0,
    imageScans: 0,
    videoScans: 0,
    fakeCount: 0,
    realCount: 0,
    fakeRate: 0.0,
    avgFaceConf: 0.0,
    avgScore: 0.0,
    modelInfo: {
      name: 'MS-EffGCViT-B0',
      parameters: '8.70M',
      gflops: '0.85 GFLOPs',
      precisionFF: 94.8,
      recallFF: 93.2,
      f1FF: 94.0,
      aucCelebDF: 99.7,
      accCelebDF: 98.4,
      device: 'MPS / CUDA'
    }
  });

  const fetchAllData = async () => {
    try {
      const [statsRes, imgRes, vidRes] = await Promise.allSettled([
        axios.get('/image/stats'),
        axios.get('/image/history'),
        axios.get('/video/history')
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value.data?.status === 'success') {
        const d = statsRes.value.data;
        setSystemStats({
          totalScans: d.total_scans || 0,
          imageScans: d.image_scans || 0,
          videoScans: d.video_scans || 0,
          fakeCount: d.fake_count || 0,
          realCount: d.real_count || 0,
          fakeRate: d.fake_rate || 0.0,
          avgFaceConf: d.avg_face_conf || 0.0,
          avgScore: d.avg_score || 0.0,
          modelInfo: {
            ...d.model_info,
            precisionFF: d.model_info?.precision_ff || 94.8,
            recallFF: d.model_info?.recall_ff || 93.2,
            f1FF: d.model_info?.f1_ff || 94.0,
            aucCelebDF: d.model_info?.auc_celeb_df || 99.7,
            accCelebDF: d.model_info?.acc_celeb_df || 98.4,
            device: d.model_info?.device || 'PyTorch Core'
          }
        });
      }

      let combined = [];
      if (imgRes.status === 'fulfilled' && imgRes.value.data?.context) {
        combined = [...combined, ...imgRes.value.data.context.map(i => ({ ...i, mediaType: 'image' }))];
      }
      if (vidRes.status === 'fulfilled' && vidRes.value.data?.context) {
        combined = [...combined, ...vidRes.value.data.context.map(v => ({ ...v, mediaType: 'video' }))];
      }

      if (combined.length > 0) {
        combined.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        setRecentScans(combined.slice(0, 8));
      } else if (statsRes.status === 'fulfilled' && statsRes.value.data?.recent_scans?.length > 0) {
        setRecentScans(statsRes.value.data.recent_scans.slice(0, 8).map(s => ({
          ...s,
          mediaType: s.media_type ? s.media_type.toLowerCase() : 'image'
        })));
      }
    } catch (e) {
      console.warn("Could not load dashboard data:", e);
    }
  };

  useEffect(() => {
    fetchAllData();
    const handleScanCompleted = () => {
      fetchAllData();
    };
    window.addEventListener('lixar:scan_completed', handleScanCompleted);
    return () => window.removeEventListener('lixar:scan_completed', handleScanCompleted);
  }, []);

  const rankingData = recentScans.map((s, idx) => {
    const isVideo = s.mediaType === 'video' || s.media_type === 'VIDEO';
    const isFake = s.label === 'FAKE';
    const scoreVal = s.score !== undefined && s.score !== null && s.score >= 0 
      ? `${(s.score * 100).toFixed(0)}%` 
      : (s.label ? s.label : 'N/A');

    const cleanTitle = s.version_type 
      ? `${isVideo ? 'VID' : 'IMG'} · ${s.version_type.toUpperCase()} · ${s.domain_type || '서양인'}`
      : (isVideo ? `VID #${s.id || idx + 1}` : `IMG #${s.id || idx + 1}`);

    const dateStr = s.created_at ? s.created_at.slice(5, 10) : 'Today';

    return {
      title: cleanTitle,
      val1: scoreVal,
      val2: dateStr,
      isUp: !isFake,
      rawItem: s
    };
  });

  // Arc calculation for orange accent ring
  const orangeArcOffset = systemStats.totalScans > 0
    ? 804 * (1 - Math.min(1, Math.max(0.08, systemStats.realCount / systemStats.totalScans)))
    : 804;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F4F5FB',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      <Header
        sessionUser={sessionUser}
        onLogout={onLogout}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onOpenScanModal={() => { setScanModalMode('image'); setScanModalOpen(true); }}
      />

      <main style={{
        flex: 1,
        padding: '10px 44px 30px',
        maxWidth: '1600px',
        width: '100%',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '290px 1fr 290px',
        gap: '24px',
        boxSizing: 'border-box',
        alignItems: 'stretch'
      }}>
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card 1: Equalizer Sparkline + Category List */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            padding: '22px',
            boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
            border: '1px solid rgba(226, 230, 243, 0.8)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '600' }}>Total Analyses</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span style={{ fontSize: '18px', fontWeight: '900', color: '#1D2138' }}>{systemStats.totalScans} Scans</span>
              <span style={{ fontSize: '10px', color: '#10B981', fontWeight: '800' }}>▲ Live</span>
            </div>
            <div style={{ fontSize: '9px', color: '#A0A5BD', marginTop: '2px', marginBottom: '16px' }}>
              {systemStats.imageScans} Images · {systemStats.videoScans} Videos verified
            </div>

            {/* Dual-ended Equalizer Sparkline (Pink top, Blue bottom) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: '56px',
              padding: '0 4px',
              marginBottom: '16px',
              borderBottom: '1px solid #EFF1F7',
              paddingBottom: '16px'
            }}>
              {Array.from({ length: 12 }).map((_, idx) => {
                const s = recentScans[idx];
                const topH = s && s.score !== null && s.score !== undefined ? Math.max(4, Math.min(32, Math.round(s.score * 32))) : 2;
                const botH = s && s.score !== null && s.score !== undefined ? Math.max(4, Math.min(32, Math.round((1 - s.score) * 28))) : 2;
                const topBg = s ? '#FF6584' : '#E2E6F3';
                const botBg = s ? '#6C63FF' : '#E2E6F3';
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <div style={{ width: '4px', height: `${topH}px`, backgroundColor: topBg, borderRadius: '2px' }} />
                    <div style={{ width: '4px', height: `${botH}px`, backgroundColor: botBg, borderRadius: '2px' }} />
                  </div>
                );
              })}
            </div>

            {/* Category breakdown table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {[
                { name: 'FF++ Benchmark', color: '#10B981', val1: '99.7%', val2: 'c23 SOTA' },
                { name: 'Celeb-DF V2', color: '#FF9B38', val1: '98.4%', val2: '99.7% AUC' },
                { name: 'Image Inferences', color: '#7E7BF8', val1: `${systemStats.imageScans}`, val2: 'Images' },
                { name: 'Video Inferences', color: '#36B8FF', val1: `${systemStats.videoScans}`, val2: 'Videos' },
                { name: 'Flagged Fakes', color: '#FF4772', val1: `${systemStats.fakeCount}`, val2: 'FLAGGED' },
                { name: 'Verified Real', color: '#10B981', val1: `${systemStats.realCount}`, val2: 'AUTHENTIC' },
                { name: 'Face Extraction', color: '#00D2D3', val1: systemStats.avgFaceConf > 0 ? `${systemStats.avgFaceConf.toFixed(0)}%` : '—', val2: 'YOLOv8' },
                { name: 'MS-EffGCViT Core', color: '#544FF0', val1: '8.70M', val2: '0.85G' },
                { name: 'Runtime Device', color: '#8E93B0', val1: 'PyTorch', val2: 'Online' }
              ].map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: c.color }} />
                    <span style={{ color: '#1D2138', fontWeight: '600' }}>{c.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '14px', color: '#8E93B0', fontWeight: '600' }}>
                    <span style={{ width: '38px', textAlign: 'right' }}>{c.val1}</span>
                    <span style={{ width: '52px', textAlign: 'right', color: '#1D2138', fontWeight: '700' }}>{c.val2}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: 3-Row Metric Card */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            padding: '22px',
            boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
            border: '1px solid rgba(226, 230, 243, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div>
              <div style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '600' }}>Total Inferences</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <span style={{ fontSize: '17px', fontWeight: '900', color: '#1D2138' }}>{systemStats.totalScans}</span>
                <span style={{ fontSize: '10px', color: '#10B981', fontWeight: '800' }}>▲ Active</span>
              </div>
              <div style={{ fontSize: '9px', color: '#A0A5BD', marginTop: '2px' }}>Persisted across all sessions</div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '600' }}>Verified Authentic</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <span style={{ fontSize: '17px', fontWeight: '900', color: '#1D2138' }}>{systemStats.realCount}</span>
                <span style={{ fontSize: '10px', color: '#10B981', fontWeight: '800' }}>
                  {systemStats.totalScans > 0 ? (100 - systemStats.fakeRate).toFixed(0) : 0}%
                </span>
              </div>
              <div style={{ fontSize: '9px', color: '#A0A5BD', marginTop: '2px' }}>Original genuine content</div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '600' }}>Flagged Deepfakes</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <span style={{ fontSize: '17px', fontWeight: '900', color: '#1D2138' }}>{systemStats.fakeCount}</span>
                <span style={{ fontSize: '10px', color: '#FF4772', fontWeight: '800' }}>
                  {systemStats.totalScans > 0 ? systemStats.fakeRate.toFixed(0) : 0}%
                </span>
              </div>
              <div style={{ fontSize: '9px', color: '#A0A5BD', marginTop: '2px' }}>Manipulated facial synthesis</div>
            </div>
          </div>
        </div>

        {/* CENTER GIANT CARD: Concentric Radial Dial & Global Statistics */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '26px',
          padding: '24px 30px',
          boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
          border: '1px solid rgba(226, 230, 243, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {['1W', '1M', '3M', '1Y', 'ALL'].map((time) => {
                const isActive = activeTimeline === time;
                return (
                  <span
                    key={time}
                    onClick={() => setActiveTimeline(time)}
                    style={{
                      fontSize: '11px',
                      fontWeight: isActive ? '800' : '600',
                      color: isActive ? '#FFFFFF' : '#8E93B0',
                      backgroundColor: isActive ? '#1D2138' : 'transparent',
                      padding: isActive ? '4px 14px' : '4px 8px',
                      borderRadius: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {time}
                  </span>
                );
              })}
            </div>

            <h1 style={{
              margin: '8px 0 0',
              fontSize: '38px',
              fontWeight: '800',
              color: '#1D2138',
              letterSpacing: '-0.5px'
            }}>
              Global Statistics
            </h1>
          </div>

          {/* Central Radial Dial System */}
          <div style={{ position: 'relative', width: '380px', height: '380px', margin: '10px auto' }}>
            <svg width="380" height="380" viewBox="0 0 380 380">
              <defs>
                <linearGradient id="purpleRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7E7BF8" />
                  <stop offset="100%" stopColor="#544FF0" />
                </linearGradient>
                <linearGradient id="orangeRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFB800" />
                  <stop offset="100%" stopColor="#FF9B38" />
                </linearGradient>
              </defs>

              {/* Outer Radial Segmented Ticks Ring */}
              {Array.from({ length: 90 }).map((_, i) => {
                const angle = (i * 4 * Math.PI) / 180;
                const r1 = 158;
                const r2 = i % 5 === 0 ? 170 : 165;
                const x1 = 190 + r1 * Math.cos(angle);
                const y1 = 190 + r1 * Math.sin(angle);
                const x2 = 190 + r2 * Math.cos(angle);
                const y2 = 190 + r2 * Math.sin(angle);
                return (
                  <line
                    key={i}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="#DDE0EE"
                    strokeWidth={i % 5 === 0 ? 1.5 : 1}
                  />
                );
              })}

              {/* Light background circle track */}
              <circle cx="190" cy="190" r="128" fill="none" stroke="#EFF1F7" strokeWidth="8" />

              {/* Orange outer accent arc */}
              <circle
                cx="190" cy="190" r="128" fill="none"
                stroke="url(#orangeRingGrad)" strokeWidth="6"
                strokeDasharray="804"
                strokeDashoffset={orangeArcOffset}
                strokeLinecap="round"
                style={{ transform: 'rotate(-45deg)', transformOrigin: '190px 190px', transition: 'stroke-dashoffset 0.8s ease' }}
              />

              {/* Inner Purple Circular Dial */}
              <circle
                cx="190" cy="190" r="92"
                fill="url(#purpleRingGrad)"
                filter="drop-shadow(0 14px 30px rgba(84, 79, 240, 0.4))"
              />
              <circle cx="190" cy="190" r="102" fill="none" stroke="rgba(84, 79, 240, 0.15)" strokeWidth="8" />
            </svg>

            {/* Inner Center Text on Purple Dial */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: '#FFFFFF',
              zIndex: 10
            }}>
              <div style={{ fontSize: '20px', marginBottom: '2px' }}>👑</div>
              <div style={{ fontSize: '9px', fontWeight: '800', letterSpacing: '1px', opacity: 0.9 }}>
                LIXAR DYNAMICS
              </div>
              <div style={{ fontSize: '46px', fontWeight: '900', lineHeight: 1 }}>
                {systemStats.totalScans > 0 ? (100 - systemStats.fakeRate).toFixed(0) : "0"}<span style={{ fontSize: '24px', fontWeight: '700' }}>%</span>
              </div>
            </div>

            {/* Satellite Badge 1: PLAN 67% (Orange Circle) */}
            <div style={{
              position: 'absolute',
              top: '52px',
              right: '84px',
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              border: '2px solid #FF9B38',
              boxShadow: '0 6px 18px rgba(255, 155, 56, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20
            }}>
              <span style={{ fontSize: '8px', fontWeight: '800', color: '#8E93B0' }}>REAL</span>
              <span style={{ fontSize: '13px', fontWeight: '900', color: '#1D2138' }}>
                {systemStats.totalScans > 0 ? Math.round((systemStats.realCount / systemStats.totalScans) * 100) : 0}%
              </span>
            </div>

            {/* Satellite Badge 2: MONTH 54% (Purple Circle with sparkline) */}
            <div style={{
              position: 'absolute',
              top: '110px',
              right: '28px',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 6px 18px rgba(66, 71, 112, 0.15)',
              border: '1px solid #EFF1F7',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20
            }}>
              <span style={{ fontSize: '7px', fontWeight: '800', color: '#8E93B0' }}>FAKE</span>
              <span style={{ fontSize: '11px', fontWeight: '900', color: '#5854EE' }}>
                {systemStats.totalScans > 0 ? Math.round((systemStats.fakeCount / systemStats.totalScans) * 100) : 0}%
              </span>
            </div>

            {/* Metric Node: Left - Views (Total Scans) */}
            <div style={{
              position: 'absolute',
              left: '12px',
              top: '170px',
              textAlign: 'center',
              zIndex: 10
            }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'rgba(54, 184, 255, 0.1)',
                color: '#36B8FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 4px'
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/></svg>
              </div>
              <div style={{ fontSize: '9px', color: '#A0A5BD', fontWeight: '700' }}>Total Scans</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#1D2138' }}>{systemStats.totalScans}</div>
            </div>

            {/* Metric Node: Right - Sales (Authentic) */}
            <div style={{
              position: 'absolute',
              right: '12px',
              top: '170px',
              textAlign: 'center',
              zIndex: 10
            }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'rgba(88, 84, 238, 0.1)',
                color: '#5854EE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 4px'
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              </div>
              <div style={{ fontSize: '9px', color: '#A0A5BD', fontWeight: '700' }}>Authentic</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#1D2138' }}>{systemStats.realCount}</div>
            </div>

            {/* Metric Node: Bottom - Profitability (Face Conf) */}
            <div style={{
              position: 'absolute',
              bottom: '4px',
              left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              zIndex: 10
            }}>
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: 'rgba(54, 184, 255, 0.1)',
                color: '#36B8FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 3px'
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/></svg>
              </div>
              <div style={{ fontSize: '9px', color: '#A0A5BD', fontWeight: '700' }}>Face Conf</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#1D2138' }}>
                {systemStats.avgFaceConf > 0 ? `${systemStats.avgFaceConf.toFixed(0)}%` : '—'}
              </div>
            </div>
          </div>

          {/* Bottom KPI Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #EFF1F7',
            paddingTop: '16px',
            paddingLeft: '10px',
            paddingRight: '10px'
          }}>
            {/* Image Scans */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'rgba(88, 84, 238, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5854EE' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/></svg>
              </div>
              <div>
                <div style={{ fontSize: '9px', color: '#8E93B0', fontWeight: '700' }}>Image Scans</div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#1D2138' }}>{systemStats.imageScans}</div>
              </div>
              <span style={{ fontSize: '9px', color: '#8E93B0', fontWeight: '700', marginLeft: '6px' }}>JPG/PNG</span>
            </div>

            {/* Video Scans */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'rgba(54, 184, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#36B8FF' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              </div>
              <div>
                <div style={{ fontSize: '9px', color: '#8E93B0', fontWeight: '700' }}>Video Scans</div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#1D2138' }}>{systemStats.videoScans}</div>
              </div>
              <div style={{ display: 'flex', gap: '2px', marginLeft: '4px' }}>
                <span style={{ width: '6px', height: '3px', borderRadius: '1px', backgroundColor: '#FF4772' }} />
                <span style={{ width: '10px', height: '3px', borderRadius: '1px', backgroundColor: '#5854EE' }} />
              </div>
            </div>

            {/* Server */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'rgba(88, 84, 238, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5854EE' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/></svg>
              </div>
              <div>
                <div style={{ fontSize: '9px', color: '#8E93B0', fontWeight: '700' }}>Active Engine</div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#1D2138' }}>MS-EffGCViT</div>
              </div>
              <div style={{ display: 'flex', gap: '2px', marginLeft: '4px' }}>
                <span style={{ width: '4px', height: '3px', borderRadius: '1px', backgroundColor: '#10B981' }} />
                <span style={{ width: '4px', height: '3px', borderRadius: '1px', backgroundColor: '#10B981' }} />
                <span style={{ width: '8px', height: '3px', borderRadius: '1px', backgroundColor: '#5854EE' }} />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card 1: Matrix / Grid Heatmap */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            padding: '22px',
            boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
            border: '1px solid rgba(226, 230, 243, 0.8)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '600' }}>Detection Density</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <span style={{ fontSize: '18px', fontWeight: '900', color: '#1D2138' }}>{systemStats.totalScans} Verified</span>
              <span style={{ fontSize: '10px', color: '#10B981', fontWeight: '800' }}>▲ SOTA</span>
            </div>
            <div style={{ fontSize: '9px', color: '#A0A5BD', marginTop: '2px', marginBottom: '14px' }}>
              {systemStats.fakeCount} Manipulated · {systemStats.realCount} Authentic
            </div>

            {/* Matrix Grid Visualization */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '9px', color: '#A0A5BD', fontWeight: '700' }}>
                <span>1500</span>
                <span>1000</span>
                <span>500</span>
                <span>100</span>
              </div>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                {Array.from({ length: 65 }).map((_, i) => {
                  let bg = '#E4E6F5';
                  if (systemStats.totalScans > 0) {
                    const fakeBlocks = Math.round((systemStats.fakeCount / systemStats.totalScans) * 65);
                    const realBlocks = Math.round((systemStats.realCount / systemStats.totalScans) * 65);
                    if (i < fakeBlocks) {
                      bg = '#FF4772';
                    } else if (i < fakeBlocks + realBlocks) {
                      bg = '#6C63FF';
                    }
                  }
                  return (
                    <div
                      key={i}
                      style={{
                        height: '7px',
                        backgroundColor: bg,
                        borderRadius: '2px'
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card 2: Solid Purple Dual-Donut Card */}
          <div style={{
            background: 'linear-gradient(135deg, #6C66FA 0%, #544FF0 100%)',
            borderRadius: '24px',
            padding: '20px',
            color: '#FFFFFF',
            boxShadow: '0 12px 30px rgba(84, 79, 240, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            {/* Donut Row 1 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ position: 'relative', width: '42px', height: '42px' }}>
                <svg width="42" height="42" viewBox="0 0 42 42">
                  <circle cx="21" cy="21" r="16" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
                  <circle
                    cx="21" cy="21" r="16" fill="none" stroke="#FFD200" strokeWidth="4"
                    strokeDasharray="100" strokeDashoffset={`${100 - (systemStats.modelInfo?.accCelebDF || 98)}`} strokeLinecap="round"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800' }}>
                  {systemStats.modelInfo?.accCelebDF ? Math.round(systemStats.modelInfo.accCelebDF) : 98}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', opacity: 0.85 }}>Model Accuracy</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '15px', fontWeight: '900' }}>
                  {systemStats.modelInfo?.accCelebDF || 98.4}% <span style={{ fontSize: '9px', opacity: 0.8 }}>▲ SOTA</span>
                </div>
              </div>
            </div>

            {/* Donut Row 2 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ position: 'relative', width: '42px', height: '42px' }}>
                <svg width="42" height="42" viewBox="0 0 42 42">
                  <circle cx="21" cy="21" r="16" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
                  <circle
                    cx="21" cy="21" r="16" fill="none" stroke="#FF6584" strokeWidth="4"
                    strokeDasharray="100" strokeDashoffset={`${100 - (systemStats.modelInfo?.aucCelebDF || 99.7)}`} strokeLinecap="round"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800' }}>
                  {systemStats.modelInfo?.aucCelebDF ? Math.round(systemStats.modelInfo.aucCelebDF) : 99}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', opacity: 0.85 }}>SOTA AUC Score</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '15px', fontWeight: '900' }}>
                  {systemStats.modelInfo?.aucCelebDF || 99.7}% <span style={{ fontSize: '9px', opacity: 0.8, color: '#FFA0B5' }}>FF++ c23</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Ranking Table List */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            padding: '20px',
            boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
            border: '1px solid rgba(226, 230, 243, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {rankingData.length > 0 ? (
              rankingData.map((row, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    if (row.rawItem) {
                      if (row.rawItem.mediaType === 'video' || row.rawItem.media_type === 'VIDEO') {
                        navigate('/video-timeline', { state: { video_id: row.rawItem.id, ...row.rawItem } });
                      } else {
                        navigate('/analysis-detail', { state: { image_id: row.rawItem.image_id || row.rawItem.id } });
                      }
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    cursor: row.rawItem ? 'pointer' : 'default',
                    padding: '3px 0'
                  }}
                >
                  <span style={{ color: '#1D2138', fontWeight: '600' }}>{row.title}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: '#8E93B0', fontWeight: '600', width: '32px', textAlign: 'right' }}>{row.val1}</span>
                    <span style={{ color: '#1D2138', fontWeight: '800', width: '38px', textAlign: 'right' }}>{row.val2}</span>
                    <span style={{ color: row.isUp ? '#10B981' : '#FF4772', fontSize: '9px', fontWeight: '800', width: '12px', textAlign: 'center' }}>
                      {row.isUp ? '▲' : '▼'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 10px', color: '#8E93B0', fontSize: '11px', fontWeight: '600' }}>
                No scan history recorded yet
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />

      <ScanModal
        isOpen={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        initialMode={scanModalMode}
        sessionUser={sessionUser}
      />
    </div>
  );
};

export default DashboardPage;
