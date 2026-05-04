import React from 'react';
import useAuth from '../../features/auth/hooks/useAuth';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import './HomePage.css';

const HomePage = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="page home-page">
      <div className="home-container">
        <div className="hero-section">
          <h1 className="hero-title">Frogger</h1>
          <p className="hero-subtitle">
            
          </p>

          <div className="hero-actions">
            {isAuthenticated ? (
              <Button 
                variant="primary" 
                size="large"
                onClick={() => window.location.href = '/profile'}
              >
                Go to Profile
              </Button>
            ) : (
              <>
                <Button 
                  variant="primary" 
                  size="large"
                  onClick={() => window.location.href = '/login'}
                >
                  Login
                </Button>
                <Button 
                  variant="outline" 
                  size="large"
                  onClick={() => window.location.href = '/register'}
                >
                  Sign Up
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
