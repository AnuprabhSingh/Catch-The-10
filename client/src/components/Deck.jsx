export default function Deck({ isShuffling }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm">
      <div className="mb-3 text-xs uppercase text-slate-400">Deck</div>
      <div className={`deck-stack ${isShuffling ? "deck-shuffle" : ""}`}>
        <div className="deck-card" />
        <div className="deck-card" />
        <div className="deck-card" />
      </div>
      <div className="mt-3 text-xs text-slate-500">
        {isShuffling ? "Shuffling..." : "Ready"}
      </div>
    </div>
  );
}
