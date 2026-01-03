import { useState, useEffect } from "react";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "../firebase";

function RoomSidebar({ roomId }) {
  const [roomData, setRoomData] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!roomId) return;

    const unsub = onSnapshot(doc(db, "rooms", roomId), async (roomSnap) => {
      if (roomSnap.exists()) {
        const data = roomSnap.data();
        setRoomData(data);

        if (data.members && data.members.length > 0) {
          const memberPromises = data.members.map(async (uid) => {
            try {
              const userSnap = await getDoc(doc(db, "users", uid));
              return userSnap.exists() 
                ? { uid, ...userSnap.data() } 
                : { uid, fullName: "Unknown User", username: "Guest" };
            } catch (error) {
              return { uid, fullName: "Error", username: "?" };
            }
          });

          const memberList = await Promise.all(memberPromises);
          setMembers(memberList);
        } else {
          setMembers([]);
        }
      }
      setLoading(false);
    });

    return () => unsub();
  }, [roomId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="text-gray-400 text-sm animate-pulse">Loading room...</div>;
  if (!roomData) return null;

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-purple-100 h-full flex flex-col">
      
      {/* 1. ROOM HEADER */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 break-words leading-tight">
          {roomData.name}
        </h2>
        <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider font-semibold">
          Study Session Active
        </p>
      </div>

      {/* 2. PROMINENT INVITE CODE CARD */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-4 text-center text-white shadow-md mb-8 transform transition hover:scale-[1.02]">
        <p className="text-xs font-medium text-purple-200 uppercase tracking-widest mb-2">
          Invite Friends
        </p>
        
        {/* The Code Box */}
        <div 
          onClick={handleCopy}
          className="bg-white/10 border-2 border-white/20 rounded-lg py-3 px-2 mb-3 cursor-pointer hover:bg-white/20 transition relative group"
        >
          <p className="text-xl font-mono font-bold tracking-widest break-all select-all">
            {roomId}
          </p>
          
          {/* Tooltip hint */}
          <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition">
            Click to Copy
          </span>
        </div>

        <button 
          onClick={handleCopy}
          className={`text-xs font-bold px-4 py-1.5 rounded-full transition shadow-sm ${
            copied 
              ? "bg-green-400 text-green-900" 
              : "bg-white text-purple-700 hover:bg-gray-100"
          }`}
        >
          {copied ? "COPIED! ✓" : "COPY CODE"}
        </button>
      </div>

      {/* 3. MEMBERS LIST */}
      <div className="flex-grow">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">
          Online Members ({members.length})
        </h3>
        
        <ul className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          {members.map((member) => (
            <li key={member.uid} className="flex items-center gap-3 group">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-white shadow-sm flex items-center justify-center text-sm font-bold text-purple-600 group-hover:border-purple-200 transition">
                {member.fullName ? member.fullName.charAt(0).toUpperCase() : "?"}
              </div>
              
              {/* Name Info */}
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-700 leading-tight">
                  {member.fullName}
                </span>
                <span className="text-[10px] text-gray-400 font-mono group-hover:text-purple-500 transition">
                  @{member.username}
                </span>
              </div>
              
              {/* Online Indicator (Visual only for now) */}
              <div className="ml-auto w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.6)]"></div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default RoomSidebar;