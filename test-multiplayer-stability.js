#!/usr/bin/env node

import assert from "node:assert/strict";
import express from "express";
import http from "http";
import { once } from "node:events";
import { Server } from "socket.io";
import { io as createClient } from "socket.io-client";
import { TRICK_RESOLVE_DELAY_MS } from "./server/src/game/constants.js";
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
    gameEndedEvents: [],
    gameRestartedEvents: [],
    playerLeftEvents: [],
    stateVersion: 0,
    roundCompletions: [],
    roundResults: [],
    clearTableEvents: []
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
  socket.on("game_ended", (payload) => {
    tracker.gameEndedEvents.push(payload);
  });
  socket.on("game_restarted", (payload) => {
    tracker.gameRestartedEvents.push(payload);
  });
  socket.on("player_left", (payload) => {
    tracker.playerLeftEvents.push(payload);
  });
  socket.on("round_complete", (payload) => {
    tracker.roundCompletions.push(payload);
  });
  socket.on("round_result", (payload) => {
    tracker.roundResults.push(payload);
  });
  socket.on("clear_table", (payload) => {
    tracker.clearTableEvents.push(payload);
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
  const expectedSeatByPlayerId = {
    "player-1": 0,
    "player-2": 1,
    "player-3": 2,
    "player-4": 3
  };

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

    const reconnectCard = pickLegalCard(reconnectedClient.lastState);
    assert.ok(reconnectCard, "Expected the reconnected player to have a legal card.");
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
    const stateVersionsBeforeRoundComplete = new Map(
      activeClients.map((client) => [client.playerId, client.stateVersion])
    );

    for (let cardsNeeded = 0; cardsNeeded < 2; cardsNeeded += 1) {
      const actingClient = activeClients.find(
        (client) => client.lastState.yourPlayerIndex === client.lastState.currentTurnIndex
      );
      assert.ok(actingClient, "Expected an acting player before round completion.");

      const nextCard = pickLegalCard(actingClient.lastState);
      assert.ok(nextCard, "Expected a legal card before round completion.");

      actingClient.socket.emit("play_card", { roomId, cardId: nextCard.id });
      await Promise.all(
        activeClients.map((client) =>
          waitFor(() => client.stateVersion > stateVersionsBeforeRoundComplete.get(client.playerId))
        )
      );
      activeClients.forEach((client) => {
        stateVersionsBeforeRoundComplete.set(client.playerId, client.stateVersion);
      });
    }

    await Promise.all(
      activeClients.map((client) =>
        waitForState(
          client,
          (state) => state.pendingTrick !== null && state.tableCards.length === 4 && state.currentTurnIndex === null
        )
      )
    );

    activeClients.forEach((client) => {
      assert.equal(client.roundCompletions.length, 1);
      assert.equal(client.roundCompletions[0].trickCards.length, 4);
      assert.equal(client.lastState.pendingTrick?.lastPlayedCardPlayerIndex, 3);
    });

    await wait(TRICK_RESOLVE_DELAY_MS - 500);
    activeClients.forEach((client) => {
      assert.equal(client.lastState.tableCards.length, 4);
      assert.ok(client.lastState.pendingTrick, "Expected the table to stay visible before clear.");
      assert.equal(client.clearTableEvents.length, 0);
    });

    const pendingReconnectClient = activeClients[0];
    pendingReconnectClient.socket.disconnect();
    const refreshedClient = createTrackedClient(url, {
      roomId,
      playerId: pendingReconnectClient.playerId,
      name: pendingReconnectClient.name
    });
    await refreshedClient.connectAndJoin();

    assert.equal(refreshedClient.lastState.tableCards.length, 4);
    assert.ok(refreshedClient.lastState.pendingTrick, "Expected reconnect during delay to restore the full table.");

    activeClients[0] = refreshedClient;

    await Promise.all(
      activeClients.map((client) =>
        waitForState(client, (state) => state.pendingTrick === null && state.tableCards.length === 0)
      )
    );

    activeClients.forEach((client) => {
      assert.equal(client.roundResults.length, 1);
      assert.equal(client.clearTableEvents.length, 1);
    });

    while (activeClients[0].lastState.phase !== "FINISHED") {
      if (activeClients[0].lastState.pendingTrick) {
        await Promise.all(
          activeClients.map((client) =>
            waitForState(client, (state) => state.pendingTrick === null)
          )
        );
        continue;
      }

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
      assert.ok(client.gameEndedEvents.length > 0, "Expected a game_ended event.");
      assert.equal(client.lastState.endSummary?.winner, client.gameEndedEvents.at(-1)?.winner);
    });

    const preRestartVersions = new Map(
      activeClients.map((client) => [client.playerId, client.stateVersion])
    );
    activeClients[0].socket.emit("restart_game", { roomId });

    await Promise.all(
      activeClients.map((client) =>
        waitFor(() => client.stateVersion > preRestartVersions.get(client.playerId))
      )
    );

    await Promise.all(
      activeClients.map((client) =>
        waitForState(client, (state) => {
          const yourPlayer = state.players.find((player) => player.seatIndex === state.yourPlayerIndex);
          return (
            state.phase === "TRUMP_DISCOVERY" &&
            state.tableCards.length === 0 &&
            state.pendingTrick === null &&
            state.scores.teamA.tens === 0 &&
            state.scores.teamA.tricks === 0 &&
            state.scores.teamB.tens === 0 &&
            state.scores.teamB.tricks === 0 &&
            state.endSummary === null &&
            (yourPlayer?.hand?.length ?? 0) === 5
          );
        })
      )
    );

    activeClients.forEach((client) => {
      assert.ok(client.gameRestartedEvents.length > 0, "Expected a game_restarted event.");
      assert.equal(client.lastState.yourPlayerIndex, expectedSeatByPlayerId[client.playerId]);
    });

    const leavingClient = activeClients[3];
    const remainingClients = activeClients.slice(0, 3);
    leavingClient.socket.emit("leave_room", { roomId });

    await Promise.all(
      remainingClients.map((client) =>
        waitForState(client, (state) => {
          const leavingSeat = state.players.find((player) => player.playerId === leavingClient.playerId);
          return (
            state.phase === "FINISHED" &&
            state.activePlayerCount === 3 &&
            leavingSeat &&
            leavingSeat.isConnected === false
          );
        })
      )
    );

    remainingClients.forEach((client) => {
      assert.ok(client.playerLeftEvents.length > 0, "Expected a player_left event after leave_room.");
      assert.equal(client.playerLeftEvents.at(-1)?.playerId, leavingClient.playerId);
      assert.equal(client.lastState.endSummary?.result, "A player left the room.");
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
