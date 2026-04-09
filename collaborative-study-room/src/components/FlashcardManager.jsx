import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

function FlashcardManager({ basePath, title, onSelectDeck }) {
  const { user } = useAuth();
  const [decks, setDecks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, basePath, "decks"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDecks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user, basePath]);

  const handleDeleteDeck = async (e, deckId) => {
    e.stopPropagation(); 
    if (window.confirm("Are you sure you want to delete this deck?")) {
      try {
        await deleteDoc(doc(db, basePath, "decks", deckId));
      } catch (error) {
        console.error("Error deleting deck:", error);
      }
    }
  };

  const handleCreateDeck = async (e) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;
    try {
      await addDoc(collection(db, basePath, "decks"), {
        name: newDeckName,
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });
      setNewDeckName("");
      setShowModal(false);
    } catch (error) {
      console.error("Error creating deck:", error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center mb-6 px-2">
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
          MY STUDY DECKS
        </h2>
        <button 
          onClick={() => setShowModal(!showModal)} 
          className="bg-[#0f172a] text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
        >
          {showModal ? "CANCEL" : "+ NEW DECK"}
        </button>
      </div>

      {/* CREATE DECK FORM */}
      {showModal && (
        <div className="mb-8 p-6 bg-slate-50/80 border border-slate-100 rounded-[2.5rem] animate-in fade-in slide-in-from-top duration-300">
          <form onSubmit={handleCreateDeck} className="space-y-4">
            <input 
              autoFocus
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
              placeholder="Deck Name (e.g. Biology, React Hooks)"
              className="w-full p-4 bg-white border border-slate-100 rounded-2xl focus:outline-none focus:border-indigo-500 font-bold text-slate-800 placeholder:text-slate-300 shadow-inner"
            />
            <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98]">
              CREATE DECK
            </button>
          </form>
        </div>
      )}

      {/* GRID LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {decks.map((deck) => (
          <div 
            key={deck.id}
            onClick={() => onSelectDeck && onSelectDeck(deck)}
            className="group relative bg-white p-6 rounded-[2rem] shadow-sm border-t-4 border-emerald-500 hover:shadow-xl transition-all cursor-pointer active:scale-[0.98]"
          >
            <div className="flex justify-between items-start mb-4">
              {/* Deck/Cards Icon */}
              <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-emerald-50 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="9" y1="21" x2="9" y2="9"/>
                </svg>
              </div>

              <button 
                onClick={(e) => handleDeleteDeck(e, deck.id)}
                className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all rounded-md"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            </div>

            <h3 className="font-black text-slate-800 text-sm truncate mb-1 uppercase tracking-tight">
              {deck.name}
            </h3>
            
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest group-hover:underline">
              Open Deck →
            </span>
          </div>
        ))}
      </div>

      {/* EMPTY STATE */}
      {decks.length === 0 && !showModal && (
        <div className="text-center py-20 opacity-20">
           <p className="font-black italic tracking-widest text-lg">NO DECKS CREATED</p>
        </div>
      )}
    </div>
  );
}

export default FlashcardManager;