import { SUIT_LABELS } from "../utils/cards";

function getCardImageSrc(card) {
  return `/cards_images/${card.rank}_of_${card.suit.toLowerCase()}.png`;
}

export default function TensWonPanel({ history }) {
  const entries = history ?? [];

  return (
    <div className="glass-panel rounded-2xl p-3 text-xs text-slate-300 sm:rounded-3xl sm:p-4 sm:text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-slate-100">10 Cards Won</div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
          {entries.length}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-slate-800/70 bg-slate-950/50 px-3 py-4 text-center text-[11px] text-slate-500">
          No 10 cards captured yet.
        </div>
      ) : (
        <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto pr-1">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/50 p-2"
            >
              <div className="flex h-16 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-slate-700/70 bg-slate-900/80 p-1">
                <img
                  src={getCardImageSrc(entry.card)}
                  alt={`${entry.card.rank} of ${entry.card.suit}`}
                  className="h-full w-full object-contain"
                  draggable={false}
                />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
                  Round {entry.round}
                </div>
                <div className="mt-1 font-medium text-slate-100">
                  Won by {entry.winningTeam}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  {entry.card.rank} of {SUIT_LABELS[entry.card.suit] ?? entry.card.suit}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
