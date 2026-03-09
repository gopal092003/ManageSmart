import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    
    // Validation
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }

    setLoading(true);
    try {
      // Send email as-is (backend handles case-insensitive matching)
      const res = await api.post("/auth/login", { 
        email: email.trim(), 
        password 
      });
      
      // Store token and manager info
      localStorage.setItem("token", res.data.token);
      if (res.data.manager) {
        localStorage.setItem("manager", JSON.stringify(res.data.manager));
      }
      
      console.log("Login successful, manager:", res.data.manager);
      navigate("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      console.error("Error response:", err.response?.data);
      const errorMessage = err.response?.data?.message || 
                          err.message || 
                          "Login failed. Please check your credentials.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="text-center mb-4">
          <h2 className="mb-2">Welcome Back</h2>
          <p className="text-muted">Sign in to manage your library</p>
        </div>
              
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
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
          <div className="mb-4">
            <label htmlFor="password" className="form-label">
              🔒 Password
            </label>
            <input
              id="password"
              className="form-control"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
                Logging in...
              </>
            ) : (
              "🚀 Login"
            )}
          </button>
        </form>

        <div className="text-center">
          <p className="mb-0 text-muted">
            Don't have an account?{" "}
            <Link to="/signup" className="text-decoration-none fw-bold" style={{ color: 'var(--primary-color)' }}>
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
