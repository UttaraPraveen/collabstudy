import { useState } from "react";
import { doc, updateDoc, arrayUnion, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

function JoinRoom() {
  const [roomInput, setRoomInput] = useState("");
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleJoinRoom = async (e) => {
    if (e) e.preventDefault();
    
    const cleanCode = roomInput.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 6) {
      return alert("Please enter a valid 6-character Room Code");
    }

    setLoading(true);

    try {
      const roomsRef = collection(db, "rooms");
      let targetRoomId = null;
      let roomName = "";

      // 1. Check for 'roomCode' field first
      let q = query(roomsRef, where("roomCode", "==", cleanCode));
      let snapshot = await getDocs(q);

      // 2. If not found, check 'code' field (for compatibility)
      if (snapshot.empty) {
        q = query(roomsRef, where("code", "==", cleanCode));
        snapshot = await getDocs(q);
      }

      if (!snapshot.empty) {
        // Found the room!
        const docSnap = snapshot.docs[0];
        targetRoomId = docSnap.id;
        roomName = docSnap.data().name;

        // Check if user is already in the room to avoid unnecessary writes
        if (docSnap.data().members?.includes(user.uid)) {
          alert("You are already a member of this room!");
          setLoading(false);
          return;
        }
      } else {
        // Fallback: If the user entered a direct Document ID
        targetRoomId = cleanCode;
      }

      // 3. Add the user to the members array
      const roomRef = doc(db, "rooms", targetRoomId);
      await updateDoc(roomRef, {
        members: arrayUnion(user.uid),
      });
      
      alert(`Successfully joined: ${roomName || "New Room"}`);
      setRoomInput(""); // Clear input on success
      
    } catch (error) {
      console.error("Join Error:", error);
      alert("Invalid Room Code or ID. Please check and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] shadow-2xl w-full">
      <h3 className="text-white font-black uppercase tracking-[0.2em] text-sm mb-2">
        Have a Code?
      </h3>
      <p className="text-[10px] text-purple-200/50 mb-5 uppercase font-bold tracking-widest">
        Enter the 6-character Room Code to join.
      </p>
      
      <div className="flex flex-col gap-4">
        <input
          type="text"
          value={roomInput}
          onChange={(e) => setRoomInput(e.target.value)}
          placeholder="E.G. HX92KP"
          maxLength={20} // Allow longer for direct ID fallback, but 6 is standard
          className="w-full bg-white/5 border border-white/10 text-white placeholder-white/10 p-4 rounded-2xl focus:outline-none focus:border-emerald-400/50 font-mono text-sm uppercase tracking-[0.3em] transition-all"
        />
        
        <button
          onClick={handleJoinRoom}
          disabled={loading}
          className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all shadow-xl active:scale-95 ${
            loading 
            ? "bg-white/10 text-white/20 cursor-wait" 
            : "bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/20"
          }`}
        >
          {loading ? "SEARCHING..." : "Join Room"}
        </button>
      </div>
    </div>
  );
}

export default JoinRoom;