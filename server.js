const { Expo } = require('expo-server-sdk');
let expo = new Expo();

const io = require("socket.io")(process.env.PORT || 3000, {
  cors: { origin: "*" }
});

// We use a Set to store multiple unique tokens per user
let userPushTokens = {}; // { username: Set(["token1", "token2"]) }
let activeUsers = {};    // { socketId: "username" }

console.log("Server started on port", process.env.PORT || 3000);

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // 1. JOIN LOGIC
  socket.on("join", (username) => {
    activeUsers[socket.id] = username;
    console.log(`${username} joined.`);
    io.emit("update-user-list", Object.values(activeUsers));
  });

  // 2. TOKEN REGISTRATION (Fixed for Multiple Devices)
  socket.on("register-push-token", (data) => {
    if (data.username && data.token) {
      // If this user doesn't have a token list yet, create one
      if (!userPushTokens[data.username]) {
        userPushTokens[data.username] = new Set();
      }
      
      // Add the new token to the set (Sets automatically handle duplicates)
      userPushTokens[data.username].add(data.token);
      
      console.log(`Token added for ${data.username}. Total devices: ${userPushTokens[data.username].size}`);
    }
  });

  // 3. MESSAGE LOGIC (Fixed to loop through all tokens)
  socket.on("send-message", async (data) => {
    // Send to live users immediately via Socket.io
    socket.broadcast.emit("receive-message", data);

    // Prepare Push Notifications
    let notifications = [];
    
    for (let username in userPushTokens) {
      // Don't notify the sender
      if (username !== data.user) {
        const tokens = userPushTokens[username];
        
        // Loop through EVERY token this user has (Phone, Tablet, etc.)
        tokens.forEach(token => {
          if (Expo.isExpoPushToken(token)) {
            notifications.push({
              to: token,
              sound: 'default',
              title: `New message from ${data.user}`,
              body: data.content,
              data: { user: data.user, content: data.content }, 
            });
          }
        });
      }
    }

    // Chunk and send notifications
    if (notifications.length > 0) {
      let chunks = expo.chunkPushNotifications(notifications);
      for (let chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
        } catch (error) {
          console.error("Notification error:", error);
        }
      }
    }
  });

  socket.on("typing", (data) => {
    socket.broadcast.emit("user-typing", data);
  });

  socket.on("disconnect", () => {
    const username = activeUsers[socket.id];
    delete activeUsers[socket.id];
    io.emit("update-user-list", Object.values(activeUsers));
    console.log(`User disconnected: ${username || socket.id}`);
  });
});
