#!/usr/bin/env node

import assert from "node:assert/strict";
import express from "express";
import http from "http";
import { once } from "node:events";
import { Server } from "socket.io";
import { io as createClient } from "socket.io-client";
import { createRoomManager } from "./server/src/roomManager.js";
import { registerSocketHandlers } from "./server/src/socketHandlers.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function startTestServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    transports: ["websocket"],
    cors: { origin: "*" }
  });
  const roomManager = createRoomManager();

  io.on("connection", (socket) => {
    registerSocketHandlers(io, socket, roomManager);
  });

  server.listen(0);
  await once(server, "listening");

  return {
    io,
    roomManager,
    server,
    url: `http://127.0.0.1:${server.address().port}`
  };
}

function createTrackedClient(serverUrl, { roomId, playerId, name }) {
  const socket = createClient(serverUrl, {
    transports: ["websocket"],
    reconnection: false,
    autoConnect: false
  });

  const tracker = {
    socket,
    roomId,
    playerId,
    name,
    lastState: null,
    invalidMoves: [],
    joins: [],
    gameOvers: [],
    stateVersion: 0
  };

  socket.on("game_state", (state) => {
    tracker.lastState = state;
    tracker.stateVersion += 1;
  });
  socket.on("invalid_move", (payload) => {
    tracker.invalidMoves.push(payload.reason);
  });
  socket.on("join_success", (payload) => {
    tracker.joins.push(payload);
  });
  socket.on("game_over", (payload) => {
    tracker.gameOvers.push(payload.result);
  });

  tracker.connectAndJoin = async () => {
    socket.connect();
    await once(socket, "connect");
    socket.emit("join_room", { roomId, playerId, name });
    await once(socket, "join_success");
    await waitForState(tracker);
  };

  return tracker;
}

async function waitFor(check, timeoutMs = 4_000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const value = check();
    if (value) {
      return value;
    }
    await wait(20);
  }

  throw new Error("Timed out waiting for condition.");
}

async function waitForState(client, predicate = () => true, timeoutMs = 4_000) {
  return waitFor(() => {
    if (!client.lastState) {
      return null;
    }

    return predicate(client.lastState) ? client.lastState : null;
  }, timeoutMs);
}

function pickLegalCard(state) {
  const yourPlayer = state.players.find((player) => player.seatIndex === state.yourPlayerIndex);
  const hand = yourPlayer?.hand ?? [];
  if (hand.length === 0) {
    return null;
  }

  if (!state.baseSuit) {
    return hand[0];
  }

  const matchingSuitCards = hand.filter((card) => card.suit === state.baseSuit);
  return matchingSuitCards[0] ?? hand[0];
}

async function main() {
  const roomId = "ROOMTEST1";
  const players = [
    { playerId: "player-1", name: "Alice" },
    { playerId: "player-2", name: "Bob" },
    { playerId: "player-3", name: "Carol" },
    { playerId: "player-4", name: "Dave" }
  ];

  const { io, server, url } = await startTestServer();
  const clients = [];

  try {
    for (const player of players.slice(0, 3)) {
      const client = createTrackedClient(url, { roomId, ...player });
      clients.push(client);
      await client.connectAndJoin();
    }

    clients[0].socket.emit("start_game", { roomId });
    await waitFor(() => clients[0].invalidMoves.includes("Need exactly 4 active players to start."));

    const fourthClient = createTrackedClient(url, { roomId, ...players[3] });
    clients.push(fourthClient);
    await fourthClient.connectAndJoin();

    clients[0].socket.emit("start_game", { roomId });
    await Promise.all(
      clients.map((client) =>
        waitForState(client, (state) => state.phase === "TRUMP_DISCOVERY")
      )
    );

    const openingPlayer = clients.find(
      (client) => client.lastState?.yourPlayerIndex === client.lastState?.currentTurnIndex
    );
    assert.ok(openingPlayer, "Expected a player whose turn it is.");

    const openingCard = openingPlayer.lastState.players.find(
      (player) => player.seatIndex === openingPlayer.lastState.yourPlayerIndex
    )?.hand?.[0];
    assert.ok(openingCard, "Expected the opening player to have a playable card.");

    openingPlayer.socket.emit("play_card", { roomId, cardId: openingCard.id });
    await Promise.all(
      clients.map((client) =>
        waitForState(
          client,
          (state) => state.tableCards.length === 1 && state.currentTurnIndex === 1
        )
      )
    );

    const disconnectedClient = clients[1];
    const handBeforeReconnect =
      disconnectedClient.lastState.players.find(
        (player) => player.seatIndex === disconnectedClient.lastState.yourPlayerIndex
      )?.hand?.length ?? 0;

    disconnectedClient.socket.disconnect();

    await Promise.all(
      clients
        .filter((client) => client !== disconnectedClient)
        .map((client) =>
          waitForState(client, (state) => {
            const seatOne = state.players.find((player) => player.seatIndex === 1);
            return state.activePlayerCount === 3 && seatOne && seatOne.isConnected === false;
          })
        )
    );

    const reconnectedClient = createTrackedClient(url, {
      roomId,
      playerId: disconnectedClient.playerId,
      name: disconnectedClient.name
    });
    await reconnectedClient.connectAndJoin();

    await Promise.all(
      clients
        .filter((client) => client !== disconnectedClient)
        .concat(reconnectedClient)
        .map((client) =>
          waitForState(client, (state) => {
            const seatOnePlayers = state.players.filter((player) => player.seatIndex === 1);
            return (
              state.activePlayerCount === 4 &&
              seatOnePlayers.length === 1 &&
              seatOnePlayers[0].isConnected === true &&
              state.tableCards.length === 1
            );
          })
        )
    );

    assert.equal(reconnectedClient.lastState.yourPlayerIndex, 1);
    const reconnectedPlayer = reconnectedClient.lastState.players.find(
      (player) => player.seatIndex === 1
    );
    assert.ok(reconnectedPlayer?.hand, "Expected the reconnected player to recover their hand.");
    assert.equal(reconnectedPlayer.hand.length, handBeforeReconnect);

    const reconnectCard = reconnectedPlayer.hand[0];
    reconnectedClient.socket.emit("play_card", { roomId, cardId: reconnectCard.id });

    await Promise.all(
      clients
        .filter((client) => client !== disconnectedClient)
        .concat(reconnectedClient)
        .map((client) =>
          waitForState(
            client,
            (state) => state.tableCards.length === 2 && state.currentTurnIndex === 2
          )
        )
    );

    const activeClients = [clients[0], reconnectedClient, clients[2], clients[3]];

    while (activeClients[0].lastState.phase !== "FINISHED") {
      const actingClient = activeClients.find(
        (client) => client.lastState.yourPlayerIndex === client.lastState.currentTurnIndex
      );
      assert.ok(actingClient, "Expected to find the active turn owner.");

      const previousState = actingClient.lastState;
      const previousVersions = new Map(
        activeClients.map((client) => [client.playerId, client.stateVersion])
      );
      const nextCard = pickLegalCard(previousState);
      assert.ok(nextCard, "Expected the acting player to have a legal card.");

      actingClient.socket.emit("play_card", { roomId, cardId: nextCard.id });

      await Promise.all(
        activeClients.map((client) =>
          waitFor(() => client.stateVersion > previousVersions.get(client.playerId))
        )
      );
    }

    activeClients.forEach((client) => {
      assert.equal(client.lastState.phase, "FINISHED");
      assert.ok(client.gameOvers.length > 0, "Expected a game_over event.");
    });

    console.log("Multiplayer stability test passed.");
  } finally {
    clients.forEach((client) => client.socket.disconnect());
    io.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
