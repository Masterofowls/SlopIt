import React, { useState } from 'react';
import { DEBUG_MODE, DEBUG_OPTIONS, MOCK_USER, getMockSession, debugLog } from '../../config/debug';
import './DebugToolbar.css';

const DebugToolbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mockAuth, setMockAuth] = useState(false);

  if (!DEBUG_MODE || !DEBUG_OPTIONS.showDebugToolbar) {
    return null;
  }

  const handleToggleMockAuth = () => {
    setMockAuth(!mockAuth);
    debugLog('Debug', `Mock auth ${!mockAuth ? 'enabled' : 'disabled'}`);

    if (!mockAuth) {
      // Store mock session in localStorage
      localStorage.setItem('session', JSON.stringify(getMockSession()));
      window.location.reload();
    } else {
      // Remove mock session
      localStorage.removeItem('session');
      window.location.reload();
    }
  };

  const handleClearData = () => {
    localStorage.clear();
    debugLog('Debug', 'All local data cleared');
    window.location.reload();
  };

  const handleShowUserInfo = () => {
    const session = localStorage.getItem('session');
    if (session) {
      debugLog('Debug', 'Current mock session:', JSON.parse(session));
    } else {
      debugLog('Debug', 'No mock session found');
    }
  };

  return (
    <div className="debug-toolbar">
      <button 
        className="debug-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Toggle Debug Toolbar"
      >
        bug
      </button>

      {isOpen && (
        <div className="debug-panel">
          <h3>Debug Options</h3>

          <div className="debug-section">
            <h4>Authentication</h4>
            <div className="debug-option">
              <label>
                <input
                  type="checkbox"
                  checked={mockAuth}
                  onChange={handleToggleMockAuth}
                />
                Mock Authentication
              </label>
              <small>Use mock user for testing</small>
            </div>
          </div>

          <div className="debug-section">
            <h4>Actions</h4>
            <button onClick={handleShowUserInfo}>Show User Info</button>
            <button onClick={handleClearData}>Clear All Data</button>
          </div>

          <div className="debug-section">
            <h4>Mock User Info</h4>
            <div className="user-info">
              <p><strong>ID:</strong> {MOCK_USER.id}</p>
              <p><strong>Username:</strong> {MOCK_USER.username}</p>
              <p><strong>Email:</strong> {MOCK_USER.email}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugToolbar;
