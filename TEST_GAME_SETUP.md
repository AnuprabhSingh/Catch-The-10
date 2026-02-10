# Test Game Setup Helper

This tool quickly sets up a test game with 4 players in a room without needing to manually enter player names and room IDs each time.

## Installation

The script requires `socket.io-client` which should already be available. If not, run:

```bash
npm install socket.io-client
```

## Usage

### Quick Setup (with defaults)

```bash
npm run test:game
```

This creates a game with a random room ID and 4 default players: Alice, Bob, Charlie, Diana.

### Custom Room ID

```bash
node test-game-setup.js MYROOM
```

Creates a game in room `MYROOM` with default player names.

### Custom Players

```bash
node test-game-setup.js MYROOM Player1 Player2 Player3 Player4
```

Creates a game with your custom player names and room ID.

### Examples

```bash
# Quick test with defaults
npm run test:game

# Specific room with default players
node test-game-setup.js TESTROOM

# Specific room with custom players
node test-game-setup.js TESTROOM Alice Bob Charlie Diana

# Just custom players, random room ID
node test-game-setup.js "" Alice Bob Charlie Diana
```

## What It Does

1. Connects 4 WebSocket clients to your server
2. Each player joins the specified room
3. Displays the room ID and player list
4. Waits for you to press Enter to start the game
5. Emits the `start_game` event
6. Keeps the game running so you can test it in your browser

## Testing Workflow

1. Start your dev server: `npm run dev`
2. In another terminal, run: `npm run test:game`
3. Open `http://localhost:5173` in your browser
4. Press Enter in the test script to start the game
5. Both programmatic players and browser players can interact

## Tips

- The room ID is logged so you can join additional players via the browser if needed
- The script keeps players connected, so you can close the browser and they're still there
- Press Ctrl+C to disconnect all test players and exit
