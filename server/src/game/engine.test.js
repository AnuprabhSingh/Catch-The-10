import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createGameState,
  determineTrickWinner,
  getGameOverMessage,
  getWinnerLabel,
  playCardInGame,
  resolveCompletedTrick,
  startInitialDeal,
  startNextRound
} from "./engine.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCard(suit, rank, id) {
  return { id: id ?? `${suit}-${rank}`, suit, rank };
}

function makeTableEntry(playerIndex, suit, rank) {
  return { playerIndex, card: makeCard(suit, rank) };
}

/**
 * Build a minimal 4-player game state ready to play cards.
 * Each player has a hand of cards from `hands` (array of arrays of {suit,rank}).
 * baseSuit and trumpSuit are optional.
 */
function makeGame({ hands = [[], [], [], []], baseSuit = null, trumpSuit = null, phase = "MAIN_GAME", currentTurnIndex = 0, round = 1 } = {}) {
  const players = [0, 1, 2, 3].map((i) => ({
    playerId: `p${i}`,
    socketId: `s${i}`,
    seatIndex: i,
    name: `P${i}`,
    hand: (hands[i] ?? []).map((c, j) => makeCard(c.suit, c.rank, `${c.suit}-${c.rank}-${i}-${j}`))
  }));

  return {
    roomId: "TEST",
    phase,
    players,
    currentTurnIndex,
    baseSuit,
    trumpSuit,
    deck: [],
    tableCards: [],
    scores: { teamA: { tens: 0, tricks: 0 }, teamB: { tens: 0, tricks: 0 } },
    totalScores: { teamA: { tens: 0, tricks: 0 }, teamB: { tens: 0, tricks: 0 } },
    pendingMainDeal: false,
    pendingTrick: null,
    endSummary: null,
    roundSummary: null,
    round,
    firstTurnIndex: 0
  };
}

// ---------------------------------------------------------------------------
// determineTrickWinner
// ---------------------------------------------------------------------------

describe("determineTrickWinner", () => {
  it("highest rank of base suit wins when no trump", () => {
    const table = [
      makeTableEntry(0, "HEARTS", "7"),
      makeTableEntry(1, "HEARTS", "K"),
      makeTableEntry(2, "HEARTS", "9"),
      makeTableEntry(3, "HEARTS", "4")
    ];
    const winner = determineTrickWinner(table, "HEARTS", null);
    assert.equal(winner.playerIndex, 1);
    assert.equal(winner.card.rank, "K");
  });

  it("a trump card beats all base-suit cards", () => {
    const table = [
      makeTableEntry(0, "HEARTS", "A"),
      makeTableEntry(1, "HEARTS", "K"),
      makeTableEntry(2, "SPADES", "2"),
      makeTableEntry(3, "HEARTS", "Q")
    ];
    const winner = determineTrickWinner(table, "HEARTS", "SPADES");
    assert.equal(winner.playerIndex, 2);
    assert.equal(winner.card.suit, "SPADES");
  });

  it("highest trump wins when multiple trumps played", () => {
    const table = [
      makeTableEntry(0, "HEARTS", "A"),
      makeTableEntry(1, "CLUBS", "5"),
      makeTableEntry(2, "CLUBS", "K"),
      makeTableEntry(3, "CLUBS", "9")
    ];
    const winner = determineTrickWinner(table, "HEARTS", "CLUBS");
    assert.equal(winner.playerIndex, 2);
    assert.equal(winner.card.rank, "K");
  });

  it("ignores off-suit non-trump cards when base suit is led", () => {
    const table = [
      makeTableEntry(0, "DIAMONDS", "3"),
      makeTableEntry(1, "DIAMONDS", "6"),
      makeTableEntry(2, "HEARTS", "A"), // off-suit, no trump declared
      makeTableEntry(3, "DIAMONDS", "J")
    ];
    const winner = determineTrickWinner(table, "DIAMONDS", null);
    assert.equal(winner.playerIndex, 3);
    assert.equal(winner.card.rank, "J");
  });

  it("ace beats king in same suit", () => {
    const table = [
      makeTableEntry(0, "SPADES", "K"),
      makeTableEntry(1, "SPADES", "A"),
      makeTableEntry(2, "SPADES", "Q"),
      makeTableEntry(3, "SPADES", "J")
    ];
    const winner = determineTrickWinner(table, "SPADES", null);
    assert.equal(winner.playerIndex, 1);
  });

  it("10 beats 9 (numeric rank order check)", () => {
    const table = [
      makeTableEntry(0, "HEARTS", "9"),
      makeTableEntry(1, "HEARTS", "10"),
      makeTableEntry(2, "HEARTS", "8"),
      makeTableEntry(3, "HEARTS", "7")
    ];
    const winner = determineTrickWinner(table, "HEARTS", null);
    assert.equal(winner.playerIndex, 1);
    assert.equal(winner.card.rank, "10");
  });

  it("lowest trump (2) still beats highest base-suit card", () => {
    const table = [
      makeTableEntry(0, "HEARTS", "A"),
      makeTableEntry(1, "HEARTS", "K"),
      makeTableEntry(2, "HEARTS", "Q"),
      makeTableEntry(3, "CLUBS", "2")
    ];
    const winner = determineTrickWinner(table, "HEARTS", "CLUBS");
    assert.equal(winner.playerIndex, 3);
    assert.equal(winner.card.suit, "CLUBS");
  });
});

// ---------------------------------------------------------------------------
// getGameOverMessage / getWinnerLabel
// ---------------------------------------------------------------------------

describe("getGameOverMessage", () => {
  it("Team A wins by 10s", () => {
    const msg = getGameOverMessage({ teamA: { tens: 3, tricks: 2 }, teamB: { tens: 1, tricks: 5 } });
    assert.equal(msg, "Team A wins by 10s.");
  });

  it("Team B wins by 10s", () => {
    const msg = getGameOverMessage({ teamA: { tens: 1, tricks: 10 }, teamB: { tens: 2, tricks: 0 } });
    assert.equal(msg, "Team B wins by 10s.");
  });

  it("tied tens, Team A wins by tricks", () => {
    const msg = getGameOverMessage({ teamA: { tens: 2, tricks: 8 }, teamB: { tens: 2, tricks: 5 } });
    assert.equal(msg, "Team A wins by tricks.");
  });

  it("tied tens, Team B wins by tricks", () => {
    const msg = getGameOverMessage({ teamA: { tens: 0, tricks: 3 }, teamB: { tens: 0, tricks: 7 } });
    assert.equal(msg, "Team B wins by tricks.");
  });

  it("complete draw returns draw message", () => {
    const msg = getGameOverMessage({ teamA: { tens: 2, tricks: 5 }, teamB: { tens: 2, tricks: 5 } });
    assert.equal(msg, "Game is a draw.");
  });
});

describe("getWinnerLabel", () => {
  it("returns 'Team A' when team A has more tens", () => {
    assert.equal(getWinnerLabel({ teamA: { tens: 3, tricks: 0 }, teamB: { tens: 1, tricks: 10 } }), "Team A");
  });

  it("returns 'Team B' when team B has more tens", () => {
    assert.equal(getWinnerLabel({ teamA: { tens: 0, tricks: 10 }, teamB: { tens: 4, tricks: 0 } }), "Team B");
  });

  it("returns 'No one' on a complete draw", () => {
    assert.equal(getWinnerLabel({ teamA: { tens: 2, tricks: 5 }, teamB: { tens: 2, tricks: 5 } }), "No one");
  });
});

// ---------------------------------------------------------------------------
// playCardInGame — validation guards
// ---------------------------------------------------------------------------

describe("playCardInGame — validation", () => {
  it("rejects play when phase is LOBBY", () => {
    const game = makeGame({ phase: "LOBBY" });
    const card = makeCard("HEARTS", "5", "h5");
    game.players[0].hand.push(card);
    const result = playCardInGame(game, "p0", "h5");
    assert.ok(result.error, "Expected an error");
  });

  it("rejects play when phase is FINISHED", () => {
    const game = makeGame({ phase: "FINISHED" });
    const card = makeCard("HEARTS", "5", "h5");
    game.players[0].hand.push(card);
    const result = playCardInGame(game, "p0", "h5");
    assert.ok(result.error);
  });

  it("rejects play when it is not the player's turn", () => {
    const game = makeGame({ currentTurnIndex: 1 });
    const card = makeCard("HEARTS", "5", "h5");
    game.players[0].hand.push(card);
    const result = playCardInGame(game, "p0", "h5");
    assert.equal(result.error, "Not your turn.");
  });

  it("rejects play when card is not in hand", () => {
    const game = makeGame({ currentTurnIndex: 0 });
    const result = playCardInGame(game, "p0", "nonexistent-card");
    assert.equal(result.error, "Card not in hand.");
  });

  it("rejects play when player must follow base suit but plays different suit", () => {
    const game = makeGame({
      currentTurnIndex: 0,
      baseSuit: "HEARTS"
    });
    game.players[0].hand = [
      makeCard("HEARTS", "7", "h7"),
      makeCard("SPADES", "A", "sA")
    ];
    const result = playCardInGame(game, "p0", "sA");
    assert.equal(result.error, "Must follow base suit.");
  });

  it("allows playing off-suit when player has no base-suit cards", () => {
    const game = makeGame({
      currentTurnIndex: 0,
      baseSuit: "HEARTS"
    });
    game.players[0].hand = [makeCard("SPADES", "A", "sA")];
    const result = playCardInGame(game, "p0", "sA");
    assert.ok(!result.error, `Unexpected error: ${result.error}`);
  });
});

// ---------------------------------------------------------------------------
// playCardInGame — trump discovery
// ---------------------------------------------------------------------------

describe("playCardInGame — trump discovery", () => {
  it("sets trump when player cannot follow base suit in TRUMP_DISCOVERY", () => {
    const game = makeGame({ phase: "TRUMP_DISCOVERY", currentTurnIndex: 0 });
    // P0 plays HEARTS → sets baseSuit
    game.players[0].hand = [makeCard("HEARTS", "7", "h7")];
    playCardInGame(game, "p0", "h7");
    assert.equal(game.baseSuit, "HEARTS");

    // P1 has no HEARTS, plays SPADES → should set trump
    game.players[1].hand = [makeCard("SPADES", "K", "sK")];
    const result = playCardInGame(game, "p1", "sK");
    assert.ok(!result.error, `Unexpected error: ${result.error}`);
    assert.equal(result.trumpDecided, true);
    assert.equal(game.trumpSuit, "SPADES");
    assert.equal(game.pendingMainDeal, true);
  });

  it("does not set trump when player plays off-suit but has base suit (follow-suit violation blocked)", () => {
    const game = makeGame({ phase: "TRUMP_DISCOVERY", currentTurnIndex: 0 });
    game.players[0].hand = [makeCard("HEARTS", "7", "h7")];
    playCardInGame(game, "p0", "h7"); // baseSuit = HEARTS

    game.players[1].hand = [makeCard("HEARTS", "3", "h3"), makeCard("SPADES", "K", "sK")];
    const result = playCardInGame(game, "p1", "sK");
    assert.equal(result.error, "Must follow base suit.");
    assert.equal(game.trumpSuit, null);
  });

  it("does not re-set trump once it is already determined", () => {
    const game = makeGame({ phase: "MAIN_GAME", currentTurnIndex: 0, trumpSuit: "CLUBS" });
    game.players[0].hand = [makeCard("HEARTS", "7", "h7")];
    playCardInGame(game, "p0", "h7"); // baseSuit = HEARTS
    game.players[1].hand = [makeCard("SPADES", "K", "sK")];
    const result = playCardInGame(game, "p1", "sK");
    assert.ok(!result.error);
    assert.equal(result.trumpDecided, false);
    assert.equal(game.trumpSuit, "CLUBS"); // unchanged
  });
});

// ---------------------------------------------------------------------------
// playCardInGame — turn advancement
// ---------------------------------------------------------------------------

describe("playCardInGame — turn advancement", () => {
  it("advances turn clockwise after each card", () => {
    const game = makeGame({ currentTurnIndex: 0 });
    game.players[0].hand = [makeCard("HEARTS", "2", "h2")];
    playCardInGame(game, "p0", "h2");
    assert.equal(game.currentTurnIndex, 1);
  });

  it("wraps turn from seat 3 back to seat 0", () => {
    const game = makeGame({ currentTurnIndex: 3, baseSuit: "HEARTS" });
    game.tableCards = [
      { playerIndex: 0, card: makeCard("HEARTS", "3") },
      { playerIndex: 1, card: makeCard("HEARTS", "4") },
      { playerIndex: 2, card: makeCard("HEARTS", "5") }
    ];
    game.players[3].hand = [makeCard("HEARTS", "6", "h6")];
    playCardInGame(game, "p3", "h6");
    // 4th card — pendingTrick set, currentTurnIndex → null
    assert.equal(game.currentTurnIndex, null);
    assert.ok(game.pendingTrick);
  });

  it("sets pendingTrick after the 4th card is played", () => {
    const game = makeGame({ currentTurnIndex: 3, baseSuit: "HEARTS" });
    game.tableCards = [
      { playerIndex: 0, card: makeCard("HEARTS", "3") },
      { playerIndex: 1, card: makeCard("HEARTS", "4") },
      { playerIndex: 2, card: makeCard("HEARTS", "5") }
    ];
    game.players[3].hand = [makeCard("HEARTS", "K", "hK")];
    const result = playCardInGame(game, "p3", "hK");
    assert.ok(result.roundComplete, "Expected roundComplete payload");
    assert.equal(result.roundComplete.trickCards.length, 4);
    assert.ok(game.pendingTrick?.resolvesAt > Date.now());
  });
});

// ---------------------------------------------------------------------------
// resolveCompletedTrick
// ---------------------------------------------------------------------------

describe("resolveCompletedTrick", () => {
  it("scores a trick for the winning team and clears the table", () => {
    const game = makeGame({ trumpSuit: null });
    game.players.forEach((p) => { p.hand = []; }); // <-- Add this line
    game.baseSuit = "HEARTS";
    game.tableCards = [
      { playerIndex: 0, card: makeCard("HEARTS", "7") },
      { playerIndex: 1, card: makeCard("HEARTS", "K") }, // winner
      { playerIndex: 2, card: makeCard("HEARTS", "3") },
      { playerIndex: 3, card: makeCard("HEARTS", "9") }
    ];
    // Add each played card to the correct player's hand
    game.tableCards.forEach(entry => {
      game.players[entry.playerIndex].hand.push(entry.card);
    });
    game.pendingTrick = { resolvesAt: Date.now() - 1, lastPlayedCardPlayerIndex: 3 };

    const resolution = resolveCompletedTrick(game);

    assert.ok(!resolution.error);
    assert.equal(resolution.roundResult.winnerIndex, 1);
    assert.equal(resolution.roundResult.winningTeam, "Team B"); // seat 1 → Team B
    assert.equal(game.tableCards.length, 0);
    assert.equal(game.scores.teamB.tricks, 1);
    assert.equal(game.currentTurnIndex, 1);
  });

  it("counts captured tens and awards them to the winning team", () => {
    const game = makeGame({ trumpSuit: null });
    game.baseSuit = "HEARTS";
    game.players.forEach((p) => { p.hand = []; }); // <-- Add this line
    game.tableCards = [
      { playerIndex: 0, card: makeCard("HEARTS", "10") }, // ten!
      { playerIndex: 1, card: makeCard("HEARTS", "A") },  // winner
      { playerIndex: 2, card: makeCard("HEARTS", "10") }, // ten!
      { playerIndex: 3, card: makeCard("HEARTS", "5") }
    ];
    game.tableCards.forEach(entry => {
      game.players[entry.playerIndex].hand.push(entry.card);
    });
    game.pendingTrick = { resolvesAt: Date.now() - 1, lastPlayedCardPlayerIndex: 3 };

    const resolution = resolveCompletedTrick(game);

    assert.equal(resolution.roundResult.tensCaptured, 2);
    // seat 1 → Team B
    assert.equal(game.scores.teamB.tens, 2);
    assert.equal(game.scores.teamA.tens, 0);
  });

  it("trump card wins over ace of base suit", () => {
    const game = makeGame({ trumpSuit: "CLUBS" });
    game.baseSuit = "HEARTS";
    game.players.forEach((p) => { p.hand = []; }); // <-- Add this line
    game.tableCards = [
      { playerIndex: 0, card: makeCard("HEARTS", "A") },
      { playerIndex: 1, card: makeCard("HEARTS", "K") },
      { playerIndex: 2, card: makeCard("CLUBS", "2") }, // lowest trump still wins
      { playerIndex: 3, card: makeCard("HEARTS", "Q") }
    ];
    game.tableCards.forEach(entry => {
      game.players[entry.playerIndex].hand.push(entry.card);
    });
    game.pendingTrick = { resolvesAt: Date.now() - 1, lastPlayedCardPlayerIndex: 3 };

    const resolution = resolveCompletedTrick(game);
    assert.equal(resolution.roundResult.winnerIndex, 2);
  });

  it("returns error when there is no pendingTrick", () => {
    const game = makeGame();
    const result = resolveCompletedTrick(game);
    assert.ok(result.error);
  });

  it("transitions to MAIN_GAME after trump-discovery trick resolves", () => {
    const game = makeGame({ phase: "TRUMP_DISCOVERY", trumpSuit: "SPADES" });
    game.baseSuit = "HEARTS";
    game.pendingMainDeal = true;
    game.players.forEach((p) => { p.hand = []; }); // <-- Add this line
    game.tableCards = [
      { playerIndex: 0, card: makeCard("HEARTS", "5") },
      { playerIndex: 1, card: makeCard("HEARTS", "9") }, // wins
      { playerIndex: 2, card: makeCard("HEARTS", "3") },
      { playerIndex: 3, card: makeCard("HEARTS", "2") }
    ];
    game.tableCards.forEach(entry => {
      game.players[entry.playerIndex].hand.push(entry.card);
    });
    game.pendingTrick = { resolvesAt: Date.now() - 1, lastPlayedCardPlayerIndex: 3 };

    // Give each player remaining cards so hand isn't empty after trick
    game.players.forEach((p) => {
      p.hand = [makeCard("HEARTS", "7")];
    });

    resolveCompletedTrick(game);
    assert.equal(game.phase, "MAIN_GAME");
    assert.equal(game.pendingMainDeal, false);
  });
});

// ---------------------------------------------------------------------------
// createGameState / startInitialDeal / startNextRound
// ---------------------------------------------------------------------------

describe("createGameState", () => {
  it("initialises with LOBBY phase and empty hands", () => {
    const players = [0, 1, 2, 3].map((i) => ({
      playerId: `p${i}`,
      socketId: null,
      seatIndex: i,
      name: `P${i}`
    }));
    const state = createGameState("R1", players);
    assert.equal(state.phase, "LOBBY");
    assert.equal(state.round, 1);
    state.players.forEach((p) => assert.equal(p.hand.length, 0));
  });
});

describe("startInitialDeal", () => {
  it("deals 5 cards to each player and sets TRUMP_DISCOVERY phase", () => {
    const players = [0, 1, 2, 3].map((i) => ({
      playerId: `p${i}`,
      socketId: `s${i}`,
      seatIndex: i,
      name: `P${i}`
    }));
    const game = createGameState("R1", players);
    startInitialDeal(game);
    assert.equal(game.phase, "TRUMP_DISCOVERY");
    assert.equal(game.round, 1);
    assert.equal(game.currentTurnIndex, 0);
    game.players.forEach((p) => assert.equal(p.hand.length, 5));
  });

  it("resets totalScores and scores to zero", () => {
    const players = [0, 1, 2, 3].map((i) => ({
      playerId: `p${i}`, socketId: `s${i}`, seatIndex: i, name: `P${i}`
    }));
    const game = createGameState("R1", players);
    game.totalScores.teamA.tens = 5;
    startInitialDeal(game);
    assert.equal(game.totalScores.teamA.tens, 0);
    assert.equal(game.scores.teamA.tens, 0);
  });
});

describe("startNextRound", () => {
  it("increments round counter", () => {
    const players = [0, 1, 2, 3].map((i) => ({
      playerId: `p${i}`, socketId: `s${i}`, seatIndex: i, name: `P${i}`
    }));
    const game = createGameState("R1", players);
    startInitialDeal(game);
    startNextRound(game);
    assert.equal(game.round, 2);
  });

  it("rotates firstTurnIndex clockwise each round", () => {
    const players = [0, 1, 2, 3].map((i) => ({
      playerId: `p${i}`, socketId: `s${i}`, seatIndex: i, name: `P${i}`
    }));
    const game = createGameState("R1", players);
    startInitialDeal(game);

    startNextRound(game); // round 2
    assert.equal(game.firstTurnIndex, 1);
    assert.equal(game.currentTurnIndex, 1);

    startNextRound(game); // round 3
    assert.equal(game.firstTurnIndex, 2);

    startNextRound(game); // round 4
    assert.equal(game.firstTurnIndex, 3);

    startNextRound(game); // round 5 → wraps
    assert.equal(game.firstTurnIndex, 0);
  });

  it("resets per-round scores but preserves totalScores", () => {
    const players = [0, 1, 2, 3].map((i) => ({
      playerId: `p${i}`, socketId: `s${i}`, seatIndex: i, name: `P${i}`
    }));
    const game = createGameState("R1", players);
    startInitialDeal(game);
    game.totalScores.teamA.tens = 3; // simulated from previous round
    game.scores.teamA.tens = 3;

    startNextRound(game);

    assert.equal(game.scores.teamA.tens, 0, "per-round scores should reset");
    assert.equal(game.totalScores.teamA.tens, 3, "totalScores should be preserved");
  });

  it("deals 5 fresh cards to each player", () => {
    const players = [0, 1, 2, 3].map((i) => ({
      playerId: `p${i}`, socketId: `s${i}`, seatIndex: i, name: `P${i}`
    }));
    const game = createGameState("R1", players);
    startInitialDeal(game);
    game.players.forEach((p) => { p.hand = []; }); // simulate hand played out

    startNextRound(game);
    game.players.forEach((p) => assert.equal(p.hand.length, 5));
  });
});
