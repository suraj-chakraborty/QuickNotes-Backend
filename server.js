const express = require("express");
const app = express();
const http = require("http");
const mongoose = require("mongoose");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: [
      "https://quick-notes-frontend.vercel.app",
      "https://cute-pear-newt-tux.cyclic.app/",
    ],
    method: ["GET", "POST"],
    transports: ["polling"],
    credentials: true,
  },
  allowEI03: true,
  loadBalancingMethod: "least-connection",
});
const Document = require("./Document");

mongoose.connect(
  "mongodb+srv://Quicknotes:Quicknotes@quicknotes.rfuqvid.mongodb.net/quick-notes?retryWrites=true&w=majority"
);

// const io = require("socket.io")(process.env.PORT || 8080, {
//   cors: {
//     origin: "https://quick-notes-frontend.vercel.app",
//     method: ["GET", "POST"],
//     credentials: true,
//   },
// });

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

io.listen(process.env.PORT || 8080, () => {
  console.log("listening on 8080");
});

io.on("connect_error", (err) => {
  console.log(`connect_error due to ${err.message}`);
});

// find if the documentid exist else create a new document
async function Focd(id) {
  if (id == null) return;

  const document = await Document.findById(id);
  if (document) return document;
  return await Document.create({ _id: id, data: defaultValue });
}
