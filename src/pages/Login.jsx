import { useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase";
import { getUserProfile } from "../utils/userService";
import "./Login.css";
import { useNavigate } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      // Login through Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const firebaseUser = userCredential.user;

      // Get the Bizyo user profile using the Firebase UID
      const userProfile = await getUserProfile(firebaseUser.uid);

      // Account exists in Firebase Auth
      // but not in Bizyo users
      if (!userProfile) {
        await signOut(auth);

        setError(
          "Your account is not registered in Bizyo."
        );

        return;
      }

      /*
       * Only STAFF accounts are affected
       * by the Active / Inactive status.
       *
       * Admin accounts are allowed to log in.
       *
       * A Staff account with no status is treated
       * as Active for older accounts.
       */
      const isInactiveStaff =
        userProfile.role === "staff" &&
        userProfile.status === "Inactive";

      if (isInactiveStaff) {
        await signOut(auth);

        setError(
          "Your Bizyo Staff account is inactive. Contact the administrator."
        );

        return;
      }

      // Login successful
      console.log("Logged in user:", userProfile);

      navigate("/dashboard");
    } catch (error) {
      console.error(error);

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found"
      ) {
        setError("Invalid email or password.");
      } else {
        setError("Unable to log in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">

      {/* =========================================
          LEFT SIDE - IMAGE / BRANDING
      ========================================= */}
      <div className="login-image-section">

        <div className="image-overlay"></div>

        <div className="brand-content">

          <div className="brand-logo">
            B
          </div>

          <h1>BIZYO</h1>

          <p className="brand-tagline">
            GYM MANAGEMENT SYSTEM
          </p>

          <div className="brand-line"></div>

          <p className="brand-quote">
            Train. Manage.
            <br />
            Achieve.
          </p>

          <p className="brand-description">
            A smarter way to manage your gym, members,
            payments, and daily operations.
          </p>

        </div>

        <div className="image-bottom-text">
          <span>FITNESS</span>
          <span>•</span>
          <span>PERFORMANCE</span>
          <span>•</span>
          <span>RESULTS</span>
        </div>

      </div>

      {/* =========================================
          RIGHT SIDE - LOGIN
      ========================================= */}
      <div className="login-form-section">

        <div className="login-form-wrapper">

          {/* =====================================
              MOBILE LOGO
          ===================================== */}
          <div className="mobile-logo">

            <div className="mobile-logo-icon">
              B
            </div>

            <span>BIZYO</span>

          </div>

          {/* =====================================
              HEADER
          ===================================== */}
          <div className="login-header">

            {/* <p className="welcome-label">
              WELCOME BACK
            </p> */}

            <h2>
              Sign in to your account
            </h2>

            <p className="login-description">
              Enter your credentials to access the
              Bizyo Gym Management System.
            </p>

          </div>

          {/* =====================================
              ERROR MESSAGE
          ===================================== */}
          {error && (
            <div className="error-message">

              <div className="error-icon">
                !
              </div>

              <div>
                <strong>Login failed</strong>

                <p>
                  {error}
                </p>
              </div>

            </div>
          )}

          {/* =====================================
              LOGIN FORM
          ===================================== */}
          <form
            onSubmit={handleLogin}
            className="login-form"
          >

            {/* ===================================
                EMAIL
            =================================== */}
            <div className="input-group">

              <label htmlFor="email">
                Email Address
              </label>

              <div className="input-wrapper">

                <span className="input-icon">

                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4 6H20C21.1 6 22 6.9 22 8V16C22 17.1 21.1 18 20 18H4C2.9 18 2 17.1 2 16V8C2 6.9 2.9 6 4 6Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />

                    <path
                      d="M22 8L12 13L2 8"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                </span>

                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  autoComplete="email"
                  required
                />

              </div>

            </div>

            {/* ===================================
                PASSWORD
            =================================== */}
            <div className="input-group">

              <label htmlFor="password">
                Password
              </label>

              <div className="input-wrapper">

                <span className="input-icon">

                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect
                      x="4"
                      y="10"
                      width="16"
                      height="11"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />

                    <path
                      d="M8 10V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V10"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>

                </span>

                <input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  autoComplete="current-password"
                  required
                />

                {/* SHOW / HIDE PASSWORD */}
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >

                  {showPassword ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >

                      <path
                        d="M3 3L21 21"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />

                      <path
                        d="M10.58 10.59C10.21 10.96 10 11.46 10 12C10 13.1 10.9 14 12 14C12.54 14 13.04 13.79 13.41 13.42"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />

                      <path
                        d="M9.88 5.09C10.56 4.89 11.27 4.8 12 4.8C17.5 4.8 21.5 12 21.5 12C20.85 13.17 20.05 14.29 19.12 15.28"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />

                      <path
                        d="M6.61 6.61C4.48 8.04 2.5 10.82 2.5 12C2.5 12 6.5 19.2 12 19.2C13.27 19.2 14.48 18.94 15.58 18.49"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />

                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >

                      <path
                        d="M2.5 12C2.5 12 6.5 4.8 12 4.8C17.5 4.8 21.5 12 21.5 12C21.5 12 17.5 19.2 12 19.2C6.5 19.2 2.5 12 2.5 12Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />

                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />

                    </svg>
                  )}

                </button>

              </div>

            </div>

            {/* ===================================
                LOGIN BUTTON
            =================================== */}
            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >

              {loading ? (
                <>
                  <span className="spinner"></span>
                  Logging in...
                </>
              ) : (
                <>
                  <span>Login</span>

                  <svg
                    className="arrow-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >

                    <path
                      d="M5 12H19"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />

                    <path
                      d="M13 6L19 12L13 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                  </svg>
                </>
              )}

            </button>

          </form>

          {/* =====================================
              FORGOT PASSWORD
          ===================================== */}
          <div className="forgot-password">

            <div className="security-icon">

              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >

                <path
                  d="M12 3L20 6V11C20 16.1 16.6 20.4 12 21C7.4 20.4 4 16.1 4 11V6L12 3Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />

                <path
                  d="M9 12L11 14L15 10"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

              </svg>

            </div>

            <div>

              <strong>
                Forgot your password?
              </strong>

              <p>
                Contact the administrator to reset
                your account password.
              </p>

            </div>

          </div>

          {/* =====================================
              FOOTER
          ===================================== */}
          <div className="login-footer">


            <span>
              © {new Date().getFullYear()} Bizyo
            </span>

            <span className="footer-dot">
              •
            </span>

            <span>
              Gym Management System
            </span>

            <span>
              Established since 2021 Bizyo
            </span>

          </div>

        </div>

      </div>

    </div>
  );
}

export default Login;