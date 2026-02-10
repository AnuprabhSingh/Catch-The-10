import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import Card from "./components/Card";
import Deck from "./components/Deck";
import PlayerSeat from "./components/PlayerSeat";
import ScoreBoard from "./components/ScoreBoard";
import Table from "./components/Table";
import RoomLobby from "./components/RoomLobby";
import Landing from "./pages/Landing";
import { SUIT_LABELS } from "./utils/cards";

const SERVER_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function App() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [joined, setJoined] = useState(false);
  const [inLobby, setInLobby] = useState(true);
  const [gameState, setGameState] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const socket = io(SERVER_URL, { 
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("game_state", (state) => {
      setGameState(state);
      setMessage("");
      setJoined(true);
      // Show lobby if in LOBBY phase, show game otherwise
      if (state.phase === "LOBBY") {
        setInLobby(true);
      } else {
        setInLobby(false);
      }
    });

    socket.on("invalid_move", (payload) => {
      setMessage(payload?.reason || "Invalid move");
    });

    socket.on("trick_result", (payload) => {
      if (payload?.message) {
        setMessage(payload.message);
      }
    });

    socket.on("trump_decided", (payload) => {
      if (payload?.trumpSuit) {
        const label = SUIT_LABELS[payload.trumpSuit] || payload.trumpSuit;
        setMessage(`Trump suit decided: ${label}`);
      }
    });

    socket.on("join_success", (payload) => {
      setJoined(true);
      setInLobby(true);
    });

    socket.on("join_error", (payload) => {
      setMessage(payload?.reason || "Failed to join room");
      setJoined(false);
    });

    socket.on("game_over", (payload) => {
      if (payload?.result) {
        setMessage(payload.result);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const yourIndex = gameState?.yourPlayerIndex ?? null;
  const yourPlayer =
    yourIndex != null ? gameState?.players?.find((p) => p.seatIndex === yourIndex) : null;
  const isYourTurn = gameState?.currentTurnIndex === yourIndex;
  const isShuffling = gameState?.phase === "TRUMP_DISCOVERY" && !!gameState?.trumpSuit;

  const canStart = useMemo(() => {
    return gameState?.phase === "LOBBY" && (gameState?.players?.length ?? 0) === 4;
  }, [gameState]);

  const joinRoom = () => {
    if (!roomId || !playerName) {
      setMessage("Enter a room name and player name.");
      return;
    }
    socketRef.current.emit("join_room", { roomId, name: playerName });
    setJoined(true);
  };

  const startGame = () => {
    socketRef.current.emit("start_game", { roomId });
  };

  const leaveRoom = () => {
    socketRef.current.emit("leave_room", { roomId });
    setJoined(false);
    setInLobby(true);
    setRoomId("");
    setPlayerName("");
    setGameState(null);
  };

  const handleJoinRoom = ({ roomId: newRoomId, playerName: newPlayerName }) => {
    setRoomId(newRoomId);
    setPlayerName(newPlayerName);
    // join_room is already emitted from Landing using the shared socket
    // join_success listener above will set joined=true
  };

  const playCard = (card) => {
    if (!isYourTurn) return;
    socketRef.current.emit("play_card", { roomId, cardId: card.id });
  };

  const renderSeat = (seatIndex, position) => {
    const player =
      seatIndex == null
        ? null
        : gameState?.players?.find((p) => p.seatIndex === seatIndex) || null;
    return (
      <PlayerSeat
        key={`${position}-${seatIndex ?? "empty"}`}
        player={player}
        position={position}
        isCurrent={gameState?.currentTurnIndex === seatIndex}
        isYou={yourIndex === seatIndex}
      />
    );
  };

  const positionOrder = ["bottom", "left", "top", "right"];
  const getPositionForSeat = (seatIndex) => {
    if (yourIndex == null) return positionOrder[seatIndex] || "bottom";
    const relative = (seatIndex - yourIndex + 4) % 4;
    return positionOrder[relative];
  };

  const seatByPosition = positionOrder.reduce((acc, position) => {
    acc[position] = null;
    return acc;
  }, {});

  (gameState?.players || []).forEach((player) => {
    seatByPosition[getPositionForSeat(player.seatIndex)] = player.seatIndex;
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(30,64,175,0.3),_transparent_50%),radial-gradient(circle_at_bottom,_rgba(20,83,45,0.25),_transparent_55%),linear-gradient(135deg,_#020617,_#0f172a_55%,_#1e293b)] p-4 text-slate-100 sm:p-6">
      {/* Show Landing page if not joined */}
      {!joined && <Landing socket={socketRef.current} connected={connected} onJoinRoom={handleJoinRoom} />}

      {/* Show Room Lobby if joined and in lobby phase (even if waiting for gameState) */}
      {joined && inLobby && (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 sm:gap-6">
          <header className="glass-panel flex flex-col gap-3 rounded-3xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Catch the Ten</h1>
                <p className="text-sm text-slate-300">Room: {roomId}</p>
              </div>
              <div className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                {connected ? "Online" : "Offline"}
              </div>
            </div>
          </header>

          {gameState ? (
            <RoomLobby
              roomId={roomId}
              playerName={playerName}
              gameState={gameState}
              onStartGame={startGame}
              onLeaveRoom={leaveRoom}
            />
          ) : (
            <div className="glass-panel rounded-3xl p-6 text-center sm:p-8">
              <div className="space-y-4">
                <p className="text-base text-slate-300 sm:text-lg">Loading room...</p>
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Show Game Board if game has started */}
      {joined && !inLobby && gameState && (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-6">
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[2fr,1fr]">
            <div className="glass-panel rounded-3xl p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-xs uppercase text-slate-400">Room</div>
                    <div className="text-lg font-semibold">{gameState?.roomId || roomId}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-slate-400">Phase</div>
                    <div className="text-lg font-semibold">
                      {gameState?.phase || "LOBBY"}
                    </div>
                  </div>
                </div>
                {canStart && (
                  <button
                    type="button"
                    onClick={startGame}
                    className="rounded-2xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/30 transition hover:-translate-y-0.5"
                  >
                    Start Game
                  </button>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr,2fr,1fr]">
                <div className="flex flex-col gap-10 justify-between">
                  {renderSeat(seatByPosition.top, "top")}
                  {renderSeat(seatByPosition.left, "left")}
                </div>

                <div className="relative min-h-[260px] sm:min-h-[360px]">
                  <Table
                    tableCards={gameState?.tableCards || []}
                    trumpSuit={gameState?.trumpSuit}
                    yourIndex={yourIndex}
                  />
                </div>

                <div className="flex flex-col gap-10 justify-between items-end">
                  {renderSeat(seatByPosition.right, "right")}
                  {renderSeat(seatByPosition.bottom, "bottom")}
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-slate-800/60 bg-slate-950/70 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-4">
                  <div className="text-sm">
                    Base Suit: <span className="font-semibold">{gameState?.baseSuit ? SUIT_LABELS[gameState.baseSuit] : "None"}</span>
                  </div>
                  <div className="text-sm">
                    Trump Suit: <span className="font-semibold">{gameState?.trumpSuit ? SUIT_LABELS[gameState.trumpSuit] : "None"}</span>
                  </div>
                  <div className="text-sm">
                    Turn:{" "}
                    <span className="font-semibold">
                      {isYourTurn
                        ? "You"
                        : gameState?.players?.find((p) => p.seatIndex === gameState?.currentTurnIndex)?.name ||
                          gameState?.currentTurnIndex ||
                          "-"}
                    </span>
                  </div>
                </div>

                <div className="hand-fan">
                  {(yourPlayer?.hand || []).map((card, index) => (
                    <Card
                      key={card.id}
                      card={card}
                      isClickable={isYourTurn}
                      onClick={() => playCard(card)}
                      isTrump={card.suit === gameState?.trumpSuit}
                      isDimmed={!isYourTurn}
                      dealDelay={index * 40}
                      style={{ "--fan-index": index }}
                    />
                  ))}
                  {!yourPlayer?.hand?.length && (
                    <div className="text-sm text-slate-500">Waiting for cards...</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <ScoreBoard scores={gameState?.scores} />
              <Deck isShuffling={isShuffling} />
              <div className="glass-panel rounded-3xl p-4 text-sm text-slate-300">
                <div className="font-semibold text-slate-100">Status</div>
                <div className="mt-2 min-h-[40px] text-xs text-slate-400">
                  {message || "Awaiting action."}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
