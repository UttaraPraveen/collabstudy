import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ children }) {
  // Assuming your useAuth provides a 'loading' boolean
  const { user, loading } = useAuth(); 

  // 1. If Firebase is still checking if user is logged in, show a spinner
  if (loading) {
    return <div className="text-center mt-20">Loading...</div>;
  }

  // 2. If check is done and no user found, redirect to Login
  if (!user) {
    return <Navigate to="/" />;
  }

  // 3. If user exists, show the Dashboard
  return children;
}

export default ProtectedRoute;