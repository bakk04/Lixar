import React, { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ScanModal from '../components/ScanModal';

const PipelineAnalyticsPage = ({ sessionUser, onLogout }) => {
  const [activeTimeline, setActiveTimeline] = useState('3M');
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanModalMode, setScanModalMode] = useState('image');
  const [searchTerm, setSearchTerm] = useState('');

  const architectureLayers = [
    { name: 'MBConv Backbone', color: '#10B981', val1: 'B0', val2: '3.65M' },
    { name: 'L-GCViT (Local)', color: '#FF9B38', val1: '24d', val2: '1.65M' },
    { name: 'H-GCViT (Global)', color: '#7E7BF8', val1: '256d', val2: '3.29M' },
    { name: 'Cross Fusion', color: '#36B8FF', val1: '4h', val2: '280d' },
    { name: 'YOLOv8-Face', color: '#FF4772', val1: 'Det', val2: '6.38M' },
    { name: 'Landmark 68-pt', color: '#FFB800', val1: 'Align', val2: '68 pts' },
    { name: 'Resolution', color: '#00D2D3', val1: 'RGB', val2: '224x224' },
    { name: 'Sigmoid Head', color: '#544FF0', val1: '1d', val2: 'Binary' },
    { name: 'Optimizer', color: '#8E93B0', val1: 'AdamW', val2: 'Cosine' },
  ];

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
        gap: '24px',
        boxSizing: 'border-box'
      }}>
        {/* Left Column: Model Specifications & Layers */}
        <div style={{ width: '310px', display: 'flex', flexDirection: 'column', gap: '20px', flexShrink: 0 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '800', color: '#1D2138' }}>
            Pipeline Analytics
          </h2>

          {/* Card 1: Benchmark Donut Card (98.4%) */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '22px',
            padding: '20px',
            boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
            border: '1px solid rgba(226, 230, 243, 0.8)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{ position: 'relative', width: '56px', height: '56px' }}>
              <svg width="56" height="56" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="22" fill="none" stroke="#EFF1F7" strokeWidth="6" />
                <circle
                  cx="28" cy="28" r="22" fill="none"
                  stroke="url(#donutGrad)" strokeWidth="6"
                  strokeDasharray="138"
                  strokeDashoffset={`${138 * (1 - 0.984)}`}
                  strokeLinecap="round"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                />
                <defs>
                  <linearGradient id="donutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FF9B38" />
                    <stop offset="100%" stopColor="#FF4772" />
                  </linearGradient>
                </defs>
              </svg>
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: '800', color: '#1D2138'
              }}>
                98%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '600' }}>Celeb-DF(v2) SOTA</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <span style={{ fontSize: '18px', fontWeight: '900', color: '#1D2138' }}>98.4%</span>
                <span style={{ fontSize: '10px', color: '#10B981', fontWeight: '800' }}>Acc</span>
              </div>
              <div style={{ fontSize: '10px', color: '#A0A5BD', marginTop: '1px' }}>
                99.7% Test AUC
              </div>
            </div>
          </div>

          {/* Card 2: Training Loss & Optimizer Spline Card */}
          <div style={{
            background: 'linear-gradient(135deg, #6C66FA 0%, #544FF0 100%)',
            borderRadius: '24px',
            padding: '24px 20px',
            color: '#FFFFFF',
            boxShadow: '0 12px 30px rgba(84, 79, 240, 0.35)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Glowing Double Wave SVG */}
            <div style={{ width: '100%', height: '80px', marginBottom: '16px' }}>
              <svg width="100%" height="80" viewBox="0 0 240 80" fill="none">
                <path
                  d="M 5 60 C 40 10, 80 75, 120 20 C 160 5, 200 45, 235 25"
                  stroke="#FFD200"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <path
                  d="M 5 45 C 45 65, 85 15, 125 50 C 165 75, 205 20, 235 40"
                  stroke="rgba(255, 255, 255, 0.9)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div style={{ fontSize: '12px', opacity: 0.85, fontWeight: '600' }}>Loss & Convergence</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '22px', fontWeight: '900' }}>0.0767</span>
              <span style={{ fontSize: '11px', opacity: 0.9, fontWeight: '800' }}>Test Log Loss</span>
            </div>
            <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '3px', marginBottom: '16px' }}>
              AdamW · Cosine Annealing (30 Epochs)
            </div>

            {/* Color Legend Pills */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                  <span>FaceForensics++ (c23)</span>
                </div>
                <div style={{ width: '70px', height: '4px', backgroundColor: '#10B981', borderRadius: '2px' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FF4772' }} />
                  <span>Celeb-DF(v2)</span>
                </div>
                <div style={{ width: '70px', height: '4px', backgroundColor: '#FF4772', borderRadius: '2px' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FFD200' }} />
                  <span>KoDF (Asian Domain)</span>
                </div>
                <div style={{ width: '70px', height: '4px', backgroundColor: '#FFD200', borderRadius: '2px' }} />
              </div>
            </div>
          </div>

          {/* Card 3: Neural Layer Breakdown */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '22px',
            padding: '20px',
            boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
            border: '1px solid rgba(226, 230, 243, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            {architectureLayers.map((layer, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: layer.color }} />
                  <span style={{ color: '#1D2138', fontWeight: '600' }}>{layer.name}</span>
                </div>
                <div style={{ display: 'flex', gap: '16px', color: '#8E93B0', fontWeight: '600' }}>
                  <span style={{ width: '38px', textAlign: 'right' }}>{layer.val1}</span>
                  <span style={{ width: '48px', textAlign: 'right', color: '#1D2138', fontWeight: '700' }}>{layer.val2}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Main Card: Data visualisation & Sankey Flow Diagram */}
        <div style={{
          flex: 1,
          backgroundColor: '#FFFFFF',
          borderRadius: '26px',
          padding: '28px 36px',
          boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
          border: '1px solid rgba(226, 230, 243, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative'
        }}>
          {/* Top Timeline Navigation */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#A0A5BD', letterSpacing: '2px' }}>TIMELINE</span>
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
              margin: '16px 0 0',
              fontSize: '38px',
              fontWeight: '800',
              color: '#1D2138',
              letterSpacing: '-0.5px'
            }}>
              Neural Pipeline Architecture
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#8E93B0' }}>
              Dual-branch Multi-Scale Efficient Global Context Vision Transformer (MS-EffGCViT)
            </p>
          </div>

          {/* Central Sankey Neural Flow Diagram */}
          <div style={{ position: 'relative', width: '100%', height: '360px', margin: '20px 0' }}>
            {/* SVG Connecting Fluid Ribbons */}
            <svg
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
              }}
              viewBox="0 0 880 360"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="flowCyanToPink" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#36B8FF" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#FF4772" stopOpacity="0.75" />
                </linearGradient>

                <linearGradient id="flowPinkToPurple" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#FF4772" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#544FF0" stopOpacity="0.75" />
                </linearGradient>
              </defs>

              {/* Branch 1: Left Node to Middle 1 (Low-level L-GCViT) */}
              <path
                d="M 160 170 C 270 170, 310 85, 420 85 L 420 105 C 310 105, 270 185, 160 185 Z"
                fill="url(#flowCyanToPink)"
              />

              {/* Branch 2: Left Node to Middle 2 (MBConv Backbone) */}
              <path
                d="M 160 175 C 270 175, 310 175, 420 175 L 420 195 C 310 195, 270 195, 160 195 Z"
                fill="url(#flowCyanToPink)"
              />

              {/* Branch 3: Left Node to Middle 3 (High-level H-GCViT) */}
              <path
                d="M 160 185 C 270 185, 310 275, 420 275 L 420 295 C 310 295, 270 205, 160 205 Z"
                fill="url(#flowCyanToPink)"
              />

              {/* Middle 1 to Right 1 */}
              <path
                d="M 560 80 C 620 80, 640 80, 700 80 L 700 95 C 640 95, 620 95, 560 95 Z"
                fill="url(#flowPinkToPurple)"
              />

              {/* Middle 1 crossing down to Right 2 */}
              <path
                d="M 560 95 C 620 95, 640 175, 700 175 L 700 190 C 640 190, 620 110, 560 110 Z"
                fill="url(#flowPinkToPurple)"
              />

              {/* Middle 2 crossing up to Right 1 */}
              <path
                d="M 560 170 C 620 170, 640 95, 700 95 L 700 110 C 640 110, 620 185, 560 185 Z"
                fill="url(#flowPinkToPurple)"
              />

              {/* Middle 2 to Right 2 */}
              <path
                d="M 560 185 C 620 185, 640 185, 700 185 L 700 200 C 640 200, 620 200, 560 200 Z"
                fill="url(#flowPinkToPurple)"
              />

              {/* Middle 3 crossing up to Right 2 & Right 3 */}
              <path
                d="M 560 265 C 620 265, 640 195, 700 195 L 700 210 C 640 210, 620 280, 560 280 Z"
                fill="url(#flowPinkToPurple)"
              />
              <path
                d="M 560 280 C 620 280, 640 280, 700 280 L 700 295 C 640 295, 620 295, 560 295 Z"
                fill="url(#flowPinkToPurple)"
              />
            </svg>

            {/* Left Input Node Card: Preprocessed Face Input */}
            <div style={{
              position: 'absolute',
              left: '30px',
              top: '135px',
              width: '135px',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '16px 14px',
              boxShadow: '0 10px 30px rgba(66, 71, 112, 0.12)',
              border: '1px solid rgba(226, 230, 243, 0.9)',
              zIndex: 10
            }}>
              <div style={{ fontSize: '18px', color: '#5854EE', marginBottom: '6px' }}>🔬</div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#1D2138' }}>Input Crop</div>
              <div style={{ fontSize: '10px', color: '#8E93B0', marginTop: '2px' }}>224 × 224 RGB aligned.</div>
            </div>

            {/* Middle 3 Cards: Feature Extractors & Dual Branch */}
            <div style={{
              position: 'absolute',
              left: '420px',
              top: '45px',
              width: '145px',
              background: 'linear-gradient(135deg, #FF668B 0%, #FF4772 100%)',
              borderRadius: '16px',
              padding: '14px 16px',
              color: '#FFFFFF',
              boxShadow: '0 8px 24px rgba(255, 71, 114, 0.35)',
              zIndex: 10
            }}>
              <div style={{ fontSize: '11px', opacity: 0.9, fontWeight: '700' }}>L-GCViT Branch</div>
              <div style={{ fontSize: '15px', fontWeight: '900', marginTop: '2px' }}>Local Attn</div>
              <div style={{ fontSize: '9px', opacity: 0.85, marginTop: '2px' }}>Subtle skin/edge artifacts</div>
            </div>

            <div style={{
              position: 'absolute',
              left: '420px',
              top: '140px',
              width: '145px',
              background: 'linear-gradient(135deg, #FF668B 0%, #FF4772 100%)',
              borderRadius: '16px',
              padding: '14px 16px',
              color: '#FFFFFF',
              boxShadow: '0 8px 24px rgba(255, 71, 114, 0.35)',
              zIndex: 10
            }}>
              <div style={{ fontSize: '11px', opacity: 0.9, fontWeight: '700' }}>MBConv Backbone</div>
              <div style={{ fontSize: '15px', fontWeight: '900', marginTop: '2px' }}>EfficientNet-B0</div>
              <div style={{ fontSize: '9px', opacity: 0.85, marginTop: '2px' }}>Spatial inductive bias</div>
            </div>

            <div style={{
              position: 'absolute',
              left: '420px',
              top: '235px',
              width: '145px',
              background: 'linear-gradient(135deg, #FF668B 0%, #FF4772 100%)',
              borderRadius: '16px',
              padding: '14px 16px',
              color: '#FFFFFF',
              boxShadow: '0 8px 24px rgba(255, 71, 114, 0.35)',
              zIndex: 10
            }}>
              <div style={{ fontSize: '11px', opacity: 0.9, fontWeight: '700' }}>H-GCViT Branch</div>
              <div style={{ fontSize: '15px', fontWeight: '900', marginTop: '2px' }}>Global Attn</div>
              <div style={{ fontSize: '9px', opacity: 0.85, marginTop: '2px' }}>Macro lighting & shadow</div>
            </div>

            {/* Right 3 Purple Cards: Fusion, Head, and Verdict */}
            <div style={{
              position: 'absolute',
              left: '700px',
              top: '45px',
              width: '145px',
              background: 'linear-gradient(135deg, #6C66FA 0%, #544FF0 100%)',
              borderRadius: '16px',
              padding: '14px 16px',
              color: '#FFFFFF',
              boxShadow: '0 8px 24px rgba(84, 79, 240, 0.35)',
              zIndex: 10
            }}>
              <div style={{ fontSize: '11px', opacity: 0.9, fontWeight: '700' }}>Cross Fusion</div>
              <div style={{ fontSize: '15px', fontWeight: '900', marginTop: '2px' }}>280 Channels</div>
              <div style={{ fontSize: '9px', opacity: 0.85, marginTop: '2px' }}>L + H Linear projection</div>
            </div>

            <div style={{
              position: 'absolute',
              left: '700px',
              top: '140px',
              width: '145px',
              background: 'linear-gradient(135deg, #6C66FA 0%, #544FF0 100%)',
              borderRadius: '16px',
              padding: '14px 16px',
              color: '#FFFFFF',
              boxShadow: '0 8px 24px rgba(84, 79, 240, 0.35)',
              zIndex: 10
            }}>
              <div style={{ fontSize: '11px', opacity: 0.9, fontWeight: '700' }}>Sigmoid Head</div>
              <div style={{ fontSize: '15px', fontWeight: '900', marginTop: '2px' }}>Binary Score</div>
              <div style={{ fontSize: '9px', opacity: 0.85, marginTop: '2px' }}>Real (0) vs Fake (1)</div>
            </div>

            <div style={{
              position: 'absolute',
              left: '700px',
              top: '235px',
              width: '145px',
              background: 'linear-gradient(135deg, #6C66FA 0%, #544FF0 100%)',
              borderRadius: '16px',
              padding: '14px 16px',
              color: '#FFFFFF',
              boxShadow: '0 8px 24px rgba(84, 79, 240, 0.35)',
              zIndex: 10
            }}>
              <div style={{ fontSize: '11px', opacity: 0.9, fontWeight: '700' }}>XAI Attribution</div>
              <div style={{ fontSize: '15px', fontWeight: '900', marginTop: '2px' }}>Grad-CAM</div>
              <div style={{ fontSize: '9px', opacity: 0.85, marginTop: '2px' }}>Artifact visualizer map</div>
            </div>

            {/* Right Vertical Floating Toolbar */}
            <div style={{
              position: 'absolute',
              right: '-16px',
              top: '110px',
              zIndex: 20,
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              boxShadow: '0 6px 20px rgba(66, 71, 112, 0.1)',
              border: '1px solid rgba(226, 230, 243, 0.9)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '12px 8px'
            }}>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5854EE', fontSize: '16px', fontWeight: 'bold' }}>+</button>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5854EE', fontSize: '16px', fontWeight: 'bold' }}>–</button>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5854EE' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>

          {/* Bottom 3 Verified Parameters */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            borderTop: '1px solid #EFF1F7',
            paddingTop: '20px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'rgba(54, 184, 255, 0.1)',
                color: '#36B8FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 6px'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/></svg>
              </div>
              <div style={{ fontSize: '10px', color: '#A0A5BD', fontWeight: '800', letterSpacing: '0.8px' }}>PARAMETERS</div>
              <div style={{ fontSize: '30px', fontWeight: '900', color: '#1D2138', marginTop: '2px' }}>8.70M</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'rgba(88, 84, 238, 0.1)',
                color: '#5854EE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 6px'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{ fontSize: '10px', color: '#A0A5BD', fontWeight: '800', letterSpacing: '0.8px' }}>FLOP COUNT</div>
              <div style={{ fontSize: '30px', fontWeight: '900', color: '#1D2138', marginTop: '2px' }}>0.85G</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 71, 114, 0.1)',
                color: '#FF4772',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 6px'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <div style={{ fontSize: '10px', color: '#A0A5BD', fontWeight: '800', letterSpacing: '0.8px' }}>CELEB-DF AUC</div>
              <div style={{ fontSize: '30px', fontWeight: '900', color: '#1D2138', marginTop: '2px' }}>99.7%</div>
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

export default PipelineAnalyticsPage;
