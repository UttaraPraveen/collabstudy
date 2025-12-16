import { useState } from "react";
import { db } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

function CreateRoom() {
  const [roomName, setRoomName] = useState("");
  const { user } = useAuth();

  const handleCreateRoom = async () => {
  console.log("Create room clicked");

  if (!roomName) {
    alert("Room name empty");
    return;
  }

  console.log("User UID:", user?.uid);

  try {
    const docRef = await addDoc(collection(db, "rooms"), {
      name: roomName,
      createdBy: user.uid,
      members: [user.uid],
      createdAt: serverTimestamp(),
    });

    console.log("Room created with ID:", docRef.id);
    alert("Room created!");
  } catch (error) {
    console.error("Firestore error:", error.code, error.message);
    alert(error.message);
  }
};


  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold mb-2">Create Study Room</h2>
      <input
        value={roomName}
        onChange={(e) => setRoomName(e.target.value)}
        placeholder="Room name"
        className="border p-2 mr-2"
      />
      <button
        onClick={handleCreateRoom}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Create
      </button>
    </div>
  );
}

export default CreateRoom;
