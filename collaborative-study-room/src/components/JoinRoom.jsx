import { useState } from "react";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

function JoinRoom() {
  const [roomId, setRoomId] = useState("");
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleJoinRoom = async () => {
    if (!roomId) return alert("Please enter a Room Code");
    setLoading(true);

    try {
      const roomRef = doc(db, "rooms", roomId);
      await updateDoc(roomRef, {
        members: arrayUnion(user.uid),
      });
      alert("Successfully joined the room!");
      setRoomId("");
    } catch (error) {
      console.error(error);
      alert("Invalid Room Code. Please check and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      <h2 className="text-lg font-bold text-gray-800 mb-2">Have a Code?</h2>
      <p className="text-xs text-gray-500 mb-3">
        Enter the Room Code shared by your friend to join.
      </p>
      
      <div className="flex gap-2">
        <input
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="Paste Room Code here..."
          className="border border-gray-300 p-2 rounded flex-grow focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
        />
        <button
          onClick={handleJoinRoom}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold transition whitespace-nowrap"
        >
          {loading ? "Joining..." : "Join Room"}
        </button>
      </div>
    </div>
  );
}

export default JoinRoom;