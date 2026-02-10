export default function ScoreBoard({ scores, compact }) {
  if (compact) {
    return (
      <div className="glass-panel flex items-center gap-3 rounded-xl px-3 py-1.5 text-[11px] sm:rounded-2xl sm:px-4 sm:py-2 sm:text-sm">
        <span className="font-semibold text-slate-300">A</span>
        <span>{scores?.teamA?.tens ?? 0}×10</span>
        <span className="text-slate-600">|</span>
        <span className="font-semibold text-slate-300">B</span>
        <span>{scores?.teamB?.tens ?? 0}×10</span>
      </div>
    );
  }

  return (
    <div className="grid gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs sm:gap-4 sm:rounded-2xl sm:p-4 sm:text-sm">
      <div className="text-sm font-semibold text-slate-100 sm:text-base">Scoreboard</div>
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2 sm:rounded-xl sm:p-3">
          <div className="text-xs uppercase text-slate-400">Team A</div>
          <div className="mt-1 text-xs sm:mt-2 sm:text-sm">10s: {scores?.teamA?.tens ?? 0}</div>
          <div className="text-xs sm:text-sm">Tricks: {scores?.teamA?.tricks ?? 0}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2 sm:rounded-xl sm:p-3">
          <div className="text-xs uppercase text-slate-400">Team B</div>
          <div className="mt-1 text-xs sm:mt-2 sm:text-sm">10s: {scores?.teamB?.tens ?? 0}</div>
          <div className="text-xs sm:text-sm">Tricks: {scores?.teamB?.tricks ?? 0}</div>
        </div>
      </div>
    </div>
  );
}
