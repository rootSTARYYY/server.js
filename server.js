const io = require("socket.io")(3000, {
    cors: { origin: "*" }
  });
  
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);
  
    // Listen for 'send-message' from any client
    socket.on("send-message", (data) => {
      // Broadcast it to everyone else
      socket.broadcast.emit("receive-message", data);
    });
  
    socket.on("disconnect", () => console.log("User disconnected"));
    let activeUsers = {}; // Stores { socketId: username }

  socket.on("join", (username) => {
    activeUsers[socket.id] = username;
    // Tell everyone the new list of names
    io.emit("update-user-list", Object.values(activeUsers));
  });

  socket.on("disconnect", () => {
    delete activeUsers[socket.id];
    io.emit("update-user-list", Object.values(activeUsers));
  });
});
