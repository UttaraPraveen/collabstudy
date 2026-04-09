import { useState, useEffect } from "react";
import { db } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

function PomodoroTimer({ roomId }) {
  const { user } = useAuth();

  const FOCUS_TIME = 25 * 60;
  const BREAK_TIME = 5 * 60;

  const [timeLeft, setTimeLeft] = useState(FOCUS_TIME);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedHours, setSelectedHours] = useState(1);
  const [mode, setMode] = useState("focus");
  const [cyclesTotal, setCyclesTotal] = useState(0);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const isBreak = mode === "break";

  const handleStartPlan = () => {
    const totalCycles = selectedHours * 2;
    setCyclesTotal(totalCycles);
    setCyclesCompleted(0);
    setMode("focus");
    setTimeLeft(FOCUS_TIME);
    setIsSessionActive(true);
    setIsRunning(true);
  };

  const saveSession = async () => {
    try {
if (!user?.uid) return;  
await addDoc(collection(db, "users", user.uid, "studySessions"), {        duration: 25,
        type: "pomodoro",
        roomId: roomId || "personal",
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const switchPhase = () => {
    if (mode === "focus") {
      saveSession();
      const completed = cyclesCompleted + 1;
      setCyclesCompleted(completed);

      if (completed >= cyclesTotal) {
        setIsSessionActive(false);
        setIsRunning(false);
        alert("🎉 Study goal completed!");
        setMode("focus");
        setTimeLeft(FOCUS_TIME);
        return;
      }

      setMode("break");
      setTimeLeft(BREAK_TIME);
    } else {
      setMode("focus");
      setTimeLeft(FOCUS_TIME);
    }
  };

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          switchPhase();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, mode, cyclesCompleted]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsSessionActive(false);
    setCyclesCompleted(0);
    setMode("focus");
    setTimeLeft(FOCUS_TIME);
  };

  return (
    <div
      className={`p-8 rounded-[2rem] transition-all duration-700 shadow-xl border-2
      ${
        isBreak
          ? "bg-emerald-500 border-emerald-300 text-white"
          : "bg-white border-purple-100 text-slate-800"
      }`}
    >
      {!isSessionActive ? (
        <div className="text-center space-y-6">
          <h2 className="text-2xl font-black">Focus Timer</h2>
          <p className="opacity-70 font-bold uppercase tracking-wider text-xs">Set your study goal</p>

          <select
            value={selectedHours}
            onChange={(e) => setSelectedHours(Number(e.target.value))}
            className="w-full p-4 rounded-2xl border-2 font-bold text-slate-700 outline-none focus:border-purple-300"
          >
            {[...Array(12)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1} Hour ({(i + 1) * 2} Cycles)
              </option>
            ))}
          </select>

          <button
            onClick={handleStartPlan}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold tracking-widest uppercase text-sm"
          >
            Start Study Plan
          </button>

          <p className="text-xs opacity-60 font-bold uppercase tracking-widest mt-2">
            5-min breaks included
          </p>
        </div>
      ) : (
        <div className="text-center">
          <div className="flex justify-between mb-6">
            <span
              className={`px-4 py-1 rounded-full text-xs font-black tracking-widest
              ${
                isBreak
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "bg-rose-500 text-white shadow-md"
              }`}
            >
              {isBreak ? "☕ BREAK MODE" : "🔥 FOCUS MODE"}
            </span>

            <span className="text-xs font-bold opacity-70 tracking-wider">
              Cycle {Math.ceil((cyclesCompleted + 1) / 2)} of{" "}
              {cyclesTotal / 2}
            </span>
          </div>

          <div className="text-8xl font-black mb-8 tracking-tighter drop-shadow-sm">
            {formatTime(timeLeft)}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`flex-1 py-4 rounded-2xl font-bold uppercase tracking-wider text-sm shadow-md transition-all
              ${
                isRunning
                  ? "bg-amber-400 text-amber-950 hover:bg-amber-300"
                  : "bg-[#1a0533] text-white hover:bg-[#2d0b59]"
              }`}
            >
              {isRunning ? "Pause" : "Resume"}
            </button>

            <button
              onClick={handleReset}
              className="flex-1 py-4 rounded-2xl bg-white text-slate-800 border-2 border-slate-100 font-bold uppercase tracking-wider text-sm hover:bg-slate-50 transition-all"
            >
              Reset
            </button>
          </div>

          <div className="mt-8">
            <div className={`h-3 rounded-full overflow-hidden ${isBreak ? 'bg-white/30' : 'bg-slate-100'}`}>
              <div
                className={`h-full transition-all duration-700 ${isBreak ? 'bg-white' : 'bg-purple-500'}`}
                style={{
width: `${cyclesTotal ? (cyclesCompleted / cyclesTotal) * 100 : 0}%`,                }}
              />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-3 opacity-60">Session Progress</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default PomodoroTimer;