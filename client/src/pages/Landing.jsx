import { useEffect, useRef, useState } from "react";

const buildRoomId = () => Math.random().toString(36).slice(2, 11).toUpperCase();

export default function Landing({
  connected,
  initialRoomId,
  initialPlayerName,
  isJoining,
  message,
  onClearSession,
  onJoinRequest
}) {
  const [currentPage, setCurrentPage] = useState("welcome");
  const [playerName, setPlayerName] = useState(initialPlayerName || "");
  const [roomId, setRoomId] = useState(initialRoomId || "");
  const [localMessage, setLocalMessage] = useState("");
  const autoJoinRef = useRef(null);
  const hasTriggeredAutoJoinRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get("room");
    const urlName = params.get("name");

    if (urlRoom && urlName) {
      const nextRoomId = urlRoom.toUpperCase();
      const nextPlayerName = urlName.trim();
      autoJoinRef.current = {
        roomId: nextRoomId,
        playerName: nextPlayerName
      };
      setRoomId(nextRoomId);
      setPlayerName(nextPlayerName);
      setCurrentPage("join");
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (urlRoom) {
      setRoomId(urlRoom.toUpperCase());
      setCurrentPage("signup");
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (initialPlayerName) {
      setCurrentPage(initialRoomId ? "join" : "menu");
    }
  }, [initialPlayerName, initialRoomId]);

  useEffect(() => {
    if (!connected || !autoJoinRef.current || hasTriggeredAutoJoinRef.current) {
      return;
    }

    hasTriggeredAutoJoinRef.current = true;
    onJoinRequest(autoJoinRef.current);
  }, [connected, onJoinRequest]);

  const submitJoinRequest = (nextRoomId) => {
    if (!playerName.trim()) {
      setLocalMessage("Please enter a player name");
      return;
    }

    if (!nextRoomId.trim()) {
      setLocalMessage("Please enter a room ID");
      return;
    }

    setLocalMessage("");
    onJoinRequest({
      roomId: nextRoomId.trim().toUpperCase(),
      playerName: playerName.trim()
    });
  };

  const handleSignUp = () => {
    if (!playerName.trim()) {
      setLocalMessage("Please enter a player name");
      return;
    }

    if (roomId.trim()) {
      submitJoinRequest(roomId);
      return;
    }

    setLocalMessage("");
    setCurrentPage("menu");
  };

  const handleCreateRoom = () => {
    const nextRoomId = buildRoomId();
    setRoomId(nextRoomId);
    submitJoinRequest(nextRoomId);
  };

  const handleJoinRoom = () => {
    submitJoinRequest(roomId);
  };

  const clearSession = () => {
    setPlayerName("");
    setRoomId("");
    setLocalMessage("");
    setCurrentPage("welcome");
    autoJoinRef.current = null;
    hasTriggeredAutoJoinRef.current = false;
    onClearSession();
  };

  const shareOnWhatsApp = () => {
    const roomLink = `${window.location.origin}?room=${roomId}`;
    const shareMessage = `Join me for Catch the Ten!\n\nRoom ID: ${roomId}\n\nJoin here: ${roomLink}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(whatsappUrl, "_blank");
  };

  const displayMessage = localMessage || message;

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(30,64,175,0.3),_transparent_50%),radial-gradient(circle_at_bottom,_rgba(20,83,45,0.25),_transparent_55%),linear-gradient(135deg,_#020617,_#0f172a_55%,_#1e293b)] p-4 text-slate-100">
      <div className="w-full max-w-md">
        {currentPage === "welcome" && (
          <div className="space-y-6">
            <div className="space-y-3 text-center">
              <h1 className="text-5xl font-bold tracking-tight">Catch the Ten</h1>
              <p className="text-xl text-slate-300">A multiplayer card game for 4 players</p>
            </div>

            <div className="glass-panel space-y-4 rounded-3xl p-8">
              <p className="text-center text-slate-300">
                Test your strategy and skills in this trick-taking game built for live multiplayer
                play.
              </p>
              <button
                onClick={() => setCurrentPage("signup")}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 font-semibold text-white transition-all duration-200 hover:from-emerald-600 hover:to-teal-600"
              >
                Get Started
              </button>
            </div>

            <div className="text-center text-sm text-slate-400">
              <p>Status: {connected ? "Connected" : "Connecting..."}</p>
            </div>
          </div>
        )}

        {currentPage === "signup" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="mb-2 text-3xl font-bold">Welcome!</h2>
              <p className="text-slate-300">Enter your player name to begin</p>
            </div>

            <div className="glass-panel space-y-4 rounded-3xl p-8">
              <input
                type="text"
                placeholder="Your player name"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && handleSignUp()}
                className="w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-4 py-3 text-white placeholder-slate-400 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                maxLength="20"
              />

              {displayMessage && (
                <div className="rounded-lg bg-red-400/10 p-2 text-center text-sm text-red-400">
                  {displayMessage}
                </div>
              )}

              <button
                onClick={handleSignUp}
                disabled={!playerName.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:from-slate-600 disabled:to-slate-600 hover:from-emerald-600 hover:to-teal-600"
              >
                Continue
              </button>

              <button
                onClick={() => {
                  setCurrentPage("welcome");
                  setLocalMessage("");
                }}
                className="w-full rounded-xl border border-slate-600 px-4 py-2 font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Back
              </button>

              <button
                onClick={clearSession}
                className="w-full rounded-xl border border-red-600/50 px-4 py-2 text-sm font-semibold text-red-400 transition hover:border-red-500 hover:text-red-300"
              >
                Clear Session
              </button>
            </div>
          </div>
        )}

        {currentPage === "menu" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="mb-1 text-3xl font-bold">Welcome, {playerName}!</h2>
              <p className="text-slate-300">What would you like to do?</p>
            </div>

            <div className="glass-panel space-y-3 rounded-3xl p-8">
              <button
                onClick={() => {
                  setCurrentPage("create");
                  setLocalMessage("");
                }}
                className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-rose-500 px-4 py-4 text-lg font-semibold text-white transition-all duration-200 hover:from-fuchsia-600 hover:to-rose-600"
              >
                Create a Room
              </button>

              <button
                onClick={() => {
                  setCurrentPage("join");
                  setLocalMessage("");
                }}
                className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-4 text-lg font-semibold text-white transition-all duration-200 hover:from-blue-600 hover:to-cyan-600"
              >
                Join a Room
              </button>

              <button
                onClick={() => {
                  setCurrentPage("welcome");
                  setPlayerName("");
                  setLocalMessage("");
                }}
                className="w-full rounded-xl border border-slate-600 px-4 py-2 font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Back
              </button>

              <button
                onClick={clearSession}
                className="w-full rounded-xl border border-red-600/50 px-4 py-2 text-sm font-semibold text-red-400 transition hover:border-red-500 hover:text-red-300"
              >
                Clear Session & Logout
              </button>
            </div>
          </div>
        )}

        {currentPage === "create" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="mb-1 text-3xl font-bold">Create a Room</h2>
              <p className="text-slate-300">Start a new game session</p>
            </div>

            <div className="glass-panel space-y-4 rounded-3xl p-8">
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-center">
                <p className="mb-2 text-sm text-slate-300">You&apos;ll host a new room.</p>
                <p className="text-xs text-slate-400">Share the room code with friends to invite them.</p>
              </div>

              {displayMessage && (
                <div className="rounded-lg bg-red-400/10 p-2 text-center text-sm text-red-400">
                  {displayMessage}
                </div>
              )}

              <button
                onClick={handleCreateRoom}
                disabled={isJoining || !connected}
                className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-rose-500 px-4 py-3 font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:from-slate-600 disabled:to-slate-600 hover:from-fuchsia-600 hover:to-rose-600"
              >
                {isJoining ? "Creating..." : "Create Room"}
              </button>

              <button
                onClick={() => setCurrentPage("menu")}
                className="w-full rounded-xl border border-slate-600 px-4 py-2 font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {currentPage === "join" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="mb-1 text-3xl font-bold">Join a Room</h2>
              <p className="text-slate-300">Enter the room code from your friend</p>
            </div>

            <div className="glass-panel space-y-4 rounded-3xl p-8">
              <input
                type="text"
                placeholder="Room ID"
                value={roomId}
                onChange={(event) => setRoomId(event.target.value.toUpperCase())}
                onKeyDown={(event) => event.key === "Enter" && handleJoinRoom()}
                className="w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-4 py-3 text-white placeholder-slate-400 uppercase transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
                maxLength="15"
              />

              {displayMessage && (
                <div className="rounded-lg bg-red-400/10 p-2 text-center text-sm text-red-400">
                  {displayMessage}
                </div>
              )}

              <button
                onClick={handleJoinRoom}
                disabled={isJoining || !roomId.trim() || !connected}
                className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-3 font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:from-slate-600 disabled:to-slate-600 hover:from-blue-600 hover:to-cyan-600"
              >
                {isJoining ? "Joining..." : "Join Room"}
              </button>

              <button
                onClick={() => setCurrentPage("menu")}
                className="w-full rounded-xl border border-slate-600 px-4 py-2 font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Back
              </button>

              {roomId && (
                <button
                  onClick={shareOnWhatsApp}
                  className="w-full rounded-xl border border-emerald-500/50 px-4 py-2 font-semibold text-emerald-300 transition hover:border-emerald-400 hover:text-emerald-200"
                >
                  Share Room on WhatsApp
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
