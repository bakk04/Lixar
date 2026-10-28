import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ScanModal from '../components/ScanModal';
import axios from 'axios';

const StatisticsPage = ({ sessionUser, onLogout }) => {
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanModalMode, setScanModalMode] = useState('image');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState(false);

  // Real stats from API
  const [systemStats, setSystemStats] = useState({
    totalScans: 0,
    fakeCount: 0,
    realCount: 0,
    fakeRate: 0.0,
    modelInfo: {
      name: 'MS-EffGCViT-B0',
      parameters: '8.70M',
      gflops: '0.85 GFLOPs',
      resolution: '224x224',
      precisionFF: 94.8,
      recallFF: 93.2,
      f1FF: 94.0,
      aucCelebDF: 99.7,
      accCelebDF: 98.4,
      device: 'MPS / CUDA'
    }
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get('/image/stats');
        if (res.data?.status === 'success') {
          setSystemStats({
            totalScans: res.data.total_scans,
            imageScans: res.data.image_scans || 0,
            videoScans: res.data.video_scans || 0,
            fakeCount: res.data.fake_count,
            realCount: res.data.real_count,
            fakeRate: res.data.fake_rate,
            avgFaceConf: res.data.avg_face_conf,
            avgScore: res.data.avg_score,
            modelInfo: {
              ...res.data.model_info,
              precisionFF: res.data.model_info?.precision_ff || 94.8,
              recallFF: res.data.model_info?.recall_ff || 93.2,
              f1FF: res.data.model_info?.f1_ff || 94.0,
              aucCelebDF: res.data.model_info?.auc_celeb_df || 99.7,
              accCelebDF: res.data.model_info?.acc_celeb_df || 98.4,
              device: res.data.model_info?.device || 'PyTorch Core'
            }
          });
        }
      } catch (e) {
        console.warn("Could not load stats in StatisticsPage:", e);
      }
    };
    fetchStats();
    const handleScanCompleted = () => {
      fetchStats();
    };
    window.addEventListener('lixar:scan_completed', handleScanCompleted);
    return () => window.removeEventListener('lixar:scan_completed', handleScanCompleted);
  }, []);

  // Generate Bilateral Stream data points based on actual recent scans
  const barCount = 46;
  const recentScansList = systemStats.recent_scans || [];
  const streamData = recentScansList.length > 0
    ? Array.from({ length: barCount }).map((_, i) => {
        const scan = recentScansList[i % recentScansList.length];
        if (!scan) return { upper: 0, lower: 0 };
        const score = scan.score >= 0 ? scan.score : 0.5;
        const isFake = scan.label === 'FAKE';
        return {
          upper: isFake ? Math.max(12, Math.min(85, score * 85)) : 0,
          lower: !isFake ? Math.max(10, Math.min(65, (1 - score) * 65)) : 0
        };
      })
    : [];

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
        display: 'flex',
        flexDirection: 'column',
        gap: '22px',
        boxSizing: 'border-box'
      }}>
        {/* Top Expansive Card: Detection dynamic & Bilateral Wave Chart */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '26px',
          padding: '28px 36px',
          boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
          border: '1px solid rgba(226, 230, 243, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          {/* Header Bar: Title and Action Buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px'
          }}>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: '34px',
                fontWeight: '800',
                color: '#1D2138',
                letterSpacing: '-0.5px'
              }}>
                Detection dynamic
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#8E93B0' }}>
                Bilateral activity wave: Upper stream (Deepfake flags) vs Lower stream (Authentic media)
              </p>
            </div>

            <div style={{ display: 'flex', gap: '14px' }}>
              <button
                onClick={() => setFilterActive(!filterActive)}
                style={{
                  padding: '9px 24px',
                  backgroundColor: filterActive ? '#EFF1F7' : '#FFFFFF',
                  color: '#5854EE',
                  border: '1.5px solid #5854EE',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {filterActive ? 'Filter: Active' : 'Filter'}
              </button>

              <button
                onClick={() => { setScanModalMode('image'); setScanModalOpen(true); }}
                style={{
                  padding: '9px 24px',
                  backgroundColor: '#5854EE',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(88, 84, 238, 0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4743DE'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#5854EE'}
              >
                Scan Media
              </button>
            </div>
          </div>

          {/* Central Bilateral Mirrored Stream Chart */}
          <div style={{
            display: 'flex',
            height: '320px',
            position: 'relative',
            marginTop: '10px'
          }}>
            {/* Coordinate Y-Axis on Left */}
            <div style={{
              width: '60px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              fontSize: '10px',
              fontWeight: '700',
              color: '#A0A5BD',
              paddingBottom: '20px'
            }}>
              <span>100%</span>
              <span>80%</span>
              <span>60%</span>
              <span>40%</span>
              <span>20%</span>
              <span>0%</span>
            </div>

            {/* Grid & Bilateral Bars Canvas */}
            <div style={{
              flex: 1,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              borderLeft: '1px solid #EFF1F7',
              borderBottom: '1px solid #EFF1F7'
            }}>
              {/* Horizontal Grid lines */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ width: '100%', height: '1px', backgroundColor: '#F0F2F9' }} />
                ))}
              </div>

              {/* Vertical subtle column guides */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-around', pointerEvents: 'none' }}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} style={{ height: '100%', width: '1px', backgroundColor: '#F4F5FB' }} />
                ))}
              </div>

              {/* Zero Baseline */}
              <div style={{
                position: 'absolute',
                top: '56%',
                left: 0,
                right: 0,
                height: '1px',
                backgroundColor: '#EFF1F7',
                zIndex: 1
              }} />

              {/* Bilateral Bars */}
              <div style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                boxSizing: 'border-box',
                zIndex: 5
              }}>
                {streamData.length > 0 ? (
                  streamData.map((bar, idx) => (
                    <div
                      key={idx}
                      style={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        position: 'relative',
                        width: '10px'
                      }}
                    >
                      {/* Upper Wave Bar: Pink/Coral Capsule extending upwards */}
                      {bar.upper > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '44%',
                            width: '7.5px',
                            height: `${bar.upper * 1.5}px`,
                            background: 'linear-gradient(180deg, #F8C5D8 0%, #FF4772 100%)',
                            borderRadius: '6px 6px 0 0',
                            boxShadow: '0 2px 6px rgba(255, 71, 114, 0.25)'
                          }}
                        />
                      )}

                      {/* Lower Wave Bar: Indigo/Blue Capsule extending downwards */}
                      {bar.lower > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '56%',
                            width: '7.5px',
                            height: `${bar.lower * 1.3}px`,
                            background: 'linear-gradient(180deg, #5854EE 0%, #B8B5FD 100%)',
                            borderRadius: '0 0 6px 6px',
                            boxShadow: '0 2px 6px rgba(88, 84, 238, 0.25)'
                          }}
                        />
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#8E93B0',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}>
                    Awaiting scan activity to populate bilateral forensic spectrum
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row: 4 Genuine Research & Model Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: '20px' }}>
          {/* Card 1: Benchmark Summary Table */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            padding: '22px 24px',
            boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
            border: '1px solid rgba(226, 230, 243, 0.8)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '800', color: '#1D2138' }}>
              Offline Evaluation Summary
            </h3>

            {/* Table Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '90px 70px 60px 65px 45px 45px',
              fontSize: '9px',
              fontWeight: '800',
              color: '#A0A5BD',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              marginBottom: '10px'
            }}>
              <span>Benchmark</span>
              <span>Accuracy</span>
              <span>AUC</span>
              <span>Status</span>
              <span>Split</span>
              <span style={{ textAlign: 'right' }}>SOTA</span>
            </div>

            {/* Table Rows grounded in research documentation */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { name: 'Celeb-DF(v2)', dot: '#FF4772', acc: '98.4%', auc: '99.7%', dashes: ['#FF4772', '#FF4772', '#FF4772', '#FF4772'], split: 'Test', dyn: 'SOTA' },
                { name: 'FaceForensics++', dot: '#5854EE', acc: '98.1%', auc: '99.7%', dashes: ['#5854EE', '#5854EE', '#5854EE', '#D7DAEA'], split: 'c23', dyn: 'SOTA' },
                { name: 'KoDF Asian', dot: '#36B8FF', acc: '96.6%', auc: '97.9%', dashes: ['#36B8FF', '#36B8FF', '#D7DAEA', '#D7DAEA'], split: 'Test', dyn: 'Top' },
                { name: 'Model Params', dot: '#10B981', acc: '8.70M', auc: '0.85G', dashes: ['#10B981', '#10B981', '#10B981', '#10B981'], split: '224x', dyn: 'Live' },
              ].map((row, i) => (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '90px 70px 60px 65px 45px 45px',
                  alignItems: 'center',
                  fontSize: '11px',
                  color: '#1D2138',
                  fontWeight: '600'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: row.dot }} />
                    <span style={{ fontSize: '11px', fontWeight: '700' }}>{row.name}</span>
                  </div>
                  <span style={{ color: '#1D2138', fontSize: '11px', fontWeight: '800' }}>{row.acc}</span>
                  <span style={{ color: '#8E93B0', fontSize: '10px' }}>{row.auc}</span>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {row.dashes.map((c, idx) => (
                      <span key={idx} style={{ width: '8px', height: '3px', borderRadius: '1px', backgroundColor: c }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '10px', color: '#8E93B0' }}>{row.split}</span>
                  <span style={{ color: '#10B981', fontWeight: '800', fontSize: '10px', textAlign: 'right' }}>{row.dyn}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: Total Verified Pipeline */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            padding: '22px 20px',
            boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
            border: '1px solid rgba(226, 230, 243, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '600' }}>Total Processed Scans</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{ fontSize: '20px', fontWeight: '900', color: '#1D2138' }}>{systemStats.totalScans}</span>
                <span style={{ fontSize: '10px', color: '#10B981', fontWeight: '800' }}>▲ Active</span>
              </div>
              <div style={{ fontSize: '10px', color: '#A0A5BD', marginTop: '2px' }}>
                Real-time SQLite/MySQL persistence
              </div>
            </div>

            <div style={{ borderTop: '1px solid #EFF1F7', paddingTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: '700', color: '#8E93B0', marginBottom: '8px' }}>
                <span>Multi-scale Feature Fusion</span>
                <span style={{ color: '#1D2138' }}>{systemStats.totalScans > 0 ? `${systemStats.fakeRate.toFixed(0)}%` : '0%'}</span>
              </div>
              <div style={{ width: '100%', height: '5px', backgroundColor: '#EFF1F7', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${systemStats.totalScans > 0 ? systemStats.fakeRate : 0}%`, height: '100%', backgroundColor: '#FF4772', borderRadius: '3px' }} />
              </div>
            </div>
          </div>

          {/* Card 3: Model Accuracy Donut (98.4%) */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            padding: '22px 20px',
            boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
            border: '1px solid rgba(226, 230, 243, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ position: 'relative', width: '54px', height: '54px' }}>
                <svg width="54" height="54" viewBox="0 0 54 54">
                  <circle cx="27" cy="27" r="21" fill="none" stroke="#EFF1F7" strokeWidth="5" />
                  <circle
                    cx="27" cy="27" r="21" fill="none" stroke="url(#foundationsGrad)" strokeWidth="5"
                    strokeDasharray="132" strokeDashoffset="12" strokeLinecap="round"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                  />
                  <defs>
                    <linearGradient id="foundationsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FF9B38" />
                      <stop offset="100%" stopColor="#544FF0" />
                    </linearGradient>
                  </defs>
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: '900', color: '#1D2138' }}>98<span style={{ fontSize: '9px' }}>%</span></span>
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '700' }}>Celeb-DF(v2) SOTA</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <span style={{ fontSize: '18px', fontWeight: '900', color: '#1D2138' }}>98.4%</span>
                <span style={{ fontSize: '10px', color: '#10B981', fontWeight: '800' }}>Acc</span>
              </div>
              <div style={{ fontSize: '9px', color: '#A0A5BD', marginTop: '2px' }}>
                99.7% Area Under Curve (AUC)
              </div>
            </div>
          </div>

          {/* Card 4: Equalizer & Computational Footprint */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            padding: '22px 20px',
            boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
            border: '1px solid rgba(226, 230, 243, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '600' }}>Inference Efficiency</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <span style={{ fontSize: '18px', fontWeight: '900', color: '#1D2138' }}>0.85 GFLOPs</span>
                <span style={{ fontSize: '10px', color: '#10B981', fontWeight: '800' }}>Fast</span>
              </div>
              <div style={{ fontSize: '9px', color: '#A0A5BD', marginTop: '2px' }}>
                8.70M Parameters · Edge Ready
              </div>
            </div>

            {/* Equalizer Frequency Bars representing Multi-Scale Attention */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '46px', paddingTop: '10px' }}>
              {Array.from({ length: 10 }).map((_, idx) => {
                const s = recentScansList[idx];
                const topH = s && s.score >= 0 ? Math.max(4, Math.min(28, Math.round(s.score * 28))) : 2;
                const botH = s && s.score >= 0 ? Math.max(4, Math.min(22, Math.round((1 - s.score) * 22))) : 2;
                const topBg = s ? '#FF4772' : '#E2E6F3';
                const botBg = s ? '#5854EE' : '#E2E6F3';
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <div style={{ width: '4px', height: `${topH}px`, backgroundColor: topBg, borderRadius: '2px' }} />
                    <div style={{ width: '4px', height: `${botH}px`, backgroundColor: botBg, borderRadius: '2px' }} />
                  </div>
                );
              })}
            </div>
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

export default StatisticsPage;
