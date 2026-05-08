import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignIn, useAuth } from '@clerk/clerk-react';
import ToxicBackground from '../components/ToxicBackground.jsx';
import './AuthPage.css';

const AuthPage = () => {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();

  // Already signed in — skip straight to feed
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate('/home', { replace: true });
    }
  }, [isSignedIn, isLoaded, navigate]);

  if (!isLoaded) {
    return (
      <div className="auth-page">
        <ToxicBackground />
        <div className="auth-page-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <ToxicBackground />

      <div className="auth-page-container">
        <div className="auth-page-header">
          <button
            className="auth-page-back"
            onClick={() => navigate('/')}
            aria-label="Back to home"
          >
            ← back
          </button>
          <h1 className="auth-page-title">SlopIt</h1>
        </div>

        <div className="auth-page-card">
          <SignIn
            routing="hash"
            afterSignInUrl="/home"
            afterSignUpUrl="/home"
            appearance={{
              variables: {
                colorPrimary: '#00ff00',
                colorBackground: '#001400',
                colorText: '#00ff00',
                colorTextSecondary: '#00cc00',
                colorInputBackground: '#002200',
                colorInputText: '#00ff00',
                colorNeutral: '#00aa00',
                borderRadius: '4px',
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '14px',
              },
              elements: {
                card: 'slop-clerk-card',
                headerTitle: 'slop-clerk-title',
                headerSubtitle: 'slop-clerk-subtitle',
                socialButtonsBlockButton: 'slop-clerk-social-btn',
                formButtonPrimary: 'slop-clerk-submit-btn',
                footerActionLink: 'slop-clerk-footer-link',
                formFieldInput: 'slop-clerk-input',
                dividerLine: 'slop-clerk-divider',
                dividerText: 'slop-clerk-divider-text',
              },
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
