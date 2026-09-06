import React, { useState } from "react";
import { loginUser, registerUser } from "../api";

export default function Auth({ mode, onSuccess, onClose }) {

  const [isLogin, setIsLogin] = useState(mode === "login");

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: ""
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });

    setError("");
  };

  const handleSubmit = async (e) => {

    e.preventDefault();

    setError("");
    setLoading(true);

    try {

      let response;

      if (isLogin) {

        response = await loginUser({
          login: form.email,
          password: form.password
        });

      } else {

        response = await registerUser({
          username: form.username,
          email: form.email,
          password: form.password
        });

      }

      localStorage.setItem(
        "atelier_token",
        response.access_token
      );

      localStorage.setItem(
        "atelier_user",
        JSON.stringify(response.user)
      );

      onSuccess(response.user);

    } catch (err) {

      setError(
        err.message || "Something went wrong. Please try again."
      );

    } finally {

      setLoading(false);

    }
  };

  return (
    <div className="auth-overlay">

      <div className="auth-card">

        <button
          className="auth-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <div className="auth-header">

          <div className="auth-monogram">
            A
          </div>

          <p className="auth-eyebrow">
            ATELIER
          </p>

          <h1>
            {isLogin
              ? "Welcome back."
              : "Create your account."
            }
          </h1>

          <p>
            {isLogin
              ? "Sign in to continue your gallery experience."
              : "Join Atelier and discover exceptional contemporary art."
            }
          </p>

        </div>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >

          {!isLogin && (
            <div className="form-group">

              <label>
                Username
              </label>

              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="Enter your username"
                required
                autoComplete="username"
              />

            </div>
          )}

          <div className="form-group">

            <label>
              {isLogin
                ? "Email or username"
                : "Email address"
              }
            </label>

            <input
              type={isLogin ? "text" : "email"}
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder={
                isLogin
                  ? "Enter email or username"
                  : "you@example.com"
              }
              required
              autoComplete={
                isLogin
                  ? "username"
                  : "email"
              }
            />

          </div>

          <div className="form-group">

            <div className="password-label">

              <label>
                Password
              </label>

              {isLogin && (
                <button
                  type="button"
                  className="forgot-password"
                  onClick={() =>
                    setError(
                      "Password recovery is not configured yet."
                    )
                  }
                >
                  Forgot password?
                </button>
              )}

            </div>

            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
              minLength="8"
              autoComplete={
                isLogin
                  ? "current-password"
                  : "new-password"
              }
            />

          </div>

          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : isLogin
                ? "Sign In"
                : "Create Account"
            }

            {!loading && (
              <span>→</span>
            )}

          </button>

        </form>

        <div className="auth-switch">

          <span>
            {isLogin
              ? "Don't have an account?"
              : "Already have an account?"
            }
          </span>

          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
          >
            {isLogin
              ? "Create account"
              : "Sign in"
            }
          </button>

        </div>

        <div className="auth-security">
          Your account information is securely handled by Atelier.
        </div>

      </div>

    </div>
  );
}
