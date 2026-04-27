import { useEffect, useState } from "react";

export default function RoomLobby({ roomId, playerName, gameState, onStartGame, onLeaveRoom }) {
  const [shareMessage, setShareMessage] = useState("");

  const shareOnWhatsApp = () => {
    const roomLink = `${window.location.origin}?room=${roomId}`;
    const message = `🎴 Join me for "Catch the Ten"! 🎴\n\nRoom ID: ${roomId}\n\n${window.location.origin}/?room=${roomId}\n\nLet's play!`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank");
    setShareMessage("Link shared! 🎉");
    setTimeout(() => setShareMessage(""), 3000);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setShareMessage("Room code copied! 📋");
    setTimeout(() => setShareMessage(""), 3000);
  };

  const playerCount = gameState?.players?.length || 0;
  const activePlayerCount =
    gameState?.activePlayerCount ??
    gameState?.players?.filter((player) => player.isConnected).length ??
    0;

  return (
    <div className="glass-panel rounded-3xl p-5 space-y-6 sm:p-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold sm:text-3xl">Room Created! 🎉</h2>
        <p className="text-slate-300">Waiting for players to join...</p>
      </div>

      <div className="bg-slate-900/50 rounded-2xl p-4 space-y-3 sm:p-6">
        <div>
          <p className="text-sm text-slate-400 mb-1">Room Code</p>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 bg-slate-950 rounded-lg px-3 py-3 font-mono text-base text-emerald-400 tracking-widest break-all sm:px-4 sm:text-lg">
              {roomId}
            </code>
            <button
              onClick={copyRoomCode}
              className="px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
              title="Copy room code"
            >
              📋
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-slate-400">Active Players ({activePlayerCount}/4)</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {gameState?.players?.map((player) => (
            <div
              key={player.playerId}
              className={`rounded-lg border p-3 text-center ${
                player.isConnected
                  ? "border-emerald-400/30 bg-emerald-400/10"
                  : "border-amber-400/30 bg-amber-400/10"
              }`}
            >
              <p className="font-semibold">{player.name}</p>
              <p className="text-xs text-slate-400">Seat {player.seatIndex + 1}</p>
              <p className="text-xs text-slate-500">
                {player.isConnected ? "Connected" : "Reconnecting..."}
              </p>
            </div>
          ))}
          {playerCount < 4 &&
            Array.from({ length: 4 - playerCount }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-center text-slate-500"
              >
                <p className="font-semibold">Waiting...</p>
                <p className="text-xs">Empty Seat</p>
              </div>
            ))}
        </div>
      </div>

      {shareMessage && (
        <div className="bg-emerald-400/10 border border-emerald-400/30 text-emerald-300 rounded-lg p-3 text-center text-sm">
          {shareMessage}
        </div>
      )}

      <div className="space-y-2">
        <button
          onClick={shareOnWhatsApp}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold transition-all duration-200 flex items-center justify-center gap-2"
        >
          💬 Share on WhatsApp
        </button>

        {playerCount === 4 && activePlayerCount === 4 && (
          <button
            onClick={onStartGame}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold transition-all duration-200 transform hover:scale-105"
          >
            🚀 Start Game
          </button>
        )}

        <button
          onClick={onLeaveRoom}
          className="w-full py-2 px-4 rounded-xl border border-slate-600 hover:border-red-500 text-slate-300 hover:text-red-400 font-semibold transition"
        >
          Leave Room
        </button>
      </div>

      <div className="text-xs text-slate-400 text-center">
        <p>💡 Share your room code with friends to invite them</p>
        <p>Game starts only when all 4 seats are filled and connected</p>
      </div>
    </div>
  );
}
