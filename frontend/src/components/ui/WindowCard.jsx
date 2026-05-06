import React, { Children } from "react";
import "./WindowCard.css";

const WindowCard = ({ title, className, children }) => {
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
      <div className="window-body">{children}</div>
    </div>
  );
};

export default WindowCard;
