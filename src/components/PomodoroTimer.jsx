import { useState, useEffect } from "react";

function PomodoroTimer({ roomId }) {
  const [time, setTime] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let timer;
    if (isRunning && time > 0) {
      timer = setInterval(() => {
        setTime((t) => t - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, time]);

  const minutes = Math.floor(time / 60);
  const seconds = time % 60;

  return (
    <div className="border p-4 rounded">
      <h2 className="text-xl font-bold">Pomodoro Timer 🍅</h2>
      <p className="text-3xl my-2">
        {minutes}:{seconds.toString().padStart(2, "0")}
      </p>

      <button onClick={() => setIsRunning(true)}>Start</button>
      <button onClick={() => setIsRunning(false)}>Pause</button>
      <button onClick={() => setTime(25 * 60)}>Reset</button>
    </div>
  );
}

export default PomodoroTimer;   // 🔥 THIS LINE IS REQUIRED
