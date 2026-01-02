import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  query, 
  orderBy 
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

    // Ordered by deadline
    const taskRef = collection(db, "rooms", roomId, "tasks");
    const q = query(taskRef, orderBy("deadline", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTasks(taskData);
    });

    return () => unsubscribe();
  }, [roomId]);

  const addTask = async () => {
    if (!taskTitle || !deadline) return alert("Fill all fields");
    if (!roomId) return; // Safety check

    try {
      await addDoc(collection(db, "rooms", roomId, "tasks"), {
        title: taskTitle,
        deadline,
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
    await updateDoc(taskRef, {
      completed: !currentStatus,
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Room Tasks</h2>

      {/* Input Section */}
      <div className="flex flex-col md:flex-row gap-3 mb-6 p-4 bg-gray-50 rounded">
        <input
          placeholder="What needs to be done?"
          value={taskTitle}
          onChange={(e) => setTaskTitle(e.target.value)}
          className="border p-2 rounded flex-grow"
        />
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="border p-2 rounded"
        />
        <button
          onClick={addTask}
          className="bg-blue-600 text-white px-6 py-2 rounded font-semibold hover:bg-blue-700"
        >
          Add Task
        </button>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-center justify-between p-4 border rounded transition ${
              task.completed ? "bg-gray-100" : "bg-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <input 
                type="checkbox"
                checked={task.completed}
                onChange={() => toggleTask(task.id, task.completed)}
                className="w-5 h-5 cursor-pointer accent-green-600"
              />
              <div>
                <p
                  className={`font-semibold ${
                    task.completed ? "line-through text-gray-400" : "text-gray-800"
                  }`}
                >
                  {task.title}
                </p>
                <p className="text-xs text-gray-500">Due: {task.deadline}</p>
              </div>
            </div>
            
            <span className={`text-xs px-2 py-1 rounded ${task.completed ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
               {task.completed ? "Done" : "Pending"}
            </span>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-center text-gray-400 mt-4">No tasks yet. Add one above!</p>}
      </div>
    </div>
  );
}

export default TaskManager;