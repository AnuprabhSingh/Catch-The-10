import { PHASES } from "./game/constants.js";
import {
  getPublicStateForSocket,
  playCardInGame,
  startInitialDeal
} from "./game/engine.js";

export function registerSocketHandlers(io, socket, roomManager) {
  const emitStateToRoom = (roomId) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    
    console.log(`[EMIT_STATE] Broadcasting to room ${roomId}`);
    
    // Send personalized state to each player based on their socket ID
    room.players.forEach((player) => {
      const playerSocket = io.sockets.sockets.get(player.id);
      if (playerSocket) {
        const state = getPublicStateForSocket(room.game, player.id);
        playerSocket.emit("game_state", state);
        console.log(`[EMIT_STATE] Sent state to ${player.name} (${player.id})`);
      } else {
        console.log(`[EMIT_STATE] Socket not found for ${player.id}`);
      }
    });
  };

  socket.on("join_room", ({ roomId, name }) => {
    console.log(`[JOIN_ROOM] ${name} joining room ${roomId}`);
    
    const { room, error } = roomManager.addPlayer(roomId, {
      id: socket.id,
      name: name || `Player ${socket.id.slice(0, 4)}`
    });

    if (error) {
      console.log(`[JOIN_ROOM] Error: ${error}`);
      socket.emit("join_error", { reason: error });
      return;
    }

    socket.join(roomId);
    console.log(`[JOIN_ROOM] Player joined room ${roomId}, socket in rooms:`, socket.rooms);

    if (!room.game) {
      room.game = {
        roomId,
        phase: PHASES.LOBBY,
        players: room.players.map((player, index) => ({
          ...player,
          seatIndex: index,
          team: index % 2 === 0 ? "Team A" : "Team B",
          hand: []
        })),
        currentTurnIndex: 0,
        baseSuit: null,
        trumpSuit: null,
        deck: [],
        tableCards: [],
        scores: {
          teamA: { tens: 0, tricks: 0 },
          teamB: { tens: 0, tricks: 0 }
        }
      };
    } else {
      room.game.players = room.players.map((player, index) => ({
        ...player,
        seatIndex: index,
        team: index % 2 === 0 ? "Team A" : "Team B",
        hand: room.game.players?.[index]?.hand || []
      }));
    }

    socket.emit("join_success", { roomId });
    console.log(`[JOIN_ROOM] Sent join_success`);
    
    // Broadcast game state to all players in the room
    console.log(`[JOIN_ROOM] Broadcasting game_state to room ${roomId}`);
    emitStateToRoom(roomId);
  });

  socket.on("start_game", ({ roomId }) => {
    const { room, error } = roomManager.startGame(roomId);
    if (error) {
      socket.emit("invalid_move", { reason: error });
      return;
    }

    startInitialDeal(room.game);
    emitStateToRoom(roomId);
  });

  socket.on("play_card", ({ roomId, cardId }) => {
    const room = roomManager.getRoom(roomId);
    if (!room?.game) {
      socket.emit("invalid_move", { reason: "Game not found." });
      return;
    }

    const result = playCardInGame(room.game, socket.id, cardId);

    if (result.error) {
      socket.emit("invalid_move", { reason: result.error });
      return;
    }

    if (result.trumpDecided) {
      io.to(roomId).emit("trump_decided", { trumpSuit: room.game.trumpSuit });
    }

    if (result.trickResult) {
      io.to(roomId).emit("trick_result", result.trickResult);
    }

    if (result.gameOver) {
      io.to(roomId).emit("game_over", { result: result.gameOver });
    }

    emitStateToRoom(roomId);
  });

  socket.on("disconnect", () => {
    console.log(`[DISCONNECT] ${socket.id} disconnected`);
    const rooms = Array.from(socket.rooms);
    rooms.forEach((roomId) => {
      if (roomId === socket.id) return;
      roomManager.removePlayer(roomId, socket.id);
      const room = roomManager.getRoom(roomId);
      if (room?.game?.phase && room.game.phase !== PHASES.FINISHED) {
        io.to(roomId).emit("game_over", { result: "Game ended due to disconnect." });
      }
    });
  });

  socket.on("leave_room", ({ roomId }) => {
    socket.leave(roomId);
    roomManager.removePlayer(roomId, socket.id);
    const room = roomManager.getRoom(roomId);
    if (room && room.players.length > 0) {
      if (room.game?.phase && room.game.phase !== PHASES.FINISHED) {
        room.game.phase = PHASES.FINISHED;
        io.to(roomId).emit("game_over", { result: "A player left the room." });
      }
      emitStateToRoom(roomId);
    }
  });
}
