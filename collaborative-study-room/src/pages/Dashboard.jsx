import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; 
import { signOut } from "firebase/auth";        
import { auth, db } from "../firebase"; 
import { doc, getDoc } from "firebase/firestore"; 
import { useAuth } from "../context/AuthContext";

// Component Imports
import JoinRoom from "../components/JoinRoom";
import CreateRoom from "../components/CreateRoom";
import RoomList from "../components/RoomList";
import TaskManager from "../components/TaskManager";
import PomodoroTimer from "../components/Pomodoro"; 
import StudyTracker from "../components/StudyTracker"; 
import VideoRoom from "../components/VideoRoom";
import FlashcardManager from "../components/FlashcardManager";
import FlashcardDeck from "../components/FlashcardDeck"; 
import CollaborativeEditor from "../components/CollaborativeEditor"; 
import RoomResources from "../components/RoomResources";
import UniversalLibrary from "../components/UniversalLibrary";
import EncryptedChat from "../components/EncryptedChat";
import AmbientSoundscape from "../components/AmbientSoundscape";

function Dashboard() {
  const { user } = useAuth(); 
  const navigate = useNavigate(); 
  const [displayName, setDisplayName] = useState("SCHOLAR");
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [isFlowActive, setIsFlowActive] = useState("focus");
  const [activeDeck, setActiveDeck] = useState(null); 
  const [currentRoomName, setCurrentRoomName] = useState("");
  const [currentRoomCode, setCurrentRoomCode] = useState("");
  const [currentRoomHostId, setCurrentRoomHostId] = useState(null); 
  const [copied, setCopied] = useState(false); 
  
  // Stats object
  const [userStats] = useState({ 
    streak: 0, 
    bestStreak: 0,
    pomodorosToday: 0, 
    pomodorosYesterday: 0,
    hoursThisWeek: 0, 
    goalHours: 25,
    flashcardAccuracy: 87,
    flashcardAccuracyLastWeek: 82
  });
  
  // MODAL & UI STATES
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [modalIcon, setModalIcon] = useState("📚");
  const [modalColor, setModalColor] = useState("green");
  const [modalPrivacy, setModalPrivacy] = useState("public");
  
  const [modalRoomName, setModalRoomName] = useState("");
  const [modalDescription, setModalDescription] = useState("What are you studying?");
  const [modalMaxMembers, setModalMaxMembers] = useState("10");

  const iconsList = ['📚', '🔬', '🧮', '💻', '🎨', '🌍', '🛸', '🎵', '📝', '🏛️', '🧬', '🚀'];
  const colorsList = [
    { id: 'purple', bg: 'bg-purple-600' },
    { id: 'blue', bg: 'bg-blue-600' },
    { id: 'green', bg: 'bg-emerald-600' },
    { id: 'red', bg: 'bg-rose-600' },
    { id: 'orange', bg: 'bg-amber-600' }
  ];

  useEffect(() => {
    if (user?.uid) {
      getDoc(doc(db, "users", user.uid)).then(snap => {
        if (snap.exists()) setDisplayName(snap.data().fullName?.toUpperCase() || "SCHOLAR");
      });
    }
  }, [user]);

  const enterRoom = async (roomId) => {
    const roomDoc = await getDoc(doc(db, "rooms", roomId));
    if (roomDoc.exists()) {
      const data = roomDoc.data();
      setCurrentRoomName(data.name || "STUDY ROOM");
      setCurrentRoomCode(data.code || data.roomCode || roomId);
      setCurrentRoomHostId(data.createdBy);
    }
    setSelectedRoomId(roomId);
  };

  const handleLogout = async () => { await signOut(auth); navigate("/login"); };

  const handleCopyCode = () => {
    if (currentRoomCode) {
      navigator.clipboard.writeText(currentRoomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openSettingsModal = () => {
    setModalRoomName(currentRoomName);
    setIsSettingsModalOpen(true);
  };

  const saveRoomSettings = () => {
    if(modalRoomName.trim() !== "") {
      setCurrentRoomName(modalRoomName);
    }
    setIsSettingsModalOpen(false);
  };

  const focusBg = "bg-gradient-to-b from-[#e879f9] to-[#4c1d95]";
  const breakBg = "bg-gradient-to-b from-[#34d399] to-[#065f46]";

  const statsConfig = [
    { 
      label: "Pomodoros Today", 
      val: userStats.pomodorosToday, 
      color: "border-purple-400",
      trend: `${userStats.pomodorosToday - userStats.pomodorosYesterday >= 0 ? "↑ +" : "↓ "}${userStats.pomodorosToday - userStats.pomodorosYesterday} vs yesterday`,
      trendColor: userStats.pomodorosToday - userStats.pomodorosYesterday >= 0 ? "text-emerald-500" : "text-rose-500",
      icon: "🍅"
    },
    { 
      label: "Study Streak", 
      val: `${userStats.streak}d`, 
      color: "border-amber-400",
      trend: userStats.streak >= userStats.bestStreak ? "↑ Personal best!" : `↓ Best: ${userStats.bestStreak}d`,
      trendColor: userStats.streak >= userStats.bestStreak ? "text-emerald-500" : "text-rose-500",
      icon: "🔥"
    },
    { 
      label: "Flashcard Accuracy", 
      val: `${userStats.flashcardAccuracy}%`, 
      color: "border-emerald-400",
      trend: `${userStats.flashcardAccuracy - userStats.flashcardAccuracyLastWeek >= 0 ? "↑ +" : "↓ "}${userStats.flashcardAccuracy - userStats.flashcardAccuracyLastWeek}% this week`,
      trendColor: userStats.flashcardAccuracy - userStats.flashcardAccuracyLastWeek >= 0 ? "text-emerald-500" : "text-rose-500",
      icon: "🧠"
    },
    { 
      label: "Hours This Week", 
      val: `${Number(userStats.hoursThisWeek).toFixed(1)}h`, 
      color: "border-rose-400",
      trend: userStats.hoursThisWeek >= userStats.goalHours ? "↑ Goal reached!" : `↓ Goal: ${userStats.goalHours}h`,
      trendColor: userStats.hoursThisWeek >= userStats.goalHours ? "text-emerald-500" : "text-rose-500",
      icon: "⏱️"
    }
  ];

  return (
    <div className={`min-h-screen p-3 sm:p-6 font-mono text-white transition-all duration-1000 ${isFlowActive === "break" ? breakBg : focusBg} relative`}>
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5 md:gap-0 mb-8 sm:mb-10 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-4 sm:gap-6 w-full md:w-auto">
          {selectedRoomId && (
            <button onClick={() => setSelectedRoomId(null)} className="p-3 sm:p-4 bg-white/10 hover:bg-white/20 rounded-xl sm:rounded-[1.5rem] border border-white/10 shadow-xl transition active:scale-95 shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
          )}
          <div className="flex-grow">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tighter drop-shadow-md truncate max-w-full">
              {selectedRoomId ? currentRoomName : `HI, ${displayName} 👋`}
            </h1>
            <p className="text-white/60 text-[8px] sm:text-[10px] mt-1 sm:mt-2 tracking-[0.2em] sm:tracking-[0.4em] font-bold uppercase truncate">
              {selectedRoomId ? `LIVE ROOM ID: ${currentRoomCode}` : "Workspace Overview"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full md:w-auto justify-start md:justify-end">
          <button onClick={() => setIsFlowActive(isFlowActive === "break" ? "focus" : "break")} className={`flex-1 md:flex-none flex justify-center items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-[1.5rem] border shadow-xl transition-all duration-500 ${isFlowActive === "break" ? "bg-emerald-500 border-emerald-300" : "bg-white/10 border-white/20 hover:bg-white/20"}`}>
            <span className="text-lg sm:text-xl">{isFlowActive === "break" ? "🧘" : "☕"}</span>
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Take Break</span>
          </button>
          <button onClick={handleLogout} className="flex-1 md:flex-none bg-black/90 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-[1.5rem] font-black tracking-[0.2em] text-[9px] sm:text-[10px] shadow-2xl hover:bg-white hover:text-black transition-all">LOGOUT</button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto">
        {selectedRoomId ? (
          <div className="grid grid-cols-12 gap-4 sm:gap-6 items-stretch animate-in fade-in slide-in-from-bottom duration-700">
            
            {/* FIXED: VIDEO ROOM set to span-6 */}
            <div className="col-span-12 lg:col-span-6 h-[350px] lg:h-[450px]">
              <div className="bg-[#1a1b4b]/80 backdrop-blur-md rounded-3xl lg:rounded-[2.5rem] p-1 border border-white/10 shadow-2xl h-full">
                <VideoRoom roomId={selectedRoomId} />
              </div>
            </div>

            {/* FIXED: STUDY DECKS set to span-3 */}
            <div className="col-span-12 lg:col-span-3 h-[400px] lg:h-[450px]">
              <div className="bg-[#fcf8fa] backdrop-blur-md rounded-3xl lg:rounded-[2.5rem] p-4 sm:p-5 border border-white/20 shadow-inner flex flex-col w-full h-full">
                {activeDeck ? (
                  <FlashcardDeck deckName={activeDeck.name} collectionPath={`rooms/${selectedRoomId}/decks/${activeDeck.id}/cards`} onBack={() => setActiveDeck(null)} />
                ) : (
                  <div className="flex-grow overflow-y-auto custom-scrollbar">
                    <FlashcardManager basePath={`rooms/${selectedRoomId}`} onSelectDeck={(deck) => setActiveDeck(deck)} />
                  </div>
                )}
              </div>
            </div>

            {/* FOCUS TIMER (span-3) */}
            <div className="col-span-12 lg:col-span-3">
              <div className="bg-white rounded-3xl lg:rounded-[2.5rem] p-5 sm:p-8 shadow-xl border border-purple-100 text-slate-800 h-full">
                <PomodoroTimer roomId={selectedRoomId} onRunningChange={setIsFlowActive} />
              </div>
            </div>
            
            {/* LEFT COLUMN: SHARED NOTES, TASKS, AND RESOURCES */}
            <div className="col-span-12 lg:col-span-9 flex flex-col gap-4 sm:gap-6">
              <div className="bg-white rounded-3xl lg:rounded-[2.5rem] p-1 shadow-2xl min-h-[350px] lg:min-h-[500px] overflow-hidden w-full">
                <CollaborativeEditor roomId={selectedRoomId} />
              </div>
              
              <div className="w-full">
                <TaskManager roomId={selectedRoomId} />
              </div>
              
              <div className="w-full flex-grow flex flex-col [&>*]:flex-grow [&>*]:h-full min-h-[300px]">
                <RoomResources roomId={selectedRoomId} isHost={currentRoomHostId === user?.uid} />
              </div>
            </div>

            {/* RIGHT COLUMN: MUSIC, CHAT & ROOM DETAILS PANEL */}
            <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 sm:gap-6">
              <div className="bg-white/10 backdrop-blur-md rounded-3xl lg:rounded-[2.5rem] p-5 sm:p-6 border border-white/10 shadow-2xl">
                 <AmbientSoundscape roomId={selectedRoomId} />
              </div>
              <div className="bg-indigo-900/40 backdrop-blur-md rounded-3xl lg:rounded-[2.5rem] p-1 border border-white/20 shadow-2xl min-h-[350px] lg:min-h-[450px] overflow-hidden">
                <EncryptedChat roomId={selectedRoomId} roomCode={currentRoomCode} />
              </div>

              {/* ROOM DETAILS PANEL */}
              <div className="bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] rounded-3xl lg:rounded-[2.5rem] p-5 sm:p-6 shadow-2xl border border-purple-400/20 text-white flex flex-col gap-4 sm:gap-5">
                <div className="bg-[#065f46] rounded-2xl p-4 flex justify-between items-center shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="text-xl">📚</div>
                    <div className="font-black tracking-widest text-[9px] sm:text-[10px] uppercase">Study Space</div>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] sm:text-[10px] font-bold text-emerald-100">
                    <span>🌐</span> <span>·</span> <span>1/10</span>
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight drop-shadow-md break-words">{currentRoomName}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"></span>
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-emerald-400">1 Online</span>
                  </div>
                </div>

                <div className="border border-white/10 rounded-2xl p-1 bg-white/5">
                  <div className="p-3 pb-1">
                    <div className="text-[8px] sm:text-[9px] font-black tracking-widest opacity-60 uppercase">Invite Code</div>
                  </div>
                  <div 
                    onClick={handleCopyCode}
                    className="bg-[#4c1d95] rounded-xl py-4 sm:py-6 cursor-pointer hover:bg-[#5b21b6] transition shadow-inner flex flex-col items-center justify-center"
                  >
                    <div className="text-xl sm:text-2xl font-black tracking-[0.2em] sm:tracking-[0.4em] text-emerald-400">{currentRoomCode}</div>
                    <div className={`text-[7px] sm:text-[8px] uppercase tracking-widest mt-2 font-black transition-colors ${copied ? 'text-emerald-400' : 'opacity-60'}`}>
                      {copied ? "COPIED!" : "Click to Copy"}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={openSettingsModal}
                  className="w-full bg-[#6d28d9] hover:bg-[#7c3aed] border border-white/10 py-3 sm:py-4 rounded-2xl font-black text-[9px] sm:text-[10px] tracking-widest uppercase shadow-lg transition flex items-center justify-center gap-2"
                >
                  <span>⚙️</span> Edit Room Settings
                </button>

                <div>
                  <div className="text-[8px] sm:text-[9px] font-black tracking-widest opacity-60 uppercase mb-3 px-1">Study Buddies</div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:bg-white/10 transition overflow-hidden">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#f472b6] flex items-center justify-center font-black text-white relative shadow-md shrink-0">
                      {displayName.charAt(0)}
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-400 rounded-full border-2 border-[#5b21b6]"></div>
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm tracking-wide truncate">You</div>
                      {currentRoomHostId === user?.uid && (
                        <div className="text-[7px] sm:text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 sm:px-2 py-0.5 rounded uppercase tracking-wider inline-block mt-0.5 sm:mt-1 font-black">Host</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* OVERVIEW SECTION - RESPONSIVE GRIDS */
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 sm:gap-8 items-start animate-in fade-in duration-500">
             <div className="xl:col-span-3 space-y-6 sm:space-y-8">
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {statsConfig.map((item, i) => (
                  <div key={i} className={`bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl border-t-4 ${item.color} text-slate-800 transition hover:-translate-y-1 relative overflow-hidden flex flex-col justify-between min-h-[120px] sm:min-h-[140px]`}>
                    <div className="z-10 relative">
                      <div className="text-[9px] sm:text-[11px] font-black text-slate-400 mb-1 sm:mb-2 leading-tight">{item.label}</div>
                      <div className="text-3xl sm:text-4xl font-black tracking-tighter">{item.val}</div>
                    </div>
                    <div className={`text-[8px] sm:text-[10px] font-black mt-3 sm:mt-4 z-10 relative tracking-wide ${item.trendColor}`}>
                      {item.trend}
                    </div>
                    <div className="absolute -bottom-4 -right-4 sm:-bottom-6 sm:-right-4 text-[4rem] sm:text-[5.5rem] opacity-[0.08] grayscale pointer-events-none">
                      {item.icon}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[#fcf8fa] backdrop-blur-md rounded-3xl lg:rounded-[2.5rem] p-5 sm:p-8 shadow-2xl border border-white/40"><h2 className="text-lg sm:text-xl font-black text-slate-800 mb-4 sm:mb-6 uppercase tracking-tight">Activity Map</h2><StudyTracker /></div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 h-auto lg:h-[600px]">
                <div className="bg-white/80 backdrop-blur-md rounded-3xl lg:rounded-[2.5rem] p-5 sm:p-8 shadow-2xl flex flex-col h-[400px] lg:h-auto">{activeDeck ? <FlashcardDeck deckName={activeDeck.name} collectionPath={`users/${user?.uid}/decks/${activeDeck.id}/cards`} onBack={() => setActiveDeck(null)} /> : <FlashcardManager basePath={`users/${user?.uid}`} onSelectDeck={(deck) => setActiveDeck(deck)} />}</div>
                <div className="bg-white/10 backdrop-blur-md rounded-3xl lg:rounded-[2.5rem] p-5 sm:p-8 shadow-2xl flex flex-col border border-white/20 h-[400px] lg:h-auto"><h2 className="text-lg sm:text-xl font-black text-white mb-4 sm:mb-6 uppercase tracking-tight">Global Library</h2><UniversalLibrary /></div>
              </div>
            </div>
            
            <div className="xl:col-span-1 space-y-4 sm:space-y-6 sticky top-6">
              <div className="bg-white/10 backdrop-blur-md rounded-3xl lg:rounded-[2.5rem] p-5 sm:p-6 shadow-2xl border border-white/20">
                <h2 className="text-[9px] sm:text-[10px] font-black tracking-[0.3em] text-[#f0abfc] uppercase mb-3 sm:mb-4 px-2">Management</h2>
                <div className="flex flex-col gap-4"><CreateRoom /><div className="border-t border-white/5 pt-4"><JoinRoom /></div></div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-3xl lg:rounded-[2.5rem] p-5 sm:p-6 shadow-2xl border border-white/20">
                <h2 className="text-base sm:text-lg font-black mb-4 sm:mb-6 tracking-widest text-[#f0abfc] uppercase text-center italic">Active Rooms</h2>
                <RoomList onSelectRoom={enterRoom} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SETTINGS MODAL */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-[200] animate-in fade-in duration-200 p-4 text-white">
          <div className="bg-[#1e1b4b] w-full max-w-md rounded-3xl sm:rounded-[2rem] overflow-hidden shadow-2xl border border-white/10">
            <div className="bg-[#065f46] p-5 sm:p-6 flex justify-between items-center relative">
              <div className="flex items-center gap-3 pr-8">
                <div className="text-xl sm:text-2xl drop-shadow-md">{modalIcon}</div>
                <div>
                  <h3 className="font-black text-lg sm:text-xl uppercase tracking-tight leading-none mb-1 truncate max-w-[200px]">{modalRoomName || currentRoomName}</h3>
                  <p className="text-[8px] sm:text-[9px] font-bold tracking-widest uppercase opacity-80 flex flex-wrap gap-1 sm:gap-2">
                    <span>STUDY SPACE</span> <span className="hidden sm:inline">·</span> <span>{modalPrivacy === 'public' ? '🌐 Public' : '🔒 Private'}</span> <span className="hidden sm:inline">·</span> <span>Max {modalMaxMembers || '10'}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => setIsSettingsModalOpen(false)} className="opacity-50 hover:opacity-100 transition absolute top-5 sm:top-6 right-5 sm:right-6">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sm:w-6 sm:h-6"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-5 sm:p-6 flex flex-col gap-5 sm:gap-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase opacity-70 mb-2 block">Room Name *</label>
                <input 
                  type="text" 
                  value={modalRoomName}
                  onChange={(e) => setModalRoomName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold focus:outline-none focus:border-purple-500 transition" 
                />
              </div>
              
              <div>
                <label className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase opacity-70 mb-2 block">Description</label>
                <textarea 
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold focus:outline-none focus:border-purple-500 transition resize-none h-20 sm:h-24"
                ></textarea>
              </div>

              <div>
                <label className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase opacity-70 mb-2 block">Room Icon</label>
                <div className="flex flex-wrap gap-2 text-lg sm:text-xl bg-white/5 p-2 rounded-2xl border border-white/10 w-fit">
                   {iconsList.map(icon => (
                     <div 
                       key={icon}
                       onClick={() => setModalIcon(icon)}
                       className={`p-1.5 sm:p-2 rounded-xl cursor-pointer transition ${
                         modalIcon === icon 
                           ? 'border-2 border-purple-400 bg-white/10 scale-105' 
                           : 'opacity-50 hover:opacity-100 border-2 border-transparent'
                       }`}
                     >
                       {icon}
                     </div>
                   ))}
                </div>
              </div>

              <div>
                <label className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase opacity-70 mb-2 block">Room Colour</label>
                <div className="flex flex-wrap gap-3">
                  {colorsList.map(c => (
                    <div 
                      key={c.id}
                      onClick={() => setModalColor(c.id)}
                      className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full cursor-pointer ${c.bg} transition-all duration-200 ${
                        modalColor === c.id 
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1e1b4b] scale-110' 
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase opacity-70 mb-2 block">Max Members</label>
                  <input 
                    type="number" 
                    value={modalMaxMembers}
                    onChange={(e) => setModalMaxMembers(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold focus:outline-none focus:border-purple-500 transition" 
                  />
                </div>

                <div>
                  <label className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase opacity-70 mb-2 block">Privacy</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setModalPrivacy('public')}
                      className={`flex-1 rounded-xl py-2.5 sm:py-3 text-xs sm:text-sm flex justify-center items-center transition ${
                        modalPrivacy === 'public' 
                          ? 'bg-purple-600 shadow-lg' 
                          : 'bg-white/5 border border-white/10 opacity-50 hover:opacity-100'
                      }`}
                    >
                      🌐
                    </button>
                    <button 
                      onClick={() => setModalPrivacy('private')}
                      className={`flex-1 rounded-xl py-2.5 sm:py-3 text-xs sm:text-sm flex justify-center items-center transition ${
                        modalPrivacy === 'private' 
                          ? 'bg-purple-600 shadow-lg' 
                          : 'bg-white/5 border border-white/10 opacity-50 hover:opacity-100'
                      }`}
                    >
                      🔒
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-2">
                <button onClick={() => setIsSettingsModalOpen(false)} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-3 sm:py-4 text-[9px] sm:text-[10px] font-black tracking-widest uppercase transition">Cancel</button>
                <button onClick={saveRoomSettings} className="w-full bg-purple-600 hover:bg-purple-500 shadow-[0_0_20px_rgba(147,51,234,0.4)] rounded-xl py-3 sm:py-4 text-[9px] sm:text-[10px] font-black tracking-widest uppercase transition">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Dashboard;