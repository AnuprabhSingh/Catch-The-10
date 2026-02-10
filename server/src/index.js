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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Catch the Ten server running on ${PORT}`);
});
