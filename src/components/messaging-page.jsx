import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { database, auth } from "../config/firebase";
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  TextField,
  IconButton,
  Divider,
  Avatar,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import ChatIcon from "@mui/icons-material/Chat";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

export const MessagesPage = () => {
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState({});
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  const currentUser = auth.currentUser?.uid;
  const navigate = useNavigate();

  // Fetch all conversations for the current user and user details
  useEffect(() => {
    const getConversations = async () => {
      console.log("Fetching conversations for user:", currentUser);  // Debug: Check current user
      const snapshot = await getDocs(collection(database, "messages"));
      const allMessages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      console.log("All messages:", allMessages);  // Debug: Check messages

      // Get unique conversations
      const uniqueUsers = {};
      allMessages.forEach((msg) => {
        if (msg.senderId === currentUser || msg.receiverId === currentUser) {
          const otherUser = msg.senderId === currentUser ? msg.receiverId : msg.senderId;
          if (!uniqueUsers[otherUser]) uniqueUsers[otherUser] = msg;
        }
      });

      setConversations(Object.values(uniqueUsers));
      console.log("Unique conversations:", Object.values(uniqueUsers));  // Debug: Check conversations

      // Fetch user details for all unique otherUsers
      const userIds = Object.keys(uniqueUsers);
      console.log("User IDs to fetch:", userIds);  // Debug: Check UIDs
      const userPromises = userIds.map(async (uid) => {
        try {
          const q = query(collection(database, "users"), where("uid", "==", uid));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            console.log("User data:", data);

            // RETURN the object so Promise.all collects it
            return {
              uid,
              displayName: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
              photoURL: data.photoURL || null,
            };
          } else {
            console.log("User not found for UID:", uid);
            return { uid, displayName: uid, photoURL: null };
          }
        } catch (error) {
          console.error("Error fetching user", uid, ":", error);
          return { uid, displayName: uid, photoURL: null };
        }
      });

      const userData = await Promise.all(userPromises);
      const usersMap = {};
      userData.forEach((user) => {
        usersMap[user.uid] = { displayName: user.displayName, photoURL: user.photoURL };
      });
      setUsers(usersMap);
      console.log("Users map:", usersMap);  // Debug: Final users state
    };

    if (currentUser) getConversations();  // Only run if user is logged in
  }, [currentUser]);

  // Open chat with a user
  const openChat = async (userId) => {
    setSelectedChat(userId);

    const snapshot = await getDocs(collection(database, "messages"));
    const msgs = snapshot.docs
      .map((doc) => doc.data())
      .filter(
        (m) =>
          (m.senderId === currentUser && m.receiverId === userId) ||
          (m.senderId === userId && m.receiverId === currentUser)
      )
      .sort((a, b) => a.timestamp?.seconds - b.timestamp?.seconds);

    setMessages(msgs);
  };

  // Send a new message
  const sendMessage = async () => {
    if (!selectedChat || newMessage.trim() === "") return;

    await addDoc(collection(database, "messages"), {
      uid: currentUser,
      senderId: currentUser,
      receiverId: selectedChat,
      message: newMessage,
      timestamp: serverTimestamp(),
    });

    setNewMessage("");
    openChat(selectedChat);
  };

  return (
    <Box
      sx={{
        height: "84vh",
        display: "flex",
        bgcolor: "background.default",
        px: 4,
      }}
    >
      <Grid container sx={{ flex: 1 }}>
        {/* Conversations Sidebar */}
        <Grid item xs={12} md={5} sx={{ borderRight: 1, borderColor: "divider" }}>
          <Card
            sx={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              borderRadius: 0,
              boxShadow: "none",
              px: 4,
            }}
          >
            <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 600, color: '#1976d2', mt: 6 }}>
              Messages
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              View all your messages here.
            </Typography>
            <Box sx={{ flex: 1, overflowY: "auto", p: 1 }}>
              {conversations.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                  No conversations yet
                </Typography>
              ) : (
                conversations.map((conv) => {
                  const otherUser = conv.senderId === currentUser ? conv.receiverId : conv.senderId;
                  const userData = users[otherUser] || { displayName: otherUser, photoURL: null };
                  console.log("Rendering user", otherUser, "with data:", userData);  // Debug: Check rendering
                  return (
                    <Card
                      key={conv.id}
                      onClick={() => openChat(otherUser)}
                      sx={{
                        mb: 1,
                        cursor: "pointer",
                        bgcolor: selectedChat === otherUser ? "primary.light" : "background.paper",
                        border: selectedChat === otherUser ? "2px solid" : "1px solid",
                        borderColor: selectedChat === otherUser ? "primary.main" : "divider",
                        transition: "all 0.2s",
                        "&:hover": {
                          bgcolor: "action.hover",
                        },
                      }}
                    >
                      <CardContent sx={{ py: 2, px: 2 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                          <Avatar
                            src={userData.photoURL}
                            sx={{ bgcolor: "primary.main" }}
                          >
                            {!userData.photoURL && userData.displayName.charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography variant="body1" fontWeight={500}>
                            {userData.displayName}
                            {console.log("Displayed name:", userData.displayName)}  {/* Debug: Check displayed name */}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </Box>
          </Card>
        </Grid>

        {/* Chat Area */}
        <Grid item xs={12} md={7} sx={{ display: "flex", flexDirection: "column", flex: 2 }}>
          {selectedChat ? (
            <>
              <Box
                sx={{
                  flex: 1,
                  p: 2,
                  overflowY: "auto",
                  bgcolor: "grey.50",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                }}
              >
                {messages.map((msg, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: "flex",
                      justifyContent: msg.senderId === currentUser ? "flex-end" : "flex-start",
                      mb: 1,
                    }}
                  >
                    <Box
                      sx={{
                        maxWidth: "70%",
                        p: 1.5,
                        borderRadius: 3,
                        bgcolor: msg.senderId === currentUser ? "primary.main" : "grey.200",
                        color: msg.senderId === currentUser ? "white" : "text.primary",
                        boxShadow: 1,
                      }}
                    >
                      <Typography variant="body1">{msg.message}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
              <Divider />
              <Box sx={{ p: 4, display: "flex", gap: 1, alignItems: "center" }}>
                <TextField
                  fullWidth
                  variant="outlined"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                  sx={{ borderRadius: 2 }}
                />
                <IconButton
                  onClick={sendMessage}
                  color="primary"
                  sx={{
                    bgcolor: "primary.main",
                    color: "white",
                    "&:hover": { bgcolor: "primary.dark" },
                  }}
                >
                  <SendIcon />
                </IconButton>
              </Box>
            </>
          ) : (
            <Box
              sx={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "text.secondary",
              }}
            >
              <Typography variant="h6">Select a conversation to start chatting</Typography>
            </Box>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};
