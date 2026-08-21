require("dotenv").config();

const express = require("express");
const app = express();
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const server = http.createServer(app);
const { Server } = require("socket.io");
const Document = require("./Document");

const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    dbConnected: mongoose.connection.readyState === 1,
    timestamp: new Date(),
  });
});

// Validate required environment variables
if (!process.env.MONGODB_URL) {
  console.error("❌ MONGODB_URL is not set in .env file. Exiting.");
  process.exit(1);
}

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

// Socket.IO server with CORS
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || origin.startsWith("http://localhost") || origin === CLIENT_URL) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 30000,
  pingInterval: 25000,
});

const defaultValue = "";

// Helper to broadcast room user count
function broadcastUserCount(documentId) {
  const room = io.sockets.adapter.rooms.get(documentId);
  const count = room ? room.size : 0;
  io.to(documentId).emit("user-count", count);
}

// Typing Race State Management
// docId -> { status: 'waiting' | 'in_progress' | 'finished', text: string, startTime: number, players: Map<socketId, Player> }
const raceRooms = new Map();

function getRaceRoom(documentId) {
  if (!raceRooms.has(documentId)) {
    raceRooms.set(documentId, {
      status: 'waiting',
      text: '',
      startTime: null,
      players: new Map(),
    });
  }
  return raceRooms.get(documentId);
}

function broadcastRaceState(documentId) {
  const race = raceRooms.get(documentId);
  if (!race) return;

  const playersList = Array.from(race.players.values());
  io.to(documentId).emit("race-state-updated", {
    status: race.status,
    text: race.text,
    startTime: race.startTime,
    players: playersList,
  });
}

io.on("connection", (socket) => {
  let currentDocId = null;
  let currentUsername = null;

  socket.on("get-document", async (documentId) => {
    try {
      currentDocId = documentId;
      const document = await getOrCreateDocument(documentId);
      socket.join(documentId);

      // Send document data, title, and pageStyle
      socket.emit("load-document", {
        data: document.data,
        title: document.title || "Untitled Document",
        pageStyle: document.pageStyle || {},
        updatedAt: document.updatedAt,
      });

      broadcastUserCount(documentId);

      // Send current race state if in progress
      const race = raceRooms.get(documentId);
      if (race) {
        broadcastRaceState(documentId);
      }

      // Handle real-time editor content changes
      socket.on("send-changes", (delta) => {
        socket.broadcast.to(documentId).emit("receive-changes", delta);
      });

      // Handle real-time title rename
      socket.on("rename-document", async (newTitle) => {
        try {
          const trimmedTitle = (newTitle || "Untitled Document").trim();
          await Document.findByIdAndUpdate(documentId, { title: trimmedTitle });
          socket.broadcast.to(documentId).emit("document-renamed", trimmedTitle);
        } catch (err) {
          console.error(`❌ Error renaming document ${documentId}:`, err.message);
        }
      });

      // Handle real-time page design & style changes
      socket.on("update-page-style", async (newPageStyle) => {
        try {
          if (newPageStyle && typeof newPageStyle === "object") {
            await Document.findByIdAndUpdate(documentId, { pageStyle: newPageStyle });
            socket.broadcast.to(documentId).emit("page-style-updated", newPageStyle);
          }
        } catch (err) {
          console.error(`❌ Error updating page style for ${documentId}:`, err.message);
        }
      });

      // Handle document saving
      socket.on("save-document", async ({ data, title, pageStyle }) => {
        try {
          const updatePayload = { data };
          if (title) updatePayload.title = title;
          if (pageStyle) updatePayload.pageStyle = pageStyle;
          await Document.findByIdAndUpdate(documentId, updatePayload);
          socket.emit("save-success", { timestamp: new Date() });
        } catch (err) {
          console.error(`❌ Error saving document ${documentId}:`, err.message);
          socket.emit("save-error", err.message);
        }
      });

      // --- Typing Race Mode Socket Events ---
      socket.on("join-race", ({ username }) => {
        currentUsername = username || `User_${socket.id.slice(0, 4)}`;
        const race = getRaceRoom(documentId);
        race.players.set(socket.id, {
          id: socket.id,
          username: currentUsername,
          progress: 0,
          wpm: 0,
          accuracy: 100,
          finished: false,
          rank: null,
        });
        broadcastRaceState(documentId);
      });

      socket.on("start-race", ({ text }) => {
        const race = getRaceRoom(documentId);
        race.status = 'in_progress';
        race.text = text;
        race.startTime = Date.now() + 3000; // 3s countdown
        race.players.forEach((p) => {
          p.progress = 0;
          p.wpm = 0;
          p.accuracy = 100;
          p.finished = false;
          p.rank = null;
        });
        io.to(documentId).emit("race-starting", {
          text: race.text,
          startTime: race.startTime,
        });
        broadcastRaceState(documentId);
      });

      socket.on("update-race-progress", ({ progress, wpm, accuracy, finished }) => {
        const race = raceRooms.get(documentId);
        if (!race) return;

        const player = race.players.get(socket.id);
        if (!player) return;

        player.progress = progress;
        player.wpm = wpm;
        player.accuracy = accuracy;

        if (finished && !player.finished) {
          player.finished = true;
          const finishedCount = Array.from(race.players.values()).filter((p) => p.finished).length;
          player.rank = finishedCount;
        }

        broadcastRaceState(documentId);
      });

      socket.on("reset-race", () => {
        const race = raceRooms.get(documentId);
        if (race) {
          race.status = 'waiting';
          race.startTime = null;
          race.players.forEach((p) => {
            p.progress = 0;
            p.wpm = 0;
            p.accuracy = 100;
            p.finished = false;
            p.rank = null;
          });
          broadcastRaceState(documentId);
        }
      });
    } catch (err) {
      console.error(`❌ Error loading document ${documentId}:`, err.message);
      socket.emit("load-error", "Failed to load document");
    }
  });

  socket.on("disconnecting", () => {
    if (currentDocId) {
      const room = io.sockets.adapter.rooms.get(currentDocId);
      const count = room ? Math.max(0, room.size - 1) : 0;
      socket.broadcast.to(currentDocId).emit("user-count", count);

      // Clean player from race room if present
      const race = raceRooms.get(currentDocId);
      if (race && race.players.has(socket.id)) {
        race.players.delete(socket.id);
        if (race.players.size === 0) {
          raceRooms.delete(currentDocId);
        } else {
          broadcastRaceState(currentDocId);
        }
      }
    }
  });

  socket.on("disconnect", () => {
    // disconnected
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});

io.on("connect_error", (err) => {
  console.error(`❌ Socket connection error: ${err.message}`);
});

async function getOrCreateDocument(id) {
  if (!id) return;

  let document = await Document.findById(id);
  if (document) return document;

  document = new Document({
    _id: id,
    title: "Untitled Document",
    data: defaultValue,
  });
  await document.save();
  return document;
}
