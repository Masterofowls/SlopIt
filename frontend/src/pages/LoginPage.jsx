import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LoginForm from "../features/auth/components/LoginForm";
import FrogBackground from "../components/ToxicBackground";
import { useSession } from "../hooks/useSession.js";
import "./LoginPage.css";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, isPending, error } = useSession();
  const params = new URLSearchParams(location.search);
  const oauthError = params.get("error") || params.get("auth_error");
  const bannerState = location.state;
  const lastStatus = sessionStorage.getItem("auth:last_status");

  const banner = (() => {
    if (oauthError) {
      return {
        type: "error",
        message: `Authentication failed: ${oauthError}`,
      };
    }

    if (bannerState?.authStatus === "error") {
      return {
        type: "error",
        message:
          bannerState.authMessage || "Authentication required. Please sign in.",
      };
    }

    if (error) {
      return {
        type: "error",
        message: "Unable to verify session. Please try logging in again.",
      };
    }

    if (lastStatus === "logged_out") {
      return {
        type: "info",
        message: "You have been logged out successfully.",
      };
    }

    return null;
  })();

  console.debug("[auth] LoginPage:render", {
    path: location.pathname,
    search: location.search,
    isPending,
    hasSession: Boolean(session),
    oauthError,
    bannerState,
    lastStatus,
  });

  useEffect(() => {
    if (!isPending && session) {
      sessionStorage.setItem("auth:last_status", "success");
      console.info("[auth] LoginPage:authenticated-redirect-home", {
        username: session?.user?.username,
      });
      navigate("/home", {
        replace: true,
        state: {
          authStatus: "success",
          authMessage: "Authentication successful. Welcome back!",
        },
      });
    }
  }, [isPending, session, navigate]);

  const bannerStyle =
    banner?.type === "success"
      ? { background: "#d8ffe1", color: "#0f5a22", border: "1px solid #62d982" }
      : banner?.type === "error"
        ? {
            background: "#ffe3e3",
            color: "#7a1010",
            border: "1px solid #ff8f8f",
          }
        : {
            background: "#e8f1ff",
            color: "#124086",
            border: "1px solid #8db7ff",
          };

  return (
    <div className="page login-page">
      <FrogBackground />
      {banner ? (
        <div
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            width: "min(760px, calc(100vw - 32px))",
            padding: "12px 16px",
            borderRadius: 10,
            fontWeight: 600,
            boxShadow: "0 8px 22px rgba(0, 0, 0, 0.2)",
            ...bannerStyle,
          }}
          role="status"
          aria-live="polite"
        >
          {banner.message}
        </div>
      ) : null}
      <LoginForm />
    </div>
  );
};

export default LoginPage;
