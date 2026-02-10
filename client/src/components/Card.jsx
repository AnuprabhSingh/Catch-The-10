import { SUIT_COLORS, SUIT_SYMBOLS } from "../utils/cards";

export default function Card({
  card,
  isClickable,
  onClick,
  isTrump,
  isDimmed,
  isOnTable = false,
  dealDelay = 0,
  style
}) {
  if (!card) {
    return (
      <div className="h-20 w-14 rounded-xl border border-slate-700/60 bg-slate-900/40 sm:h-24 sm:w-16" />
    );
  }

  const suitColor = SUIT_COLORS[card.suit] || "text-slate-200";

  const dealStyle = {
    ...(dealDelay ? { "--deal-delay": `${dealDelay}ms` } : {}),
    ...(style || {})
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      style={dealStyle}
      className={`card-root relative flex h-20 w-14 flex-col items-center justify-between rounded-xl border px-2 py-2 text-xs font-semibold transition sm:h-24 sm:w-16 sm:text-sm
        ${isClickable ? "cursor-pointer hover:-translate-y-1 hover:border-emerald-400" : "cursor-default"}
        ${isTrump ? "border-amber-400/80 shadow-[0_0_0_2px_rgba(251,191,36,0.3)]" : "border-slate-700/60"}
        ${isDimmed ? "opacity-60" : "opacity-100"}
        ${isOnTable ? "card-table" : ""}
        ${dealDelay ? "card-deal" : ""}
        bg-slate-900/80`}
    >
      <span className={`${suitColor} text-sm sm:text-base`}>{card.rank}</span>
      <span className={`${suitColor} text-lg sm:text-xl`}>{SUIT_SYMBOLS[card.suit]}</span>
      <span className={`${suitColor} text-[10px] sm:text-xs`}>{card.rank}</span>
    </button>
  );
}
