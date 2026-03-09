import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";

function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/dashboard");
    }
  }, [navigate]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/register", { 
        name: name.trim(), 
        email: email.trim().toLowerCase(), 
        password 
      });
      
      // Store token and manager info
      localStorage.setItem("token", res.data.token);
      if (res.data.manager) {
        localStorage.setItem("manager", JSON.stringify(res.data.manager));
      }
      
      console.log("Signup successful, manager:", res.data.manager);
      navigate("/registerlibrary"); // after signup, go to library registration
    } catch (err) {
      console.error("Signup error:", err);
      const errorMessage = err.response?.data?.message || 
                          err.message || 
                          "Signup failed. Please try again.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="text-center mb-4">
          <h2 className="mb-2">Create Account</h2>
          <p className="text-muted">Join us to manage your library</p>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup}>
          <div className="mb-3">
            <label htmlFor="name" className="form-label">
              👤 Full Name
            </label>
            <input
              id="name"
              className="form-control"
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="email" className="form-label">
              📧 Email Address
            </label>
            <input
              id="email"
              className="form-control"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="password" className="form-label">
              🔒 Password
            </label>
            <input
              id="password"
              className="form-control"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              minLength={6}
            />
            <small className="form-text text-muted">
              Must be at least 6 characters
            </small>
          </div>
          <div className="mb-4">
            <label htmlFor="confirmPassword" className="form-label">
              🔒 Confirm Password
            </label>
            <input
              id="confirmPassword"
              className="form-control"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-100 mb-3"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                Creating account...
              </>
            ) : (
              "✨ Sign Up"
            )}
          </button>
        </form>

        <div className="text-center">
          <p className="mb-0 text-muted">
            Already have an account?{" "}
            <Link to="/login" className="text-decoration-none fw-bold" style={{ color: 'var(--primary-color)' }}>
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signup;
