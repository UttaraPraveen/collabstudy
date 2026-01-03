import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth"; // 1. Import reset function
import { auth } from "../firebase"; 
import { useAuth } from "../context/AuthContext";
import welcomeImg from "../assets/welcome.png"; // Assuming you want the image here too

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState(""); // For success messages
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { user } = useAuth(); 

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  // --- LOGIN LOGIC ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // AuthContext detects change and useEffect redirects to Dashboard
    } catch (error) {
      console.log("LOGIN ERROR:", error.code);
      if (error.code === "auth/invalid-credential") {
        setError("Incorrect email or password.");
      } else if (error.code === "auth/too-many-requests") {
        setError("Too many failed attempts. Try again later.");
      } else {
        setError("Failed to login. Please check your details.");
      }
      setLoading(false);
    }
  };

  // --- FORGOT PASSWORD LOGIC ---
  const handleResetPassword = async () => {
    if (!email) {
      setError("Please enter your email address above to reset your password.");
      return;
    }

    try {
      setMessage("");
      setError("");
      await sendPasswordResetEmail(auth, email);
      setMessage("Check your inbox! We sent a password reset link.");
    } catch (error) {
      console.error(error);
      if (error.code === "auth/user-not-found") {
        setError("No account found with this email.");
      } else {
        setError("Failed to send reset email. Try again.");
      }
    }
  };

  // Shared Input Style (Retro Theme)
  const inputStyle = "w-full bg-[#1a1a1a] border-2 border-[#f0abfc] text-white placeholder-gray-400 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#e879f9] to-[#4c1d95] flex flex-col items-center justify-center px-4 py-6 font-mono">
      
      {/* HEADER */}
      <h1 className="text-white text-4xl font-bold tracking-widest mb-4 drop-shadow-md">
        CLOCKEDIN
      </h1>

      <div className="mb-6">
        <img 
          src={welcomeImg} 
          alt="Illustration" 
          className="w-40 mix-blend-screen opacity-90 grayscale contrast-125 brightness-150" 
        />
      </div>

      <div className="w-full max-w-sm">
        
        {/* MESSAGES */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-white px-3 py-2 rounded text-center text-xs mb-4">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-green-500/20 border border-green-500 text-white px-3 py-2 rounded text-center text-xs mb-4">
            {message}
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputStyle}
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputStyle}
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full bg-[#e8bdf0] text-black text-xl font-bold py-3 rounded-full shadow-lg hover:bg-[#d8a4e2] transition-transform transform active:scale-95 tracking-wide"
          >
            {loading ? "LOGGING IN..." : "LOGIN"}
          </button>
        </form>

        {/* FORGOT PASSWORD & SIGNUP LINKS */}
        <div className="mt-6 flex flex-col items-center gap-2">
          
          {/* Forgot Password Button */}
          <button 
            onClick={handleResetPassword}
            className="text-purple-200 text-sm hover:text-white hover:underline transition"
          >
            Forgot Password?
          </button>

          <p className="text-white text-sm mt-2">
            Don't have an account?{" "}
            <Link to="/signup" className="text-[#f0abfc] font-bold hover:underline">
              Register here!
            </Link>
          </p>
          
          <Link to="/" className="text-xs text-gray-400 hover:text-white mt-4 underline">
            Go back home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Login;