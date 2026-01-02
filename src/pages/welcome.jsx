import { useNavigate } from "react-router-dom";
import welcomeImg from "../assets/welcome.png";


function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-purple-900 to-purple-500 px-4">
      <div className="w-full max-w-sm text-center">
        


        <h1 className="text-white text-3xl font-bold tracking-widest mb-6">
          CLOCKEDIN
        </h1>

        <div className="bg-white/80 rounded-[40px] p-8 shadow-xl">

          <img
            src={welcomeImg}
            alt="illustration"
            className="w-40 mx-auto mb-6"
          />

          <p className="text-lg font-medium text-gray-700 mb-2">
            Welcome!
          </p>

          <p className="text-gray-600 mb-8">
            It's about time you got it together :D
          </p>

          {/* Signup button (future use) */}
          <button
            className="w-full bg-gradient-to-r from-purple-900 to-purple-600 text-white py-3 rounded-xl shadow-md mb-4"
            onClick={() => navigate("/signup")}
          >
            CREATE A NEW ACCOUNT
          </button>

          {/* Login button */}
          <button
            className="w-full bg-gradient-to-r from-purple-700 to-purple-500 text-white py-3 rounded-xl shadow-md"
            onClick={() => navigate("/login")}
          >
            LOG IN
          </button>

        </div>
      </div>
    </div>
  );
}

export default Welcome;
