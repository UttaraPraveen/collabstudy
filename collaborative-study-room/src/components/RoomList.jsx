import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

function RoomList({ onSelectRoom }) {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "rooms"),
      where("members", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRooms(roomData);
    });

    return () => unsubscribe();
  }, [user]);

  const handleCopy = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000); // Reset "Copied" message after 2s
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-3 text-gray-800">Your Study Rooms</h2>

      {rooms.length === 0 && <p className="text-gray-500 italic">No rooms joined yet.</p>}

      {rooms.map((room) => (
        <div
          key={room.id}
          className="border border-gray-200 p-5 rounded-lg mb-4 bg-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition"
        >
          {/* Room Info */}
          <div>
            <h3 className="font-bold text-lg text-indigo-900">{room.name}</h3>
            
            {/* The "Share Code" Section */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Share Code:
              </span>
              <div 
                className="bg-gray-100 border border-gray-300 px-2 py-1 rounded text-sm font-mono text-purple-700 font-bold tracking-wider cursor-pointer hover:bg-white select-all"
                title="Click to select"
              >
                {room.id}
              </div>
              
              {/* Copy Button */}
              <button 
                onClick={() => handleCopy(room.id)}
                className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded transition"
              >
                {copiedId === room.id ? "✅ Copied!" : "📋 Copy"}
              </button>
            </div>
          </div>
          
          {/* Action Button */}
          <button
            onClick={() => onSelectRoom(room.id)}
            className="bg-indigo-600 text-white px-5 py-2 rounded-md font-medium hover:bg-indigo-700 transition shadow-sm whitespace-nowrap"
          >
            Enter Room →
          </button>
        </div>
      ))}
    </div>
  );
}

export default RoomList;