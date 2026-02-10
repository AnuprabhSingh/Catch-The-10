export default function PlayerSeat({ player, isCurrent, isYou, position }) {
  const positionClasses = {
    bottom: "items-center",
    top: "items-center",
    left: "items-start",
    right: "items-end"
  };

  return (
    <div className={`flex flex-col gap-1 ${positionClasses[position]} min-w-[90px] sm:min-w-[120px]`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isCurrent ? "bg-emerald-400" : "bg-slate-600"}`} />
        <span className={`text-xs font-semibold sm:text-sm ${isYou ? "text-emerald-300" : "text-slate-200"}`}>
          {player?.name || "Waiting"}
        </span>
      </div>
      <div className="text-[11px] text-slate-400 sm:text-xs">
        {player ? `${player.team} • ${player.handCount ?? player.hand?.length ?? 0} cards` : ""}
      </div>
    </div>
  );
}
