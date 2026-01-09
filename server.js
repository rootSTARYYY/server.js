const { Expo } = require('expo-server-sdk');
let expo = new Expo();

const io = require("socket.io")(process.env.PORT || 3000, {
  cors: { origin: "*" }
});

// Move these to the TOP so they persist for all connections
let userPushTokens = {}; // { username: "token" }
let activeUsers = {};    // { socketId: "username" }

console.log("Server started on port", process.env.PORT || 3000);

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // 1. JOIN LOGIC
  socket.on("join", (username) => {
    activeUsers[socket.id] = username;
    console.log(`${username} joined.`);
    // Broadcast the full list of names to EVERYONE
    io.emit("update-user-list", Object.values(activeUsers));
  });

  // 2. TOKEN REGISTRATION
  socket.on("register-push-token", (data) => {
    if (data.username && data.token) {
      userPushTokens[data.username] = data.token;
      console.log(`Push token registered for: ${data.username}`);
    }
  });

  // 3. MESSAGE LOGIC
  socket.on("send-message", async (data) => {
    // Send to live users immediately
    socket.broadcast.emit("receive-message", data);

    // Send Push Notifications to offline users
    let messages = [];
    for (let user in userPushTokens) {
      // Don't send a notification to the person who sent the message
      if (user !== data.user && Expo.isExpoPushToken(userPushTokens[user])) {
        messages.push({
          to: userPushTokens[user],
          sound: 'default',
          title: `New message from ${data.user}`,
          body: data.content,
          // DATA payload is critical for your BACKGROUND TASK in App.js
          data: { user: data.user, content: data.content }, 
        });
      }
    }

    // Chunk and send notifications (Expo requirement)
    if (messages.length > 0) {
      let chunks = expo.chunkPushNotifications(messages);
      for (let chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
        } catch (error) {
          console.error("Notification error:", error);
        }
      }
    }
  });

  // 4. TYPING STATUS
  socket.on("typing", (data) => {
    socket.broadcast.emit("user-typing", data);
  });

  // 5. DISCONNECT LOGIC
  socket.on("disconnect", () => {
    const username = activeUsers[socket.id];
    delete activeUsers[socket.id];
    // Update the list for everyone else
    io.emit("update-user-list", Object.values(activeUsers));
    console.log(`User disconnected: ${username || socket.id}`);
  });
});
