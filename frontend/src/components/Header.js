import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const Header = ({ sessionUser, onLogout, onOpenScanModal, searchTerm, setSearchTerm }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Determine active tab based on path
  const currentPath = location.pathname;
  const getActiveTab = () => {
    if (currentPath === '/statistics') return 'statistics';
    if (currentPath === '/dashboard') return 'dashboard';
    if (currentPath === '/analytics') return 'analytics';
    return 'overview'; // Default for /overview, /main, /
  };

  const activeTab = getActiveTab();

  const handleTabClick = (tabKey) => {
    if (tabKey === 'statistics') navigate('/statistics');
    else if (tabKey === 'dashboard') navigate('/dashboard');
    else if (tabKey === 'analytics') navigate('/analytics');
    else navigate('/overview');
  };

  const handleLogout = async () => {
    try {
      await axios.get('/auth/logout');
      if (onLogout) onLogout();
      setShowProfileMenu(false);
      navigate('/overview');
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  return (
    <header style={{
      width: '100%',
      height: '74px',
      backgroundColor: 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 44px',
      boxSizing: 'border-box',
      position: 'relative',
      zIndex: 50
    }}>
      {/* Left section: Logo & Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '38px' }}>
        {/* Brand Logo */}
        <div 
          onClick={() => navigate('/overview')}
          style={{ display: 'flex', alignItems: 'center', gap: '11px', cursor: 'pointer', userSelect: 'none' }}
        >
          {/* Gradient Donut Icon from reference */}
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #FF4570 0%, #7B61FF 50%, #36B8FF 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(123, 97, 255, 0.35)',
            position: 'relative'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)'
            }} />
          </div>
          <span style={{
            fontSize: '18px',
            fontWeight: '800',
            letterSpacing: '1.2px',
            color: '#1D2138',
            fontFamily: "'Plus Jakarta Sans', sans-serif"
          }}>
            LIXAR
          </span>
        </div>

        {/* Search pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#EFF1F7',
          borderRadius: '30px',
          padding: '8px 18px',
          width: '260px',
          height: '38px',
          boxSizing: 'border-box'
        }}>
          <input
            type="text"
            placeholder="Search scans, IDs, files..."
            value={searchTerm || ''}
            onChange={(e) => setSearchTerm && setSearchTerm(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '13px',
              color: '#1D2138',
              width: '100%',
              fontWeight: '500'
            }}
          />
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9EA3BE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      {/* Center section: Navigation Tabs */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: '40px',
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)'
      }}>
        {[
          { key: 'statistics', label: 'Statistics' },
          { key: 'overview', label: 'Overview' },
          { key: 'dashboard', label: 'Dashboard' },
          { key: 'analytics', label: 'Analytics' }
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <div
              key={tab.key}
              onClick={() => handleTabClick(tab.key)}
              style={{
                position: 'relative',
                padding: '10px 4px',
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              <span style={{
                fontSize: '14px',
                fontWeight: isActive ? '700' : '500',
                color: isActive ? '#1D2138' : '#8E93B0',
                transition: 'color 0.2s ease'
              }}>
                {tab.label}
              </span>
              {isActive && (
                <div style={{
                  position: 'absolute',
                  bottom: '0',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '32px',
                  height: '3px',
                  backgroundColor: '#5854EE',
                  borderRadius: '2px'
                }} />
              )}
            </div>
          );
        })}
      </nav>

      {/* Right section: Quick Scan, Profile, Settings */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        {/* Quick Scan Action Button */}
        {onOpenScanModal && (
          <button
            onClick={onOpenScanModal}
            style={{
              backgroundColor: '#5854EE',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(88, 84, 238, 0.3)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4743DE'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#5854EE'}
          >
            <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span>
            <span>New Scan</span>
          </button>
        )}

        {/* User Profile Avatar / Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8E93B0',
              padding: '6px',
              borderRadius: '50%',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#1D2138'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#8E93B0'}
            aria-label="User Profile"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>

          {/* Profile Dropdown */}
          {showProfileMenu && (
            <div style={{
              position: 'absolute',
              top: '42px',
              right: 0,
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              boxShadow: '0 12px 35px rgba(66, 71, 112, 0.15)',
              border: '1px solid rgba(226, 230, 243, 0.9)',
              padding: '16px',
              minWidth: '200px',
              zIndex: 100,
              animation: 'fadeIn 0.15s ease'
            }}>
              {sessionUser ? (
                <div>
                  <div style={{ paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid #EFF1F7' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#1D2138' }}>{sessionUser.name}</div>
                    <div style={{ fontSize: '12px', color: '#8E93B0', marginTop: '2px' }}>{sessionUser.email}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'rgba(255, 71, 114, 0.08)',
                      color: '#FF4772',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={() => { setShowProfileMenu(false); navigate('/login'); }}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      backgroundColor: '#5854EE',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => { setShowProfileMenu(false); navigate('/register'); }}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      backgroundColor: '#EFF1F7',
                      color: '#1D2138',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Register
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sliders / Filter icon */}
        <button
          onClick={() => onOpenScanModal && onOpenScanModal()}
          title="Scan Configuration"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#8E93B0',
            padding: '6px',
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#1D2138'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#8E93B0'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="21" x2="4" y2="14" />
            <line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" />
            <line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" />
            <line x1="9" y1="8" x2="15" y2="8" />
            <line x1="17" y1="16" x2="23" y2="16" />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default Header;
