const { Expo } = require('expo-server-sdk');
let expo = new Expo();

const io = require("socket.io")(process.env.PORT || 3000, {
  cors: { origin: "*" }
});

// MEMORY STORAGE (Temporary until you add MongoDB)
let userPushTokens = {}; // Format: { "Mehul": Set(["token1", "token2"]) }
let activeUsers = {};    

console.log("Server started on port", process.env.PORT || 3000);

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // 1. IMPROVED JOIN (Accepts username and token at once)
  socket.on("join", (data) => {
    // Handle both old version (string) and new version (object)
    const username = typeof data === 'string' ? data : data.username;
    const token = typeof data === 'object' ? data.token : null;

    activeUsers[socket.id] = username;
    
    // Auto-register token if sent during join
    if (username && token) {
      if (!userPushTokens[username]) userPushTokens[username] = new Set();
      userPushTokens[username].add(token);
      console.log(`[AUTH] Token synced for ${username} during join.`);
    }

    console.log(`${username} joined.`);
    io.emit("update-user-list", Object.values(activeUsers));
  });

  // 2. TOKEN REGISTRATION
  socket.on("register-push-token", (data) => {
    if (data.username && data.token) {
      if (!userPushTokens[data.username]) {
        userPushTokens[data.username] = new Set();
      }
      userPushTokens[data.username].add(data.token);
      console.log(`[AUTH] Manual Token registration for ${data.username}. Devices: ${userPushTokens[data.username].size}`);
    }
  });

  // 3. MESSAGE LOGIC
  socket.on("send-message", async (data) => {
    socket.broadcast.emit("receive-message", data);

    let notifications = [];
    
    // We loop through all registered users to find recipients
    for (let username in userPushTokens) {
      if (username !== data.user) {
        const tokens = userPushTokens[username];

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

    if (notifications.length > 0) {
      console.log(`[PUSH] Sending to ${notifications.length} devices...`);
      let chunks = expo.chunkPushNotifications(notifications);
      for (let chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
        } catch (error) {
          console.error("Expo Error:", error);
        }
      }
    } else {
      console.log("[PUSH] No tokens found in memory. Phones need to re-sync.");
    }
  });

  socket.on("disconnect", () => {
    const username = activeUsers[socket.id];
    delete activeUsers[socket.id];
    io.emit("update-user-list", Object.values(activeUsers));
    console.log(`Disconnected: ${username}`);
  });
});
