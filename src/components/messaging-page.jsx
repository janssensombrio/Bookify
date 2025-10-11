import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { database, auth } from "../config/firebase";

export const MessagesPage = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  const currentUser = auth.currentUser?.uid;
  const navigate = useNavigate();

  // Fetch all conversations for the current user
  useEffect(() => {
    const getConversations = async () => {
      const snapshot = await getDocs(collection(database, "messages"));
      const allMessages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // Get unique conversations
      const uniqueUsers = {};
      allMessages.forEach((msg) => {
        if (msg.senderId === currentUser || msg.receiverId === currentUser) {
          const otherUser = msg.senderId === currentUser ? msg.receiverId : msg.senderId;
          if (!uniqueUsers[otherUser]) uniqueUsers[otherUser] = msg;
        }
      });

      setConversations(Object.values(uniqueUsers));
    };

    getConversations();
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
      .sort((a, b) => a.timestamp?.seconds - b.timestamp?.seconds); // sort by timestamp

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
    openChat(selectedChat); // refresh messages
  };

  return (
    <div style={{ display: "flex", height: "100vh", border: "1px solid #ccc" }}>
      {/* Conversations */}
      <div style={{ width: "30%", borderRight: "1px solid #ccc", overflowY: "auto" }}>
        <button onClick={() => navigate("/home")}>Back to Home</button>
        <h3 style={{ padding: "10px" }}>Messages</h3>
        {conversations.length === 0 ? (
          <p style={{ padding: "10px", color: "#777" }}>No conversations yet</p>
        ) : (
          conversations.map((conv) => {
            const otherUser = conv.senderId === currentUser ? conv.receiverId : conv.senderId;
            return (
              <div
                key={conv.id}
                onClick={() => openChat(otherUser)}
                style={{
                  padding: "10px",
                  cursor: "pointer",
                  background: selectedChat === otherUser ? "#f0f0f0" : "white",
                  borderBottom: "1px solid #eee",
                }}
              >
                Chat with: {otherUser}
              </div>
            );
          })
        )}
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {selectedChat ? (
          <>
            <div style={{ flex: 1, padding: "10px", overflowY: "auto", background: "#fafafa" }}>
              {messages.map((msg, index) => (
                <div
                  key={index}
                  style={{
                    textAlign: msg.senderId === currentUser ? "right" : "left",
                    margin: "5px 0",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      padding: "8px 12px",
                      borderRadius: "10px",
                      background: msg.senderId === currentUser ? "#DCF8C6" : "#EAEAEA",
                    }}
                  >
                    {msg.message}
                  </span>
                </div>
              ))}
            </div>

            {/* Input */}
            <div style={{ padding: "10px", borderTop: "1px solid #ccc" }}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                style={{ width: "80%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
              />
              <button
                onClick={sendMessage}
                style={{ marginLeft: "10px", padding: "8px 12px", borderRadius: "6px" }}
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div style={{ margin: "auto", color: "#777" }}>Select a conversation to start chatting</div>
        )}
      </div>
    </div>
  );
};
