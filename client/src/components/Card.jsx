import { SUIT_COLORS, SUIT_SYMBOLS } from "../utils/cards";

export default function Card({
  card,
  isClickable,
  onClick,
  isTrump,
  isDimmed,
  isHighlighted = false,
  isOnTable = false,
  dealDelay = 0,
  style
}) {
  if (!card) {
    return (
      <div className={`rounded-lg border border-slate-700/60 bg-slate-900/40 sm:rounded-xl ${isOnTable ? "h-14 w-10 sm:h-18 sm:w-13 md:h-22 md:w-15" : "h-16 w-12 sm:h-20 sm:w-14 md:h-24 md:w-16"}`} />
    );
  }

  const suitColor = SUIT_COLORS[card.suit] || "text-slate-200";

  const dealStyle = {
    ...(dealDelay ? { "--deal-delay": `${dealDelay}ms` } : {}),
    ...(style || {})
  };

  const sizeClasses = isOnTable
    ? "h-30 w-20 sm:h-30 sm:w-20 md:h-30 md:w-20"
    : "h-30 w-20 sm:h-30 sm:w-20 md:h-30 md:w-20";

  // --- PNG path logic ---
  // Example: public/cards_images/10_of_hearts.png for 10 of Hearts
  const card_suit_lower = (card.suit).toLowerCase();
  const imgSrc = `/cards_images/${card.rank}_of_${card_suit_lower}.png`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      style={dealStyle}
      className={`card-root relative flex ${sizeClasses} flex-col items-center justify-between rounded-lg border px-1 py-1 text-xs font-semibold transition active:scale-95 sm:rounded-xl sm:px-2 sm:py-1.5
        ${isClickable ? "cursor-pointer hover:-translate-y-1 hover:border-emerald-400 active:border-emerald-400" : "cursor-default"}
        ${isTrump ? "border-amber-400/80 shadow-[0_0_0_2px_rgba(251,191,36,0.3)]" : "border-slate-700/60"}
        ${isHighlighted ? "ring-2 ring-sky-300/80 shadow-[0_0_20px_rgba(125,211,252,0.35)]" : ""}
        ${isDimmed ? "opacity-60" : "opacity-100"}
        ${isOnTable ? "card-table" : ""}
        ${dealDelay ? "card-deal" : ""}
        bg-slate-900/80`}
    >
      <img
        src={imgSrc}
        alt={`${card.rank} of ${card.suit}`}
        className="w-full h-full object-contain pointer-events-none select-none"
        draggable={false}
      />
    </button>
  );
}
