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
  });