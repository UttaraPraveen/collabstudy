import { useEffect, useState } from "react";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { collection, query, where, onSnapshot, doc, deleteDoc } from "firebase/firestore";

function RoomList({ onSelectRoom }) {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "rooms"),
      where("members", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      roomData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setRooms(roomData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const copyToClipboard = (e, code, roomId) => {
    e.stopPropagation();
    if (!code || code === "XXXXXX") return;
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(roomId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleDelete = async (e, roomId) => {
    e.stopPropagation();
    if (!window.confirm("Delete this room?")) return;
    try {
      await deleteDoc(doc(db, "rooms", roomId));
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) return <div className="text-center py-10 text-white/20 animate-pulse font-black italic">SYNCING...</div>;

  return (
    <div className="space-y-4">
      {rooms.map((room) => {
        const roomCode = room.roomCode || room.code || "XXXXXX";
        return (
          <div
            key={room.id}
            onClick={() => onSelectRoom(room.id)}
            className="group bg-white/5 hover:bg-white/10 border border-white/10 p-5 rounded-[2rem] transition-all cursor-pointer flex items-center justify-between shadow-2xl overflow-hidden"
          >
            {/* LEFT SIDE: ROOM NAME & LABEL */}
            <div className="flex flex-col gap-1 min-w-0">
              <h3 className="font-black text-white text-lg uppercase tracking-tight truncate leading-tight">
                {room.name}
              </h3>
              <span className="text-[8px] bg-white/10 text-white/50 w-fit px-2 py-1 rounded-lg font-black uppercase tracking-widest border border-white/5">
                STUDY ROOM
              </span>
            </div>

            {/* RIGHT SIDE: ALIGNED ACTIONS */}
            <div className="flex items-center gap-4">
              
              {/* VERTICAL STACK: DELETE + COPY */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={(e) => handleDelete(e, room.id)}
                  className="p-2 text-white/10 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                  title="Delete"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                </button>

                <button
                  onClick={(e) => copyToClipboard(e, roomCode, room.id)}
                  className={`text-[9px] font-mono font-bold tracking-widest px-2 py-1 rounded-lg border transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    copiedId === room.id 
                    ? "bg-emerald-500 text-white border-emerald-400" 
                    : "bg-emerald-400/10 text-emerald-400 border-emerald-400/20 hover:bg-emerald-400/20"
                  }`}
                >
                  <span>{copiedId === room.id ? "DONE!" : `#${roomCode}`}</span>
                  {copiedId !== room.id && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  )}
                </button>
              </div>
              
              {/* DIVIDER */}
              <div className="h-14 w-[1px] bg-white/10"></div>

              {/* ENTER BUTTON */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectRoom(room.id);
                }}
                className="bg-white/10 hover:bg-white text-white hover:text-purple-900 px-6 py-4 rounded-2xl text-[10px] font-black tracking-[0.2em] transition-all border border-white/10 active:scale-95 shadow-xl"
              >
                ENTER
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default RoomList;