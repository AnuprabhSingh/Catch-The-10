import { PHASES, TRICK_RESOLVE_DELAY_MS } from "./game/constants.js";
import {
  getPublicStateForPlayer,
  playCardInGame,
  resolveCompletedTrick,
  startInitialDeal,
  syncGamePlayers
} from "./game/engine.js";

export function registerSocketHandlers(io, socket, roomManager) {
  const getTeamLabel = (seatIndex) => (seatIndex % 2 === 0 ? "Team A" : "Team B");
  const sortPlayersBySeatIndex = (players) =>
    [...players].sort((left, right) => left.seatIndex - right.seatIndex);

  const getPlayerFromSocket = (room, socketId) => {
    return room.players.find((player) => player.socketId === socketId);
  };

  const buildLobbyState = (room, playerId) => {
    const players = sortPlayersBySeatIndex(room.players).map((player) => ({
      playerId: player.playerId,
      name: player.name,
      seatIndex: player.seatIndex,
      team: getTeamLabel(player.seatIndex),
      isConnected: player.socketId !== null,
      handCount: 0
    }));

    const activePlayerCount = players.filter((player) => player.isConnected).length;
    const ownerIndex = players.find((player) => player.playerId === playerId)?.seatIndex ?? null;

    return {
      roomId: room.roomId,
      phase: PHASES.LOBBY,
      baseSuit: null,
      trumpSuit: null,
      currentTurnIndex: 0,
      players,
      tableCards: [],
      scores: {
        teamA: { tens: 0, tricks: 0 },
        teamB: { tens: 0, tricks: 0 }
      },
      yourPlayerIndex: ownerIndex,
      activePlayerCount,
      pendingTrick: null
    };
  };

  const emitStateToRoom = (roomId) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    if (room.game) {
      syncGamePlayers(room.game, room.players);
    }

    room.players.forEach((player) => {
      if (!player.socketId) return;

      const playerSocket = io.sockets.sockets.get(player.socketId);
      if (playerSocket) {
        const state = room.game
          ? getPublicStateForPlayer(room.game, player.playerId)
          : buildLobbyState(room, player.playerId);
        playerSocket.emit("game_state", state);
      }
    });
  };

  const clearTrickResolutionTimer = (room) => {
    if (room?.trickResolutionTimer) {
      clearTimeout(room.trickResolutionTimer);
      room.trickResolutionTimer = null;
    }
  };

  const scheduleTrickResolution = (roomId) => {
    const room = roomManager.getRoom(roomId);
    if (!room?.game?.pendingTrick || room.trickResolutionTimer) {
      return;
    }

    const delayMs = Math.max(room.game.pendingTrick.resolvesAt - Date.now(), 0);
    room.trickResolutionTimer = setTimeout(() => {
      const liveRoom = roomManager.getRoom(roomId);
      if (!liveRoom) return;

      liveRoom.trickResolutionTimer = null;

      if (!liveRoom.game || liveRoom.game.phase === PHASES.FINISHED) {
        return;
      }

      syncGamePlayers(liveRoom.game, liveRoom.players);
      const resolution = resolveCompletedTrick(liveRoom.game);
      if (resolution.error) {
        return;
      }

      io.to(roomId).emit("round_result", resolution.roundResult);
      io.to(roomId).emit("clear_table", resolution.clearTable);

      if (resolution.gameEnded) {
        io.to(roomId).emit("game_ended", resolution.gameEnded);
      }

      if (resolution.gameOver) {
        io.to(roomId).emit("game_over", {
          result: resolution.gameOver
        });
      }

      emitStateToRoom(roomId);
    }, delayMs);
  };

  socket.on("join_room", ({ roomId, name, playerId }) => {
    const normalizedRoomId = `${roomId ?? ""}`.trim().toUpperCase();
    const normalizedName = `${name ?? ""}`.trim().slice(0, 20) || "Player";

    console.log("JOIN:", {
      roomId: normalizedRoomId,
      name: normalizedName,
      playerId,
      socketId: socket.id
    });

    if (!normalizedRoomId) {
      socket.emit("join_error", { reason: "Missing roomId" });
      return;
    }

    if (!playerId) {
      socket.emit("join_error", { reason: "Missing playerId" });
      return;
    }

    const previousRoomId = socket.data.roomId;
    if (previousRoomId && previousRoomId !== normalizedRoomId) {
      const previousRoom = roomManager.removePlayer(previousRoomId, socket.id);
      socket.leave(previousRoomId);
      if (previousRoom) {
        emitStateToRoom(previousRoomId);
      }
    }

    console.log(`[JOIN] ${normalizedName} joining ${normalizedRoomId}`);

    const { room, error, rejoined } = roomManager.addPlayer(normalizedRoomId, {
      playerId,
      socketId: socket.id,
      name: normalizedName
    });

    if (error) {
      socket.emit("join_error", { reason: error });
      return;
    }

    socket.join(normalizedRoomId);
    socket.data.roomId = normalizedRoomId;
    socket.data.playerId = playerId;

    socket.emit("join_success", { roomId: normalizedRoomId, rejoined });
    emitStateToRoom(room.roomId);

    if (room.game?.pendingTrick) {
      scheduleTrickResolution(room.roomId);
    }
  });

  socket.on("start_game", ({ roomId }) => {
    const targetRoomId = `${roomId ?? socket.data.roomId ?? ""}`.trim().toUpperCase();
    const { room, error } = roomManager.startGame(targetRoomId);

    if (error) {
      socket.emit("invalid_move", { reason: error });
      return;
    }

    clearTrickResolutionTimer(room);
    startInitialDeal(room.game);
    emitStateToRoom(targetRoomId);
  });

  socket.on("restart_game", ({ roomId }) => {
    const targetRoomId = `${roomId ?? socket.data.roomId ?? ""}`.trim().toUpperCase();
    const room = roomManager.getRoom(targetRoomId);

    if (!room?.game) {
      socket.emit("invalid_move", { reason: "Game not found." });
      return;
    }

    if (room.game.phase !== PHASES.FINISHED && room.game.phase !== PHASES.LOBBY) {
      socket.emit("invalid_move", { reason: "Game can only be restarted after it ends." });
      return;
    }

    const { error } = roomManager.startGame(targetRoomId);
    if (error) {
      socket.emit("invalid_move", { reason: error });
      return;
    }

    clearTrickResolutionTimer(room);
    startInitialDeal(room.game);
    io.to(targetRoomId).emit("game_restarted", { roomId: targetRoomId });
    emitStateToRoom(targetRoomId);
  });

  socket.on("play_card", ({ roomId, cardId }) => {
    const targetRoomId = `${roomId ?? socket.data.roomId ?? ""}`.trim().toUpperCase();
    const room = roomManager.getRoom(targetRoomId);

    if (!room?.game) {
      socket.emit("invalid_move", { reason: "Game not found." });
      return;
    }

    syncGamePlayers(room.game, room.players);

    const player = getPlayerFromSocket(room, socket.id);
    if (!player) {
      socket.emit("invalid_move", { reason: "Player not found." });
      return;
    }

    const result = playCardInGame(room.game, player.playerId, cardId);
    if (result.error) {
      socket.emit("invalid_move", { reason: result.error });
      return;
    }

    if (result.trumpDecided) {
      io.to(targetRoomId).emit("trump_decided", {
        trumpSuit: room.game.trumpSuit
      });
    }

    emitStateToRoom(targetRoomId);

    if (result.roundComplete) {
      io.to(targetRoomId).emit("round_complete", {
        ...result.roundComplete,
        delayMs: TRICK_RESOLVE_DELAY_MS
      });
      scheduleTrickResolution(targetRoomId);
    }
  });

  socket.on("disconnect", () => {
    console.log(`[DISCONNECT] ${socket.id}`);

    const roomId = socket.data.roomId;
    if (!roomId) return;

    const result = roomManager.markPlayerDisconnected(roomId, socket.id);
    if (result?.player) {
      emitStateToRoom(roomId);
    }
  });

  socket.on("leave_room", ({ roomId }) => {
    const targetRoomId = `${roomId ?? socket.data.roomId ?? ""}`.trim().toUpperCase();
    const room = roomManager.getRoom(targetRoomId);
    if (!room) return;
    const leavingPlayerId = socket.data.playerId ?? null;

    const shouldEndGame =
      room.game?.phase &&
      room.game.phase !== PHASES.LOBBY &&
      room.game.phase !== PHASES.FINISHED;

    if (shouldEndGame) {
      clearTrickResolutionTimer(room);

      const result = roomManager.markPlayerDisconnected(targetRoomId, socket.id);
      socket.leave(targetRoomId);
      delete socket.data.roomId;
      delete socket.data.playerId;

      if (result?.room?.game) {
        syncGamePlayers(result.room.game, result.room.players);
        result.room.game.phase = PHASES.FINISHED;
        result.room.game.pendingTrick = null;
        result.room.game.endSummary = {
          result: "A player left the room.",
          winner: "No one",
          scores: result.room.game.scores
        };
      }

      io.to(targetRoomId).emit("player_left", {
        playerId: leavingPlayerId
      });
      io.to(targetRoomId).emit("game_ended", {
        result: "A player left the room.",
        winner: "No one",
        scores: result?.room?.game?.scores ?? null
      });
      io.to(targetRoomId).emit("game_over", {
        result: "A player left the room."
      });

      emitStateToRoom(targetRoomId);
      return;
    }

    const updatedRoom = roomManager.removePlayer(targetRoomId, socket.id);
    if (updatedRoom) {
      clearTrickResolutionTimer(updatedRoom);
    }

    socket.leave(targetRoomId);
    delete socket.data.roomId;
    delete socket.data.playerId;

    if (updatedRoom) {
      io.to(targetRoomId).emit("player_left", {
        playerId: leavingPlayerId
      });
      emitStateToRoom(targetRoomId);
    }
  });
}
