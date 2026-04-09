import { useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";

function VideoRoom({ roomId }) {
  const { user } = useAuth();
  const videoContainerRef = useRef(null);
  const joinedRef = useRef(false); 

  useEffect(() => {
    let isMounted = true;
    if (!videoContainerRef.current || !user || !roomId) return;
    if (joinedRef.current) return; 

    const startMeeting = async () => {
      // Ensure AppID is a Number. strings cause WebSocket 403/closed errors.
      const appID = Number(import.meta.env.VITE_ZEGO_APP_ID);
      const serverSecret = import.meta.env.VITE_ZEGO_SERVER_SECRET;

      if (!appID || !serverSecret) return;

      try {
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appID,
          serverSecret,
          roomId,             
          user.uid,           
          user.displayName || "Scholar" 
        );

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        
        if (isMounted) {
          joinedRef.current = true; 
          zp.joinRoom({
            container: videoContainerRef.current,
            scenario: { mode: ZegoUIKitPrebuilt.GroupCall },
            
            // All requested options enabled
            showScreenSharingButton: true,      
            showPreJoinView: false,             
            turnOnCameraWhenJoining: false,     
            turnOnMicrophoneWhenJoining: false, 
            showTextChat: true,           
            showUserList: true,           
            showRoomDetailsButton: true,  
            showLayoutButton: true,       
            maxUsers: 4,
            layout: "Grid",
          });
        }
      } catch (error) {
        console.error("ZegoCloud Failed:", error);
        if (isMounted) joinedRef.current = false;
      }
    };

    startMeeting();
    return () => { isMounted = false; };
  }, [roomId, user]);

  return (
    // FIXED: Removed overflow-hidden from this container so right-side buttons don't get clipped!
    <div className="bg-[#1a1b4b] rounded-[2.5rem] shadow-2xl flex flex-col h-full border border-white/10 relative w-full">
      
      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#1a1b4b] rounded-t-[2.5rem] z-20 border-b border-white/5">
        <div className="flex flex-col">
          <h2 className="text-[10px] font-black text-white tracking-[0.2em] uppercase italic opacity-80">Live Study Group</h2>
          <span className="text-[8px] text-indigo-300 font-bold uppercase mt-1">ROOM: {roomId}</span>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[9px] text-emerald-400 font-black uppercase tracking-wider">Connected</span>
        </div>
      </div>

      <div className="flex-grow relative w-full bg-[#111114] rounded-b-[2.5rem]">
        <div 
          ref={videoContainerRef} 
          className="absolute inset-0 w-full h-full" 
        />
      </div>

    </div>
  );
}

export default VideoRoom;