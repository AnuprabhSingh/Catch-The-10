import { useEffect, useRef, useState } from "react";

export default function Landing({ socket, connected, onJoinRoom }) {
  const [currentPage, setCurrentPage] = useState("welcome"); // welcome, signup, menu, join, create
  const [playerName, setPlayerName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const playerNameRef = useRef(playerName);
  playerNameRef.current = playerName;
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;

  // Load from localStorage on mount
  useEffect(() => {
    const savedPlayerName = localStorage.getItem("playerName");
    const savedRoomId = localStorage.getItem("roomId");
    
    if (savedPlayerName) {
      setPlayerName(savedPlayerName);
    }
    if (savedRoomId) {
      setRoomId(savedRoomId);
      // If we have a saved room ID and player name, try to rejoin automatically
      if (savedPlayerName) {
        setCurrentPage("join");
      }
    }
  }, []);

  // Save to localStorage when they change
  useEffect(() => {
    if (playerName) {
      localStorage.setItem("playerName", playerName);
    }
  }, [playerName]);

  useEffect(() => {
    if (roomId) {
      localStorage.setItem("roomId", roomId);
    }
  }, [roomId]);

  useEffect(() => {
    if (!socket) return;

    const handleJoinSuccess = (payload) => {
      setIsLoading(false);
      setMessage("");
      onJoinRoom({
        roomId: payload.roomId,
        playerName: playerNameRef.current,
      });
    };

    const handleJoinError = (payload) => {
      setIsLoading(false);
      setMessage(payload?.reason || "Failed to join room");
    };

    socket.on("join_success", handleJoinSuccess);
    socket.on("join_error", handleJoinError);

    // Check for room and name parameters in URL
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get("room");
    const urlName = params.get("name");
    if (urlRoom && urlName) {
      // Auto-join: both room and name provided via URL
      setRoomId(urlRoom.toUpperCase());
      setPlayerName(urlName);
      playerNameRef.current = urlName;
      setIsLoading(true);
      socket.emit("join_room", { roomId: urlRoom.toUpperCase(), name: urlName });
      // Clean the URL params after auto-joining
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlRoom) {
      setRoomId(urlRoom.toUpperCase());
      setCurrentPage("signup");
    }

    return () => {
      socket.off("join_success", handleJoinSuccess);
      socket.off("join_error", handleJoinError);
    };
  }, [socket, onJoinRoom]);

  const handleSignUp = () => {
    if (!playerName.trim()) {
      setMessage("Please enter a player name");
      return;
    }
    // If we have a room from URL parameter, go directly to join
    if (roomId) {
      handleJoinRoom();
    } else {
      setCurrentPage("menu");
      setMessage("");
    }
  };

  const handleCreateRoom = () => {
    setIsLoading(true);
    const newRoomId = Math.random().toString(36).substr(2, 9).toUpperCase();
    setRoomId(newRoomId);
    socket.emit("join_room", { roomId: newRoomId, name: playerName });
  };

  const handleJoinRoom = () => {
    if (!roomId.trim()) {
      setMessage("Please enter a room ID");
      return;
    }
    setIsLoading(true);
    socket.emit("join_room", { roomId: roomId, name: playerName });
  };

  const clearSession = () => {
    localStorage.removeItem("playerName");
    localStorage.removeItem("roomId");
    setPlayerName("");
    setRoomId("");
    setMessage("");
    setCurrentPage("welcome");
  };

  const shareOnWhatsApp = () => {
    const roomLink = `${window.location.origin}?room=${roomId}`;
    const message = `🎴 Join me for "Catch the Ten"! 🎴\n\nRoom ID: ${roomId}\n\nJoin here: ${roomLink}\n\nLet's play!`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_rgba(30,64,175,0.3),_transparent_50%),radial-gradient(circle_at_bottom,_rgba(20,83,45,0.25),_transparent_55%),linear-gradient(135deg,_#020617,_#0f172a_55%,_#1e293b)] p-4 text-slate-100 flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Welcome Page */}
        {currentPage === "welcome" && (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <h1 className="text-5xl font-bold tracking-tight">
                🎴 Catch the Ten
              </h1>
              <p className="text-xl text-slate-300">
                A multiplayer card game for 4 players
              </p>
            </div>

            <div className="glass-panel rounded-3xl p-8 space-y-4">
              <p className="text-center text-slate-300">
                Test your strategy and skills in this exciting trick-taking card game. Ideal for playing with friends online!
              </p>
              <button
                onClick={() => setCurrentPage("signup")}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold transition-all duration-200 transform hover:scale-105"
              >
                Get Started
              </button>
            </div>

            <div className="text-center text-sm text-slate-400">
              <p>Status: {connected ? "🟢 Connected" : "🔴 Connecting..."}</p>
            </div>
          </div>
        )}

        {/* Sign Up Page */}
        {currentPage === "signup" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">Welcome!</h2>
              <p className="text-slate-300">Enter your player name to begin</p>
            </div>

            <div className="glass-panel rounded-3xl p-8 space-y-4">
              <input
                type="text"
                placeholder="Your player name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSignUp()}
                className="w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-4 py-3 text-white placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition"
                maxLength="20"
              />

              {message && (
                <div className="text-red-400 text-sm text-center bg-red-400/10 rounded-lg p-2">
                  {message}
                </div>
              )}

              <button
                onClick={handleSignUp}
                disabled={!playerName.trim()}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-semibold transition-all duration-200"
              >
                Continue
              </button>

              <button
                onClick={() => {
                  setCurrentPage("welcome");
                  setMessage("");
                }}
                className="w-full py-2 px-4 rounded-xl border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white font-semibold transition"
              >
                Back
              </button>

              <button
                onClick={clearSession}
                className="w-full py-2 px-4 rounded-xl border border-red-600/50 hover:border-red-500 text-red-400 hover:text-red-300 font-semibold transition text-sm"
              >
                Clear Session
              </button>
            </div>
          </div>
        )}

        {/* Menu Page */}
        {currentPage === "menu" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-1">Welcome, {playerName}! 👋</h2>
              <p className="text-slate-300">What would you like to do?</p>
            </div>

            <div className="glass-panel rounded-3xl p-8 space-y-3">
              <button
                onClick={() => {
                  setCurrentPage("create");
                  setMessage("");
                }}
                className="w-full py-4 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold transition-all duration-200 transform hover:scale-105 text-lg"
              >
                + Create a Room
              </button>

              <button
                onClick={() => {
                  setCurrentPage("join");
                  setMessage("");
                }}
                className="w-full py-4 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold transition-all duration-200 transform hover:scale-105 text-lg"
              >
                🔗 Join a Room
              </button>

              <button
                onClick={() => {
                  setCurrentPage("welcome");
                  setPlayerName("");
                  setMessage("");
                }}
                className="w-full py-2 px-4 rounded-xl border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white font-semibold transition"
              >
                Back
              </button>

              <button
                onClick={clearSession}
                className="w-full py-2 px-4 rounded-xl border border-red-600/50 hover:border-red-500 text-red-400 hover:text-red-300 font-semibold transition text-sm"
              >
                Clear Session & Logout
              </button>
            </div>
          </div>
        )}

        {/* Create Room Page */}
        {currentPage === "create" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-1">Create a Room</h2>
              <p className="text-slate-300">Start a new game session</p>
            </div>

            <div className="glass-panel rounded-3xl p-8 space-y-4">
              <div className="bg-emerald-400/10 border border-emerald-400/30 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-300 mb-2">You'll be the host of a new room</p>
                <p className="text-xs text-slate-400">You can share the room code with friends to invite them</p>
              </div>

              {message && (
                <div className="text-red-400 text-sm text-center bg-red-400/10 rounded-lg p-2">
                  {message}
                </div>
              )}

              <button
                onClick={handleCreateRoom}
                disabled={isLoading || !connected}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-semibold transition-all duration-200"
              >
                {isLoading ? "Creating..." : "Create Room"}
              </button>

              <button
                onClick={() => setCurrentPage("menu")}
                className="w-full py-2 px-4 rounded-xl border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white font-semibold transition"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Join Room Page */}
        {currentPage === "join" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-1">Join a Room</h2>
              <p className="text-slate-300">Enter the room code from your friend</p>
            </div>

            <div className="glass-panel rounded-3xl p-8 space-y-4">
              <input
                type="text"
                placeholder="Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === "Enter" && handleJoinRoom()}
                className="w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-4 py-3 text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 transition uppercase"
                maxLength="15"
              />

              {message && (
                <div className="text-red-400 text-sm text-center bg-red-400/10 rounded-lg p-2">
                  {message}
                </div>
              )}

              <button
                onClick={handleJoinRoom}
                disabled={isLoading || !roomId.trim() || !connected}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-semibold transition-all duration-200"
              >
                {isLoading ? "Joining..." : "Join Room"}
              </button>

              <button
                onClick={() => setCurrentPage("menu")}
                className="w-full py-2 px-4 rounded-xl border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white font-semibold transition"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
