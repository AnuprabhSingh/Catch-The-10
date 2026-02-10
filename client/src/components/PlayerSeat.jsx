export default function PlayerSeat({ player, isCurrent, isYou, position }) {
  const positionClasses = {
    bottom: "items-center",
    top: "items-center",
    left: "items-start",
    right: "items-end"
  };

  return (
    <div className={`flex flex-col gap-0 sm:gap-0.5 ${positionClasses[position]} min-w-0 max-w-[80px] sm:min-w-[90px] sm:max-w-none`}>
      <div className="flex items-center gap-1 sm:gap-1.5">
        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isCurrent ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-slate-600"}`} />
        <span className={`truncate text-[11px] font-semibold leading-tight sm:text-xs ${isYou ? "text-emerald-300" : "text-slate-200"}`}>
          {player?.name || "—"}
        </span>
      </div>
      <div className="truncate text-[9px] leading-tight text-slate-500 sm:text-[10px]">
        {player ? `${player.team} · ${player.handCount ?? player.hand?.length ?? 0}` : ""}
      </div>
    </div>
  );
}
