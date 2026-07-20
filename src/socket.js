let SERVER_COUNT = 0;

function attachSocketHandlers(io) {
  io.on("connection", (socket) => {

    socket.on("register", () => {
      SERVER_COUNT++;
      const serverName = `server ${SERVER_COUNT}`;
      global.botSockets.set(socket.id, { socket, node: serverName });
      console.log(`${serverName} connected`);
    });

    socket.on("disconnect", () => {
      global.botSockets.delete(socket.id);
      console.log(`socket ${socket.id} disconnected — cleaned`);
    });

  });
}

module.exports = { attachSocketHandlers };
