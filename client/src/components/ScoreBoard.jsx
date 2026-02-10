export default function ScoreBoard({ scores }) {
  return (
    <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-sm sm:p-4">
      <div className="text-base font-semibold text-slate-100">Scoreboard</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <div className="text-xs uppercase text-slate-400">Team A</div>
          <div className="mt-2 text-sm">10s: {scores?.teamA?.tens ?? 0}</div>
          <div className="text-sm">Tricks: {scores?.teamA?.tricks ?? 0}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <div className="text-xs uppercase text-slate-400">Team B</div>
          <div className="mt-2 text-sm">10s: {scores?.teamB?.tens ?? 0}</div>
          <div className="text-sm">Tricks: {scores?.teamB?.tricks ?? 0}</div>
        </div>
      </div>
    </div>
  );
}
