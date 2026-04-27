import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { createRoomManager } from "./roomManager.js";
import { registerSocketHandlers } from "./socketHandlers.js";

const app = express();

// CORS configuration for production
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
const isDev = process.env.NODE_ENV !== "production";
const allowOrigin = (origin, callback) => {
  if (isDev || !origin) return callback(null, true);
  return callback(null, origin === corsOrigin);
};
app.use(cors({ origin: allowOrigin }));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowOrigin,
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
});

const roomManager = createRoomManager();

io.on("connection", (socket) => {
  console.log(`[SOCKET] New connection: ${socket.id}`);
  registerSocketHandlers(io, socket, roomManager);
});

setInterval(() => {
  const changedRoomIds = roomManager.sweepDisconnectedPlayers();
  changedRoomIds.forEach((roomId) => {
    const room = roomManager.getRoom(roomId);
    if (!room) {
      io.to(roomId).emit("room_closed");
      return;
    }

    const players = room.players.map((player) => ({
      playerId: player.playerId,
      name: player.name,
      seatIndex: player.seatIndex,
      team: player.seatIndex % 2 === 0 ? "Team A" : "Team B",
      isConnected: player.socketId !== null,
      handCount: 0
    }));

    const activePlayerCount = players.filter((player) => player.isConnected).length;
    players
      .filter((player) => player.isConnected)
      .forEach((player) => {
        const playerSocket = io.sockets.sockets.get(
          room.players.find((roomPlayer) => roomPlayer.playerId === player.playerId)?.socketId
        );

        if (playerSocket) {
          playerSocket.emit("game_state", {
            roomId,
            phase: "LOBBY",
            baseSuit: null,
            trumpSuit: null,
            currentTurnIndex: 0,
            players,
            tableCards: [],
            scores: {
              teamA: { tens: 0, tricks: 0 },
              teamB: { tens: 0, tricks: 0 }
            },
            yourPlayerIndex: player.seatIndex,
            activePlayerCount
          });
        }
      });
  });
}, 10 * 1000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Catch the Ten server running on ${PORT}`);
});
