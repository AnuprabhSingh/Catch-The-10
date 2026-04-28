const TEAM_COLORS = {
  A: {
    ring: "ring-emerald-400",
    ringGlow: "shadow-[0_0_0_3px_rgba(52,211,153,0.35)]",
    avatar: "bg-emerald-900/80 text-emerald-300 border-emerald-700",
    label: "text-emerald-300",
    dot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
  },
  B: {
    ring: "ring-rose-400",
    ringGlow: "shadow-[0_0_0_3px_rgba(251,113,133,0.35)]",
    avatar: "bg-rose-900/80 text-rose-300 border-rose-700",
    label: "text-rose-300",
    dot: "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]"
  }
};

export default function PlayerSeat({ player, isCurrent, isYou, position }) {
  const alignClasses = {
    bottom: "items-center",
    top: "items-center",
    left: "items-start",
    right: "items-end"
  };

  const team = player?.team ?? "A";
  const colors = TEAM_COLORS[team] ?? TEAM_COLORS.A;
  const initials = player?.name
    ? player.name.slice(0, 2).toUpperCase()
    : "?";
  const handCount = player?.handCount ?? player?.hand?.length ?? 0;

  return (
    <div className={`flex flex-col gap-1 ${alignClasses[position]} min-w-0`}>
      {/* Avatar */}
      <div className="relative">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full border text-[11px] font-bold sm:h-10 sm:w-10 sm:text-xs
            ${player ? colors.avatar : "border-slate-700 bg-slate-900/50 text-slate-600"}
            ${isCurrent ? `ring-2 ${colors.ring} ${colors.ringGlow}` : ""}
          `}
        >
          {initials}
        </div>
        {/* Online dot */}
        {player && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900
              ${player.isConnected === false ? "bg-amber-400" : isCurrent ? colors.dot : "bg-slate-600"}`}
          />
        )}
        {/* Pulse ring on active turn */}
        {isCurrent && (
          <span className={`absolute inset-0 animate-ping rounded-full opacity-30 ring-2 ${colors.ring}`} />
        )}
      </div>

      {/* Name */}
      <div className={`max-w-[72px] truncate text-center text-[10px] font-semibold leading-tight sm:max-w-[88px] sm:text-[11px]
        ${isYou ? colors.label : "text-slate-300"}`}>
        {player?.name || "—"}
        {isYou && <span className="ml-0.5 text-[8px] text-slate-500"> (you)</span>}
      </div>

      {/* Cards in hand */}
      {player && (
        <div className="flex items-center gap-0.5 text-[9px] text-slate-500">
          <span>🂠</span>
          <span>{handCount}</span>
        </div>
      )}

      {/* Disconnected badge */}
      {player && !player.isConnected && (
        <div className="rounded px-1 py-0.5 text-[8px] font-medium text-amber-400 ring-1 ring-amber-400/40">
          offline
        </div>
      )}
    </div>
  );
}
