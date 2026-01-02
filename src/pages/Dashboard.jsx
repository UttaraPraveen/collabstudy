import { useState } from "react";
import { useNavigate } from "react-router-dom"; // 1. Import useNavigate
import { signOut } from "firebase/auth";        // 2. Import signOut
import { auth } from "../firebase";             // 3. Import auth instance

import JoinRoom from "../components/JoinRoom";
import CreateRoom from "../components/CreateRoom";
import RoomList from "../components/RoomList";
import TaskManager from "../components/TaskManager";

function Dashboard() {
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const navigate = useNavigate(); // 4. Initialize navigation

  // 5. Handle Logout Logic
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login"); // Redirect to Login after signing out
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        
        {/* Right Side Controls */}
        <div className="flex items-center gap-4">
          
          {/* Back Button (Only visible when inside a room) */}
          {selectedRoomId && (
            <button 
              onClick={() => setSelectedRoomId(null)}
              className="text-sm text-blue-600 underline"
            >
              ← Back to Room List
            </button>
          )}

          {/* Logout Button */}
          <button 
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded shadow-md transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* CONDITIONAL RENDERING */}
      {selectedRoomId ? (
        // IF ROOM SELECTED: Show Task Manager
        <TaskManager roomId={selectedRoomId} />
      ) : (
        // IF NO ROOM SELECTED: Show Dashboard Widgets
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <CreateRoom />
            <JoinRoom />
          </div>
          <div>
            {/* Pass the function to set the selected room */}
            <RoomList onSelectRoom={setSelectedRoomId} />
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;