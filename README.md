# QuickNotes Backend

Real-time WebSocket and API server for [QuickNotes](https://github.com/suraj-chakraborty/QuickNotes). Built with Node.js, Express, Socket.IO, and MongoDB.

## Features

- **Document Sync**: Real-time delta synchronization powered by Socket.IO.
- **Auto-Save**: Debounced saving to MongoDB to prevent unnecessary database writes.
- **Presence Tracking**: Broadcasts the number of active users in each note.
- **Multiplayer Typing Race**: In-memory room manager for live typing race countdowns and progress tracking.
- **Health Check**: Simple `/api/health` endpoint for uptime monitoring.

## Tech Stack

- **Node.js** (v20+ / v22 LTS)
- **Express 5**
- **Socket.IO 4**
- **MongoDB & Mongoose 9**

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in this directory:

```env
PORT=3000
CLIENT_URL=http://localhost:5173
MONGODB_URL=mongodb+srv://<username>:<password>@cluster0.xor8rl1.mongodb.net/quick-notes?retryWrites=true&w=majority
```

### 3. Run the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server will start on `http://localhost:3000`.

## Socket.IO Events

### Document Collaboration
- `get-document(id)`: Load document data and join the room.
- `send-changes(delta)`: Broadcast text changes to other clients.
- `receive-changes(delta)`: Receive text changes from collaborators.
- `save-document({ data, title })`: Save current content and title to MongoDB.
- `rename-document(title)`: Broadcast title change to everyone in the room.
- `user-count(count)`: Emits active collaborator count.

### Typing Race
- `join-race({ documentId, playerName })`: Register a player for the room's race.
- `start-race({ documentId })`: Starts a synchronized 3-second countdown.
- `update-race-progress({ documentId, progress, wpm, finished })`: Updates live race stats.
- `race-state-updated`: Emits current leaderboard positions to all participants.
- `reset-race({ documentId })`: Resets the race for a rematch.

## Deployment (Render)

1. Create a **Web Service** on Render connected to this repository.
2. Build Command: `npm install`
3. Start Command: `npm start`
4. Add environment variables:
   - `NODE_VERSION` = `22` (or `20`)
   - `MONGODB_URL` = your MongoDB connection string
   - `CLIENT_URL` = your frontend URL
