#!/usr/bin/env node

/**
 * Quick Test Game Setup Script
 * Automatically creates a game room with 4 players for testing
 * Run: node test-game-setup.js [roomId] [player1] [player2] [player3] [player4]
 * Or: node test-game-setup.js (uses defaults)
 */

import { io } from "socket.io-client";
import readline from "readline";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";

// Default test players
const DEFAULT_PLAYERS = ["Alice", "Bob", "Charlie"];
const YOUR_NAME = "Player";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createRoomAndPlayers(roomId, playerNames) {
  const sockets = [];
  let readyCount = 0;

  return new Promise((resolve) => {
    playerNames.forEach((playerName, index) => {
      const socket = io(SERVER_URL, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionDelay: 100,
        reconnectionDelayMax: 1000,
        reconnectionAttempts: 5,
      });

      socket.on("join_success", (payload) => {
        console.log(
          `✓ ${playerName} joined room ${payload.roomId} successfully`
        );
        readyCount++;

        if (readyCount === playerNames.length) {
          // All players joined, wait a moment then prompt to start
          setTimeout(() => {
            promptToStartGame(sockets, roomId);
            resolve(sockets);
          }, 500);
        }
      });

      socket.on("join_error", (payload) => {
        console.error(`✗ ${playerName} failed to join: ${payload.reason}`);
      });

      socket.on("game_state", (state) => {
        console.log(`[${playerName}] Game state received - Phase: ${state.phase}`);
      });

      socket.on("disconnect", () => {
        console.log(`[${playerName}] disconnected`);
      });

      socket.on("connect_error", (error) => {
        console.error(`[${playerName}] Connection error:`, error.message);
      });

      // Emit join_room event after connected
      socket.on("connect", () => {
        console.log(`✓ ${playerName} connected (Socket: ${socket.id.slice(0, 6)})`);
        socket.emit("join_room", { roomId, name: playerName });
      });

      sockets.push({ socket, playerName });
    });
  });
}

function promptToStartGame(sockets, roomId) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const browserUrl = `${CLIENT_URL}?room=${roomId}&name=${YOUR_NAME}`;

  console.log("\n" + "=".repeat(60));
  console.log(`✓ 3 bot players joined room: ${roomId}`);
  console.log("=".repeat(60));
  console.log("\n🤖 Bots connected:");
  sockets.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.playerName}`);
  });
  console.log(`\n📱 Now open this URL to join as the 4th player:`);
  console.log(`   ${browserUrl}`);
  console.log(`\n⏳ After you join in the browser, press Enter here to start.`);

  rl.question(
    "\n👉 Press Enter to start the game (or type 'exit' to quit): ",
    (answer) => {
      rl.close();

      if (answer.toLowerCase() === "exit") {
        console.log("\n🛑 Cleaning up...");
        sockets.forEach(({ socket }) => socket.disconnect());
        process.exit(0);
      }

      // Start the game
      console.log("\n🚀 Starting game...\n");
      if (sockets[0]) {
        sockets[0].socket.emit("start_game", { roomId });
      }

      // Keep process alive with periodic checks
      console.log("✅ Game in progress. Players are connected and ready.");
      console.log("📱 Open http://localhost:5173 in your browser to play.\n");
      
      keepAlive(sockets, roomId);
    }
  );
}

function keepAlive(sockets, roomId) {
  // Keep the process alive by checking every 30 seconds
  const interval = setInterval(() => {
    const connectedCount = sockets.filter(({ socket }) => socket.connected).length;
    console.log(`[${new Date().toLocaleTimeString()}] Room ${roomId} - ${connectedCount}/4 players connected`);
  }, 30000);

  // Handle Ctrl+C gracefully
  process.on("SIGINT", () => {
    clearInterval(interval);
    console.log("\n\n🛑 Shutting down gracefully...");
    sockets.forEach(({ socket, playerName }) => {
      console.log(`Disconnecting ${playerName}...`);
      socket.disconnect();
    });
    process.exit(0);
  });
}

async function main() {
  const args = process.argv.slice(2);
  let roomId = args[0];
  let playerNames = args.slice(1);

  // Generate room ID if not provided
  if (!roomId) {
    roomId = Math.random().toString(36).substr(2, 9).toUpperCase();
  } else {
    roomId = roomId.toUpperCase();
  }

  // Use provided player names or defaults (3 bots, you're the 4th)
  if (playerNames.length === 0) {
    playerNames = DEFAULT_PLAYERS;
  } else if (playerNames.length < 3) {
    playerNames = [
      ...playerNames,
      ...DEFAULT_PLAYERS.slice(playerNames.length),
    ];
  }
  // Only take 3 bot players max — you are the 4th
  playerNames = playerNames.slice(0, 3);

  const browserUrl = `${CLIENT_URL}?room=${roomId}&name=${YOUR_NAME}`;

  console.log("\n🎴 Catch the Ten - Test Game Setup");
  console.log("=".repeat(60));
  console.log(`🔗 Server: ${SERVER_URL}`);
  console.log(`📍 Room ID: ${roomId}`);
  console.log(`🤖 Bots: ${playerNames.join(", ")}`);
  console.log(`👤 You: ${YOUR_NAME}`);
  console.log("=".repeat(60));
  console.log(`\n📱 Open this URL in your browser to join:\n`);
  console.log(`   ${browserUrl}\n`);
  console.log("Connecting bot players...\n");

  await createRoomAndPlayers(roomId, playerNames);
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  console.error(
    "\n⚠️  Make sure the server is running on",
    SERVER_URL
  );
  console.error(
    "   Start it with: npm run dev\n"
  );
  process.exit(1);
});
