import React, { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ScanModal from '../components/ScanModal';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const SAMPLE_IMAGES = [
  { name: 'Western Fake (Img)', path: '/samples/images/western_fake_1.JPG', domain: '서양인' },
  { name: 'Asian Fake (Img)', path: '/samples/images/asian_fake_1.JPG', domain: '동양인' }
];

const SAMPLE_VIDEOS = [
  { name: 'Western Fake (Vid)', path: '/samples/videos/western_fake.mp4', domain: '서양인' },
  { name: 'Western Real (Vid)', path: '/samples/videos/western_real.mp4', domain: '서양인' }
];

const OverviewPage = ({ sessionUser, onLogout }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanModalMode, setScanModalMode] = useState('image');
  const [, setHoveredHex] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Mode: 'image' or 'video'
  const [mediaMode, setMediaMode] = useState('image');

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
      gflops: '0.85',
      resolution: '224x224',
      precisionFF: 94.8,
      recallFF: 93.2,
      f1FF: 94.0,
      aucCelebDF: 99.7,
      accCelebDF: 98.4,
      device: 'MPS / CUDA'
    }
  });

  // Scanner state
  const [selectedFile, setSelectedFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // AI Forensics & Deepfake Explorer State
  const forensicsSectionRef = useRef(null);
  const [forensicsTab, setForensicsTab] = useState('evidence'); // 'evidence' | 'signals' | 'timeline' | 'architecture' | 'report'
  const [forensicsLayer, setForensicsLayer] = useState('bbox'); // 'raw' | 'bbox' | 'cam'
  const [viewFocus, setViewFocus] = useState('whole'); // 'whole' | 'face_crop'
  const [camSettings, setCamSettings] = useState({
    explainerType: 'eigengradcam',
    branchLevel: 'high',
    displayType: 'heatmap_bbox',
    overlayRatio: 0.7,
    threshold: 0.8
  });
  const [isGeneratingCam, setIsGeneratingCam] = useState(false);
  const [camResultUrl, setCamResultUrl] = useState(null);
  const [camError, setCamError] = useState(null);

  // Video Frame Temporal Dynamics State
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);
  const [frameCamUrl, setFrameCamUrl] = useState(null);
  const [isGeneratingFrameCam, setIsGeneratingFrameCam] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await axios.get('/image/stats');
      if (res.data?.status === 'success') {
        setSystemStats(prev => ({
          ...prev,
          totalScans: res.data.total_scans,
          imageScans: res.data.image_scans || 0,
          videoScans: res.data.video_scans || 0,
          fakeCount: res.data.fake_count,
          realCount: res.data.real_count,
          fakeRate: res.data.fake_rate,
          avgFaceConf: res.data.avg_face_conf,
          avgScore: res.data.avg_score,
          modelInfo: {
            ...prev.modelInfo,
            ...res.data.model_info,
            precisionFF: res.data.model_info?.precision_ff || 94.8,
            recallFF: res.data.model_info?.recall_ff || 93.2,
            f1FF: res.data.model_info?.f1_ff || 94.0,
            aucCelebDF: res.data.model_info?.auc_celeb_df || 99.7,
            accCelebDF: res.data.model_info?.acc_celeb_df || 98.4,
            device: res.data.model_info?.device || 'PyTorch Core'
          }
        }));
      }
    } catch (err) {
      console.warn("Could not fetch system stats:", err);
    }
  };

  useEffect(() => {
    fetchStats();
    const handleScanCompleted = () => {
      fetchStats();
    };
    window.addEventListener('lixar:scan_completed', handleScanCompleted);
    return () => window.removeEventListener('lixar:scan_completed', handleScanCompleted);
  }, []);

  // Handle file validation and preview
  const handleSelectFile = (file) => {
    if (!file) return;

    if (mediaMode === 'image') {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!validTypes.includes(file.type.toLowerCase())) {
        setScanError("Invalid format. Please select a JPG, PNG, or WEBP image.");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setScanError("Image exceeds 20MB size limit.");
        return;
      }
    } else {
      const validTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!validTypes.includes(file.type.toLowerCase()) && !['mp4', 'mov', 'webm'].includes(ext)) {
        setScanError("Invalid format. Please select an MP4, MOV, or WEBM video.");
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        setScanError("Video exceeds 100MB size limit.");
        return;
      }
    }

    setScanError(null);
    setScanResult(null);
    setSelectedFile(file);

    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(URL.createObjectURL(file));
  };

  // Run real deepfake inference (image or video)
  const executeScan = async (fileToScan = selectedFile, domain = '서양인', targetMode = mediaMode) => {
    if (!fileToScan) return;

    setIsScanning(true);
    setScanError(null);
    setScanResult(null);

    const formData = new FormData();
    formData.append('version_type', 'v2');
    formData.append('model_type', 'fast');
    formData.append('domain_type', domain);
    formData.append('sync', 'true');

    if (targetMode === 'image') {
      formData.append('imagefile', fileToScan);
      try {
        const response = await axios.post('/inference/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (response.data && response.data.status === 'success') {
          const analysis = response.data.analysis || {};
          const isFake = (analysis.prob !== undefined ? analysis.prob : 0) > 0.5;

          setScanResult({
            id: response.data.image_id,
            mediaType: 'image',
            label: response.data.label || (isFake ? 'FAKE' : 'REAL'),
            prob: analysis.prob !== undefined ? analysis.prob : 0.0,
            faceConf: analysis.face_conf || 0.0,
            faceRatio: analysis.face_ratio || 0.0,
            faceBrightness: analysis.face_brightness || 0.0,
            bbox: analysis.bbox || null,
            imgSize: analysis.img_size || null,
            numLandmarks: analysis.num_landmarks || 68,
            imageLoc: response.data.image_loc || null,
            message: response.data.message || "Image analysis successfully completed"
          });
          setCamResultUrl(null);
          setFrameCamUrl(null);
          setCamError(null);
          setForensicsLayer('bbox');

          // Refresh stats and notify other pages
          fetchStats();
          window.dispatchEvent(new CustomEvent('lixar:scan_completed', {
            detail: { id: response.data.image_id, type: 'image' }
          }));
        } else {
          setScanError(response.data?.message || "Inference failed to return a result.");
        }
      } catch (err) {
        console.error("Scan error:", err);
        const detail = err.response?.data?.detail || err.message || "Server error during inference.";
        setScanError(detail);
      } finally {
        setIsScanning(false);
      }
    } else {
      formData.append('videofile', fileToScan);
      try {
        const uploadRes = await axios.post('/inference/video', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        const videoId = uploadRes.data?.video_id;
        if (!videoId) {
          throw new Error("Failed to receive video analysis ticket.");
        }

        // Fetch result
        const resultRes = await axios.get(`/inference/video/${videoId}`);
        const resultData = resultRes.data;

        // Fetch frame details
        let detailData = null;
        try {
          const detailRes = await axios.get(`/inference/video/${videoId}/detail`);
          detailData = detailRes.data;
        } catch (detailErr) {
          console.warn("Could not load video detail frames:", detailErr);
        }

        const frames = detailData?.frames || [];
        setScanResult({
          id: videoId,
          videoId: videoId,
          mediaType: 'video',
          label: resultData.label || 'REAL',
          prob: resultData.score >= 0 ? resultData.score : 0.0,
          faceConf: resultData.face_conf >= 0 ? resultData.face_conf : 0.0,
          faceRatio: resultData.face_ratio >= 0 ? resultData.face_ratio : 0.0,
          faceBrightness: resultData.face_brightness >= 0 ? resultData.face_brightness : 0.0,
          meta: detailData?.meta || null,
          frames: frames,
          videoLoc: resultData.video_loc || null,
          message: resultData.result_msg || "Video analysis completed"
        });
        setCamResultUrl(null);
        setFrameCamUrl(null);
        setCamError(null);
        setForensicsLayer('bbox');

        if (frames.length > 0) {
          let peakIdx = 0;
          let peakScore = -1;
          frames.forEach((f, idx) => {
            if (f.score > peakScore) {
              peakScore = f.score;
              peakIdx = idx;
            }
          });
          setSelectedFrameIndex(peakIdx);
        }

        // Refresh stats and notify other pages
        fetchStats();
        window.dispatchEvent(new CustomEvent('lixar:scan_completed', {
          detail: { id: videoId, type: 'video' }
        }));
      } catch (err) {
        console.error("Video scan error:", err);
        const detail = err.response?.data?.detail || err.message || "Server error during video inference.";
        setScanError(detail);
      } finally {
        setIsScanning(false);
      }
    }
  };

  // Generate Image Grad-CAM / HiResCAM heatmap directly
  const handleGenerateImageCam = async (customParams = {}) => {
    if (!scanResult || scanResult.mediaType !== 'image') return;
    setIsGeneratingCam(true);
    setCamError(null);
    try {
      const payload = {
        model_type: 'fast',
        branch_level: customParams.branchLevel || camSettings.branchLevel,
        explainer_type: customParams.explainerType || camSettings.explainerType,
        display_type: customParams.displayType || camSettings.displayType,
        overlay_ratio: customParams.overlayRatio !== undefined ? customParams.overlayRatio : camSettings.overlayRatio,
        threshold: customParams.threshold !== undefined ? customParams.threshold : camSettings.threshold,
        aug_smooth: false,
        eigen_smooth: false
      };
      const res = await axios.post(`/explain/image/${scanResult.id}/direct`, payload);
      if (res.data && res.data.status === 'SUCCESS' && res.data.cam_loc) {
        setCamResultUrl(res.data.cam_loc);
        setForensicsLayer('cam');
      } else {
        setCamError(res.data?.message || 'Failed to generate CAM heatmap');
      }
    } catch (err) {
      console.error('CAM Generation Error:', err);
      setCamError(err.response?.data?.detail || err.message || 'Error generating activation map');
    } finally {
      setIsGeneratingCam(false);
    }
  };

  // Generate Video Frame Grad-CAM / HiResCAM heatmap directly
  const handleGenerateFrameCam = async (frameIdx = selectedFrameIndex, customParams = {}) => {
    if (!scanResult || scanResult.mediaType !== 'video') return;
    setIsGeneratingFrameCam(true);
    setCamError(null);
    try {
      const payload = {
        model_type: 'fast',
        branch_level: customParams.branchLevel || camSettings.branchLevel,
        explainer_type: customParams.explainerType || camSettings.explainerType,
        display_type: customParams.displayType || camSettings.displayType,
        overlay_ratio: customParams.overlayRatio !== undefined ? customParams.overlayRatio : camSettings.overlayRatio,
        threshold: customParams.threshold !== undefined ? customParams.threshold : camSettings.threshold,
        aug_smooth: false,
        eigen_smooth: false
      };
      const res = await axios.post(`/explain/video/${scanResult.videoId}/frame/${frameIdx}/direct`, payload);
      if (res.data && res.data.status === 'SUCCESS' && res.data.cam_loc) {
        setFrameCamUrl(res.data.cam_loc);
        setForensicsLayer('cam');
      } else {
        setCamError(res.data?.message || 'Failed to generate frame CAM heatmap');
      }
    } catch (err) {
      console.error('Frame CAM Generation Error:', err);
      setCamError(err.response?.data?.detail || err.message || 'Error generating frame activation map');
    } finally {
      setIsGeneratingFrameCam(false);
    }
  };

  // Download Formal Scientific Forensic Report (JSON)
  const handleDownloadForensicReport = () => {
    if (!scanResult) return;
    const reportData = {
      platform: "LIXAR AI Forensics",
      spec: "Scientific Media Verification & Deepfake Explorer",
      timestamp: new Date().toISOString(),
      media_type: scanResult.mediaType,
      scan_id: scanResult.id,
      verdict: {
        classification: scanResult.prob >= 0.6 ? "SYNTHETIC / DEEPFAKE" : (scanResult.prob <= 0.4 ? "AUTHENTIC / REAL" : "INCONCLUSIVE / UNCERTAIN"),
        synthesis_probability: Number(scanResult.prob.toFixed(4)),
        detection_confidence: Number(scanResult.faceConf.toFixed(2)),
        epistemic_certainty_pct: Number((Math.abs(scanResult.prob - 0.5) * 200).toFixed(1))
      },
      biometrics: {
        face_confidence_pct: Number(scanResult.faceConf.toFixed(2)),
        face_area_ratio_pct: Number(scanResult.faceRatio.toFixed(2)),
        mean_luminance_index: Number(scanResult.faceBrightness.toFixed(2)),
        bounding_box: scanResult.bbox || null,
        landmark_points_verified: scanResult.numLandmarks || 68
      },
      models: {
        classifier: {
          name: "MS-EffGCViT-B0",
          architecture: "EfficientNet-B0 + Multi-Scale Global Context Vision Transformer",
          parameters: "8.70M",
          gflops: "0.85 GFLOPs",
          input_tensor: "224x224x3",
          benchmarks: {
            celeb_df_v2_acc: "98.4%",
            celeb_df_v2_auc: "99.7%",
            faceforensics_c23_acc: "98.1%"
          }
        },
        preprocessor: {
          name: "YOLOv8n-Face",
          type: "Anchor-free decoupled face detector",
          parameters: "3.2M",
          keypoint_engine: "68-point facial landmark validator"
        }
      },
      video_analysis: scanResult.mediaType === 'video' ? {
        meta: scanResult.meta,
        total_frames_evaluated: scanResult.frames?.length || 0,
        sampled_frames: scanResult.frames || []
      } : null,
      scientific_notes: [
        "Inference executed natively in PyTorch on local hardware without synthetic generation.",
        "Probabilities reflect the sigmoid output of the transformer head.",
        "Margin of Certainty measures statistical distance from the 0.5 decision boundary.",
        "Domain sensitivity: Celeb-DF v2 / FaceForensics++ c23 (Western) vs KoDF (Asian)."
      ]
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LIXAR_Forensics_${scanResult.mediaType}_${scanResult.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Quick load sample media
  const loadSample = async (sample, mode = mediaMode) => {
    try {
      setIsScanning(true);
      setScanError(null);
      setScanResult(null);

      const resp = await fetch(sample.path);
      const blob = await resp.blob();
      const mime = mode === 'image' ? (blob.type || 'image/jpeg') : (blob.type || 'video/mp4');
      const file = new File([blob], sample.path.split('/').pop(), { type: mime });

      setSelectedFile(file);
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
      setMediaPreview(URL.createObjectURL(file));

      await executeScan(file, sample.domain, mode);
    } catch (e) {
      setIsScanning(false);
      setScanError("Failed to load sample media.");
    }
  };

  const handleResetScan = () => {
    setSelectedFile(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
    setScanResult(null);
    setScanError(null);
    setCamResultUrl(null);
    setFrameCamUrl(null);
    setCamError(null);
    setForensicsLayer('bbox');
  };

  const handleModeChange = (mode) => {
    if (mode === mediaMode) return;
    handleResetScan();
    setMediaMode(mode);
  };

  // Generate Hexagonal Grid coordinates
  const hexRows = 14;
  const hexCols = 32;
  const hexRadius = 9;
  const hexWidth = hexRadius * Math.sqrt(3);
  const hexHeight = hexRadius * 1.5;

  const getHexColor = (row, col) => {
    const distToHotspot = Math.hypot(row - 2, col - 28);
    if (distToHotspot < 4.5) {
      const alpha = 1 - (distToHotspot / 4.5) * 0.4;
      return `rgba(255, 71, 114, ${alpha})`;
    }
    if (distToHotspot < 7.5) {
      return `rgba(255, 120, 156, ${0.8 - (distToHotspot - 4.5) * 0.2})`;
    }
    const distToBottom = (hexRows - row);
    if (distToBottom < 4) {
      if (col > 10 && col < 30) {
        return (row + col) % 3 === 0 ? '#6360F6' : '#7D79FA';
      }
      return '#8E8BFC';
    }
    if (distToBottom < 6) {
      return (row + col) % 4 === 0 ? '#AEAFFD' : '#C7C8FD';
    }
    if (row < 7 && col > 15) {
      return (row * col) % 5 === 0 ? '#F9B2C7' : '#FBD6E1';
    }
    if ((row + col) % 7 === 0) {
      return '#E4E5FA';
    }
    return '#F1F2FA';
  };

  // Calculated gauge values
  const currentConfidence = scanResult 
    ? (scanResult.prob * 100).toFixed(1)
    : (systemStats.totalScans > 0 ? systemStats.fakeRate.toFixed(1) : "0.0");

  const gaugePercent = scanResult 
    ? Math.min(1, Math.max(0, scanResult.prob))
    : (systemStats.totalScans > 0 ? (systemStats.fakeRate / 100) : 0);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F4F5FB',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      position: 'relative'
    }}>
      {/* Universal Top Header */}
      <Header
        sessionUser={sessionUser}
        onLogout={onLogout}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onOpenScanModal={() => { setScanModalMode('image'); setScanModalOpen(true); }}
      />

      {/* Main Canvas Body */}
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
        {/* Top 6 KPI Ribbon Pills */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '16px'
        }}>
          {/* Card 1: Total Scans */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 8px 24px rgba(66, 71, 112, 0.04)',
            border: '1px solid rgba(226, 230, 243, 0.7)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'rgba(88, 84, 238, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#5854EE'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/></svg>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '600' }}>Total Scans</div>
                <div style={{ fontSize: '19px', fontWeight: '800', color: '#1D2138', marginTop: '1px' }}>
                  {systemStats.totalScans}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '42px', height: '5px', backgroundColor: '#EFF1F7', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${systemStats.totalScans > 0 ? Math.min(100, systemStats.totalScans * 10) : 0}%`, height: '100%', backgroundColor: '#5854EE', borderRadius: '4px' }} />
              </div>
              <span style={{ fontSize: '10px', color: '#8E93B0', fontWeight: '700' }}>Live</span>
            </div>
          </div>

          {/* Card 2: Model Precision (FF++ c23 offline metric) */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 8px 24px rgba(66, 71, 112, 0.04)',
            border: '1px solid rgba(226, 230, 243, 0.7)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'rgba(54, 184, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#36B8FF'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '600' }}>Precision (FF++)</div>
                <div style={{ fontSize: '19px', fontWeight: '800', color: '#1D2138', marginTop: '1px' }}>
                  {systemStats.modelInfo.precisionFF}%
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '3px' }}>
              <span style={{ width: '8px', height: '4px', borderRadius: '2px', backgroundColor: '#10B981' }} />
              <span style={{ width: '12px', height: '4px', borderRadius: '2px', backgroundColor: '#5854EE' }} />
            </div>
          </div>

          {/* Card 3: Active Architecture */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 8px 24px rgba(66, 71, 112, 0.04)',
            border: '1px solid rgba(226, 230, 243, 0.7)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10B981'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '600' }}>Active Model</div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#1D2138', marginTop: '2px' }}>
                  MS-EffGCViT
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '10px', color: '#5854EE', fontWeight: '800', backgroundColor: 'rgba(88,84,238,0.1)', padding: '2px 6px', borderRadius: '6px' }}>8.7M</span>
            </div>
          </div>

          {/* Card 4: Input Resolution */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 8px 24px rgba(66, 71, 112, 0.04)',
            border: '1px solid rgba(226, 230, 243, 0.7)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'rgba(88, 84, 238, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#5854EE'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '600' }}>Resolution</div>
                <div style={{ fontSize: '19px', fontWeight: '800', color: '#1D2138', marginTop: '1px' }}>224 × 224</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '3px' }}>
              <span style={{ width: '6px', height: '4px', borderRadius: '1px', backgroundColor: '#5854EE' }} />
              <span style={{ width: '6px', height: '4px', borderRadius: '1px', backgroundColor: '#5854EE' }} />
              <span style={{ width: '6px', height: '4px', borderRadius: '1px', backgroundColor: '#5854EE' }} />
            </div>
          </div>

          {/* Card 5: Engine Runtime / Device */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 8px 24px rgba(66, 71, 112, 0.04)',
            border: '1px solid rgba(226, 230, 243, 0.7)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'rgba(54, 184, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#36B8FF'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="15" x2="23" y2="15"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/></svg>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '600' }}>Runtime Core</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#1D2138', marginTop: '2px' }}>
                  {systemStats.modelInfo.device.split(' ')[0]}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#10B981', fontSize: '11px', fontWeight: '700' }}>
              <span>●</span>
              <span>0.85G</span>
            </div>
          </div>

          {/* Card 6: Benchmark AUC */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 8px 24px rgba(66, 71, 112, 0.04)',
            border: '1px solid rgba(226, 230, 243, 0.7)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 71, 114, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FF4772'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M16 12l-4-4-4 4M12 8v8"/></svg>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '600' }}>SOTA AUC</div>
                <div style={{ fontSize: '19px', fontWeight: '800', color: '#1D2138', marginTop: '1px' }}>
                  {systemStats.modelInfo.aucCelebDF}%
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#10B981', fontSize: '11px', fontWeight: '700' }}>
              <span>▲</span>
              <span>SOTA</span>
            </div>
          </div>
        </div>

        {/* Central Split Area: Left Column (Results & Metrics) & Right Column (Scanner Surface) */}
        <div style={{ display: 'flex', gap: '24px', alignItems: 'stretch' }}>
          {/* Left Column: Result & Metrics Gauge */}
          <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '20px', flexShrink: 0 }}>
            {/* Real Result & Statistics Card */}
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '22px',
              padding: '24px',
              boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
              border: '1px solid rgba(226, 230, 243, 0.8)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#1D2138' }}>
                  {scanResult ? 'Inference Verdict' : 'Global Statistics'}
                </h3>
                {scanResult && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    backgroundColor: scanResult.label === 'FAKE' ? 'rgba(255, 71, 114, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                    color: scanResult.label === 'FAKE' ? '#FF4772' : '#10B981'
                  }}>
                    {scanResult.label}
                  </span>
                )}
              </div>

              {/* Semi-circular Ring Gauge */}
              <div style={{ position: 'relative', width: '220px', height: '140px', margin: '0 auto 10px' }}>
                <svg width="220" height="140" viewBox="0 0 220 140">
                  <path
                    d="M 25 125 A 85 85 0 0 1 195 125"
                    fill="none"
                    stroke="#EFF1F7"
                    strokeWidth="14"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 25 125 A 85 85 0 0 1 195 125"
                    fill="none"
                    stroke={scanResult?.label === 'FAKE' ? 'url(#coralGaugeGrad)' : 'url(#purpleGaugeGrad)'}
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeDasharray="267"
                    strokeDashoffset={`${267 * (1 - Math.min(1, Math.max(0.05, gaugePercent)))}`}
                  />
                  <defs>
                    <linearGradient id="purpleGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#7E7BF8" />
                      <stop offset="100%" stopColor="#544FF0" />
                    </linearGradient>
                    <linearGradient id="coralGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#FF7A9C" />
                      <stop offset="100%" stopColor="#FF4772" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Center Content */}
                <div style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    backgroundColor: scanResult?.label === 'FAKE' ? 'rgba(255, 71, 114, 0.1)' : 'rgba(88, 84, 238, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: scanResult?.label === 'FAKE' ? '#FF4772' : '#5854EE',
                    marginBottom: '4px'
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/></svg>
                  </div>
                  <div style={{ fontSize: '9px', fontWeight: '700', color: '#8E93B0', letterSpacing: '0.8px' }}>
                    {scanResult ? 'DEEPFAKE SCORE' : 'BENCHMARK CONFIDENCE'}
                  </div>
                  <div style={{ fontSize: '30px', fontWeight: '900', color: '#1D2138', lineHeight: 1.1 }}>
                    {currentConfidence}<span style={{ fontSize: '16px', fontWeight: '700' }}>%</span>
                  </div>
                </div>

                <div style={{ position: 'absolute', bottom: '0', left: '26px', fontSize: '10px', color: '#A0A5BD', fontWeight: '600' }}>0%</div>
                <div style={{ position: 'absolute', bottom: '0', right: '26px', fontSize: '10px', color: '#A0A5BD', fontWeight: '600' }}>100%</div>
              </div>

              {/* Real Face & Biometric Metrics Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px', borderTop: '1px solid #F0F2F9', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#8E93B0', fontWeight: '600' }}>Face Confidence</span>
                  <span style={{ color: '#1D2138', fontWeight: '700' }}>
                    {scanResult ? `${scanResult.faceConf.toFixed(1)}%` : (systemStats.avgFaceConf > 0 ? `${systemStats.avgFaceConf.toFixed(1)}%` : '—')}
                  </span>
                  <div style={{ width: '80px', height: '5px', backgroundColor: '#EFF1F7', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${scanResult ? Math.min(100, scanResult.faceConf) : (systemStats.avgFaceConf > 0 ? Math.min(100, systemStats.avgFaceConf) : 0)}%`, height: '100%', backgroundColor: '#5854EE', borderRadius: '4px' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#8E93B0', fontWeight: '600' }}>Face Area Ratio</span>
                  <span style={{ color: '#1D2138', fontWeight: '700' }}>
                    {scanResult ? `${scanResult.faceRatio.toFixed(1)}%` : '—'}
                  </span>
                  <div style={{ width: '80px', height: '5px', backgroundColor: '#EFF1F7', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${scanResult ? Math.min(100, scanResult.faceRatio * 2.5) : 0}%`, height: '100%', backgroundColor: '#FF9B38', borderRadius: '4px' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#8E93B0', fontWeight: '600' }}>Lighting & Brightness</span>
                  <span style={{ color: '#1D2138', fontWeight: '700' }}>
                    {scanResult ? `${scanResult.faceBrightness.toFixed(1)}%` : '—'}
                  </span>
                  <div style={{ width: '80px', height: '5px', backgroundColor: '#EFF1F7', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${scanResult ? Math.min(100, scanResult.faceBrightness) : 0}%`, height: '100%', backgroundColor: '#10B981', borderRadius: '4px' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom 2 Split Cards: Real & Fake Scans Count */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {/* White Card: Real Scans */}
              <div 
                onClick={() => { setScanModalMode('image'); setScanModalOpen(true); }}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '20px',
                  padding: '18px 16px',
                  boxShadow: '0 8px 24px rgba(66, 71, 112, 0.04)',
                  border: '1px solid rgba(226, 230, 243, 0.8)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#8E93B0' }}>Verified Real</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                  <span style={{ fontSize: '19px', fontWeight: '900', color: '#1D2138' }}>{systemStats.realCount}</span>
                  <span style={{ fontSize: '10px', color: '#10B981', fontWeight: '800' }}>REAL</span>
                </div>
                <div style={{ fontSize: '9px', color: '#A0A5BD', marginTop: '4px' }}>
                  Authentic verified media
                </div>
              </div>

              {/* Purple Solid Card: Fake Scans */}
              <div 
                onClick={() => { setScanModalMode('video'); setScanModalOpen(true); }}
                style={{
                  background: 'linear-gradient(135deg, #6C66FA 0%, #544FF0 100%)',
                  borderRadius: '20px',
                  padding: '18px 16px',
                  color: '#FFFFFF',
                  boxShadow: '0 10px 26px rgba(84, 79, 240, 0.35)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ fontSize: '12px', fontWeight: '600', opacity: 0.9 }}>Detected Fakes</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                  <span style={{ fontSize: '19px', fontWeight: '900' }}>{systemStats.fakeCount}</span>
                  <span style={{ fontSize: '10px', opacity: 0.85, fontWeight: '800' }}>FLAGGED</span>
                </div>
                <div style={{ fontSize: '9px', opacity: 0.75, marginTop: '4px' }}>
                  Manipulated content
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Primary Deepfake Scanner Canvas */}
          <div style={{
            flex: 1,
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            padding: '24px 28px',
            boxShadow: '0 10px 30px rgba(66, 71, 112, 0.05)',
            border: '1px solid rgba(226, 230, 243, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Header with Title and Mode Controls */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '18px',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#1D2138' }}>
                  Neural Scanner & Artifact Detection
                </h2>

                {/* Mode Selector Toggle */}
                <div style={{
                  display: 'flex',
                  backgroundColor: '#EFF1F7',
                  borderRadius: '14px',
                  padding: '3px',
                  gap: '2px'
                }}>
                  <button
                    onClick={() => handleModeChange('image')}
                    disabled={isScanning}
                    style={{
                      padding: '5px 14px',
                      borderRadius: '11px',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: '800',
                      cursor: isScanning ? 'not-allowed' : 'pointer',
                      backgroundColor: mediaMode === 'image' ? '#5854EE' : 'transparent',
                      color: mediaMode === 'image' ? '#FFFFFF' : '#8E93B0',
                      transition: 'all 0.2s ease',
                      boxShadow: mediaMode === 'image' ? '0 2px 8px rgba(88, 84, 238, 0.3)' : 'none'
                    }}
                  >
                    Image Scan
                  </button>
                  <button
                    onClick={() => handleModeChange('video')}
                    disabled={isScanning}
                    style={{
                      padding: '5px 14px',
                      borderRadius: '11px',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: '800',
                      cursor: isScanning ? 'not-allowed' : 'pointer',
                      backgroundColor: mediaMode === 'video' ? '#5854EE' : 'transparent',
                      color: mediaMode === 'video' ? '#FFFFFF' : '#8E93B0',
                      transition: 'all 0.2s ease',
                      boxShadow: mediaMode === 'video' ? '0 2px 8px rgba(88, 84, 238, 0.3)' : 'none'
                    }}
                  >
                    Video Scan
                  </button>
                </div>

                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#5854EE',
                  backgroundColor: 'rgba(88, 84, 238, 0.08)',
                  padding: '3px 10px',
                  borderRadius: '12px'
                }}>
                  MS-EffGCViT Active
                </span>
              </div>

              {/* Sample Quick Action Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '600' }}>Quick Test:</span>
                {(mediaMode === 'image' ? SAMPLE_IMAGES : SAMPLE_VIDEOS).map((sample) => (
                  <button
                    key={sample.name}
                    onClick={() => loadSample(sample, mediaMode)}
                    disabled={isScanning}
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#5854EE',
                      backgroundColor: '#EFF1F7',
                      border: 'none',
                      padding: '5px 12px',
                      borderRadius: '14px',
                      cursor: isScanning ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E2E6F3'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EFF1F7'}
                  >
                    {sample.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept={mediaMode === 'image' ? "image/jpeg,image/png,image/webp,image/jpg" : "video/mp4,video/quicktime,video/webm"}
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleSelectFile(e.target.files[0]);
                }
              }}
            />

            {/* Scanner Canvas Surface */}
            <div style={{
              position: 'relative',
              flex: 1,
              minHeight: '380px',
              backgroundColor: '#F8F9FD',
              borderRadius: '18px',
              border: isDragging ? '2px dashed #5854EE' : '1px solid #E6E9F4',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files?.[0]) {
                handleSelectFile(e.dataTransfer.files[0]);
              }
            }}
            >
              {mediaPreview ? (
                /* Uploaded Image or Video Mode with Laser Animation & Results */
                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                  {mediaMode === 'image' ? (
                    <img
                      src={mediaPreview}
                      alt="Scan Subject"
                      style={{
                        maxHeight: '340px',
                        maxWidth: '90%',
                        borderRadius: '14px',
                        objectFit: 'contain',
                        boxShadow: '0 12px 36px rgba(0,0,0,0.12)'
                      }}
                    />
                  ) : (
                    <video
                      src={mediaPreview}
                      controls={!isScanning}
                      autoPlay
                      loop
                      muted
                      playsInline
                      style={{
                        maxHeight: '340px',
                        maxWidth: '90%',
                        borderRadius: '14px',
                        objectFit: 'contain',
                        boxShadow: '0 12px 36px rgba(0,0,0,0.12)',
                        backgroundColor: '#000000'
                      }}
                    />
                  )}

                  {/* Animated Laser Scanning Beam */}
                  {isScanning && (
                    <div style={{
                      position: 'absolute',
                      left: '5%',
                      right: '5%',
                      height: '3px',
                      background: 'linear-gradient(90deg, transparent 0%, #FF4772 30%, #5854EE 70%, transparent 100%)',
                      boxShadow: '0 0 16px 4px rgba(88, 84, 238, 0.7)',
                      animation: 'scanLaser 2.2s ease-in-out infinite',
                      zIndex: 20
                    }} />
                  )}

                  {/* Scanning Overlay Badge */}
                  {isScanning && (
                    <div style={{
                      position: 'absolute',
                      bottom: '30px',
                      backgroundColor: 'rgba(29, 33, 56, 0.88)',
                      backdropFilter: 'blur(8px)',
                      color: '#FFFFFF',
                      padding: '10px 20px',
                      borderRadius: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      zIndex: 30,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                    }}>
                      <div style={{
                        width: '18px',
                        height: '18px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTop: '2px solid #5854EE',
                        borderRadius: '50%',
                        animation: 'rotateSlow 0.8s linear infinite'
                      }} />
                      <span style={{ fontSize: '13px', fontWeight: '700' }}>
                        {mediaMode === 'image' 
                          ? 'Analyzing facial artifacts via MS-EffGCViT...'
                          : 'Sampling frames & analyzing synthesis via MS-EffGCViT...'}
                      </span>
                    </div>
                  )}

                  {/* Result Verdict Overlay Card */}
                  {scanResult && !isScanning && (
                    <div style={{
                      position: 'absolute',
                      bottom: '24px',
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '18px',
                      padding: '16px 24px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '24px',
                      boxShadow: '0 12px 35px rgba(29, 33, 56, 0.15)',
                      border: `1.5px solid ${scanResult.label === 'FAKE' ? '#FF4772' : '#10B981'}`,
                      zIndex: 30
                    }}>
                      <div>
                        <div style={{ fontSize: '10px', color: '#8E93B0', fontWeight: '800', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                          Model Decision ({mediaMode.toUpperCase()})
                        </div>
                        <div style={{
                          fontSize: '22px',
                          fontWeight: '900',
                          color: scanResult.label === 'FAKE' ? '#FF4772' : '#10B981'
                        }}>
                          {scanResult.label === 'FAKE' ? 'DEEPFAKE DETECTED' : 'AUTHENTIC / REAL'}
                        </div>
                      </div>

                      <div style={{ borderLeft: '1px solid #E2E6F3', paddingLeft: '20px' }}>
                        <div style={{ fontSize: '10px', color: '#8E93B0', fontWeight: '800' }}>
                          PROBABILITY
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#1D2138' }}>
                          {(scanResult.prob * 100).toFixed(1)}%
                        </div>
                      </div>

                      {scanResult.meta && (
                        <div style={{ borderLeft: '1px solid #E2E6F3', paddingLeft: '20px' }}>
                          <div style={{ fontSize: '10px', color: '#8E93B0', fontWeight: '800' }}>
                            FRAMES
                          </div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: '#1D2138' }}>
                            {scanResult.meta.num_sampled || scanResult.frames?.length || 0} / {scanResult.meta.total_frames || 0}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '10px' }}>
                        {scanResult.mediaType === 'video' && (
                          <button
                            onClick={() => navigate('/video-timeline', { state: { video_id: scanResult.videoId } })}
                            style={{
                              padding: '8px 14px',
                              backgroundColor: '#EFF1F7',
                              color: '#5854EE',
                              border: 'none',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '800',
                              cursor: 'pointer'
                            }}
                          >
                            Timeline View
                          </button>
                        )}
                        <button
                          onClick={() => forensicsSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                          style={{
                            padding: '8px 14px',
                            backgroundColor: 'rgba(88, 84, 238, 0.1)',
                            color: '#5854EE',
                            border: '1px solid rgba(88, 84, 238, 0.25)',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '800',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                          Forensic Deep Dive ↓
                        </button>
                        <button
                          onClick={() => executeScan(selectedFile, '서양인', mediaMode)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#5854EE',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          Re-scan
                        </button>
                        <button
                          onClick={handleResetScan}
                          style={{
                            padding: '8px 14px',
                            backgroundColor: '#EFF1F7',
                            color: '#1D2138',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          New File
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Ready to scan prompt if media loaded but not scanned */}
                  {!isScanning && !scanResult && (
                    <div style={{
                      position: 'absolute',
                      bottom: '24px',
                      display: 'flex',
                      gap: '12px',
                      zIndex: 30
                    }}>
                      <button
                        onClick={() => executeScan(selectedFile, '서양인', mediaMode)}
                        style={{
                          padding: '12px 28px',
                          backgroundColor: '#5854EE',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '14px',
                          fontSize: '14px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          boxShadow: '0 8px 22px rgba(88, 84, 238, 0.4)'
                        }}
                      >
                        Start {mediaMode === 'image' ? 'Image' : 'Video'} Scan
                      </button>
                      <button
                        onClick={handleResetScan}
                        style={{
                          padding: '12px 20px',
                          backgroundColor: '#FFFFFF',
                          color: '#8E93B0',
                          border: '1px solid #E2E6F3',
                          borderRadius: '14px',
                          fontSize: '14px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Hexagon Spatial Surface with Interactive Upload Zone */
                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  {/* Floating Vertical Toolbar */}
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    zIndex: 10,
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    boxShadow: '0 4px 16px rgba(66, 71, 112, 0.1)',
                    border: '1px solid rgba(226, 230, 243, 0.9)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '8px 6px'
                  }}>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5854EE', fontSize: '18px', fontWeight: 'bold', padding: '2px' }}
                      title={`Upload ${mediaMode === 'image' ? 'Image' : 'Video'}`}
                    >
                      +
                    </button>
                    <button
                      onClick={fetchStats}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5854EE', padding: '2px' }}
                      title="Refresh Stats"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                    </button>
                    <button
                      onClick={() => { setScanModalMode(mediaMode); setScanModalOpen(true); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5854EE', padding: '2px' }}
                      title="Scan Studio"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/></svg>
                    </button>
                  </div>

                  {/* Hexagon Matrix Background */}
                  <div style={{ flex: 1, paddingLeft: '50px', paddingBottom: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg
                      viewBox={`0 0 ${hexCols * hexWidth + 20} ${hexRows * hexHeight + 20}`}
                      style={{ width: '100%', height: '320px', opacity: 0.85 }}
                    >
                      {Array.from({ length: hexRows }).map((_, r) => (
                        <g key={r}>
                          {Array.from({ length: hexCols }).map((_, c) => {
                            const xOffset = (r % 2 === 1) ? hexWidth / 2 : 0;
                            const cx = c * hexWidth + xOffset + 12;
                            const cy = r * hexHeight + 12;
                            const color = getHexColor(r, c);

                            const points = [
                              [cx, cy - hexRadius * 0.95],
                              [cx + hexWidth * 0.48, cy - hexRadius * 0.48],
                              [cx + hexWidth * 0.48, cy + hexRadius * 0.48],
                              [cx, cy + hexRadius * 0.95],
                              [cx - hexWidth * 0.48, cy + hexRadius * 0.48],
                              [cx - hexWidth * 0.48, cy - hexRadius * 0.48]
                            ].map(pt => pt.join(',')).join(' ');

                            return (
                              <polygon
                                key={`${r}-${c}`}
                                points={points}
                                fill={color}
                                stroke="#FFFFFF"
                                strokeWidth="0.8"
                                style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}
                                onMouseEnter={() => setHoveredHex({ r, c, color })}
                                onMouseLeave={() => setHoveredHex(null)}
                              />
                            );
                          })}
                        </g>
                      ))}
                    </svg>
                  </div>

                  {/* Dropzone Overlay Prompt */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: 'rgba(255, 255, 255, 0.94)',
                      backdropFilter: 'blur(10px)',
                      padding: '24px 36px',
                      borderRadius: '20px',
                      border: '1px solid rgba(226, 230, 243, 0.9)',
                      boxShadow: '0 12px 36px rgba(66, 71, 112, 0.12)',
                      textAlign: 'center',
                      cursor: 'pointer',
                      zIndex: 15,
                      transition: 'transform 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translate(-50%, -52%)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%)'}
                  >
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(88, 84, 238, 0.1)',
                      color: '#5854EE',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px'
                    }}>
                      {mediaMode === 'image' ? (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      ) : (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                      )}
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#1D2138' }}>
                      Click or drop a {mediaMode === 'image' ? 'photo' : 'video'} to analyze
                    </div>
                    <div style={{ fontSize: '12px', color: '#8E93B0', marginTop: '4px' }}>
                      {mediaMode === 'image' 
                        ? 'Supports JPG, PNG, WEBP up to 20MB · Real PyTorch Model'
                        : 'Supports MP4, MOV, WEBM up to 100MB · Multi-frame PyTorch Inference'}
                    </div>
                  </div>

                  {/* Coordinate X-Axis numbers */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingLeft: '65px',
                    paddingRight: '15px',
                    fontSize: '10px',
                    fontWeight: '600',
                    color: '#A0A5BD',
                    borderTop: '1px solid #EFF1F7',
                    paddingTop: '6px'
                  }}>
                    {[0, 25, 50, 75, 100, 125, 150, 175].map(val => (
                      <span key={val}>{val}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Error Message banner */}
            {scanError && (
              <div style={{
                marginTop: '12px',
                padding: '10px 16px',
                backgroundColor: 'rgba(255, 71, 114, 0.08)',
                border: '1px solid rgba(255, 71, 114, 0.3)',
                borderRadius: '12px',
                color: '#FF4772',
                fontSize: '12px',
                fontWeight: '700'
              }}>
                {scanError}
              </div>
            )}
          </div>
        </div>

        {/* AI FORENSICS & DEEPFAKE EXPLORER — ADVANCED SCIENTIFIC INSPECTION */}
        <div
          ref={forensicsSectionRef}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            padding: '30px 36px',
            boxShadow: '0 10px 32px rgba(66, 71, 112, 0.06)',
            border: '1px solid rgba(226, 230, 243, 0.85)',
            marginTop: '28px',
            marginBottom: '28px',
            position: 'relative',
            transition: 'all 0.3s ease'
          }}
        >
          {/* Section Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                backgroundColor: 'rgba(88, 84, 238, 0.08)',
                borderRadius: '100px',
                color: '#5854EE',
                fontSize: '11px',
                fontWeight: '800',
                letterSpacing: '0.6px',
                textTransform: 'uppercase',
                marginBottom: '8px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#5854EE' }} />
                AI Forensics & Deepfake Explorer
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#1D2138', margin: 0, letterSpacing: '-0.4px' }}>
                Scientific Media Verification & Neural Activation Inspector
              </h2>
              <p style={{ fontSize: '13px', color: '#8E93B0', margin: '6px 0 0 0', fontWeight: '500' }}>
                Empirical interpretability powered by <strong>MS-EffGCViT-B0</strong> and <strong>YOLOv8n-Face</strong> · Authenticated PyTorch pipeline
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {scanResult && (
                <button
                  onClick={handleDownloadForensicReport}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 16px',
                    backgroundColor: '#EFF1F7',
                    border: '1px solid #E2E6F3',
                    borderRadius: '12px',
                    color: '#1D2138',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="Download Forensic Dossier JSON"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Export Dossier (.JSON)
                </button>
              )}
              {scanResult?.mediaType === 'image' && (
                <button
                  onClick={() => navigate('/image-heatmap', { state: { image_id: scanResult.id } })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 16px',
                    backgroundColor: 'rgba(88, 84, 238, 0.08)',
                    border: '1px solid rgba(88, 84, 238, 0.25)',
                    borderRadius: '12px',
                    color: '#5854EE',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  Full Heatmap Studio →
                </button>
              )}
              {scanResult?.mediaType === 'video' && (
                <button
                  onClick={() => navigate('/video-timeline', { state: { video_id: scanResult.videoId } })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 16px',
                    backgroundColor: 'rgba(88, 84, 238, 0.08)',
                    border: '1px solid rgba(88, 84, 238, 0.25)',
                    borderRadius: '12px',
                    color: '#5854EE',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  Timeline Studio →
                </button>
              )}
            </div>
          </div>

          {/* AI Decision & Uncertainty Spectrum Card */}
          {scanResult ? (
            <div style={{
              marginTop: '24px',
              padding: '22px 28px',
              backgroundColor: '#F8F9FD',
              borderRadius: '20px',
              border: '1px solid #E6E9F4',
              display: 'grid',
              gridTemplateColumns: 'minmax(240px, 1fr) minmax(280px, 1.3fr) minmax(240px, 1fr)',
              gap: '24px',
              alignItems: 'center'
            }}>
              {/* Col 1: Verdict & Subtitle */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#8E93B0', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                  AI Forensic Verdict
                </div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '900',
                  color: scanResult.prob >= 0.6 ? '#FF4772' : (scanResult.prob <= 0.4 ? '#10B981' : '#FF9B38'),
                  marginTop: '4px',
                  letterSpacing: '-0.3px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  {scanResult.prob >= 0.6 ? 'SYNTHETIC / FAKE' : (scanResult.prob <= 0.4 ? 'AUTHENTIC / REAL' : 'INCONCLUSIVE')}
                  <span style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '8px',
                    backgroundColor: scanResult.prob >= 0.6 ? 'rgba(255, 71, 114, 0.12)' : (scanResult.prob <= 0.4 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 155, 56, 0.12)'),
                    color: scanResult.prob >= 0.6 ? '#FF4772' : (scanResult.prob <= 0.4 ? '#10B981' : '#FF9B38'),
                    fontWeight: '800'
                  }}>
                    {scanResult.mediaType.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#525875', marginTop: '6px', lineHeight: '1.45' }}>
                  {scanResult.prob >= 0.6
                    ? 'High-frequency spectral & facial synthesis cues deviate significantly from authentic human baseline manifolds.'
                    : (scanResult.prob <= 0.4
                        ? 'Facial geometry, skin texture micro-gradients, and global context tokens conform to biological characteristics.'
                        : 'Ambiguous boundary region: feature attribution is near 0.5 decision threshold; manual expert audit advised.')}
                </div>
              </div>

              {/* Col 2: Epistemic Uncertainty Gauge */}
              <div style={{ borderLeft: '1px solid #E2E6F3', borderRight: '1px solid #E2E6F3', padding: '0 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#8E93B0', textTransform: 'uppercase' }}>
                    Probability vs Uncertainty Spectrum
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: '900', color: '#1D2138' }}>
                    {(scanResult.prob * 100).toFixed(1)}% Synthesis Likelihood
                  </span>
                </div>

                {/* 3-Zone Bar Track */}
                <div style={{ position: 'relative', height: '14px', borderRadius: '7px', overflow: 'hidden', display: 'flex', backgroundColor: '#E2E6F3' }}>
                  {/* Zone 1: Authentic (0 to 40%) */}
                  <div style={{ width: '40%', backgroundColor: '#10B981', opacity: 0.85 }} title="Authentic Zone (< 40%)" />
                  {/* Zone 2: Inconclusive (40% to 60%) */}
                  <div style={{ width: '20%', backgroundColor: '#FF9B38', opacity: 0.9 }} title="Equivocal Zone (40% - 60%)" />
                  {/* Zone 3: Synthetic (60% to 100%) */}
                  <div style={{ width: '40%', backgroundColor: '#FF4772', opacity: 0.9 }} title="Synthetic Deepfake Zone (> 60%)" />
                </div>

                {/* Needle Indicator */}
                <div style={{ position: 'relative', width: '100%', height: '10px' }}>
                  <div style={{
                    position: 'absolute',
                    left: `${Math.min(98, Math.max(2, scanResult.prob * 100))}%`,
                    top: '-4px',
                    transform: 'translateX(-50%)',
                    width: '0',
                    height: '0',
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderBottom: '8px solid #1D2138',
                    transition: 'left 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: '700', color: '#8E93B0', marginTop: '4px' }}>
                  <span style={{ color: '#10B981' }}>0% Authentic</span>
                  <span style={{ color: '#FF9B38' }}>40% — 60% Ambiguous</span>
                  <span style={{ color: '#FF4772' }}>100% Synthetic</span>
                </div>
              </div>

              {/* Col 3: Scientific Metric Triplets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E6E9F4' }}>
                  <span style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '700' }}>Sigmoid Probability (P)</span>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#1D2138' }}>{(scanResult.prob).toFixed(4)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E6E9F4' }}>
                  <span style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '700' }}>Face Conf (YOLOv8)</span>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#5854EE' }}>{(scanResult.faceConf).toFixed(1)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E6E9F4' }}>
                  <span style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '700' }}>Certainty Margin |P-0.5|</span>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#1D2138' }}>{(Math.abs(scanResult.prob - 0.5) * 200).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          ) : (
            /* Standby State: Architectural Overview & Quick Test Launchers */
            <div style={{
              marginTop: '24px',
              padding: '24px 32px',
              backgroundColor: '#F8F9FD',
              borderRadius: '20px',
              border: '1px dashed #D2D6E6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '24px',
              flexWrap: 'wrap'
            }}>
              <div style={{ maxWidth: '580px' }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#1D2138' }}>
                  AI Forensics Pipeline Standing By
                </div>
                <div style={{ fontSize: '12px', color: '#8E93B0', marginTop: '4px', lineHeight: '1.5' }}>
                  Upload a photo or video above, or load an authenticated benchmark sample to explore neural activation heatmaps, YOLOv8 face landmarks, and deep spectral artifact signals.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => loadSample(SAMPLE_IMAGES[0], 'image')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E6F3',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#FF4772',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FF4772'; e.currentTarget.style.backgroundColor = 'rgba(255, 71, 114, 0.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E6F3'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  Western Fake Sample
                </button>
                <button
                  onClick={() => loadSample(SAMPLE_IMAGES[1], 'image')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E6F3',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#FF4772',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FF4772'; e.currentTarget.style.backgroundColor = 'rgba(255, 71, 114, 0.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E6F3'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  Asian Fake Sample
                </button>
                <button
                  onClick={() => loadSample(SAMPLE_VIDEOS[1], 'video')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E6F3',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#10B981',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#10B981'; e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E6F3'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  Authentic Video Sample
                </button>
              </div>
            </div>
          )}

          {/* Interactive Navigation Tabs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderBottom: '1px solid #EFF1F7',
            paddingBottom: '14px',
            marginTop: '26px',
            marginBottom: '22px',
            overflowX: 'auto'
          }}>
            {[
              {
                id: 'evidence',
                label: 'Visual Evidence & CAM Heatmap',
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                )
              },
              {
                id: 'signals',
                label: 'Biometric & Synthesis Signals',
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                )
              },
              ...(scanResult?.mediaType === 'video' ? [{
                id: 'timeline',
                label: `Video Timeline (${scanResult.frames?.length || 0} Frames)`,
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                )
              }] : []),
              {
                id: 'architecture',
                label: 'Neural Architecture Inspection',
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                    <rect x="9" y="9" width="6" height="6" />
                    <line x1="9" y1="1" x2="9" y2="4" />
                    <line x1="15" y1="1" x2="15" y2="4" />
                    <line x1="9" y1="20" x2="9" y2="23" />
                    <line x1="15" y1="20" x2="15" y2="23" />
                    <line x1="20" y1="9" x2="23" y2="9" />
                    <line x1="20" y1="14" x2="23" y2="14" />
                    <line x1="1" y1="9" x2="4" y2="9" />
                    <line x1="1" y1="14" x2="4" y2="14" />
                  </svg>
                )
              },
              {
                id: 'report',
                label: 'Forensic Synthesis & Scientific Limits',
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                )
              }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setForensicsTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  backgroundColor: forensicsTab === tab.id ? '#5854EE' : '#F8F9FD',
                  color: forensicsTab === tab.id ? '#FFFFFF' : '#6A6F8A',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: forensicsTab === tab.id ? '0 4px 14px rgba(88, 84, 238, 0.28)' : 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: VISUAL EVIDENCE & CAM HEATMAP */}
          {forensicsTab === 'evidence' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(280px, 0.8fr)',
              gap: '26px',
              animation: 'fadeIn 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
              {/* Left Column: Multi-Layer Media Viewer */}
              <div style={{
                backgroundColor: '#F8F9FD',
                borderRadius: '20px',
                border: '1px solid #E6E9F4',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Viewer Layer Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '6px', backgroundColor: '#FFFFFF', padding: '4px', borderRadius: '12px', border: '1px solid #E6E9F4' }}>
                    <button
                      onClick={() => setForensicsLayer('raw')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: forensicsLayer === 'raw' ? '#5854EE' : 'transparent',
                        color: forensicsLayer === 'raw' ? '#FFFFFF' : '#8E93B0',
                        fontSize: '11px',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      Raw Media
                    </button>
                    <button
                      onClick={() => setForensicsLayer('bbox')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: forensicsLayer === 'bbox' ? '#5854EE' : 'transparent',
                        color: forensicsLayer === 'bbox' ? '#FFFFFF' : '#8E93B0',
                        fontSize: '11px',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      YOLOv8 Biometrics
                    </button>
                    <button
                      onClick={() => setForensicsLayer('cam')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: forensicsLayer === 'cam' ? '#5854EE' : 'transparent',
                        color: forensicsLayer === 'cam' ? '#FFFFFF' : '#8E93B0',
                        fontSize: '11px',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      Grad-CAM Activation
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => setViewFocus(prev => prev === 'whole' ? 'face_crop' : 'whole')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E6F3',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#1D2138',
                        cursor: 'pointer',
                        transition: 'all 0.18s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = '#5854EE'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = '#E2E6F3'}
                    >
                      {viewFocus === 'whole' ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            <line x1="11" y1="8" x2="11" y2="14" />
                            <line x1="8" y1="11" x2="14" y2="11" />
                          </svg>
                          Zoom Face Region
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="1 4 1 10 7 10" />
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                          </svg>
                          Whole Frame
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Media Canvas Stage with Overlays */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  minHeight: '340px',
                  backgroundColor: '#0E111E',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {/* Base Image or Video */}
                  {mediaPreview ? (
                    mediaMode === 'image' ? (
                      <img
                        src={mediaPreview}
                        alt="Evidence View"
                        style={{
                          maxHeight: '340px',
                          maxWidth: '100%',
                          objectFit: 'contain',
                          transform: viewFocus === 'face_crop' ? 'scale(1.8)' : 'scale(1)',
                          transition: 'transform 0.3s ease'
                        }}
                      />
                    ) : (
                      <video
                        src={mediaPreview}
                        controls
                        style={{
                          maxHeight: '340px',
                          maxWidth: '100%',
                          objectFit: 'contain'
                        }}
                      />
                    )
                  ) : (
                    <div style={{ color: '#8E93B0', fontSize: '13px', fontWeight: '600' }}>
                      No media loaded. Scan an image or video to inspect.
                    </div>
                  )}

                  {/* LAYER: YOLOv8 Bounding Box & 68 Landmarks */}
                  {forensicsLayer === 'bbox' && scanResult && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      pointerEvents: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {/* Bounding Box Frame */}
                      <div style={{
                        position: 'relative',
                        width: `${Math.min(75, Math.max(30, Math.sqrt(scanResult.faceRatio || 16) * 9))}%`,
                        height: `${Math.min(80, Math.max(36, Math.sqrt(scanResult.faceRatio || 16) * 11))}%`,
                        border: '2px solid #5854EE',
                        borderRadius: '8px',
                        boxShadow: '0 0 0 1px rgba(88,84,238,0.4), inset 0 0 16px rgba(88,84,238,0.15)',
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}>
                        {/* Corner Target Crosshairs */}
                        <div style={{ position: 'absolute', top: '-4px', left: '-4px', width: '12px', height: '12px', borderTop: '3px solid #5854EE', borderLeft: '3px solid #5854EE' }} />
                        <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '12px', height: '12px', borderTop: '3px solid #5854EE', borderRight: '3px solid #5854EE' }} />
                        <div style={{ position: 'absolute', bottom: '-4px', left: '-4px', width: '12px', height: '12px', borderBottom: '3px solid #5854EE', borderLeft: '3px solid #5854EE' }} />
                        <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '12px', height: '12px', borderBottom: '3px solid #5854EE', borderRight: '3px solid #5854EE' }} />

                        {/* Top Tag */}
                        <div style={{
                          position: 'absolute',
                          top: '-26px',
                          left: '0',
                          backgroundColor: '#5854EE',
                          color: '#FFFFFF',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: '800',
                          whiteSpace: 'nowrap'
                        }}>
                          YOLOv8-Face: {(scanResult.faceConf).toFixed(1)}% · 68 Landmarks
                        </div>

                        {/* Landmark Biometric Vector Anchors */}
                        <div style={{ position: 'absolute', top: '35%', left: '30%', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#00E5FF', boxShadow: '0 0 8px #00E5FF, 0 0 14px rgba(0, 229, 255, 0.4)', animation: 'pulseGlow 2.4s ease-in-out infinite' }} title="Left Eye Orbit" />
                        <div style={{ position: 'absolute', top: '35%', right: '30%', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#00E5FF', boxShadow: '0 0 8px #00E5FF, 0 0 14px rgba(0, 229, 255, 0.4)', animation: 'pulseGlow 2.4s ease-in-out infinite' }} title="Right Eye Orbit" />
                        <div style={{ position: 'absolute', top: '55%', left: '50%', transform: 'translateX(-50%)', width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#00E5FF', boxShadow: '0 0 6px #00E5FF', animation: 'pulseGlow 2.4s ease-in-out infinite' }} title="Nose Bridge" />
                        <div style={{ position: 'absolute', top: '75%', left: '50%', transform: 'translateX(-50%)', width: '16px', height: '4px', borderRadius: '2px', backgroundColor: '#00E5FF', opacity: 0.85, boxShadow: '0 0 6px #00E5FF' }} title="Mouth Landmark Anchor" />
                      </div>
                    </div>
                  )}

                  {/* LAYER: Grad-CAM Activation Heatmap */}
                  {forensicsLayer === 'cam' && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(0,0,0,0.6)'
                    }}>
                      {(camResultUrl || frameCamUrl) ? (
                        <img
                          src={mediaMode === 'image' ? camResultUrl : (frameCamUrl || camResultUrl)}
                          alt="Neural Activation Map"
                          style={{
                            maxHeight: '340px',
                            maxWidth: '100%',
                            objectFit: 'contain',
                            borderRadius: '12px'
                          }}
                        />
                      ) : (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#FFFFFF' }}>
                          <div style={{ fontSize: '14px', fontWeight: '800', marginBottom: '8px' }}>
                            Activation Map Not Yet Computed
                          </div>
                          <div style={{ fontSize: '12px', color: '#A0A5BD', maxWidth: '320px', margin: '0 auto 16px' }}>
                            Click below to execute forward-backward PyTorch tensor pass and extract attention weights via {camSettings.explainerType}.
                          </div>
                          <button
                            onClick={() => mediaMode === 'image' ? handleGenerateImageCam() : handleGenerateFrameCam(selectedFrameIndex)}
                            disabled={isGeneratingCam || isGeneratingFrameCam}
                            style={{
                              padding: '10px 22px',
                              backgroundColor: '#5854EE',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '12px',
                              fontSize: '13px',
                              fontWeight: '800',
                              cursor: 'pointer',
                              boxShadow: '0 6px 20px rgba(88, 84, 238, 0.4)'
                            }}
                          >
                            {isGeneratingCam || isGeneratingFrameCam ? 'Computing in PyTorch...' : 'Compute Activation Map Now'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Notes on Media Viewer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '11px', color: '#8E93B0', fontWeight: '600' }}>
                  <span>Receptive Field: 224x224 RGB Normalized</span>
                  <span>Active Layer: {forensicsLayer.toUpperCase()}</span>
                </div>
              </div>

              {/* Right Column: CAM Explainer Settings & Controls */}
              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '20px',
                border: '1px solid #E6E9F4',
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px'
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#1D2138' }}>
                    Neural Interpretability Engine (XAI)
                  </div>
                  <div style={{ fontSize: '12px', color: '#8E93B0', marginTop: '3px' }}>
                    Select algorithm to backpropagate gradients through MS-EffGCViT tokens.
                  </div>
                </div>

                {/* Algorithm Choice */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#525875', textTransform: 'uppercase' }}>
                    CAM Method
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '6px' }}>
                    {[
                      { id: 'eigengradcam', label: 'EigenGradCAM', desc: 'Global ViT Tokens' },
                      { id: 'hirescam', label: 'HiResCAM', desc: 'Pixel-Level Edges' },
                      { id: 'gradcamplusplus', label: 'GradCAM++', desc: 'Multi-Region Cues' }
                    ].map(alg => (
                      <button
                        key={alg.id}
                        onClick={() => setCamSettings(prev => ({
                          ...prev,
                          explainerType: alg.id,
                          branchLevel: alg.id === 'hirescam' ? 'low' : 'high'
                        }))}
                        style={{
                          padding: '10px 8px',
                          borderRadius: '12px',
                          border: camSettings.explainerType === alg.id ? '2px solid #5854EE' : '1px solid #E2E6F3',
                          backgroundColor: camSettings.explainerType === alg.id ? 'rgba(88, 84, 238, 0.06)' : '#FFFFFF',
                          color: '#1D2138',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ fontSize: '12px', fontWeight: '800' }}>{alg.label}</div>
                        <div style={{ fontSize: '10px', color: '#8E93B0', marginTop: '2px' }}>{alg.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Branch Choice */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#525875', textTransform: 'uppercase' }}>
                    Network Branch Target
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                    <button
                      onClick={() => setCamSettings(prev => ({ ...prev, branchLevel: 'high' }))}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '10px',
                        border: camSettings.branchLevel === 'high' ? '2px solid #5854EE' : '1px solid #E2E6F3',
                        backgroundColor: camSettings.branchLevel === 'high' ? 'rgba(88, 84, 238, 0.08)' : '#FFFFFF',
                        color: '#1D2138',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      HIGH (ViT Attention)
                    </button>
                    <button
                      onClick={() => setCamSettings(prev => ({ ...prev, branchLevel: 'low' }))}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '10px',
                        border: camSettings.branchLevel === 'low' ? '2px solid #5854EE' : '1px solid #E2E6F3',
                        backgroundColor: camSettings.branchLevel === 'low' ? 'rgba(88, 84, 238, 0.08)' : '#FFFFFF',
                        color: '#1D2138',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      LOW (MBConv Texture)
                    </button>
                  </div>
                </div>

                {/* Sliders: Overlay Ratio & Threshold */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', color: '#525875' }}>
                      <span>Overlay Ratio (Opacity)</span>
                      <span>{Math.round(camSettings.overlayRatio * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="1.0"
                      step="0.05"
                      value={camSettings.overlayRatio}
                      onChange={(e) => setCamSettings(prev => ({ ...prev, overlayRatio: parseFloat(e.target.value) }))}
                      style={{ width: '100%', marginTop: '6px', accentColor: '#5854EE' }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', color: '#525875' }}>
                      <span>Contour Threshold</span>
                      <span>{Math.round(camSettings.threshold * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="1.0"
                      step="0.05"
                      value={camSettings.threshold}
                      onChange={(e) => setCamSettings(prev => ({ ...prev, threshold: parseFloat(e.target.value) }))}
                      style={{ width: '100%', marginTop: '6px', accentColor: '#5854EE' }}
                    />
                  </div>
                </div>

                {/* Error Banner */}
                {camError && (
                  <div style={{ padding: '8px 12px', backgroundColor: 'rgba(255, 71, 114, 0.08)', borderRadius: '10px', color: '#FF4772', fontSize: '11px', fontWeight: '700' }}>
                    {camError}
                  </div>
                )}

                {/* Execute Button */}
                <button
                  onClick={() => mediaMode === 'image' ? handleGenerateImageCam() : handleGenerateFrameCam(selectedFrameIndex)}
                  disabled={!scanResult || isGeneratingCam || isGeneratingFrameCam}
                  style={{
                    padding: '12px',
                    backgroundColor: '#5854EE',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: scanResult ? 'pointer' : 'not-allowed',
                    opacity: scanResult ? 1 : 0.6,
                    boxShadow: '0 6px 18px rgba(88, 84, 238, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {(isGeneratingCam || isGeneratingFrameCam) ? (
                    <>
                      <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #FFFFFF', borderRadius: '50%', animation: 'rotateSlow 0.8s linear infinite' }} />
                      Computing PyTorch Gradients...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      Generate {camSettings.explainerType.toUpperCase()} Map
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: BIOMETRIC & SYNTHESIS SIGNALS */}
          {forensicsTab === 'signals' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '20px',
              animation: 'fadeIn 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
              {/* Card 1: Face Detection Confidence */}
              <div
                style={{
                  backgroundColor: '#F8F9FD',
                  borderRadius: '18px',
                  padding: '22px',
                  border: '1px solid #E6E9F4',
                  transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(66, 71, 112, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(88, 84, 238, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = '#E6E9F4';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: 'rgba(88, 84, 238, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5854EE' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/></svg>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#8E93B0', textTransform: 'uppercase' }}>
                      YOLOv8 Extraction
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: (scanResult?.faceConf || 0) >= 80 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 155, 56, 0.12)',
                    color: (scanResult?.faceConf || 0) >= 80 ? '#10B981' : '#FF9B38',
                    fontWeight: '800'
                  }}>
                    {(scanResult?.faceConf || 0) >= 80 ? 'Optimal' : 'Acceptable'}
                  </span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: '900', color: '#1D2138', marginTop: '10px' }}>
                  {(scanResult?.faceConf !== undefined && scanResult.faceConf >= 0 ? scanResult.faceConf : 0).toFixed(1)}%
                </div>
                <div style={{ fontSize: '12px', color: '#525875', marginTop: '8px', lineHeight: '1.45' }}>
                  Confidence of decoupled bounding box extraction and 68 landmark point alignment. Ensures zero synthetic distortion from background noise.
                </div>
              </div>

              {/* Card 2: Spatial Area Coverage */}
              <div
                style={{
                  backgroundColor: '#F8F9FD',
                  borderRadius: '18px',
                  padding: '22px',
                  border: '1px solid #E6E9F4',
                  transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(66, 71, 112, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(88, 84, 238, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = '#E6E9F4';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: 'rgba(255, 155, 56, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF9B38' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#8E93B0', textTransform: 'uppercase' }}>
                      Face Area Ratio
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: (scanResult?.faceRatio || 0) >= 10 ? 'rgba(88, 84, 238, 0.12)' : 'rgba(255, 155, 56, 0.12)',
                    color: (scanResult?.faceRatio || 0) >= 10 ? '#5854EE' : '#FF9B38',
                    fontWeight: '800'
                  }}>
                    {(scanResult?.faceRatio || 0) >= 10 ? 'High Density' : 'Marginal Size'}
                  </span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: '900', color: '#1D2138', marginTop: '10px' }}>
                  {(scanResult?.faceRatio !== undefined && scanResult.faceRatio >= 0 ? scanResult.faceRatio : 0).toFixed(1)}%
                </div>
                <div style={{ fontSize: '12px', color: '#525875', marginTop: '8px', lineHeight: '1.45' }}>
                  Percentage of total image pixels occupied by facial region. Adequate coverage guarantees sufficient resolution for high-frequency token extraction.
                </div>
              </div>

              {/* Card 3: Luminance & Dynamic Range */}
              <div
                style={{
                  backgroundColor: '#F8F9FD',
                  borderRadius: '18px',
                  padding: '22px',
                  border: '1px solid #E6E9F4',
                  transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(66, 71, 112, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(88, 84, 238, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = '#E6E9F4';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#8E93B0', textTransform: 'uppercase' }}>
                      Luminance Index
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(88, 84, 238, 0.12)',
                    color: '#5854EE',
                    fontWeight: '800'
                  }}>
                    Mean Grayscale
                  </span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: '900', color: '#1D2138', marginTop: '10px' }}>
                  {(scanResult?.faceBrightness !== undefined && scanResult.faceBrightness >= 0 ? scanResult.faceBrightness : 0).toFixed(1)}%
                </div>
                <div style={{ fontSize: '12px', color: '#525875', marginTop: '8px', lineHeight: '1.45' }}>
                  Mean pixel luminance across cropped facial patch. Evaluates illumination homogeneity to avoid contrast-induced false gradients.
                </div>
              </div>

              {/* Card 4: Neural Anomaly Risk */}
              <div
                style={{
                  backgroundColor: '#F8F9FD',
                  borderRadius: '18px',
                  padding: '22px',
                  border: '1px solid #E6E9F4',
                  transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(66, 71, 112, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(88, 84, 238, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = '#E6E9F4';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: 'rgba(255, 71, 114, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF4772' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#8E93B0', textTransform: 'uppercase' }}>
                      Synthesis Anomaly Score
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: (scanResult?.prob || 0) >= 0.6 ? 'rgba(255, 71, 114, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                    color: (scanResult?.prob || 0) >= 0.6 ? '#FF4772' : '#10B981',
                    fontWeight: '800'
                  }}>
                    {(scanResult?.prob || 0) >= 0.6 ? 'High Risk' : 'Low Risk'}
                  </span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: '900', color: (scanResult?.prob || 0) >= 0.6 ? '#FF4772' : '#10B981', marginTop: '10px' }}>
                  {((scanResult?.prob || 0) * 10).toFixed(2)} / 10
                </div>
                <div style={{ fontSize: '12px', color: '#525875', marginTop: '8px', lineHeight: '1.45' }}>
                  Scaled anomaly divergence from authentic human feature space, derived directly from the sigmoid classification logit.
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VIDEO TEMPORAL TIMELINE (when video) */}
          {forensicsTab === 'timeline' && scanResult?.mediaType === 'video' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              animation: 'fadeIn 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
              {/* Meta bar */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '14px 20px',
                backgroundColor: '#F8F9FD',
                borderRadius: '14px',
                border: '1px solid #E6E9F4',
                fontSize: '12px',
                fontWeight: '700',
                color: '#1D2138',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <span>FPS: <strong>{scanResult.meta?.fps || '25.0'}</strong></span>
                <span>Total Video Frames: <strong>{scanResult.meta?.total_frames || scanResult.frames?.length || 0}</strong></span>
                <span>Sampled Evaluation Frames: <strong>{scanResult.frames?.length || scanResult.meta?.num_sampled || 0}</strong></span>
                <span>Detected Face Frames: <strong>{scanResult.meta?.num_detected || scanResult.frames?.length || 0}</strong></span>
              </div>

              {/* Sparkline Bar Chart of Frame Scores */}
              <div style={{
                backgroundColor: '#F8F9FD',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid #E6E9F4'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#525875', textTransform: 'uppercase' }}>
                    Temporal Frame-by-Frame Anomaly Timeline
                  </span>
                  <span style={{ fontSize: '11px', color: '#8E93B0' }}>
                    Click any frame to inspect specific activation
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', height: '90px', gap: '4px' }}>
                  {(scanResult.frames || []).map((frame, fIdx) => {
                    const isSelected = selectedFrameIndex === fIdx;
                    const fScore = frame.score !== undefined ? frame.score : 0;
                    const fColor = fScore >= 0.6 ? '#FF4772' : (fScore <= 0.4 ? '#10B981' : '#FF9B38');
                    const barHeightPct = Math.max(12, fScore * 100);

                    return (
                      <div
                        key={fIdx}
                        onClick={() => setSelectedFrameIndex(fIdx)}
                        style={{
                          flex: 1,
                          height: `${barHeightPct}%`,
                          backgroundColor: fColor,
                          borderRadius: '4px 4px 0 0',
                          cursor: 'pointer',
                          position: 'relative',
                          opacity: isSelected ? 1 : 0.65,
                          transform: isSelected ? 'scaleY(1.08)' : 'scaleY(1)',
                          transition: 'all 0.15s ease'
                        }}
                        title={`Frame #${frame.frame_index} · Time: ${frame.frame_time?.toFixed(2)}s · Score: ${(fScore * 100).toFixed(1)}%`}
                      >
                        {isSelected && (
                          <div style={{
                            position: 'absolute',
                            top: '-8px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: '#1D2138'
                          }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selected Frame Detail Strip */}
              {scanResult.frames && scanResult.frames[selectedFrameIndex] && (
                <div style={{
                  padding: '18px 24px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1.5px solid #5854EE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#5854EE', textTransform: 'uppercase' }}>
                      Selected Keyframe #{scanResult.frames[selectedFrameIndex].frame_index}
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: '900', color: '#1D2138', marginTop: '2px' }}>
                      Time Offset: {scanResult.frames[selectedFrameIndex].frame_time?.toFixed(2)}s · Score: {((scanResult.frames[selectedFrameIndex].score || 0) * 100).toFixed(1)}%
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '20px', fontSize: '12px' }}>
                    <div>
                      <div style={{ color: '#8E93B0', fontWeight: '700' }}>Face Confidence</div>
                      <div style={{ fontWeight: '800', color: '#1D2138' }}>{((scanResult.frames[selectedFrameIndex].face_conf || 0)).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div style={{ color: '#8E93B0', fontWeight: '700' }}>Luminance</div>
                      <div style={{ fontWeight: '800', color: '#1D2138' }}>{((scanResult.frames[selectedFrameIndex].face_brightness || 0)).toFixed(1)}%</div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleGenerateFrameCam(selectedFrameIndex)}
                    disabled={isGeneratingFrameCam}
                    style={{
                      padding: '10px 18px',
                      backgroundColor: '#5854EE',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    {isGeneratingFrameCam ? 'Generating Frame CAM...' : 'Generate Frame Heatmap'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: NEURAL ARCHITECTURE INSPECTION */}
          {forensicsTab === 'architecture' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
              animation: 'fadeIn 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
              {/* Primary Classifier Model Card */}
              <div
                style={{
                  backgroundColor: '#F8F9FD',
                  borderRadius: '20px',
                  padding: '24px',
                  border: '1px solid #E6E9F4',
                  transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(66, 71, 112, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(88, 84, 238, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = '#E6E9F4';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: 'rgba(88, 84, 238, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5854EE' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#5854EE', textTransform: 'uppercase' }}>
                      Primary Deepfake Classifier
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(88,84,238,0.1)', color: '#5854EE', fontWeight: '800' }}>
                    PyTorch Core
                  </span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#1D2138', margin: '8px 0 4px 0' }}>
                  MS-EffGCViT-B0
                </h3>
                <p style={{ fontSize: '12px', color: '#8E93B0', margin: 0 }}>
                  Multi-Scale Efficient Global Context Vision Transformer
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid #EFF1F7', paddingBottom: '6px' }}>
                    <span style={{ color: '#8E93B0', fontWeight: '600' }}>CNN Backbone</span>
                    <span style={{ fontWeight: '800', color: '#1D2138' }}>EfficientNet-B0 (MBConv + SE)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid #EFF1F7', paddingBottom: '6px' }}>
                    <span style={{ color: '#8E93B0', fontWeight: '600' }}>Transformer Blocks</span>
                    <span style={{ fontWeight: '800', color: '#1D2138' }}>Global Context ViT (Local + Global Query)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid #EFF1F7', paddingBottom: '6px' }}>
                    <span style={{ color: '#8E93B0', fontWeight: '600' }}>Parameters</span>
                    <span style={{ fontWeight: '800', color: '#1D2138' }}>8.70M Float32</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid #EFF1F7', paddingBottom: '6px' }}>
                    <span style={{ color: '#8E93B0', fontWeight: '600' }}>GFLOPs</span>
                    <span style={{ fontWeight: '800', color: '#1D2138' }}>0.85 GFLOPs</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#8E93B0', fontWeight: '600' }}>Celeb-DF v2 Accuracy</span>
                    <span style={{ fontWeight: '800', color: '#10B981' }}>98.4% (AUC: 99.7%)</span>
                  </div>
                </div>
              </div>

              {/* Preprocessor Detector Card */}
              <div
                style={{
                  backgroundColor: '#F8F9FD',
                  borderRadius: '20px',
                  padding: '24px',
                  border: '1px solid #E6E9F4',
                  transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(66, 71, 112, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(88, 84, 238, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = '#E6E9F4';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: 'rgba(88, 84, 238, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5854EE' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/></svg>
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#5854EE', textTransform: 'uppercase' }}>
                      Biometric Preprocessor
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(88,84,238,0.1)', color: '#5854EE', fontWeight: '800' }}>
                    Ultralytics
                  </span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#1D2138', margin: '8px 0 4px 0' }}>
                  YOLOv8n-Face
                </h3>
                <p style={{ fontSize: '12px', color: '#8E93B0', margin: 0 }}>
                  Decoupled Anchor-Free Face Localization Engine
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid #EFF1F7', paddingBottom: '6px' }}>
                    <span style={{ color: '#8E93B0', fontWeight: '600' }}>Backbone Architecture</span>
                    <span style={{ fontWeight: '800', color: '#1D2138' }}>CSPDarknet with C2f modules</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid #EFF1F7', paddingBottom: '6px' }}>
                    <span style={{ color: '#8E93B0', fontWeight: '600' }}>Landmark Engine</span>
                    <span style={{ fontWeight: '800', color: '#1D2138' }}>68-Point Facial Keypoint Validator</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid #EFF1F7', paddingBottom: '6px' }}>
                    <span style={{ color: '#8E93B0', fontWeight: '600' }}>Parameters</span>
                    <span style={{ fontWeight: '800', color: '#1D2138' }}>3.2M params</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid #EFF1F7', paddingBottom: '6px' }}>
                    <span style={{ color: '#8E93B0', fontWeight: '600' }}>Confidence Filter</span>
                    <span style={{ fontWeight: '800', color: '#1D2138' }}>Threshold &ge; 0.50</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#8E93B0', fontWeight: '600' }}>Bounding Margin</span>
                    <span style={{ fontWeight: '800', color: '#5854EE' }}>+20% Adaptive padding</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: FORENSIC SYNTHESIS REPORT & LIMITS */}
          {forensicsTab === 'report' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '22px',
              animation: 'fadeIn 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
              {/* Natural Language Forensic Synthesis */}
              <div style={{
                backgroundColor: '#F8F9FD',
                borderRadius: '18px',
                padding: '24px',
                border: '1px solid #E6E9F4'
              }}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#5854EE', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                  Automated Forensic Synthesis
                </div>
                <div style={{ fontSize: '14px', lineHeight: '1.65', color: '#1D2138', fontWeight: '600' }}>
                  {scanResult ? (
                    <>
                      Media item <strong>#{scanResult.id}</strong> ({scanResult.mediaType.toUpperCase()}) was evaluated through the dual-stage verification pipeline. 
                      YOLOv8 detected facial landmarks with <strong>{(scanResult.faceConf).toFixed(1)}%</strong> localization confidence covering <strong>{(scanResult.faceRatio).toFixed(1)}%</strong> of canvas area.
                      Subsequent tensor inference across MS-EffGCViT-B0 produced a raw sigmoid probability of <strong>{(scanResult.prob).toFixed(4)}</strong>, yielding an epistemic verdict of{' '}
                      <span style={{ color: scanResult.prob >= 0.6 ? '#FF4772' : (scanResult.prob <= 0.4 ? '#10B981' : '#FF9B38'), fontWeight: '900' }}>
                        {scanResult.prob >= 0.6 ? 'SYNTHETIC / DEEPFAKE' : (scanResult.prob <= 0.4 ? 'AUTHENTIC / REAL' : 'INCONCLUSIVE')}
                      </span>{' '}
                      with a certainty margin of <strong>{(Math.abs(scanResult.prob - 0.5) * 200).toFixed(1)}%</strong> from the decision boundary.
                    </>
                  ) : (
                    "No media scan executed in current session. Run an analysis above to generate a formal forensic report."
                  )}
                </div>
              </div>

              {/* Transparent Scientific Limitations & Boundaries */}
              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '18px',
                padding: '24px',
                border: '1px solid #E2E6F3'
              }}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#FF9B38', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  Scientific Boundaries & Operational Limitations
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', fontSize: '12px', color: '#525875', lineHeight: '1.5' }}>
                  <div>
                    <strong style={{ color: '#1D2138' }}>1. Video Compression Artifacts:</strong>
                    <p style={{ margin: '4px 0 0 0' }}>
                      Heavy H.264 / H.265 compression (quantization parameter &gt; 23) can soften fine facial pixel boundaries, which may artificially attenuate localized Grad-CAM heatmaps.
                    </p>
                  </div>
                  <div>
                    <strong style={{ color: '#1D2138' }}>2. Domain Generalization Boundaries:</strong>
                    <p style={{ margin: '4px 0 0 0' }}>
                      Models trained predominantly on Western benchmarks (Celeb-DF, FF++) vs Asian benchmarks (KoDF) maintain high generalization but may exhibit slight distribution shifts on novel capture sensors.
                    </p>
                  </div>
                  <div>
                    <strong style={{ color: '#1D2138' }}>3. Non-Decisive Legal Standard:</strong>
                    <p style={{ margin: '4px 0 0 0' }}>
                      Deepfake neural classifications provide probabilistic evidence and should be corroborated with cryptographic signatures and origin metadata for formal legal testimony.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Wide Strip Card: Real Detection Figures & Distribution */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '18px 28px',
          boxShadow: '0 8px 24px rgba(66, 71, 112, 0.04)',
          border: '1px solid rgba(226, 230, 243, 0.8)',
          display: 'flex',
          alignItems: 'center',
          gap: '30px'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: '#8E93B0', fontWeight: '700' }}>Total Model Scans</div>
            <div style={{ fontSize: '19px', fontWeight: '900', color: '#1D2138', marginTop: '2px' }}>
              {systemStats.totalScans} verified
            </div>
          </div>

          {/* Segmented Real Detection Distribution Strip */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', height: '26px', gap: '3px' }}>
            {Array.from({ length: 80 }).map((_, idx) => {
              const fakeRatio = systemStats.totalScans > 0 ? (systemStats.fakeCount / systemStats.totalScans) : 0;
              const fakeThresholdIdx = Math.round(fakeRatio * 80);
              const isFakeSegment = systemStats.totalScans > 0 && idx < fakeThresholdIdx;
              const heightPct = 25 + Math.sin(idx * 0.3) * 20 + ((idx % 7) * 8);
              const segmentBg = systemStats.totalScans === 0 ? '#E2E6F3' : (isFakeSegment ? '#FFA2B6' : '#AEAFFD');

              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    height: `${Math.min(100, Math.max(15, heightPct))}%`,
                    backgroundColor: segmentBg,
                    borderRadius: '2px',
                    position: 'relative'
                  }}
                >
                  {systemStats.totalScans > 0 && idx === 0 && (
                    <div style={{
                      position: 'absolute',
                      bottom: '-6px',
                      left: 0,
                      width: `${Math.max(40, fakeThresholdIdx * 8)}px`,
                      height: '3px',
                      backgroundColor: '#FF4772',
                      borderRadius: '2px'
                    }} />
                  )}
                  {systemStats.totalScans > 0 && idx === fakeThresholdIdx && (
                    <div style={{
                      position: 'absolute',
                      bottom: '-6px',
                      left: 0,
                      width: `${Math.max(40, (80 - fakeThresholdIdx) * 8)}px`,
                      height: '3px',
                      backgroundColor: '#5854EE',
                      borderRadius: '2px'
                    }} />
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', fontWeight: '700' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#FF4772' }} />
              <span style={{ color: '#1D2138' }}>Fake: {systemStats.fakeCount}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#5854EE' }} />
              <span style={{ color: '#1D2138' }}>Real: {systemStats.realCount}</span>
            </div>
          </div>
        </div>
      </main>

      {/* Universal Bottom Footer */}
      <Footer />

      {/* Interactive Scan Modal */}
      <ScanModal
        isOpen={scanModalOpen}
        onClose={() => { setScanModalOpen(false); fetchStats(); }}
        initialMode={scanModalMode}
        sessionUser={sessionUser}
      />
    </div>
  );
};

export default OverviewPage;
