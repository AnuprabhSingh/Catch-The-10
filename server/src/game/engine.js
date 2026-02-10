import { PHASES, RANKS, SUITS, TEAM_KEYS } from "./constants.js";

const rankValues = RANKS.reduce((acc, rank, index) => {
  acc[rank] = index + 2;
  return acc;
}, {});

const createDeck = () => {
  const deck = [];
  let idCounter = 0;
  SUITS.forEach((suit) => {
    RANKS.forEach((rank) => {
      deck.push({ id: `${suit}-${rank}-${idCounter++}`, suit, rank });
    });
  });
  return deck;
};

const shuffle = (cards) => {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const dealCards = (game, countPerPlayer) => {
  for (let round = 0; round < countPerPlayer; round += 1) {
    for (let i = 0; i < game.players.length; i += 1) {
      const card = game.deck.shift();
      if (card) {
        game.players[i].hand.push(card);
      }
    }
  }
};

const dealRemainingDeck = (game) => {
  game.deck = shuffle(game.deck);
  let seatIndex = 0;
  while (game.deck.length) {
    const card = game.deck.shift();
    game.players[seatIndex].hand.push(card);
    seatIndex = (seatIndex + 1) % game.players.length;
  }
};

const getTeamKey = (seatIndex) => (seatIndex % 2 === 0 ? TEAM_KEYS.TEAM_A : TEAM_KEYS.TEAM_B);

const determineTrickWinner = (tableCards, baseSuit, trumpSuit) => {
  const trumpCards = trumpSuit
    ? tableCards.filter((entry) => entry.card.suit === trumpSuit)
    : [];

  if (trumpCards.length > 0) {
    return trumpCards.reduce((best, current) =>
      rankValues[current.card.rank] > rankValues[best.card.rank] ? current : best
    );
  }

  const baseCards = tableCards.filter((entry) => entry.card.suit === baseSuit);
  return baseCards.reduce((best, current) =>
    rankValues[current.card.rank] > rankValues[best.card.rank] ? current : best
  );
};

export const createGameState = (roomId, players) => {
  return {
    roomId,
    phase: PHASES.LOBBY,
    players: players.map((player, index) => ({
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
    },
    pendingMainDeal: false
  };
};

export const startInitialDeal = (game) => {
  game.deck = shuffle(createDeck());
  game.players.forEach((player) => {
    player.hand = [];
  });
  dealCards(game, 5);
  game.phase = PHASES.TRUMP_DISCOVERY;
  game.baseSuit = null;
  game.trumpSuit = null;
  game.tableCards = [];
  game.currentTurnIndex = 0;
  game.pendingMainDeal = false;
  game.scores = {
    teamA: { tens: 0, tricks: 0 },
    teamB: { tens: 0, tricks: 0 }
  };
};

export const getPublicStateForSocket = (game, socketId) => {
  const players = game.players.map((player) => {
    const isOwner = player.id === socketId;
    return {
      id: player.id,
      name: player.name,
      seatIndex: player.seatIndex,
      team: player.team,
      hand: isOwner ? player.hand : undefined,
      handCount: isOwner ? undefined : player.hand.length
    };
  });

  const ownerIndex = game.players.find((player) => player.id === socketId)?.seatIndex ?? null;

  return {
    roomId: game.roomId,
    phase: game.phase,
    baseSuit: game.baseSuit,
    trumpSuit: game.trumpSuit,
    currentTurnIndex: game.currentTurnIndex,
    players,
    tableCards: game.tableCards,
    scores: game.scores,
    yourPlayerIndex: ownerIndex
  };
};

export const playCardInGame = (game, socketId, cardId) => {
  if (game.phase === PHASES.FINISHED || game.phase === PHASES.LOBBY) {
    return { error: "Game is not active." };
  }

  const playerIndex = game.players.findIndex((player) => player.id === socketId);
  if (playerIndex < 0) return { error: "Player not found." };
  if (game.currentTurnIndex !== playerIndex) return { error: "Not your turn." };

  const player = game.players[playerIndex];
  const card = player.hand.find((item) => item.id === cardId);
  if (!card) return { error: "Card not in hand." };

  const baseSuit = game.baseSuit;
  const hasBaseSuit = baseSuit
    ? player.hand.some((item) => item.suit === baseSuit)
    : false;

  if (baseSuit && hasBaseSuit && card.suit !== baseSuit) {
    return { error: "Must follow base suit." };
  }

  player.hand = player.hand.filter((item) => item.id !== cardId);

  if (!game.baseSuit) {
    game.baseSuit = card.suit;
  }

  let trumpDecided = false;
  if (!game.trumpSuit && game.baseSuit && card.suit !== game.baseSuit && !hasBaseSuit) {
    game.trumpSuit = card.suit;
    game.pendingMainDeal = true;
    trumpDecided = true;
  }

  game.tableCards.push({ playerIndex, card });

  let trickResult = null;
  let gameOver = null;

  if (game.tableCards.length === 4) {
    const winnerEntry = determineTrickWinner(game.tableCards, game.baseSuit, game.trumpSuit);
    const winningTeam = getTeamKey(winnerEntry.playerIndex);

    const tensCaptured = game.tableCards.filter((entry) => entry.card.rank === "10").length;
    game.scores[winningTeam].tens += tensCaptured;
    game.scores[winningTeam].tricks += 1;

    trickResult = {
      winnerIndex: winnerEntry.playerIndex,
      tensCaptured,
      message: `Trick won by Player ${winnerEntry.playerIndex}`
    };

    game.tableCards = [];
    game.baseSuit = null;
    game.currentTurnIndex = winnerEntry.playerIndex;

    const allHandsEmpty = game.players.every((p) => p.hand.length === 0);

    // After the trick where trump is decided finishes, deal the remaining deck.
    if (game.pendingMainDeal && game.phase === PHASES.TRUMP_DISCOVERY) {
      dealRemainingDeck(game);
      game.phase = PHASES.MAIN_GAME;
      game.pendingMainDeal = false;
    }

    if (allHandsEmpty && game.deck.length === 0) {
      game.phase = PHASES.FINISHED;
      if (game.scores.teamA.tens > game.scores.teamB.tens) {
        gameOver = "Team A wins by 10s.";
      } else if (game.scores.teamB.tens > game.scores.teamA.tens) {
        gameOver = "Team B wins by 10s.";
      } else if (game.scores.teamA.tricks > game.scores.teamB.tricks) {
        gameOver = "Team A wins by tricks.";
      } else if (game.scores.teamB.tricks > game.scores.teamA.tricks) {
        gameOver = "Team B wins by tricks.";
      } else {
        gameOver = "Game is a draw.";
      }
    }
  } else {
    game.currentTurnIndex = (game.currentTurnIndex + 1) % game.players.length;
  }

  return { trumpDecided, trickResult, gameOver };
};
