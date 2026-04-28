/**
 * Dev-only bot spawner.
 * Creates 3 bot socket clients that join a room and auto-play legal cards.
 * Bots do NOT auto-advance ROUND_END so the human player controls pacing.
 */
import { io as createClient } from "socket.io-client";

const BOT_NAMES = ["Bot-Alpha", "Bot-Beta", "Bot-Gamma"];

function pickLegalCard(state) {
  const yourPlayer = state.players.find((p) => p.seatIndex === state.yourPlayerIndex);
  const hand = yourPlayer?.hand ?? [];
  if (!hand.length) return null;
  if (!state.baseSuit) return hand[0];
  const matching = hand.filter((c) => c.suit === state.baseSuit);
  return matching[0] ?? hand[0];
}

export function spawnBots(serverUrl, roomId) {
  BOT_NAMES.forEach((name, i) => {
    const playerId = `bot-${roomId}-${i}`;
    const socket = createClient(serverUrl, {
      transports: ["websocket"],
      reconnection: false,
      autoConnect: false
    });

    let lastState = null;
    let playTimer = null;

    const tryPlay = () => {
      if (playTimer) return;

      playTimer = setTimeout(() => {
        playTimer = null;
        const state = lastState;
        if (!state) return;
        if (state.phase !== "MAIN_GAME" && state.phase !== "TRUMP_DISCOVERY") return;
        if (state.currentTurnIndex !== state.yourPlayerIndex) return;
        if (state.pendingTrick) return;

        const card = pickLegalCard(state);
        if (card) {
          socket.emit("play_card", { roomId, cardId: card.id });
        }
      }, 350 + Math.random() * 350);
    };

    socket.on("connect", () => {
      socket.emit("join_room", { roomId, name, playerId });
    });

    socket.on("game_state", (state) => {
      lastState = state;

      if (state.phase === "FINISHED") {
        clearTimeout(playTimer);
        socket.disconnect();
        return;
      }

      if (
        (state.phase === "MAIN_GAME" || state.phase === "TRUMP_DISCOVERY") &&
        state.currentTurnIndex === state.yourPlayerIndex &&
        !state.pendingTrick
      ) {
        tryPlay();
      }
    });

    socket.connect();
  });
}
