import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ✅ This socket is created ONLY once
export const socket = io(SERVER_URL, {
  transports: ["websocket", "polling"],
  reconnection: true,
  autoConnect: false,
});
