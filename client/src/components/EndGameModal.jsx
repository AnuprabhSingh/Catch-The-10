function ScoreGrid({ scores, label }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      {label && (
        <div className="col-span-2 text-center text-xs uppercase tracking-widest text-slate-400">
          {label}
        </div>
      )}
      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4 text-center">
        <div className="text-xs uppercase tracking-wide text-slate-400">Team A</div>
        <div className="mt-2 text-lg font-semibold text-slate-100">
          {scores?.teamA?.tens ?? 0} x10
        </div>
        <div className="text-xs text-slate-500">Tricks: {scores?.teamA?.tricks ?? 0}</div>
      </div>
      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4 text-center">
        <div className="text-xs uppercase tracking-wide text-slate-400">Team B</div>
        <div className="mt-2 text-lg font-semibold text-slate-100">
          {scores?.teamB?.tens ?? 0} x10
        </div>
        <div className="text-xs text-slate-500">Tricks: {scores?.teamB?.tricks ?? 0}</div>
      </div>
    </div>
  );
}

export default function EndGameModal({
  isOpen,
  isRoundEnd,
  roundSummary,
  summary,
  canReplay,
  isRestarting,
  onPlayAgain,
  onNextRound,
  onLeaveRoom
}) {
  if (!isOpen) {
    return null;
  }

  if (isRoundEnd && roundSummary) {
    const { round, nextRound, maxRounds, roundScores, totalScores } = roundSummary;
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
        <div className="glass-panel w-full max-w-md rounded-3xl border border-slate-700/60 p-6 shadow-2xl sm:p-8">
          <div className="space-y-1 text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
              Round {round} of {maxRounds} Complete
            </div>
            <h2 className="text-2xl font-bold text-slate-50">Round Over</h2>
          </div>

          <ScoreGrid scores={roundScores} label="This Round" />
          <ScoreGrid scores={totalScores} label={`Total (after ${round} rounds)`} />

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onNextRound}
              disabled={!canReplay}
              className="rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-3 font-semibold text-white transition hover:from-sky-600 hover:to-indigo-600 disabled:cursor-not-allowed disabled:from-slate-600 disabled:to-slate-600"
            >
              Round {nextRound} →
            </button>
            <button
              type="button"
              onClick={onLeaveRoom}
              className="rounded-2xl border border-slate-600 px-4 py-3 font-semibold text-slate-200 transition hover:border-red-500 hover:text-red-300"
            >
              Leave Room
            </button>
          </div>

          {!canReplay && (
            <div className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-center text-xs text-amber-200">
              All 4 players need to be connected to continue.
            </div>
          )}
        </div>
      </div>
    );
  }

  const scores = summary?.scores;
  const winner = summary?.winner || "No one";
  const result = summary?.result || "Game finished.";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md rounded-3xl border border-slate-700/60 p-6 shadow-2xl sm:p-8">
        <div className="space-y-2 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
            Match Complete
          </div>
          <h2 className="text-3xl font-bold text-slate-50">{winner}</h2>
          <p className="text-sm text-slate-300">{result}</p>
        </div>

        <ScoreGrid scores={scores} />

        {!canReplay && (
          <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-center text-xs text-amber-200">
            All 4 players need to stay connected to replay this room.
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onPlayAgain}
            disabled={!canReplay || isRestarting}
            className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 font-semibold text-white transition hover:from-emerald-600 hover:to-teal-600 disabled:cursor-not-allowed disabled:from-slate-600 disabled:to-slate-600"
          >
            {isRestarting ? "Restarting..." : "Play Again"}
          </button>
          <button
            type="button"
            onClick={onLeaveRoom}
            className="rounded-2xl border border-slate-600 px-4 py-3 font-semibold text-slate-200 transition hover:border-red-500 hover:text-red-300"
          >
            Leave Room
          </button>
        </div>
      </div>
    </div>
  );
}
