import {
  useEffect,
  useState,
} from "react";

import {
  Navigate,
  useLocation,
  useNavigate,
} from "react-router";

import { useAuth } from "../context/AuthContext";
import "./LoginPage.css";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    login,
    isAuthenticated,
  } = useAuth();

  const [formData, setFormData] =
    useState({
      email: "",
      password: "",
    });

  const [showPassword, setShowPassword] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    document.title =
      "Login | PharmaERP";
  }, []);

  if (isAuthenticated) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));

    if (errorMessage) {
      setErrorMessage("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const email = formData.email
      .trim()
      .toLowerCase();

    const password =
      formData.password;

    if (!email || !password) {
      setErrorMessage(
        "Email এবং password দুটোই প্রয়োজন।"
      );

      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      await login({
        email,
        password,
      });

      const destination =
        location.state?.from ||
        "/dashboard";

      navigate(destination, {
        replace: true,
      });
    } catch (error) {
      const apiMessage =
        error.response?.data?.message;

      setErrorMessage(
        apiMessage ||
          error.message ||
          "Login করা সম্ভব হয়নি।"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="brand-content">
          <div className="brand-logo">
            P
          </div>

          <p className="brand-eyebrow">
            Medicine Billing and Inventory
          </p>

          <h1>PharmaERP</h1>

          <p className="brand-description">
            Pharmacy sales, stock,
            purchases, suppliers and
            medicine batches এক জায়গা
            থেকে পরিচালনা করুন।
          </p>

          <div className="feature-grid">
            <article className="feature-card">
              <span>01</span>
              <div>
                <strong>
                  Smart Billing
                </strong>

                <p>
                  দ্রুত এবং নির্ভুল
                  medicine billing।
                </p>
              </div>
            </article>

            <article className="feature-card">
              <span>02</span>
              <div>
                <strong>
                  Batch Tracking
                </strong>

                <p>
                  Expiry এবং stock batch
                  অনুযায়ী track করুন।
                </p>
              </div>
            </article>

            <article className="feature-card">
              <span>03</span>
              <div>
                <strong>
                  Business Reports
                </strong>

                <p>
                  Sales, purchase এবং due
                  report দেখুন।
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="mobile-brand">
          <div className="mobile-logo">
            P
          </div>

          <div>
            <strong>PharmaERP</strong>
            <span>
              Pharmacy Management
            </span>
          </div>
        </div>

        <div className="login-card">
          <div className="login-heading">
            <p>Welcome back</p>
            <h2>Sign in to your account</h2>

            <span>
              আপনার account details
              ব্যবহার করে login করুন।
            </span>
          </div>

          {errorMessage && (
            <div
              className="login-alert"
              role="alert"
            >
              <span>!</span>
              <p>{errorMessage}</p>
            </div>
          )}

          <form
            className="login-form"
            onSubmit={handleSubmit}
          >
            <div className="form-group">
              <label htmlFor="email">
                Email address
              </label>

              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="admin@example.com"
                autoComplete="email"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">
                Password
              </label>

              <div className="password-field">
                <input
                  id="password"
                  name="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={
                    formData.password
                  }
                  onChange={handleChange}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(
                      (currentValue) =>
                        !currentValue
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword
                    ? "Hide"
                    : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p className="login-footer">
            Secure access to PharmaERP
          </p>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;