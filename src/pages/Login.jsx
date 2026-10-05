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

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      // Login through Firebase Authentication
      const userCredential =
        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );

      const firebaseUser = userCredential.user;

      // Get the Bizyo user profile using the Firebase UID
      const userProfile = await getUserProfile(
        firebaseUser.uid,
      );

      // Account exists in Firebase Auth
      // but not in Bizyo users
      if (!userProfile) {
        await signOut(auth);

        setError(
          "Your account is not registered in Bizyo.",
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
          "Your Bizyo Staff account is inactive. Contact the administrator.",
        );

        return;
      }

      // Login successful
      console.log(
        "Logged in user:",
        userProfile,
      );

      navigate("/dashboard");
    } catch (error) {
      console.error(error);

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found"
      ) {
        setError(
          "Invalid email or password.",
        );
      } else {
        setError(
          "Unable to log in. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Bizyo</h1>

        <p className="subtitle">
          Gym Management System
        </p>

        {error && (
          <p className="error-message">
            {error}
          </p>
        )}

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>Email</label>

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
            />
          </div>

          <div className="input-group">
            <label>Password</label>

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Logging in..."
              : "Login"}
          </button>
        </form>

        <p className="forgot-password">
          Forgot your password? <br />
          Contact the administrator to reset it.
        </p>
      </div>
    </div>
  );
}

export default Login;