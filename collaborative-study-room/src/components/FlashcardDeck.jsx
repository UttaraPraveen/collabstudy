import { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";

// SM-2 Algorithm Helper (Preserved)
const calculateSM2 = (card, quality) => {
  let { interval = 0, repetition = 0, ef = 2.5 } = card;
  if (quality >= 3) {
    if (repetition === 0) interval = 1;
    else if (repetition === 1) interval = 6;
    else interval = Math.round(interval * ef);
    repetition += 1;
  } else {
    repetition = 0;
    interval = 1; 
  }
  ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ef < 1.3) ef = 1.3;
  return { interval, repetition, ef };
};

function FlashcardDeck({ collectionPath, deckName, onBack }) {
  const [activeCards, setActiveCards] = useState([]); 
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [mode, setMode] = useState("smart"); 
  const [statusMsg, setStatusMsg] = useState(""); 

  // --- ADDED STATES TO FIX "ADD CARD" ERROR ---
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");

  useEffect(() => {
    const q = query(collection(db, collectionPath), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ 
        id: doc.id, 
        ...doc.data(),
        nextReview: doc.data().nextReview || 0, 
      }));
      const now = Date.now();
      const due = data.filter(c => c.nextReview <= now);
      if (activeCards.length === 0) {
        setActiveCards(mode === "smart" ? due : data);
      }
    });
    return () => unsubscribe();
  }, [collectionPath, mode]);

  // PRESERVED: Logic to prevent answer leak and handle Again/Hard/Good/Easy
  const handleGrade = async (quality) => {
    const currentCard = activeCards[currentIndex];
    if (!currentCard) return;

    if (quality === 3) setStatusMsg("⏳ Reviewing tomorrow...");
    else if (quality === 4) setStatusMsg("✅ See you in 3 days!");
    else if (quality === 5) setStatusMsg("🚀 Mastered! 1 week break.");
    else if (quality === 0) setStatusMsg("🔄 Coming back soon...");

    const { interval, repetition, ef } = calculateSM2(currentCard, quality);
    const nextDate = quality === 0 
      ? Date.now() 
      : Date.now() + (interval * 24 * 60 * 60 * 1000);

    updateDoc(doc(db, collectionPath, currentCard.id), {
      nextReview: nextDate,
      interval, repetition, ef
    });

    // Flip back first to fix the video glitch
    setIsFlipped(false); 

    setTimeout(() => {
      setStatusMsg(""); 
      if (quality === 0) {
        setActiveCards((prev) => {
          const newCards = [...prev];
          const [movedCard] = newCards.splice(currentIndex, 1);
          return [...newCards, movedCard];
        });
      } else {
        const remaining = activeCards.filter(c => c.id !== currentCard.id);
        setActiveCards(remaining);
        if (currentIndex >= remaining.length && remaining.length > 0) {
          setCurrentIndex(0);
        }
      }
    }, 500); 
  };

  // --- FIXED: ADD CARD FUNCTION ---
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;

    try {
      await addDoc(collection(db, collectionPath), {
        front: front,
        back: back,
        createdAt: serverTimestamp(),
        nextReview: Date.now(), 
        interval: 0,
        repetition: 0,
        ef: 2.5
      });
      setFront("");
      setBack("");
      setIsAdding(false);
    } catch (error) {
      console.error("Error adding card:", error);
    }
  };

  const handleDelete = async () => {
    const currentCard = activeCards[currentIndex];
    if (!currentCard || !window.confirm("Delete this card?")) return;
    await deleteDoc(doc(db, collectionPath, currentCard.id));
    setActiveCards(prev => prev.filter(c => c.id !== currentCard.id));
    setIsFlipped(false);
  };

  const currentCardData = activeCards[currentIndex];

  return (
    <div className="bg-white/95 backdrop-blur-3xl rounded-[2rem] shadow-xl border border-white/40 p-6 flex flex-col relative min-h-[420px]">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 px-2">
        <button onClick={onBack} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition shadow-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{deckName}</h2>
        <div className="flex gap-2">
          <button onClick={() => setIsAdding(!isAdding)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition hover:bg-indigo-700 shadow-md">
            {isAdding ? "✕" : "+ CARD"}
          </button>
          {!isAdding && (
             <button 
                onClick={() => { setMode(mode === "smart" ? "cram" : "smart"); setActiveCards([]); }}
                className={`text-[9px] font-black border px-3 py-2 rounded-xl uppercase tracking-widest transition ${mode === 'cram' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-slate-200 text-slate-400'}`}
             >
                {mode === "smart" ? "Cram Mode" : "Smart Mode"}
             </button>
          )}
        </div>
      </div>

      {/* CARD STAGE */}
      <div className="relative h-[220px]">
        {isAdding ? (
          <form onSubmit={handleAdd} className="flex flex-col gap-2 h-full justify-center animate-in fade-in duration-300">
            <input 
              placeholder="Question..." 
              value={front} 
              onChange={(e) => setFront(e.target.value)} 
              className="p-3 rounded-xl border border-slate-100 bg-slate-50 text-slate-900 text-[11px] font-bold outline-none focus:border-indigo-400 shadow-inner" 
            />
            <textarea 
              placeholder="Answer..." 
              value={back} 
              onChange={(e) => setBack(e.target.value)} 
              className="p-3 rounded-xl border border-slate-100 bg-slate-50 text-slate-900 text-[11px] font-bold h-24 resize-none outline-none focus:border-indigo-400 shadow-inner" 
            />
            <button type="submit" className="bg-emerald-500 text-white py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-emerald-600 transition">
              Save Card
            </button>
          </form>
        ) : activeCards.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/30">
            <p className="text-3xl mb-1">✨</p>
            <p className="font-black text-slate-800 uppercase tracking-tight text-[10px]">Session Complete</p>
          </div>
        ) : (
          <div
            key={currentCardData?.id || currentIndex}
            onClick={() => !statusMsg && setIsFlipped(!isFlipped)}
            className="relative w-full h-full cursor-pointer transition-transform duration-700 [transform-style:preserve-3d]"
            style={{ transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
          >
            {/* FRONT */}
            <div className="absolute inset-0 bg-white border border-slate-100 rounded-[2.5rem] flex items-center justify-center p-6 text-center shadow-lg [backface-visibility:hidden]">
              <p className="text-slate-800 text-lg font-black tracking-tight">{currentCardData?.front}</p>
              <div className="absolute bottom-4 text-[8px] font-black text-indigo-300 uppercase tracking-widest">Tap to reveal</div>
            </div>

            {/* BACK */}
            <div className="absolute inset-0 bg-indigo-600 rounded-[2.5rem] flex flex-col items-center justify-center p-6 text-center shadow-2xl [transform:rotateY(180deg)] [backface-visibility:hidden] border-4 border-white/10">
              <p className="text-white text-sm font-bold mb-4">{currentCardData?.back}</p>
              
              {/* REPLY MESSAGE OVERLAY */}
              {statusMsg && (
                <div className="absolute bottom-6 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 animate-pulse">
                  <span className="text-white text-[10px] font-black uppercase tracking-widest">{statusMsg}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CONTROLS */}
      {!isAdding && activeCards.length > 0 && (
        <div className="mt-8">
          {isFlipped ? (
            <div className="grid grid-cols-4 gap-2">
              {[
                {l:"Again", q:0, c:"bg-rose-50 text-rose-600 border-rose-100"}, 
                {l:"Hard", q:3, c:"bg-orange-50 text-orange-600 border-orange-100"}, 
                {l:"Good", q:4, c:"bg-blue-50 text-blue-600 border-blue-100"}, 
                {l:"Easy", q:5, c:"bg-emerald-50 text-emerald-700 border-emerald-100"}
              ].map(b => (
                <button 
                  key={b.l} 
                  disabled={!!statusMsg}
                  onClick={(e)=>{e.stopPropagation(); handleGrade(b.q)}} 
                  className={`${b.c} border py-4 rounded-2xl font-black text-[9px] uppercase tracking-tighter hover:scale-105 transition-all shadow-sm disabled:opacity-50`}
                >
                  {b.l}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between px-2">
               <button onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => (prev === 0 ? activeCards.length - 1 : prev - 1)); setIsFlipped(false); }} className="p-4 bg-slate-50 hover:bg-indigo-50 rounded-2xl text-slate-400 transition">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M15 18l-6-6 6-6"/></svg>
               </button>
               <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{currentIndex + 1} / {activeCards.length}</span>
                  <button onClick={(e)=>{e.stopPropagation(); handleDelete()}} className="text-rose-400 hover:text-rose-600 text-[8px] font-black uppercase tracking-widest mt-1 opacity-50">Delete</button>
               </div>
               <button onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => (prev + 1) % activeCards.length); setIsFlipped(false); }} className="p-4 bg-slate-50 hover:bg-indigo-50 rounded-2xl text-slate-400 transition">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 18l6-6-6-6"/></svg>
               </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FlashcardDeck;