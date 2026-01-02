import { useState, useEffect } from "react";
import { db } from "../firebase";
import { addDoc, collection, serverTimestamp, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

function StudyTracker({ roomId }) {
  const { user } = useAuth();
  const [isStudying, setIsStudying] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [todayMinutes, setTodayMinutes] = useState(0);

  const startStudy = () => {
    setStartTime(Date.now());
    setIsStudying(true);
  };

  const stopStudy = async () => {
    const endTime = Date.now();
    const duration = Math.floor((endTime - startTime) / 60000);

    await addDoc(collection(db, "rooms", roomId, "studySessions"), {
      userId: user.uid,
      duration,
      createdAt: serverTimestamp(),
    });

    setIsStudying(false);
    setStartTime(null);
  };

  useEffect(() => {
    if (!roomId || !user) return;

    const q = query(
      collection(db, "rooms", roomId, "studySessions"),
      where("userId", "==", user.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const total = snapshot.docs.reduce(
        (sum, doc) => sum + doc.data().duration,
        0
      );
      setTodayMinutes(total);
    });

    return () => unsub();
  }, [roomId, user]);

  return (
    <div className="bg-white p-5 rounded-lg shadow-md mt-6">
      <h2 className="text-xl font-bold mb-3">Study Tracker</h2>

      <p className="mb-4 text-gray-600">
        Today’s study time: <span className="font-semibold">{todayMinutes} mins</span>
      </p>

      {!isStudying ? (
        <button
          onClick={startStudy}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Start Studying
        </button>
      ) : (
        <button
          onClick={stopStudy}
          className="bg-red-600 text-white px-4 py-2 rounded"
        >
          Stop Studying
        </button>
      )}
    </div>
  );
}

export default StudyTracker;
