import { useParams } from "react-router-dom";
import PomodoroTimer from "../components/PomodoroTimer";
import TaskManager from "../components/TaskManager";
import StudyTracker from "../components/StudyTracker";

function RoomPage() {
  const { roomId } = useParams();

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">
        Study Room
      </h1>

      <PomodoroTimer roomId={roomId} />
      <TaskManager roomId={roomId} />
      <StudyTracker roomId={roomId} />

    </div>
  );
}

export default RoomPage;
