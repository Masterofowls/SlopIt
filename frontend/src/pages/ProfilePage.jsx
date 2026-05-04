import React from 'react';
import useAuth from '../features/auth/hooks/useAuth';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import './ProfilePage.css';
import '../components/FrogBackground'
import FrogBackground from '../components/FrogBackground';
import authService from '../features/auth/services/authService';
import { useEffect } from 'react';

const ProfilePage = () => {
  const { user, logout } = useAuth();

  const mockAuthUser = () => {
    authService.mockUser();
  };

  useEffect(() => {
    mockAuthUser();
  }, []);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  if (!user) {
    return (
      <div className="page profile-page">
        <Card className="profile-card">
          <p style={
            {
              color: "black",
            }
          }>Please log in to view your profile.</p>
          <Button onClick={() => window.location.href = '/login'}>
            Go to Login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="page profile-page">
      <div className="profile-container">
        <Card title="User Profile" className="profile-card">
          <div className="profile-content">
            <div className="profile-avatar">
              <div className="avatar-placeholder">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>

            <div className="profile-info">
              <h2 className="profile-name">{user.name}</h2>
              <p className="profile-email">{user.email}</p>
                        <p style={
            {
              color: "black",
            }
          }>Это мок! В useeffect измени фигню чтобы показывался юзер</p>
              <div className="profile-details">
                <div className="detail-item">
                  <span className="detail-label">User ID:</span>
                  <span className="detail-value">{user.id}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Role:</span>
                  <span className="detail-value">User</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Member Since:</span>
                  <span className="detail-value">2024</span>
                </div>
              </div>
            </div>
          </div>

          <div className="profile-actions">
            <Button variant="primary" onClick={() => {}}>
              Edit Profile
            </Button>
            <Button variant="danger" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;
