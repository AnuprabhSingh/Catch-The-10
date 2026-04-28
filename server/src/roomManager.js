import { createGameState } from "./game/engine.js";
import { PHASES } from "./game/constants.js";

export function createRoomManager() {
  const rooms = new Map();
  const MAX_PLAYERS = 4;
  const DISCONNECTED_PLAYER_TTL_MS = 60 * 1000;
  // Idle rooms in LOBBY / FINISHED are removed after 30 min; active game rooms after 2 h.
  const LOBBY_IDLE_TTL_MS = Number(process.env.LOBBY_IDLE_TTL_MS ?? 30 * 60 * 1000);
  const GAME_IDLE_TTL_MS = Number(process.env.GAME_IDLE_TTL_MS ?? 2 * 60 * 60 * 1000);
  const sortBySeatIndex = (left, right) => left.seatIndex - right.seatIndex;

  const getRoom = (roomId) => rooms.get(roomId);

  const createRoom = (roomId) => {
    const room = {
      roomId,
      players: [], // { playerId, socketId, name, seatIndex }
      game: null,
      trickResolutionTimer: null,
      lastActivityAt: Date.now()
    };
    rooms.set(roomId, room);
    return room;
  };

  const touchRoom = (roomId) => {
    const room = rooms.get(roomId);
    if (room) {
      room.lastActivityAt = Date.now();
    }
  };

  const canPurgeDisconnectedPlayers = (room) =>
    !room.game ||
    room.game.phase === PHASES.LOBBY ||
    room.game.phase === PHASES.FINISHED;

  const purgeDisconnectedPlayers = (roomId, now = Date.now()) => {
    const room = getRoom(roomId);
    if (!room) return { room: null, removedPlayerIds: [] };

    if (!canPurgeDisconnectedPlayers(room)) {
      return { room, removedPlayerIds: [] };
    }

    const removedPlayerIds = room.players
      .filter(
        (player) =>
          player.socketId === null &&
          player.disconnectedAt &&
          now - player.disconnectedAt >= DISCONNECTED_PLAYER_TTL_MS
      )
      .map((player) => player.playerId);

    if (removedPlayerIds.length > 0) {
      room.players = room.players
        .filter((player) => !removedPlayerIds.includes(player.playerId))
        .sort(sortBySeatIndex);
    }

    if (
      room.players.length === 0 &&
      (!room.game || room.game.phase === PHASES.LOBBY || room.game.phase === PHASES.FINISHED)
    ) {
      if (room.trickResolutionTimer) {
        clearTimeout(room.trickResolutionTimer);
      }
      rooms.delete(roomId);
      return { room: null, removedPlayerIds };
    }

    return { room, removedPlayerIds };
  };

  const addPlayer = (roomId, player) => {
    const normalizedRoomId = roomId.trim().toUpperCase();
    const { room: existingRoom } = purgeDisconnectedPlayers(normalizedRoomId);
    const room = existingRoom || getRoom(normalizedRoomId) || createRoom(normalizedRoomId);

    room.players = room.players.map((existingPlayer) => {
      if (
        existingPlayer.socketId === player.socketId &&
        existingPlayer.playerId !== player.playerId
      ) {
        return {
          ...existingPlayer,
          socketId: null,
          disconnectedAt: Date.now()
        };
      }

      return existingPlayer;
    });

    const existingIndex = room.players.findIndex(
      (existingPlayer) => existingPlayer.playerId === player.playerId
    );

    if (
      room.game?.phase &&
      room.game.phase !== PHASES.LOBBY &&
      existingIndex === -1
    ) {
      return { error: "Game already started." };
    }

    if (existingIndex >= 0) {
      const existing = room.players[existingIndex];

      room.players[existingIndex] = {
        ...existing,
        socketId: player.socketId,
        name: player.name,
        disconnectedAt: null
      };

      room.players.sort(sortBySeatIndex);
      return { room, rejoined: true, player: room.players[existingIndex] };
    }

    if (room.players.length >= MAX_PLAYERS) {
      return { error: "Room is full." };
    }

    const usedSeats = room.players.map((p) => p.seatIndex);
    let seatIndex = 0;
    while (usedSeats.includes(seatIndex)) {
      seatIndex++;
    }

    const newPlayer = {
      playerId: player.playerId,
      socketId: player.socketId,
      name: player.name,
      seatIndex,
      disconnectedAt: null
    };

    room.players.push(newPlayer);
    room.players.sort(sortBySeatIndex);
    touchRoom(normalizedRoomId);
    return { room, player: newPlayer };
  };

  const markPlayerDisconnected = (roomId, socketId) => {
    const room = getRoom(roomId);
    if (!room) return null;

    const player = room.players.find((currentPlayer) => currentPlayer.socketId === socketId);
    if (!player) return { room, player: null };

    player.socketId = null;
    player.disconnectedAt = Date.now();

    return { room, player };
  };

  const removePlayer = (roomId, socketId) => {
    const room = getRoom(roomId);
    if (!room) return null;

    room.players = room.players
      .filter((player) => player.socketId !== socketId)
      .sort(sortBySeatIndex);

    if (
      room.players.length === 0 &&
      (!room.game || room.game.phase === PHASES.LOBBY || room.game.phase === PHASES.FINISHED)
    ) {
      if (room.trickResolutionTimer) {
        clearTimeout(room.trickResolutionTimer);
      }
      rooms.delete(roomId);
      return null;
    }

    return room;
  };

  const startGame = (roomId) => {
    const room = getRoom(roomId);
    if (!room) return { error: "Room not found." };

    purgeDisconnectedPlayers(roomId);

    const activePlayers = room.players.filter((player) => player.socketId !== null);
    if (room.players.length !== MAX_PLAYERS || activePlayers.length !== MAX_PLAYERS) {
      return { error: "Need exactly 4 active players to start." };
    }

    room.players.sort(sortBySeatIndex);
    room.game = createGameState(roomId, room.players);
    touchRoom(roomId);
    return { room };
  };

  const sweepDisconnectedPlayers = (now = Date.now()) => {
    const changedRoomIds = [];

    for (const roomId of rooms.keys()) {
      const { removedPlayerIds } = purgeDisconnectedPlayers(roomId, now);
      if (removedPlayerIds.length > 0) {
        changedRoomIds.push(roomId);
      }
    }

    return changedRoomIds;
  };

  /**
   * Delete rooms that have been idle longer than their TTL.
   * Returns the roomIds that were deleted so callers can notify connected sockets.
   */
  const expireIdleRooms = (now = Date.now()) => {
    const expiredRoomIds = [];

    for (const [roomId, room] of rooms.entries()) {
      const isActiveGame =
        room.game &&
        room.game.phase !== PHASES.LOBBY &&
        room.game.phase !== PHASES.FINISHED;
      const ttl = isActiveGame ? GAME_IDLE_TTL_MS : LOBBY_IDLE_TTL_MS;
      const idleMs = now - (room.lastActivityAt ?? 0);

      if (idleMs >= ttl) {
        if (room.trickResolutionTimer) {
          clearTimeout(room.trickResolutionTimer);
        }
        rooms.delete(roomId);
        expiredRoomIds.push(roomId);
      }
    }

    return expiredRoomIds;
  };

  return {
    getRoom,
    addPlayer,
    markPlayerDisconnected,
    removePlayer,
    startGame,
    touchRoom,
    sweepDisconnectedPlayers,
    expireIdleRooms
  };
}
