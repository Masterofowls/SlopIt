import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signUp } from "../../../lib/auth-client";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Card from "../../../components/ui/Card";
import FrogBackground from "../../../components/ToxicBackground";
import AuthButtons from "../../../components/auth/auth_buttons";
import "../../../pages/SignupPage.css";

const SignUpForm = () => {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);

    try {
      const { error } = await signUp.username({
        username: form.get("username"),
        password: form.get("password"),
      });

      if (error) {
        setError(error.message ?? "Sign up failed");
        return;
      }
      navigate("/");
    } catch (err) {
      setError(err.message ?? "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <FrogBackground />
      <div className="signup-container">
        <Card
          title="Join Frogger"
          subtitle="Create your account to get croaking"
          className="signup-card"
        >
          <form onSubmit={handleSubmit} className="signup-form">
            <Input
              type="text"
              name="username"
              label="Username"
              placeholder="Choose a username"
              required
            />

            <Input
              type="password"
              name="password"
              label="Password"
              placeholder="Create a password"
              required
            />

            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-footer">
              <div className="form-actions">
                <Button
                  type="submit"
                  variant="primary"
                  size="large"
                  loading={loading}
                  className="signup-button"
                >
                  Sign Up
                </Button>
              </div>

              <div className="form-options">
                <p className="text-center">
                  Already have an account?{" "}
                  <a href="/login" className="link">
                    Sign in
                  </a>
                </p>
              </div>
            </div>
          </form>
          <div>
            <AuthButtons />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SignUpForm;
