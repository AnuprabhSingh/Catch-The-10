export const SUITS = ["HEARTS", "DIAMONDS", "CLUBS", "SPADES"];
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

export const PHASES = {
  LOBBY: "LOBBY",
  TRUMP_DISCOVERY: "TRUMP_DISCOVERY",
  MAIN_GAME: "MAIN_GAME",
  ROUND_END: "ROUND_END",
  FINISHED: "FINISHED"
};

export const TEAM_KEYS = {
  TEAM_A: "teamA",
  TEAM_B: "teamB"
};

export const TRICK_RESOLVE_DELAY_MS = Number(process.env.TRICK_RESOLVE_DELAY_MS ?? 3000);
export const MAX_ROUNDS = 5;
