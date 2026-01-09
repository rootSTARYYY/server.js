const { Expo } = require('expo-server-sdk');
let expo = new Expo();

const io = require("socket.io")(process.env.PORT || 3000, {
  cors: { origin: "*" }
});

// Using Sets for multiple device support per user
let userPushTokens = {}; 
let activeUsers = {};    

console.log("Server started on port", process.env.PORT || 3000);

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("join", (username) => {
    activeUsers[socket.id] = username;
    console.log(`${username} joined.`);
    io.emit("update-user-list", Object.values(activeUsers));
  });

  // 2. TOKEN REGISTRATION
  socket.on("register-push-token", (data) => {
    if (data.username && data.token) {
      // Initialize a new Set for the user if it doesn't exist
      if (!userPushTokens[data.username]) {
        userPushTokens[data.username] = new Set();
      }
      
      userPushTokens[data.username].add(data.token);
      console.log(`Token registered for ${data.username}. Total devices: ${userPushTokens[data.username].size}`);
    }
  });

  // 3. MESSAGE LOGIC
  socket.on("send-message", async (data) => {
    // Send to live users immediately
    socket.broadcast.emit("receive-message", data);

    let notifications = [];
    
    // Loop through all users who have tokens
    for (let username in userPushTokens) {
      // Don't notify the sender
      if (username !== data.user) {
        const tokens = userPushTokens[username];

        // Ensure we are looping through the Set of tokens
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

    // Send notifications in chunks
    if (notifications.length > 0) {
      console.log(`Sending ${notifications.length} notifications...`);
      let chunks = expo.chunkPushNotifications(notifications);
      for (let chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
          console.log("Notifications sent successfully.");
        } catch (error) {
          console.error("Error sending to Expo:", error);
        }
      }
    } else {
      console.log("No valid push tokens found to notify.");
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
