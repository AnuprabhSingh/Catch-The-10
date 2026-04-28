import { useEffect, useMemo, useRef, useState } from "react";
import { socket } from "./socket";
import Card from "./components/Card";
import PlayerSeat from "./components/PlayerSeat";
import ScoreBoard from "./components/ScoreBoard";
import Table from "./components/Table";
import RoomLobby from "./components/RoomLobby";
import EndGameModal from "./components/EndGameModal";
import TensWonPanel from "./components/TensWonPanel";
import Landing from "./pages/Landing";
import { SUIT_LABELS, SUIT_SYMBOLS } from "./utils/cards";
import { isMuted, playSound, setMuted } from "./utils/audioManager";

function getStatusText(gameState, isYourTurn, message) {
  if (message) return message;
  if (!gameState) return "—";
  const { phase, trumpSuit, pendingTrick, players, currentTurnIndex } = gameState;
  if (phase === "TRUMP_DISCOVERY") {
    if (!trumpSuit) {
      return isYourTurn
        ? "Play any card. If no one can follow suit, your card's suit becomes trump."
        : "Waiting for trump suit to be decided…";
    }
    return `Trump is ${SUIT_LABELS[trumpSuit]} ${SUIT_SYMBOLS[trumpSuit]}. Main game starting…`;
  }
  if (phase === "MAIN_GAME") {
    if (pendingTrick) return "Resolving trick…";
    if (isYourTurn) return "Your turn — play a card.";
    const cur = players?.find((p) => p.seatIndex === currentTurnIndex);
    return cur ? `Waiting for ${cur.name}…` : "Waiting…";
  }
  if (phase === "ROUND_END") return "Round complete. Waiting for next round…";
  if (phase === "FINISHED") return "Match over!";
  return "—";
}

const SESSION_STORAGE_KEY = "catch10_session";
const GAME_STORAGE_KEY = "catch10_game";
const PLAYER_ID_STORAGE_KEY = "catch10_playerId";
const SERVER_INSTANCE_KEY = "catch10_serverInstance";

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
  localStorage.removeItem(SERVER_INSTANCE_KEY);
};

export default function App() {
  const initialSession = readStoredSession();
  const initialGameState = readStoredGameState();
  const socketRef = useRef(socket);
  const lastJoinKeyRef = useRef("");
  const gameStateRef = useRef(initialGameState);
  const flashTimerRef = useRef(null);
  const prevTableLenRef = useRef(initialGameState?.tableCards?.length ?? 0);
  const prevTrumpRef = useRef(initialGameState?.trumpSuit ?? null);

  const [connected, setConnected] = useState(socket.connected);
  const [roomId, setRoomId] = useState(initialSession?.roomId ?? "");
  const [playerName, setPlayerName] = useState(initialSession?.playerName ?? "");
  const [joined, setJoined] = useState(Boolean(initialSession));
  const [inLobby, setInLobby] = useState(initialGameState?.phase !== "LOBBY" ? false : true);
  const [gameState, setGameState] = useState(initialGameState);
  const [message, setMessage] = useState("");
  const [roundMessage, setRoundMessage] = useState("");
  const [gameEndedData, setGameEndedData] = useState(initialGameState?.endSummary ?? null);
  const [isJoining, setIsJoining] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [trickWinnerAnnouncement, setTrickWinnerAnnouncement] = useState(null);
  const [flashSeatIndex, setFlashSeatIndex] = useState(null);
  const [soundMuted, setSoundMuted] = useState(isMuted());

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
      // Auto-join is deferred to onServerHello to detect server restarts first.
    };

    const onServerHello = ({ instanceId }) => {
      const storedInstanceId = localStorage.getItem(SERVER_INSTANCE_KEY);

      if (storedInstanceId && storedInstanceId !== instanceId) {
        // Server restarted — stale session is meaningless, drop it.
        clearStoredSession();
        setJoined(false);
        setInLobby(true);
        setRoomId("");
        setPlayerName("");
        setGameState(null);
        setMessage("");
        setRoundMessage("");
        setGameEndedData(null);
        setIsRestarting(false);
        setIsJoining(false);
        lastJoinKeyRef.current = "";
      }

      localStorage.setItem(SERVER_INSTANCE_KEY, instanceId);

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
      setGameEndedData(null);
      setIsJoining(false);
    };

    const onJoinError = ({ reason }) => {
      setJoined(false);
      setGameState(null);
      setInLobby(true);
      setMessage(reason || "Failed to join room.");
      setRoundMessage("");
      setGameEndedData(null);
      setIsRestarting(false);
      setIsJoining(false);
    };

    const onInvalidMove = ({ reason }) => {
      setMessage(reason || "That move is not allowed.");
      setIsRestarting(false);
    };

    const onRoomClosed = () => {
      clearStoredSession();
      setJoined(false);
      setInLobby(true);
      setRoomId("");
      setPlayerName("");
      setGameState(null);
      setMessage("Room closed.");
      setRoundMessage("");
      setGameEndedData(null);
      setIsRestarting(false);
      setIsJoining(false);
      lastJoinKeyRef.current = "";
    };

    const onRoundComplete = () => {
      setRoundMessage("Final card played. Resolving trick...");
    };

    const onRoundResult = ({ message: resultMessage, winnerIndex, winningTeam }) => {
      setRoundMessage(resultMessage || "Trick resolved.");
      const currentState = gameStateRef.current;
      const winner = currentState?.players?.find((p) => p.seatIndex === winnerIndex);
      setTrickWinnerAnnouncement(winner?.name ?? winningTeam ?? "Unknown");
      // Play a richer sound if tens were captured, otherwise standard trick win
      playSound("score");
    };

    const onClearTable = () => {
      setMessage("");
      // Do NOT clear trickWinnerAnnouncement here — clear_table fires immediately
      // after round_result in the same server flush, so the announcement would
      // never render. It is cleared when the first card of the next trick arrives.
    };

    const onGameOver = ({ result }) => {
      setRoundMessage(result || "");
    };

    const onGameEnded = (payload) => {
      setGameEndedData(payload);
      setRoundMessage(payload?.result || "");
      setIsRestarting(false);
      playSound("gameOver", 0.7);
    };

    const onGameRestarted = () => {
      setGameEndedData(null);
      setRoundMessage("");
      setMessage("");
      setTrickWinnerAnnouncement(null);
      setIsRestarting(false);
    };

    const onRoundStarted = () => {
      setRoundMessage("");
      setMessage("");
      setTrickWinnerAnnouncement(null);
      prevTrumpRef.current = null; // reset so trump sound fires again next round
      playSound("deal");
    };

    const onPlayerLeft = ({ playerId }) => {
      if (playerId && playerId !== getPlayerId()) {
        setMessage("A player left the room.");
      }
    };

    const onGameState = (state) => {
      gameStateRef.current = state;

      const prevLen = prevTableLenRef.current;
      prevTableLenRef.current = state.tableCards.length;

      // Trump suit revealed for the first time this round
      if (state.trumpSuit && !prevTrumpRef.current) {
        playSound("catch", 0.7);
      }
      prevTrumpRef.current = state.trumpSuit ?? null;

      if (!state.pendingTrick && state.tableCards.length > prevLen) {
        const lastEntry = state.tableCards.at(-1);
        clearTimeout(flashTimerRef.current);
        setFlashSeatIndex(lastEntry?.playerIndex ?? null);
        flashTimerRef.current = setTimeout(() => setFlashSeatIndex(null), 1500);
        // First card of a new trick — dismiss the previous trick's winner toast
        if (prevLen === 0) {
          setTrickWinnerAnnouncement(null);
        }
        // Card landed on table
        playSound("card");
      } else if (state.tableCards.length === 0) {
        clearTimeout(flashTimerRef.current);
        setFlashSeatIndex(null);
      }

      setGameState(state);
      setJoined(true);
      setInLobby(state.phase === "LOBBY");
      setMessage("");
      setGameEndedData(state.endSummary ?? null);
      if (state.phase !== "FINISHED" && !state.pendingTrick) {
        setRoundMessage("");
      }
      if (state.pendingTrick) {
        setRoundMessage("Final card played. Resolving trick...");
      }
      if (state.phase !== "FINISHED") {
        setIsRestarting(false);
      }
      setIsJoining(false);
      localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(state));
    };

    s.on("connect", onConnect);
    s.on("server_hello", onServerHello);
    s.on("disconnect", onDisconnect);
    s.on("join_success", onJoinSuccess);
    s.on("join_error", onJoinError);
    s.on("invalid_move", onInvalidMove);
    s.on("room_closed", onRoomClosed);
    s.on("round_complete", onRoundComplete);
    s.on("round_result", onRoundResult);
    s.on("clear_table", onClearTable);
    s.on("game_over", onGameOver);
    s.on("game_ended", onGameEnded);
    s.on("game_restarted", onGameRestarted);
    s.on("round_started", onRoundStarted);
    s.on("player_left", onPlayerLeft);
    s.on("game_state", onGameState);

    if (!s.connected) {
      s.connect();
    } else {
      onConnect();
    }

    return () => {
      clearTimeout(flashTimerRef.current);
      s.off("connect", onConnect);
      s.off("server_hello", onServerHello);
      s.off("disconnect", onDisconnect);
      s.off("join_success", onJoinSuccess);
      s.off("join_error", onJoinError);
      s.off("invalid_move", onInvalidMove);
      s.off("room_closed", onRoomClosed);
      s.off("round_complete", onRoundComplete);
      s.off("round_result", onRoundResult);
      s.off("clear_table", onClearTable);
      s.off("game_over", onGameOver);
      s.off("game_ended", onGameEnded);
      s.off("game_restarted", onGameRestarted);
      s.off("round_started", onRoundStarted);
      s.off("player_left", onPlayerLeft);
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
    setRoundMessage("");
    setGameEndedData(null);
    setIsRestarting(false);
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
    setRoundMessage("");
    setGameEndedData(null);
    setIsRestarting(false);
    setIsJoining(false);
    lastJoinKeyRef.current = "";
  };

  const startGame = () => {
    socketRef.current.emit("start_game", { roomId });
  };

  const nextRound = () => {
    socketRef.current.emit("next_round", { roomId });
  };

  const leaveRoom = () => {
    if (roomId) {
      socketRef.current.emit("leave_room", { roomId });
    }

    resetSavedSession();
  };

  const restartGame = () => {
    if (!roomId) return;

    setIsRestarting(true);
    setMessage("");
    socketRef.current.emit("restart_game", { roomId });
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
  const isShuffling = gameState?.phase === "TRUMP_DISCOVERY";
  const canStart =
    gameState?.phase === "LOBBY" &&
    activePlayerCount === 4 &&
    (gameState?.players?.length ?? 0) === 4;
  const isFinished = gameState?.phase === "FINISHED";
  const isRoundEnd = gameState?.phase === "ROUND_END";
  const canReplay = (isFinished || isRoundEnd) && activePlayerCount === 4 && (gameState?.players?.length ?? 0) === 4;
  const endSummary = gameEndedData ?? gameState?.endSummary ?? null;
  const roundSummary = gameState?.roundSummary ?? null;
  const totalScores = gameState?.totalScores ?? null;
  const capturedTensHistory = gameState?.capturedTensHistory ?? [];

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
          <EndGameModal
            isOpen={isFinished}
            isRoundEnd={false}
            summary={endSummary}
            canReplay={canReplay}
            isRestarting={isRestarting}
            onPlayAgain={restartGame}
            onNextRound={nextRound}
            onLeaveRoom={leaveRoom}
          />
          <EndGameModal
            isOpen={isRoundEnd}
            isRoundEnd={true}
            roundSummary={roundSummary}
            canReplay={canReplay}
            onNextRound={nextRound}
            onLeaveRoom={leaveRoom}
          />
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <div className="glass-panel flex items-center gap-3 rounded-xl px-3 py-1.5 text-[11px] sm:rounded-2xl sm:px-4 sm:py-2 sm:text-sm">
              <span className="uppercase text-slate-400">Room</span>
              <span className="font-semibold">{gameState?.roomId || roomId}</span>
              <span className="text-slate-600">|</span>
              <span className="uppercase text-slate-400">Phase</span>
              <span className="font-semibold">{gameState?.phase || "LOBBY"}</span>
            </div>
            <ScoreBoard scores={gameState?.scores} compact />
            <button
              type="button"
              onClick={() => {
                const next = !soundMuted;
                setMuted(next);
                setSoundMuted(next);
              }}
              className="rounded-xl border border-slate-600 bg-slate-800/60 px-2 py-1.5 text-lg leading-none transition hover:border-slate-400 sm:px-3 sm:py-2"
              title={soundMuted ? "Unmute sounds" : "Mute sounds"}
            >
              {soundMuted ? "🔇" : "🔊"}
            </button>
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
                    highlightedPlayerIndex={
                      gameState?.pendingTrick != null
                        ? gameState.pendingTrick.lastPlayedCardPlayerIndex
                        : flashSeatIndex
                    }
                  />
                  {trickWinnerAnnouncement && (
                    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                      <div className="trick-announce rounded-2xl border border-emerald-400/40 bg-slate-900/90 px-3 py-2 text-center shadow-xl backdrop-blur-sm">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Trick won by</div>
                        <div className="text-sm font-bold text-emerald-300">{trickWinnerAnnouncement}</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end justify-between gap-1 py-1 sm:gap-4 sm:py-2">
                  {renderSeat(seatByPosition.right, "right")}
                  {renderSeat(seatByPosition.bottom, "bottom")}
                </div>
              </div>

              <div className="mt-2 rounded-xl border border-slate-800/60 bg-slate-950/70 p-2 sm:mt-4 sm:rounded-2xl sm:p-3">
                {/* Status row */}
                <div className="mb-2 flex flex-wrap items-center gap-2 sm:mb-3">
                  {/* Base suit pill */}
                  <div className="flex items-center gap-1 rounded-lg border border-slate-700/60 bg-slate-900/60 px-2 py-0.5 text-[10px] sm:text-xs">
                    <span className="text-slate-500 uppercase tracking-wide">Base</span>
                    <span className="font-bold text-slate-200">
                      {gameState?.baseSuit ? SUIT_LABELS[gameState.baseSuit] : "—"}
                    </span>
                  </div>
                  {/* Trump suit pill */}
                  <div className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] sm:text-xs
                    ${gameState?.trumpSuit
                      ? "border-amber-500/50 bg-amber-950/50"
                      : "border-slate-700/60 bg-slate-900/60"}`}>
                    <span className="text-slate-500 uppercase tracking-wide">Trump</span>
                    <span className={`font-bold ${gameState?.trumpSuit ? "text-amber-300" : "text-slate-200"}`}>
                      {gameState?.trumpSuit ? SUIT_LABELS[gameState.trumpSuit] : "—"}
                    </span>
                  </div>
                  {/* Turn pill */}
                  <div className={`ml-auto flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-[10px] font-semibold sm:text-xs
                    ${isYourTurn
                      ? "border-emerald-500/50 bg-emerald-950/60 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.2)]"
                      : "border-slate-700/60 bg-slate-900/60 text-slate-300"}`}>
                    {isYourTurn && (
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    )}
                    {isYourTurn
                      ? "Your turn!"
                      : gameState?.players?.find(
                          (player) => player.seatIndex === gameState?.currentTurnIndex
                        )?.name || "—"}
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
                    <div className="text-xs text-slate-500 sm:text-sm">Waiting for cards...</div>
                  )}
                </div>
              </div>
            </div>

            <div className="hidden flex-col gap-3 lg:flex">
              <ScoreBoard scores={gameState?.scores} />
              <TensWonPanel history={capturedTensHistory} />

              {/* Status */}
              <div className="glass-panel rounded-2xl p-3 sm:rounded-3xl sm:p-4">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Status</div>
                <div className="min-h-[40px] text-xs leading-relaxed text-slate-300">
                  {getStatusText(gameState, isYourTurn, message)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <div className="glass-panel flex-1 rounded-xl px-3 py-1.5 text-[11px] text-slate-300">
              {getStatusText(gameState, isYourTurn, message)}
            </div>
          </div>

          <div className="lg:hidden">
            <TensWonPanel history={capturedTensHistory} />
          </div>
        </div>
      )}
    </div>
  );
}
