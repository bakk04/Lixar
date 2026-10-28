import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';

// 4 Reference Screens
import OverviewPage from './pages/OverviewPage';
import PipelineAnalyticsPage from './pages/PipelineAnalyticsPage';
import DashboardPage from './pages/DashboardPage';
import StatisticsPage from './pages/StatisticsPage';

// Scanning & Detail Workflows
import AnalysisPage from './pages/analysispage';
import VideoAnalysisPage from './pages/VideoAnalysisPage';
import AnalysisDetailPage from './pages/AnalysisDetailPage';
import VideoTimelinePage from './pages/VideoTimelinePage';
import HeatmapPage from './pages/HeatmapPage';
import ImageHeatmapPage from './pages/ImageHeatmapPage';

// Auth Pages
import LoginPage from './pages/loginpage';
import RegisterPage from './pages/signuppage';

function App() {
  const [sessionUser, setSessionUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await axios.get('/auth/check');
        if (response.data && response.data.user) {
          setSessionUser(response.data.user);
        }
      } catch (error) {
        setSessionUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const handleLogout = () => {
    setSessionUser(null);
  };

  if (loading) {
    return (
      <div style={{
        backgroundColor: '#F4F5FB',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Plus Jakarta Sans', sans-serif"
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3px solid #E2E6F3',
          borderTop: '3px solid #5854EE',
          borderRadius: '50%',
          animation: 'rotateSlow 0.8s linear infinite'
        }} />
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Default & Core 4 Reference Views */}
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<OverviewPage sessionUser={sessionUser} onLogout={handleLogout} />} />
        <Route path="/main" element={<Navigate to="/overview" replace />} />
        <Route path="/analytics" element={<PipelineAnalyticsPage sessionUser={sessionUser} onLogout={handleLogout} />} />
        <Route path="/dashboard" element={<DashboardPage sessionUser={sessionUser} onLogout={handleLogout} />} />
        <Route path="/statistics" element={<StatisticsPage sessionUser={sessionUser} onLogout={handleLogout} />} />

        {/* Dedicated Scan Studios */}
        <Route path="/analysis" element={<AnalysisPage sessionUser={sessionUser} onLogout={handleLogout} setSessionUser={setSessionUser} />} />
        <Route path="/video-analysis" element={<VideoAnalysisPage sessionUser={sessionUser} onLogout={handleLogout} setSessionUser={setSessionUser} />} />

        {/* Detail Inspection & Timeline */}
        <Route path="/analysis-detail" element={<AnalysisDetailPage sessionUser={sessionUser} onLogout={handleLogout} />} />
        <Route path="/video-detail" element={<AnalysisDetailPage sessionUser={sessionUser} onLogout={handleLogout} />} />
        <Route path="/video-timeline" element={<VideoTimelinePage sessionUser={sessionUser} onLogout={handleLogout} />} />

        {/* Explainability & Heatmap Visualizations */}
        <Route path="/heatmap" element={<HeatmapPage sessionUser={sessionUser} onLogout={handleLogout} />} />
        <Route path="/image-heatmap" element={<ImageHeatmapPage sessionUser={sessionUser} onLogout={handleLogout} />} />

        {/* Authentication */}
        <Route path="/login" element={<LoginPage setSessionUser={setSessionUser} />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </Router>
  );
}

export default App;