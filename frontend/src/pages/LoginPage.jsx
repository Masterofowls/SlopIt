import React from 'react';
import LoginForm from '../features/auth/components/LoginForm';
import FrogBackground from '../components/FrogBackground';
import './LoginPage.css';

const LoginPage = () => {
  return (
    <div className="page login-page">
      <FrogBackground />
      <LoginForm />
    </div>
  );
};

export default LoginPage;
