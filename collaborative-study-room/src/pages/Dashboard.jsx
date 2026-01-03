import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; 
import { signOut } from "firebase/auth";        
import { auth, db } from "../firebase"; 
import { doc, getDoc } from "firebase/firestore"; 
import { useAuth } from "../context/AuthContext";

import JoinRoom from "../components/JoinRoom";
import CreateRoom from "../components/CreateRoom";
import RoomList from "../components/RoomList";
import TaskManager from "../components/TaskManager";
import PomodoroTimer from "../components/Pomodoro"; 
import StudyTracker from "../components/StudyTracker"; 
import RoomSidebar from "../components/RoomSidebar";

function Dashboard() {
  const { user } = useAuth(); 
  const [displayName, setDisplayName] = useState("SCHOLAR"); // Default uppercase for retro vibe
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const navigate = useNavigate(); 

  useEffect(() => {
    const fetchUserData = async () => {
      if (user?.uid) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userSnapshot = await getDoc(userDocRef);

          if (userSnapshot.exists()) {
            const data = userSnapshot.data();
            const name = data.fullName || data.username || "Scholar";
            setDisplayName(name.toUpperCase()); // Force uppercase for aesthetic
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    };

    fetchUserData();
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login"); 
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    // 1. UPDATED BACKGROUND & FONT (Matching Signup)
    <div className="min-h-screen bg-gradient-to-b from-[#e879f9] to-[#4c1d95] p-6 font-mono text-white">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-widest drop-shadow-md">
            HI, {displayName} 👋
          </h1>
          <p className="text-purple-200 text-sm mt-1 tracking-wide">
            WELCOME BACK TO YOUR WORKSPACE.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {selectedRoomId && (
            <button 
              onClick={() => setSelectedRoomId(null)}
              className="text-sm text-purple-200 underline hover:text-white transition tracking-wide"
            >
              ← BACK TO ROOM LIST
            </button>
          )}

          {/* 2. UPDATED BUTTON STYLE (Matching Register Button vibe but smaller) */}
          <button 
            onClick={handleLogout}
            className="bg-[#1a1a1a] border-2 border-[#f0abfc] text-white px-6 py-2 rounded-full shadow-lg hover:bg-[#d8a4e2] hover:text-black hover:border-[#d8a4e2] transition-all duration-300 font-bold tracking-wider text-sm"
          >
            LOGOUT
          </button>
        </div>
      </div>

      {/* DASHBOARD CONTENT */}
      {selectedRoomId ? (
        // --- INSIDE A ROOM VIEW ---
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Main Content Area (Tasks) */}
          <div className="lg:col-span-3">
            <TaskManager roomId={selectedRoomId} />
          </div>

          {/* Right Sidebar Area */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Timer at the TOP */}
            <PomodoroTimer roomId={selectedRoomId} />
            
            {/* Sidebar BELOW */}
            <RoomSidebar roomId={selectedRoomId} />
            
          </div>

        </div>
      ) : (
        // --- MAIN DASHBOARD VIEW ---
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Left Column */}
          <div className="space-y-6">
            <StudyTracker />
            
            {/* 3. WRAPPER FOR CREATE/JOIN TO LOOK LIKE A 'SECTION' */}
            <div className="bg-white/10 border-2 border-white/20 p-6 rounded-xl backdrop-blur-sm">
              <h2 className="text-xl font-bold mb-4 tracking-widest text-[#f0abfc]">
                ROOM CONTROLS
              </h2>
              <div className="space-y-6">
                <CreateRoom />
                <div className="border-t border-white/10 pt-6">
                   <JoinRoom />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div>
            <RoomList onSelectRoom={setSelectedRoomId} />
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;