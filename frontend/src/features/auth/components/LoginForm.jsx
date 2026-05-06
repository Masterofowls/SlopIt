import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signIn } from "../../../lib/auth-client";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Card from "../../../components/ui/Card";
import FrogBackground from "../../../components/ToxicBackground";
import AuthButtons from "../../../components/auth/auth_buttons";
import "../../../pages/LoginPage.css";

const LoginForm = () => {
  return (
    <div className="login-page">
      <FrogBackground />
      <div className="login-container">
        <Card
          title="Welcome back to Frogger"
          subtitle="Discover and re-discover your interests"
          className="login-card"
        >
          <p>Log-in using:</p>
          <AuthButtons />
        </Card>
      </div>
    </div>
  );
};

export default LoginForm;
