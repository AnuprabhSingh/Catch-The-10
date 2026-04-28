import { PHASES, RANKS, SUITS, TEAM_KEYS, TRICK_RESOLVE_DELAY_MS } from "./constants.js";

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
const getTeamLabel = (seatIndex) => (seatIndex % 2 === 0 ? "Team A" : "Team B");
const sortPlayersBySeatIndex = (players) =>
  [...players].sort((left, right) => left.seatIndex - right.seatIndex);

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

const getGameOverMessage = (scores) => {
  if (scores.teamA.tens > scores.teamB.tens) {
    return "Team A wins by 10s.";
  }

  if (scores.teamB.tens > scores.teamA.tens) {
    return "Team B wins by 10s.";
  }

  if (scores.teamA.tricks > scores.teamB.tricks) {
    return "Team A wins by tricks.";
  }

  if (scores.teamB.tricks > scores.teamA.tricks) {
    return "Team B wins by tricks.";
  }

  return "Game is a draw.";
};

export const createGameState = (roomId, players) => {
  const orderedPlayers = sortPlayersBySeatIndex(players);

  return {
    roomId,
    phase: PHASES.LOBBY,
    players: orderedPlayers.map((player) => ({
      ...player,
      team: getTeamLabel(player.seatIndex),
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
    pendingMainDeal: false,
    pendingTrick: null
  };
};

export const syncGamePlayers = (game, roomPlayers) => {
  const roomPlayersById = new Map(roomPlayers.map((player) => [player.playerId, player]));

  game.players = sortPlayersBySeatIndex(
    game.players.map((player) => {
      const roomPlayer = roomPlayersById.get(player.playerId);

      if (!roomPlayer) {
        return {
          ...player,
          socketId: null
        };
      }

      return {
        ...player,
        name: roomPlayer.name,
        seatIndex: roomPlayer.seatIndex,
        socketId: roomPlayer.socketId,
        disconnectedAt: roomPlayer.disconnectedAt ?? null,
        team: getTeamLabel(roomPlayer.seatIndex)
      };
    })
  );
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
  game.pendingTrick = null;
  game.scores = {
    teamA: { tens: 0, tricks: 0 },
    teamB: { tens: 0, tricks: 0 }
  };
};

export const getPublicStateForPlayer = (game, playerId) => {
  const players = game.players.map((player) => {
    const isOwner = player.playerId === playerId;

    return {
      playerId: player.playerId,
      name: player.name,
      seatIndex: player.seatIndex,
      team: player.team,
      isConnected: player.socketId !== null,
      hand: isOwner ? player.hand : undefined,
      handCount: player.hand.length
    };
  });

  const ownerIndex =
    game.players.find((player) => player.playerId === playerId)?.seatIndex ?? null;

  return {
    roomId: game.roomId,
    phase: game.phase,
    baseSuit: game.baseSuit,
    trumpSuit: game.trumpSuit,
    currentTurnIndex: game.currentTurnIndex,
    players,
    tableCards: game.tableCards,
    scores: game.scores,
    yourPlayerIndex: ownerIndex,
    activePlayerCount: players.filter((player) => player.isConnected).length,
    pendingTrick: game.pendingTrick
      ? {
          resolvesAt: game.pendingTrick.resolvesAt,
          lastPlayedCardPlayerIndex: game.pendingTrick.lastPlayedCardPlayerIndex
        }
      : null
  };
};

export const playCardInGame = (game, playerId, cardId) => {
  if (game.phase === PHASES.FINISHED || game.phase === PHASES.LOBBY) {
    return { error: "Game is not active." };
  }

  if (game.pendingTrick) {
    return { error: "Wait for the current trick to resolve." };
  }

  const playerIndex = game.players.findIndex((player) => player.playerId === playerId);
  if (playerIndex < 0) return { error: "Player not found." };

  const player = game.players[playerIndex];
  if (game.currentTurnIndex !== player.seatIndex) return { error: "Not your turn." };

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

  game.tableCards.push({ playerIndex: player.seatIndex, card });

  let roundComplete = null;
  if (game.tableCards.length === 4) {
    game.currentTurnIndex = null;
    game.pendingTrick = {
      resolvesAt: Date.now() + TRICK_RESOLVE_DELAY_MS,
      lastPlayedCardPlayerIndex: player.seatIndex
    };
    roundComplete = {
      trickCards: game.tableCards.map((entry) => ({
        playerIndex: entry.playerIndex,
        card: { ...entry.card }
      })),
      resolvesAt: game.pendingTrick.resolvesAt,
      lastPlayedCardPlayerIndex: player.seatIndex
    };
  } else {
    game.currentTurnIndex = (player.seatIndex + 1) % game.players.length;
  }

  return { trumpDecided, roundComplete };
};

export const resolveCompletedTrick = (game) => {
  if (!game.pendingTrick || game.tableCards.length !== 4) {
    return { error: "No completed trick is waiting to resolve." };
  }

  const trickCards = game.tableCards.map((entry) => ({
    playerIndex: entry.playerIndex,
    card: { ...entry.card }
  }));
  const winnerEntry = determineTrickWinner(trickCards, game.baseSuit, game.trumpSuit);
  const winningTeamKey = getTeamKey(winnerEntry.playerIndex);
  const winningTeam = getTeamLabel(winnerEntry.playerIndex);
  const tensCapturedCards = trickCards
    .filter((entry) => entry.card.rank === "10")
    .map((entry) => ({ ...entry }));

  game.scores[winningTeamKey].tens += tensCapturedCards.length;
  game.scores[winningTeamKey].tricks += 1;
  game.tableCards = [];
  game.baseSuit = null;
  game.currentTurnIndex = winnerEntry.playerIndex;
  game.pendingTrick = null;

  if (game.pendingMainDeal && game.phase === PHASES.TRUMP_DISCOVERY) {
    dealRemainingDeck(game);
    game.phase = PHASES.MAIN_GAME;
    game.pendingMainDeal = false;
  }

  let gameOver = null;
  const allHandsEmpty = game.players.every((player) => player.hand.length === 0);
  if (allHandsEmpty && game.deck.length === 0) {
    game.phase = PHASES.FINISHED;
    gameOver = getGameOverMessage(game.scores);
  }

  return {
    roundResult: {
      winnerIndex: winnerEntry.playerIndex,
      winningTeam,
      tensCaptured: tensCapturedCards.length,
      tensCapturedCards,
      trickCards,
      message: `Trick won by ${winningTeam}`
    },
    clearTable: {
      nextTurnIndex: game.currentTurnIndex
    },
    gameOver
  };
};
