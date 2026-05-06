import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LoginForm from "../features/auth/components/LoginForm";
import FrogBackground from "../components/ToxicBackground";
import { useSession } from "../hooks/useSession.js";
import "./LoginPage.css";

const LoginPage = () => {
  const navigate = useNavigate();
  const { session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && session) {
      navigate("/home", { replace: true });
    }
  }, [isPending, session, navigate]);

  return (
    <div className="page login-page">
      <FrogBackground />
      <LoginForm />
    </div>
  );
};

export default LoginPage;
