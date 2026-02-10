import { createGameState } from "./game/engine.js";
import { PHASES } from "./game/constants.js";

export function createRoomManager() {
  const rooms = new Map();

  const getRoom = (roomId) => rooms.get(roomId);

  const createRoom = (roomId) => {
    const room = {
      roomId,
      players: [],
      game: null
    };
    rooms.set(roomId, room);
    return room;
  };

  const addPlayer = (roomId, player) => {
    const room = getRoom(roomId) || createRoom(roomId);
    if (room.game?.phase && room.game.phase !== PHASES.LOBBY) {
      return { error: "Game already started." };
    }
    const existingIndex = room.players.findIndex((member) => member.id === player.id);
    if (existingIndex >= 0) {
      room.players[existingIndex] = { ...room.players[existingIndex], ...player };
      return { room };
    }
    if (room.players.length >= 4) {
      return { error: "Room is full." };
    }
    room.players.push(player);
    return { room };
  };

  const removePlayer = (roomId, socketId) => {
    const room = getRoom(roomId);
    if (!room) return null;
    room.players = room.players.filter((player) => player.id !== socketId);
    if (room.players.length === 0) {
      rooms.delete(roomId);
      return null;
    }
    return room;
  };

  const startGame = (roomId) => {
    const room = getRoom(roomId);
    if (!room) return { error: "Room not found." };
    if (room.players.length !== 4) return { error: "Need 4 players to start." };
    room.game = createGameState(roomId, room.players);
    return { room };
  };

  return {
    getRoom,
    addPlayer,
    removePlayer,
    startGame
  };
}
