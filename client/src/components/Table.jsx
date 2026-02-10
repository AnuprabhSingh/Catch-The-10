import Card from "./Card";

const POSITIONS = ["bottom", "left", "top", "right"];

export default function Table({ tableCards, trumpSuit, yourIndex }) {
  const getRelativePosition = (playerIndex) => {
    if (yourIndex == null) return POSITIONS[playerIndex];
    const relative = (playerIndex - yourIndex + 4) % 4;
    return POSITIONS[relative];
  };

  const cardByPosition = POSITIONS.reduce((acc, position) => {
    acc[position] = null;
    return acc;
  }, {});

  tableCards.forEach((entry) => {
    const position = getRelativePosition(entry.playerIndex);
    cardByPosition[position] = entry.card;
  });

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div className="table-felt absolute inset-0 rounded-[20px] sm:rounded-[28px] md:rounded-[40px]" />
      <div className="absolute top-1 z-10 flex w-full justify-center sm:top-3">
        <Card
          card={cardByPosition.top}
          isTrump={cardByPosition.top?.suit === trumpSuit}
          isOnTable
        />
      </div>
      <div className="absolute left-1 z-10 flex h-full items-center sm:left-3">
        <Card
          card={cardByPosition.left}
          isTrump={cardByPosition.left?.suit === trumpSuit}
          isOnTable
        />
      </div>
      <div className="absolute right-1 z-10 flex h-full items-center sm:right-3">
        <Card
          card={cardByPosition.right}
          isTrump={cardByPosition.right?.suit === trumpSuit}
          isOnTable
        />
      </div>
      <div className="absolute bottom-1 z-10 flex w-full justify-center sm:bottom-3">
        <Card
          card={cardByPosition.bottom}
          isTrump={cardByPosition.bottom?.suit === trumpSuit}
          isOnTable
        />
      </div>
    </div>
  );
}
