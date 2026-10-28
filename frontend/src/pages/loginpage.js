import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const LoginPage = ({ setSessionUser }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await axios.post('/auth/login', { email, password });
      
      const homeRes = await axios.get('/home');
      if (homeRes.data?.session_user) {
        setSessionUser(homeRes.data.session_user);
        navigate('/overview');
      } else {
        navigate('/overview');
      }
    } catch (error) {
      const detail = error.response?.data?.detail || "Please verify your email and password.";
      alert(`Sign in failed: ${detail}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F4F5FB',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      {/* Brand Logo Header */}
      <div 
        onClick={() => navigate('/overview')}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '32px' }}
      >
        <div style={{
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #FF4570 0%, #7B61FF 50%, #36B8FF 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(123, 97, 255, 0.35)'
        }}>
          <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#FFFFFF' }} />
        </div>
        <span style={{ fontSize: '22px', fontWeight: '900', letterSpacing: '1px', color: '#1D2138' }}>
          LIXAR
        </span>
      </div>

      {/* Login Card */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '26px',
        padding: '40px 44px',
        boxShadow: '0 16px 45px rgba(66, 71, 112, 0.08)',
        border: '1px solid rgba(226, 230, 243, 0.9)',
        width: '100%',
        maxWidth: '420px',
        boxSizing: 'border-box'
      }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: '800', color: '#1D2138' }}>
          Sign In
        </h2>
        <p style={{ margin: '0 0 28px', fontSize: '13px', color: '#8E93B0' }}>
          Access your deepfake scan history and PRO neural models.
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#1D2138', marginBottom: '6px' }}>
              Email address
            </label>
            <input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '13px 16px',
                borderRadius: '12px',
                border: '1px solid #E2E6F3',
                backgroundColor: '#EFF1F7',
                fontSize: '14px',
                color: '#1D2138',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#1D2138', marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '13px 16px',
                borderRadius: '12px',
                border: '1px solid #E2E6F3',
                backgroundColor: '#EFF1F7',
                fontSize: '14px',
                color: '#1D2138',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: '10px',
              padding: '14px',
              backgroundColor: '#5854EE',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '14px',
              fontWeight: '800',
              fontSize: '14px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 6px 20px rgba(88, 84, 238, 0.35)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = '#4743DE')}
            onMouseLeave={(e) => !isLoading && (e.currentTarget.style.backgroundColor = '#5854EE')}
          >
            {isLoading ? "Authenticating..." : "Sign In ❯"}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: '#8E93B0' }}>
          Don't have an account?{' '}
          <span
            onClick={() => navigate('/register')}
            style={{ color: '#5854EE', fontWeight: '800', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Register
          </span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;