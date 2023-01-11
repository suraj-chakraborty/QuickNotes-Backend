const express = require("express");
const app = express();
const http = require("http");
const mongoose = require("mongoose");
const server = http.createServer(app);
const { Server } = require("socket.io");
const Document = require("./Document");

const PORT = process.env.PORT || 8000;

mongoose.connect(
  process.env.MONGODB_URL ||
    "mongodb+srv://Quicknotes:Quicknotes@quicknotes.rfuqvid.mongodb.net/quick-notes?retryWrites=true&w=majority",
  { useNewUrlParser: true }
);

const io = new Server(server, {
  cors: {
    origin: "https://quick-notes-frontend.vercel.app" || process.env.CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const defaultValue = "";

io.on("connection", (socket) => {
  socket.on("get-document", async (documentId) => {
    const document = await getOrCreateDocument(documentId);
    socket.join(documentId);
    socket.emit("load-document", document.data);

    socket.on("send-changes", (delta) => {
      socket.broadcast.to(documentId).emit("receive-changes", delta);
    });

    socket.on("save-document", async (data) => {
      await Document.findByIdAndUpdate(documentId, { data });
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

io.on("connect_error", (err) => {
  console.log(`connect_error due to ${err.message}`);
});

async function getOrCreateDocument(id) {
  if (!id) return;

  let document = await Document.findById(id);
  if (document) return document;

  document = new Document({ _id: id, data: defaultValue });
  await document.save();
  return document;
}
