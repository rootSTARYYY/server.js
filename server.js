const { Expo } = require('expo-server-sdk');
let expo = new Expo();
let userPushTokens = {}; // { username: "ExponentPushToken[xxx]" }
const io = require("socket.io")(3000, {
    cors: { origin: "*" }
  });
  
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);
  
    socket.on("disconnect", () => console.log("User disconnected"));
    let activeUsers = {}; // Stores { socketId: username }

  socket.on("join", (username) => {
    activeUsers[socket.id] = username;
    // Tell everyone the new list of names
    io.emit("update-user-list", Object.values(activeUsers));
  });
  expo.sendPushNotificationsAsync([{
    to: userPushToken,
    title: `New message from ${data.user}`,
    body: data.content,
    data: { user: data.user, content: data.content }, // <--- THIS IS WHAT THE TASK USES
  }]);
  socket.on("disconnect", () => {
    delete activeUsers[socket.id];
    io.emit("update-user-list", Object.values(activeUsers));
  });
  // Store the token when user logs in
  socket.on("register-push-token", (data) => {
    userPushTokens[data.username] = data.token;
  });

  socket.on("send-message", async (data) => {
    socket.broadcast.emit("receive-message", data);

    // Send Push Notification to all other registered tokens
    for (let user in userPushTokens) {
      if (user !== data.user && Expo.isExpoPushToken(userPushTokens[user])) {
        await expo.sendPushNotificationsAsync([{
          to: userPushTokens[user],
          sound: 'default',
          title: `New message from ${data.user}`,
          body: data.content,
          data: { withSome: 'data' },
        }]);
      }
    }
  });
});
