import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { database, auth } from "../config/firebase";
import { ArrowLeft, Send, MessageSquare } from "lucide-react";

export const MessagesPage = () => {
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState({});
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  const currentUser = auth.currentUser?.uid;
  const navigate = useNavigate();

  // Fetch conversations + user info
  useEffect(() => {
    const getConversations = async () => {
      const snapshot = await getDocs(collection(database, "messages"));
      const all = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const uniqueUsers = {};
      all.forEach((m) => {
        if (m.senderId === currentUser || m.receiverId === currentUser) {
          const other = m.senderId === currentUser ? m.receiverId : m.senderId;
          if (!uniqueUsers[other]) uniqueUsers[other] = m;
        }
      });

      setConversations(Object.values(uniqueUsers));

      // fetch user docs
      const userIds = Object.keys(uniqueUsers);
      const userPromises = userIds.map(async (uid) => {
        try {
          const qUsers = query(collection(database, "users"), where("uid", "==", uid));
          const qs = await getDocs(qUsers);
          if (!qs.empty) {
            const data = qs.docs[0].data();
            return {
              uid,
              displayName: `${data.firstName || ""} ${data.lastName || ""}`.trim() || uid,
              photoURL: data.photoURL || null,
            };
          }
          return { uid, displayName: uid, photoURL: null };
        } catch {
          return { uid, displayName: uid, photoURL: null };
        }
      });

      const userArr = await Promise.all(userPromises);
      const map = {};
      userArr.forEach((u) => (map[u.uid] = { displayName: u.displayName, photoURL: u.photoURL }));
      setUsers(map);
    };

    if (currentUser) getConversations();
  }, [currentUser]);

  const openChat = async (userId) => {
    setSelectedChat(userId);

    const snapshot = await getDocs(collection(database, "messages"));
    const msgs = snapshot.docs
      .map((d) => d.data())
      .filter(
        (m) =>
          (m.senderId === currentUser && m.receiverId === userId) ||
          (m.senderId === userId && m.receiverId === currentUser)
      )
      .sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

    setMessages(msgs);
  };

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

  const ChatBubble = ({ own, children }) => (
    <div className={`flex ${own ? "justify-end" : "justify-start"} mb-2`}>
      <div
        className={`max-w-[72%] rounded-2xl px-3 py-2 shadow ${
          own ? "bg-blue-600 text-white" : "bg-white text-gray-800 border border-gray-200"
        }`}
      >
        {children}
      </div>
    </div>
  );

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Conversations list */}
        <div className="md:col-span-5">
          <div className="glass rounded-3xl p-6 bg-white/70 border border-white/40 shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="text-blue-600" size={20} />
              <h2 className="text-xl font-semibold text-foreground">Messages</h2>
            </div>
            <p className="text-muted-foreground mb-4">View all your conversations.</p>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {conversations.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">
                  No conversations yet
                </div>
              ) : (
                conversations.map((conv) => {
                  const other =
                    conv.senderId === currentUser ? conv.receiverId : conv.senderId;
                  const data = users[other] || { displayName: other, photoURL: null };
                  const active = selectedChat === other;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => openChat(other)}
                      className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2 transition ${
                        active
                          ? "bg-blue-50 border border-blue-200"
                          : "bg-white/60 border border-gray-200 hover:bg-white"
                      }`}
                    >
                      {data.photoURL ? (
                        <img
                          src={data.photoURL}
                          alt={data.displayName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center">
                          {data.displayName?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                      )}
                      <div className="text-left">
                        <p className="font-medium text-foreground">{data.displayName}</p>
                        <p className="text-xs text-muted-foreground">Tap to open chat</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="md:col-span-7">
          <div className="glass rounded-3xl bg-white/70 border border-white/40 shadow-lg overflow-hidden">
            {/* Mobile chat header */}
            {selectedChat && (
              <div className="md:hidden flex items-center gap-2 p-3 border-b border-gray-200 bg-white/80">
                <button
                  className="p-2 rounded-lg hover:bg-gray-100"
                  onClick={() => setSelectedChat(null)}
                  aria-label="Back"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="font-medium">
                  {users[selectedChat]?.displayName || selectedChat}
                </div>
              </div>
            )}

            {selectedChat ? (
              <>
                <div className="h-[48vh] md:h-[54vh] overflow-y-auto p-4 bg-gray-50">
                  {messages.map((m, i) => (
                    <ChatBubble key={i} own={m.senderId === currentUser}>
                      <span className="text-sm">{m.message}</span>
                    </ChatBubble>
                  ))}
                </div>

                <div className="border-t border-gray-200 bg-white/80 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                    />
                    <button
                      onClick={sendMessage}
                      className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 shadow"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-[48vh] md:h-[60vh] flex items-center justify-center text-muted-foreground">
                <p className="text-base">Select a conversation to start chatting</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
