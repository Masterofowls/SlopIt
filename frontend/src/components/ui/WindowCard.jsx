import React from "react";
import "./WindowCard.css";

const WindowCard = ({ title, icon, heading, text }) => {
  return (
    <div className="window-card">
      <div className="window-header">
        <div className="window-controls">
          <div className="window-btn close"></div>
          <div className="window-btn min"></div>
          <div className="window-btn max"></div>
        </div>
        <div className="window-title">{title}</div>
      </div>
      <div className="window-body">
        <div className="feature-icon">{icon}</div>
        <h3>{heading}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
};

export default WindowCard;
