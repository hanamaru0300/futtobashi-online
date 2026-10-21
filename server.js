
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = {};

function makeCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

io.on("connection", (socket) => {
  console.log("プレイヤー接続:", socket.id);

  socket.on("createRoom", (name, callback) => {
    const code = makeCode();
    rooms[code] = {
      players: {},
      host: socket.id,
      status: "waiting"
    };

    rooms[code].players[socket.id] = {
      name: String(name || "プレイヤー").slice(0, 12),
      x: 200,
      y: 300,
      alive: true
    };

    socket.join(code);
    socket.data.roomCode = code;
    callback({ ok: true, code });
    io.to(code).emit("roomUpdate", rooms[code]);
  });

  socket.on("joinRoom", ({ code, name }, callback) => {
    code = String(code || "").toUpperCase();
    const room = rooms[code];

    if (!room) return callback({ ok: false, error: "部屋が見つかりません" });
    if (Object.keys(room.players).length >= 4)
      return callback({ ok: false, error: "部屋は満員です" });

    room.players[socket.id] = {
      name: String(name || "プレイヤー").slice(0, 12),
      x: 200 + Object.keys(room.players).length * 100,
      y: 300,
      alive: true
    };

    socket.join(code);
    socket.data.roomCode = code;
    callback({ ok: true, code });
    io.to(code).emit("roomUpdate", room);
  });

  socket.on("playerMove", (data) => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;

    const p = room.players[socket.id];
    p.x = Math.max(0, Math.min(900, Number(data.x) || 0));
    p.y = Math.max(0, Math.min(520, Number(data.y) || 0));

    socket.to(code).emit("playerMoved", {
      id: socket.id,
      x: p.x,
      y: p.y
    });
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room) return;

    delete room.players[socket.id];
    io.to(code).emit("playerLeft", socket.id);

    if (Object.keys(room.players).length === 0) delete rooms[code];
    else io.to(code).emit("roomUpdate", room);
  });
});

server.listen(process.env.PORT || 3000, "0.0.0.0", () => {
  console.log("サーバー起動！");
  console.log("http://localhost:3000");
});
