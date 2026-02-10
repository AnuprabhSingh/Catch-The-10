export default function Deck({ isShuffling }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2 text-xs sm:rounded-2xl sm:p-4 sm:text-sm">
      <div className="mb-1 text-[10px] uppercase text-slate-400 sm:mb-2 sm:text-xs">Deck</div>
      <div className={`deck-stack ${isShuffling ? "deck-shuffle" : ""}`}>
        <div className="deck-card" />
        <div className="deck-card" />
        <div className="deck-card" />
      </div>
      <div className="mt-1 text-[10px] text-slate-500 sm:mt-2 sm:text-xs">
        {isShuffling ? "Shuffling..." : "Ready"}
      </div>
    </div>
  );
}
