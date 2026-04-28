import Card from "./Card";
import { SUIT_COLORS, SUIT_LABELS, SUIT_SYMBOLS } from "../utils/cards";

const POSITIONS = ["bottom", "left", "top", "right"];

export default function Table({ tableCards, trumpSuit, yourIndex, highlightedPlayerIndex = null }) {
  const getRelativePosition = (playerIndex) => {
    if (yourIndex == null) return POSITIONS[playerIndex];
    const relative = (playerIndex - yourIndex + 4) % 4;
    return POSITIONS[relative];
  };

  const cardByPosition = POSITIONS.reduce((acc, position) => {
    acc[position] = null;
    return acc;
  }, {});

  tableCards.forEach((entry) => {
    const position = getRelativePosition(entry.playerIndex);
    cardByPosition[position] = entry.card;
  });

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div className="table-felt absolute inset-0 rounded-[20px] sm:rounded-[28px] md:rounded-[40px]" />
      {trumpSuit && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-xl border border-amber-400/40 bg-slate-900/80 px-2 py-1 text-center shadow-lg backdrop-blur-sm">
            <div className="text-[8px] font-medium uppercase tracking-widest text-slate-500">Trump</div>
            <div className={`text-base font-bold leading-tight sm:text-lg ${SUIT_COLORS[trumpSuit]}`}>
              {SUIT_SYMBOLS[trumpSuit]}
            </div>
            <div className="text-[9px] font-semibold text-slate-300 sm:text-[10px]">{SUIT_LABELS[trumpSuit]}</div>
          </div>
        </div>
      )}
      <div className="absolute top-1 z-10 flex w-full justify-center sm:top-3">
        <Card
          card={cardByPosition.top}
          isTrump={cardByPosition.top?.suit === trumpSuit}
          isOnTable
          isHighlighted={highlightedPlayerIndex != null && getRelativePosition(highlightedPlayerIndex) === "top"}
        />
      </div>
      <div className="absolute left-1 z-10 flex h-full items-center sm:left-3">
        <Card
          card={cardByPosition.left}
          isTrump={cardByPosition.left?.suit === trumpSuit}
          isOnTable
          isHighlighted={highlightedPlayerIndex != null && getRelativePosition(highlightedPlayerIndex) === "left"}
        />
      </div>
      <div className="absolute right-1 z-10 flex h-full items-center sm:right-3">
        <Card
          card={cardByPosition.right}
          isTrump={cardByPosition.right?.suit === trumpSuit}
          isOnTable
          isHighlighted={highlightedPlayerIndex != null && getRelativePosition(highlightedPlayerIndex) === "right"}
        />
      </div>
      <div className="absolute bottom-1 z-10 flex w-full justify-center sm:bottom-3">
        <Card
          card={cardByPosition.bottom}
          isTrump={cardByPosition.bottom?.suit === trumpSuit}
          isOnTable
          isHighlighted={highlightedPlayerIndex != null && getRelativePosition(highlightedPlayerIndex) === "bottom"}
        />
      </div>
    </div>
  );
}
