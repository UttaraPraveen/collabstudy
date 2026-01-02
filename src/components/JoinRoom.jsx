import { useState } from "react";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

function JoinRoom() {
  const [roomId, setRoomId] = useState("");
  const { user } = useAuth();

  const handleJoinRoom = async () => {
    if (!roomId) return alert("Enter room ID");

    try {
      const roomRef = doc(db, "rooms", roomId);
      await updateDoc(roomRef, {
        members: arrayUnion(user.uid),
      });
      alert("Joined room!");
      setRoomId("");
    } catch (error) {
      alert("Invalid room ID");
    }
  };

  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold mb-2">Join Study Room</h2>
      <input
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        placeholder="Enter Room ID"
        className="border p-2 mr-2"
      />
      <button
        onClick={handleJoinRoom}
        className="bg-green-600 text-white px-4 py-2 rounded"
      >
        Join
      </button>
    </div>
  );
}

export default JoinRoom;
