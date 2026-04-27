import { useEffect, useMemo, useRef, useState } from "react";
import { socket } from "./socket";
import Card from "./components/Card";
import Deck from "./components/Deck";
import PlayerSeat from "./components/PlayerSeat";
import ScoreBoard from "./components/ScoreBoard";
import Table from "./components/Table";
import RoomLobby from "./components/RoomLobby";
import Landing from "./pages/Landing";
import { SUIT_LABELS } from "./utils/cards";

const SESSION_STORAGE_KEY = "catch10_session";
const GAME_STORAGE_KEY = "catch10_game";
const PLAYER_ID_STORAGE_KEY = "catch10_playerId";

const getPlayerId = () => {
  let id = localStorage.getItem(PLAYER_ID_STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(PLAYER_ID_STORAGE_KEY, id);
  }
  return id;
};

const readStoredJson = (storageKey) => {
  try {
    const rawValue = localStorage.getItem(storageKey);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
};

const readStoredSession = () => {
  const session = readStoredJson(SESSION_STORAGE_KEY);
  if (!session?.roomId || !session?.playerName) {
    return null;
  }

  return {
    roomId: `${session.roomId}`.trim().toUpperCase(),
    playerName: `${session.playerName}`.trim()
  };
};

const readStoredGameState = () => readStoredJson(GAME_STORAGE_KEY);

const persistSession = (session) => {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
};

const clearStoredSession = () => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(GAME_STORAGE_KEY);
};

export default function App() {
  const initialSession = readStoredSession();
  const initialGameState = readStoredGameState();
  const socketRef = useRef(socket);
  const lastJoinKeyRef = useRef("");

  const [connected, setConnected] = useState(socket.connected);
  const [roomId, setRoomId] = useState(initialSession?.roomId ?? "");
  const [playerName, setPlayerName] = useState(initialSession?.playerName ?? "");
  const [joined, setJoined] = useState(Boolean(initialSession));
  const [inLobby, setInLobby] = useState(initialGameState?.phase !== "LOBBY" ? false : true);
  const [gameState, setGameState] = useState(initialGameState);
  const [message, setMessage] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const emitJoinRoom = (session) => {
    if (!session?.roomId || !session?.playerName) {
      return;
    }

    const s = socketRef.current;
    if (!s.connected) {
      s.connect();
      return;
    }

    const joinKey = `${s.id}:${session.roomId}:${getPlayerId()}`;
    if (lastJoinKeyRef.current === joinKey) {
      return;
    }

    lastJoinKeyRef.current = joinKey;
    setIsJoining(true);
    s.emit("join_room", {
      roomId: session.roomId,
      name: session.playerName,
      playerId: getPlayerId()
    });
  };

  useEffect(() => {
    const s = socketRef.current;

    const onConnect = () => {
      setConnected(true);
      lastJoinKeyRef.current = "";

      const savedSession = readStoredSession();
      if (savedSession) {
        emitJoinRoom(savedSession);
      }
    };

    const onDisconnect = () => {
      setConnected(false);
      setIsJoining(false);
      lastJoinKeyRef.current = "";
    };

    const onJoinSuccess = ({ roomId: joinedRoomId }) => {
      setRoomId(joinedRoomId);
      setJoined(true);
      setMessage("");
      setIsJoining(false);
    };

    const onJoinError = ({ reason }) => {
      setJoined(false);
      setGameState(null);
      setInLobby(true);
      setMessage(reason || "Failed to join room.");
      setIsJoining(false);
    };

    const onInvalidMove = ({ reason }) => {
      setMessage(reason || "That move is not allowed.");
    };

    const onRoomClosed = () => {
      clearStoredSession();
      setJoined(false);
      setInLobby(true);
      setRoomId("");
      setPlayerName("");
      setGameState(null);
      setMessage("Room closed.");
      setIsJoining(false);
      lastJoinKeyRef.current = "";
    };

    const onGameState = (state) => {
      setGameState(state);
      setJoined(true);
      setInLobby(state.phase === "LOBBY");
      setMessage("");
      setIsJoining(false);
      localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(state));
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("join_success", onJoinSuccess);
    s.on("join_error", onJoinError);
    s.on("invalid_move", onInvalidMove);
    s.on("room_closed", onRoomClosed);
    s.on("game_state", onGameState);

    if (!s.connected) {
      s.connect();
    } else {
      onConnect();
    }

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("join_success", onJoinSuccess);
      s.off("join_error", onJoinError);
      s.off("invalid_move", onInvalidMove);
      s.off("room_closed", onRoomClosed);
      s.off("game_state", onGameState);
    };
  }, []);

  const submitJoinRequest = ({ roomId: nextRoomId, playerName: nextPlayerName }) => {
    const session = {
      roomId: `${nextRoomId ?? ""}`.trim().toUpperCase(),
      playerName: `${nextPlayerName ?? ""}`.trim()
    };

    if (!session.roomId || !session.playerName) {
      setMessage("Enter a room name and player name.");
      return;
    }

    persistSession(session);
    localStorage.removeItem(GAME_STORAGE_KEY);
    setRoomId(session.roomId);
    setPlayerName(session.playerName);
    setJoined(true);
    setInLobby(true);
    setGameState(null);
    setMessage("");
    emitJoinRoom(session);
  };

  const resetSavedSession = () => {
    clearStoredSession();
    setRoomId("");
    setPlayerName("");
    setJoined(false);
    setInLobby(true);
    setGameState(null);
    setMessage("");
    setIsJoining(false);
    lastJoinKeyRef.current = "";
  };

  const startGame = () => {
    socketRef.current.emit("start_game", { roomId });
  };

  const leaveRoom = () => {
    if (roomId) {
      socketRef.current.emit("leave_room", { roomId });
    }

    resetSavedSession();
  };

  const playCard = (card) => {
    if (!isYourTurn) return;

    socketRef.current.emit("play_card", {
      roomId,
      cardId: card.id
    });
  };

  const yourIndex = gameState?.yourPlayerIndex ?? null;
  const yourPlayer =
    yourIndex != null
      ? gameState?.players?.find((player) => player.seatIndex === yourIndex) ?? null
      : null;
  const activePlayerCount = useMemo(
    () => gameState?.players?.filter((player) => player.isConnected).length ?? 0,
    [gameState]
  );
  const isYourTurn = gameState?.currentTurnIndex === yourIndex;
  const isShuffling =
    gameState?.phase === "TRUMP_DISCOVERY" && Boolean(gameState?.trumpSuit);
  const canStart =
    gameState?.phase === "LOBBY" &&
    activePlayerCount === 4 &&
    (gameState?.players?.length ?? 0) === 4;

  const renderSeat = (seatIndex, position) => {
    const player =
      seatIndex == null
        ? null
        : gameState?.players?.find((entry) => entry.seatIndex === seatIndex) ?? null;

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

  const seatByPosition = positionOrder.reduce((accumulator, position) => {
    accumulator[position] = null;
    return accumulator;
  }, {});

  (gameState?.players || []).forEach((player) => {
    seatByPosition[getPositionForSeat(player.seatIndex)] = player.seatIndex;
  });

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_rgba(30,64,175,0.3),_transparent_50%),radial-gradient(circle_at_bottom,_rgba(20,83,45,0.25),_transparent_55%),linear-gradient(135deg,_#020617,_#0f172a_55%,_#1e293b)] p-2 text-slate-100 sm:p-4 md:p-6">
      {!joined && (
        <Landing
          connected={connected}
          initialRoomId={roomId}
          initialPlayerName={playerName}
          isJoining={isJoining}
          message={message}
          onClearSession={resetSavedSession}
          onJoinRequest={submitJoinRequest}
        />
      )}

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
                  <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-emerald-400" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {joined && !inLobby && gameState && (
        <div className="mx-auto flex w-full flex-col gap-2 sm:max-w-6xl sm:gap-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <div className="glass-panel flex items-center gap-3 rounded-xl px-3 py-1.5 text-[11px] sm:rounded-2xl sm:px-4 sm:py-2 sm:text-sm">
              <span className="uppercase text-slate-400">Room</span>
              <span className="font-semibold">{gameState?.roomId || roomId}</span>
              <span className="text-slate-600">|</span>
              <span className="uppercase text-slate-400">Phase</span>
              <span className="font-semibold">{gameState?.phase || "LOBBY"}</span>
            </div>
            <ScoreBoard scores={gameState?.scores} compact />
            {canStart && (
              <button
                type="button"
                onClick={startGame}
                className="ml-auto rounded-xl bg-amber-300 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-lg shadow-amber-400/30 transition hover:-translate-y-0.5 sm:px-4 sm:py-2 sm:text-sm"
              >
                Start
              </button>
            )}
          </div>

          <div className="grid gap-2 sm:gap-4 lg:grid-cols-[1fr,240px]">
            <div className="glass-panel rounded-2xl p-2 sm:rounded-3xl sm:p-4">
              <div className="grid grid-cols-[auto,1fr,auto] gap-1 sm:gap-3">
                <div className="flex flex-col justify-between gap-1 py-1 sm:gap-4 sm:py-2">
                  {renderSeat(seatByPosition.top, "top")}
                  {renderSeat(seatByPosition.left, "left")}
                </div>

                <div className="relative aspect-square min-h-[140px] max-h-[280px] w-full sm:min-h-[240px] sm:max-h-[360px]">
                  <Table
                    tableCards={gameState?.tableCards || []}
                    trumpSuit={gameState?.trumpSuit}
                    yourIndex={yourIndex}
                  />
                </div>

                <div className="flex flex-col items-end justify-between gap-1 py-1 sm:gap-4 sm:py-2">
                  {renderSeat(seatByPosition.right, "right")}
                  {renderSeat(seatByPosition.bottom, "bottom")}
                </div>
              </div>

              <div className="mt-2 rounded-xl border border-slate-800/60 bg-slate-950/70 p-2 sm:mt-4 sm:rounded-2xl sm:p-3">
                <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] sm:mb-2 sm:gap-3 sm:text-sm">
                  <span>
                    Base: <strong>{gameState?.baseSuit ? SUIT_LABELS[gameState.baseSuit] : "-"}</strong>
                  </span>
                  <span>
                    Trump: <strong>{gameState?.trumpSuit ? SUIT_LABELS[gameState.trumpSuit] : "-"}</strong>
                  </span>
                  <span className={isYourTurn ? "font-semibold text-emerald-300" : ""}>
                    Turn:{" "}
                    <strong>
                      {isYourTurn
                        ? "Your turn!"
                        : gameState?.players?.find(
                            (player) => player.seatIndex === gameState?.currentTurnIndex
                          )?.name ||
                          gameState?.currentTurnIndex ||
                          "-"}
                    </strong>
                  </span>
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
                    <div className="text-xs text-slate-500 sm:text-sm">Waiting for cards...</div>
                  )}
                </div>
              </div>
            </div>

            <div className="hidden flex-col gap-3 lg:flex">
              <ScoreBoard scores={gameState?.scores} />
              <Deck isShuffling={isShuffling} />
              <div className="glass-panel rounded-2xl p-3 text-sm text-slate-300 sm:rounded-3xl sm:p-4">
                <div className="font-semibold text-slate-100">Status</div>
                <div className="mt-2 min-h-[40px] text-xs text-slate-400">
                  {message || "Awaiting action."}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 lg:hidden">
            <Deck isShuffling={isShuffling} />
            <div className="glass-panel flex-1 rounded-xl p-2 text-xs text-slate-300">
              <div className="font-semibold text-slate-100">Status</div>
              <div className="mt-1 text-[11px] text-slate-400">
                {message || "Awaiting action."}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
