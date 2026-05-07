import React from "react";
import { useUser, UserButton } from "@clerk/clerk-react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import "./ProfilePage.css";
import FrogBackground from "../components/ToxicBackground";

const ProfilePage = () => {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="page profile-page">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="page profile-page">
      <FrogBackground />
      <div className="profile-container">
        <Card title="User Profile" className="profile-card">
          <div className="profile-content">
            <div className="profile-avatar">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt="Profile"
                  className="user-avatar"
                />
              ) : (
                <div className="avatar-placeholder">
                  {(user?.firstName || user?.username || "?")
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}
            </div>

            <div className="profile-info">
              <h2 className="profile-name">
                {user?.fullName || user?.username || "Unknown"}
              </h2>
              <p className="profile-email">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
              <div className="profile-details">
                <div className="detail-item">
                  <span className="detail-label">User ID:</span>
                  <span className="detail-value">{user?.id}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Username:</span>
                  <span className="detail-value">{user?.username || "—"}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Member Since:</span>
                  <span className="detail-value">
                    {user?.createdAt
                      ? new Date(user.createdAt).getFullYear()
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="profile-actions">
            <UserButton afterSignOutUrl="/" />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;
