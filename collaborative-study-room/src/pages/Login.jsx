import { useAuth } from "../context/AuthContext";
import { useEffect } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth"; 
import { auth } from "../firebase"; 

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();   // ✅ ADD THIS HERE

  useEffect(() => {             // ✅ ADD THIS HERE
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleLogin = async () => {
  try {
    const res = await signInWithEmailAndPassword(auth, email, password);
    console.log("SUCCESS:", res.user);
  } catch (error) {
    console.log("LOGIN ERROR CODE:", error.code);
    console.log("LOGIN ERROR MESSAGE:", error.message);
    alert(error.message);
  }
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold text-center mb-6">
          Collaborative Study Room
        </h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 mb-6 border rounded"
        />

        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition"
        >
          Login
        </button>
      </div>
    </div>
  );
}

export default Login;