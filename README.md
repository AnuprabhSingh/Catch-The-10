# Catch the Ten

Multiplayer trick-taking web card game with server-authoritative rules.

## Tech Stack
- Frontend: React + Tailwind CSS (Vite)
- Backend: Node.js + Express
- Real-time: Socket.IO

## Requirements
- Node.js 18+

## Setup
1. Install dependencies from the project root.
2. Start both server and client in separate terminals or use the combined script.

### Install
```bash
npm install
```

### Run (two terminals)
```bash
npm run dev:server
```

```bash
npm run dev:client
```

### Run (single command)
```bash
npm run dev
```

## Game Flow
- Join a room with 4 players.
- Start game once all seats are filled.
- Play cards on your turn. The backend enforces all rules.

## Configuration
- Client expects the server at http://localhost:3001 by default.
- To override, set VITE_SERVER_URL in the client environment.
