require("dotenv").config();
const mongoose = require("mongoose");
const Document = require("./Document");
const cors = require("cors");
const http = require("http");
const server = http.createServer(Document);
const { Server } = require("socket.io");

mongoose.connect(
  "mongodb+srv://Quicknotes:Quicknotes@quicknotes.rfuqvid.mongodb.net/quick-notes?retryWrites=true&w=majority"
);
const io = new Server(server);

io(process.env.PORT || 8080, {
  cors: {
    origin: "https://quick-notes-frontend.vercel.app",
    method: ["GET", "POST"],
    credentials: true,
  },
});
io.use(cors());
const defaultValue = "";

io.on("connection", (socket) => {
  socket.on("get-document", async (documentId) => {
    const document = await Focd(documentId);
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
// find if the documentid exist else create a new document
async function Focd(id) {
  if (id == null) return;

  const document = await Document.findById(id);
  if (document) return document;
  return await Document.create({ _id: id, data: defaultValue });
}
