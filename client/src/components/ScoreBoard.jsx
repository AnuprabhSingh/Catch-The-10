const TEAM_A_CLASSES = {
  border: "border-emerald-700/60",
  bg: "bg-emerald-950/60",
  label: "text-emerald-400",
  value: "text-emerald-200",
  ring: "ring-1 ring-emerald-400/40"
};
const TEAM_B_CLASSES = {
  border: "border-rose-700/60",
  bg: "bg-rose-950/60",
  label: "text-rose-400",
  value: "text-rose-200",
  ring: "ring-1 ring-rose-400/40"
};

function TeamCard({ label, tens, tricks, classes, isLeading }) {
  return (
    <div className={`rounded-xl border p-3 sm:p-4 ${classes.border} ${classes.bg} ${isLeading ? classes.ring : ""}`}>
      <div className={`text-[10px] font-bold uppercase tracking-widest ${classes.label}`}>
        Team {label} {isLeading && <span className="ml-1">👑</span>}
      </div>
      <div className="mt-2 flex items-end gap-3">
        <div>
          <div className={`text-2xl font-black leading-none sm:text-3xl ${classes.value}`}>{tens}</div>
          <div className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-500">tens</div>
        </div>
        <div className="mb-0.5">
          <div className="text-sm font-semibold text-slate-300">{tricks}</div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500">tricks</div>
        </div>
      </div>
    </div>
  );
}

export default function ScoreBoard({ scores, compact }) {
  const tensA = scores?.teamA?.tens ?? 0;
  const tensB = scores?.teamB?.tens ?? 0;
  const tricksA = scores?.teamA?.tricks ?? 0;
  const tricksB = scores?.teamB?.tricks ?? 0;

  if (compact) {
    return (
      <div className="glass-panel flex items-center gap-2 rounded-xl px-3 py-1.5 text-[11px] sm:rounded-2xl sm:px-4 sm:py-2 sm:text-sm">
        <span className="font-bold text-emerald-400">A</span>
        <span className="font-semibold text-emerald-200">{tensA}<span className="text-slate-500">×10</span></span>
        <span className="text-slate-700">·</span>
        <span className="font-bold text-rose-400">B</span>
        <span className="font-semibold text-rose-200">{tensB}<span className="text-slate-500">×10</span></span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:rounded-3xl sm:p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400 sm:text-sm">
        Scoreboard
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <TeamCard
          label="A"
          tens={tensA}
          tricks={tricksA}
          classes={TEAM_A_CLASSES}
          isLeading={tensA > tensB}
        />
        <TeamCard
          label="B"
          tens={tensB}
          tricks={tricksB}
          classes={TEAM_B_CLASSES}
          isLeading={tensB > tensA}
        />
      </div>
    </div>
  );
}
