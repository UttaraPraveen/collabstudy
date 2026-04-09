import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

function TaskManager({ roomId }) {
  const { user } = useAuth();
  const [taskTitle, setTaskTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    if (!roomId) return;
    const taskRef = collection(db, "rooms", roomId, "tasks");
    
    // Ordered by creation time to keep new tasks at the bottom
    const q = query(taskRef, orderBy("createdAt", "asc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTasks(taskData);
    });
    return () => unsubscribe();
  }, [roomId]);

  const addTask = async () => {
    if (!taskTitle) return alert("Please enter a task title");
    if (!roomId) return;
    try {
      await addDoc(collection(db, "rooms", roomId, "tasks"), {
        title: taskTitle,
        deadline: deadline || "No Date", 
        createdBy: user.uid,
        completed: false,
        createdAt: serverTimestamp(),
      });
      setTaskTitle("");
      setDeadline("");
    } catch (err) {
      console.error(err);
      alert("Failed to add task");
    }
  };

  const toggleTask = async (taskId, currentStatus) => {
    const taskRef = doc(db, "rooms", roomId, "tasks", taskId);
    await updateDoc(taskRef, { completed: !currentStatus });
  };

  return (
    <div className="bg-[#fdfaff] rounded-[2.5rem] shadow-2xl border border-purple-50 p-8 h-full flex flex-col transition-all duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            Room Tasks
          </h2>
          <p className="text-[#a78bfa] text-xs font-black tracking-widest uppercase mt-1">Keep track of group goals</p>
        </div>
        <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-purple-100">
          <span className="text-purple-600 font-black text-[10px]">{tasks.length}</span>
        </div>
      </div>

      {/* INPUT SECTION */}
      <div className="mb-6 p-4 bg-white rounded-[2rem] border border-purple-50 shadow-inner flex flex-col lg:flex-row gap-3 items-center">
        <input
          placeholder="What needs to be done?"
          value={taskTitle}
          onChange={(e) => setTaskTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          className="flex-grow p-4 bg-transparent outline-none font-bold text-slate-700 placeholder:text-slate-300 placeholder:font-black w-full"
        />
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="p-3 bg-transparent outline-none font-black text-slate-500 text-[10px] tracking-widest uppercase cursor-pointer"
          />
          <button
            onClick={addTask}
            className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white px-8 py-4 rounded-2xl font-black text-[10px] tracking-widest uppercase shadow-lg shadow-purple-200 transition active:scale-95 w-full lg:w-auto"
          >
            Add
          </button>
        </div>
      </div>

      {/* FIXED: SCROLLABLE TASK LIST SECTION (max height strictly set) */}
      <div className="flex-grow overflow-y-auto max-h-[170px] pr-2 custom-scrollbar space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            onClick={() => toggleTask(task.id, task.completed)}
            className={`group flex items-center justify-between p-5 rounded-3xl cursor-pointer transition-all duration-300 border border-transparent ${
              task.completed
                ? "bg-slate-50 opacity-60"
                : "bg-white shadow-md hover:border-purple-200 hover:shadow-lg hover:-translate-y-0.5"
            }`}
          >
            <div className="flex items-center gap-5">
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                  task.completed
                    ? "bg-purple-500 border-purple-500"
                    : "border-[#d8b4fe] group-hover:border-purple-400"
                }`}
              >
                {task.completed && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

              <div>
                <p className={`font-black text-sm transition-all duration-300 tracking-wide ${task.completed ? "line-through text-slate-400" : "text-slate-700"}`}>
                  {task.title}
                </p>
                <div className="flex items-center mt-1">
                  <p className={`text-[9px] font-black tracking-widest uppercase ${task.completed ? "text-slate-300" : "text-[#a78bfa]"}`}>
                    {task.deadline}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="h-full flex items-center justify-center text-[10px] font-black tracking-[0.3em] uppercase text-slate-300 py-10">
            No tasks yet. Group goals go here!
          </div>
        )}
      </div>
      
    </div>
  );
}

export default TaskManager;