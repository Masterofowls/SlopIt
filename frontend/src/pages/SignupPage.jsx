import React from 'react';
import SignupForm from '../features/auth/components/SignupForm';
import FrogBackground from '../components/FrogBackground';
import './SignupPage.css';

const SignupPage = () => {
  return (
    <div className="page signup-page">
      <FrogBackground />
      <SignupForm />
    </div>
  );
};

export default SignupPage;
