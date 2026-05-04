import React from 'react';

const Card = ({ children, className = '', title = '', subtitle = '' }) => {
  return (
    <div className={`card ${className}`}>
      {title && <h2 className="card-title">{title}</h2>}
      {subtitle && <h4 className="card-subtitle">{subtitle}</h4>}
      <div className="card-content">
        {children}
      </div>
    </div>
  );
};

export default Card;
