import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
  deleteDoc,
  doc,
  writeBatch,
  setDoc,
} from "firebase/firestore";
import { database, auth } from "../config/firebase";
import {
  ArrowLeft,
  Send,
  MessageSquare,
  Trash2,
} from "lucide-react";

export default function MessagesPage() {
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState({});
  const [selectedChat, setSelectedChat] = useState(null); // other user's uid
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const currentUser = auth.currentUser?.uid;
  const bottomRef = useRef(null);

  // Derived data for selected user's profile
  const selectedProfile = useMemo(() => {
    if (!selectedChat) return null;
    return (
      users[selectedChat] || { displayName: selectedChat, photoURL: null }
    );
  }, [selectedChat, users]);

  // Fetch conversations (unique counterpart users) + profile data
  useEffect(() => {
    if (!currentUser) return;

    const fetchConversations = async () => {
      const col = collection(database, "messages");
      const [sentSnap, recvSnap] = await Promise.all([
        getDocs(query(col, where("senderId", "==", currentUser))),
        getDocs(query(col, where("receiverId", "==", currentUser))),
      ]);

      const allDocs = [...sentSnap.docs, ...recvSnap.docs];
      const uniqueUsersMap = {};

      allDocs.forEach((d) => {
        const m = { id: d.id, ...d.data() };
        const other = m.senderId === currentUser ? m.receiverId : m.senderId;
        if (!uniqueUsersMap[other]) uniqueUsersMap[other] = m;
      });

      // Fetch per-user deleted markers and hide those threads for current user
      const deletedSnap = await getDocs(collection(database, "users", currentUser, "deletedConversations"));
      const deletedSet = new Set(deletedSnap.docs.map((d) => d.id));

      const convs = Object.values(uniqueUsersMap).filter((m) => {
        const other = m.senderId === currentUser ? m.receiverId : m.senderId;
        return !deletedSet.has(other);
      });
      setConversations(convs);

      // Fetch user profiles for the list (exclude deleted)
      const userIds = Object.keys(uniqueUsersMap).filter((uid) => !deletedSet.has(uid));
      const userPromises = userIds.map(async (uid) => {
        try {
          const qUsers = query(
            collection(database, "users"),
            where("uid", "==", uid)
          );
          const qs = await getDocs(qUsers);
          if (!qs.empty) {
            const data = qs.docs[0].data();
            return {
              uid,
              displayName:
                `${data.firstName || ""} ${data.lastName || ""}`.trim() || uid,
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

    fetchConversations();
  }, [currentUser]);

  // Open a chat: fetch both directions and merge
  const openChat = async (userId) => {
    if (!userId || !currentUser) return;
    setSelectedChat(userId);

    const col = collection(database, "messages");
    const [sentSnap, recvSnap] = await Promise.all([
      getDocs(
        query(
          col,
          where("senderId", "==", currentUser),
          where("receiverId", "==", userId)
        )
      ),
      getDocs(
        query(
          col,
          where("senderId", "==", userId),
          where("receiverId", "==", currentUser)
        )
      ),
    ]);

    const msgs = [...sentSnap.docs, ...recvSnap.docs]
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort(
        (a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0)
      );

    setMessages(msgs);

    // smooth scroll to bottom
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
  };

  const sendMessage = async () => {
    if (!selectedChat || newMessage.trim() === "") return;

    // If this thread was previously "deleted" for current user, unhide it
    try {
      await deleteDoc(doc(database, "users", currentUser, "deletedConversations", selectedChat));
    } catch (e) {
      // ignore; marker may not exist
    }

    await addDoc(collection(database, "messages"), {
      uid: currentUser,
      senderId: currentUser,
      receiverId: selectedChat,
      message: newMessage.trim(),
      timestamp: serverTimestamp(),
    });
    setNewMessage("");
    openChat(selectedChat);
  };

const deleteConversation = async () => {
  if (!selectedChat || !currentUser) return;
  setDeleting(true);
  try {
    const colRef = collection(database, "messages");
    const qs = await getDocs(
      query(
        colRef,
        where("senderId", "==", currentUser),
        where("receiverId", "==", selectedChat)
      )
    );

    // Only delete docs you’re allowed to delete by rule
    const deletable = qs.docs.filter(d => d.data()?.uid === currentUser);
    const skipped = qs.docs.length - deletable.length;

    // Chunk the deletes (≤500 ops per batch)
    const CHUNK = 450;
    for (let i = 0; i < deletable.length; i += CHUNK) {
      const batch = writeBatch(database);
      deletable.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    // Hide the thread for YOU
    await setDoc(
      doc(database, "users", currentUser, "deletedConversations", selectedChat),
      { uid: currentUser, otherUserId: selectedChat, deletedAt: serverTimestamp() }
    );

    // Local UI updates
    setMessages([]);
    setSelectedChat(null);
    setConfirmOpen(false);
    setConversations(prev =>
      prev.filter(conv => {
        const other = conv.senderId === currentUser ? conv.receiverId : conv.senderId;
        return other !== selectedChat;
      })
    );

    if (skipped > 0) {
      console.warn(`Skipped ${skipped} messages not owned by you or missing uid.`);
    }
  } catch (e) {
    console.error("Failed to delete conversation:", e);
    alert("You can only delete the messages you sent. The rest are hidden from your view.");
  } finally {
    setDeleting(false);
  }
};

  const ChatBubble = ({ own, children }) => (
    <div className={`flex ${own ? "justify-end" : "justify-start"} mb-2`}>
      <div
        className={`max-w-[72%] rounded-2xl px-3 py-2 shadow ${
          own
            ? "bg-blue-600 text-white"
            : "bg-white text-gray-800 border border-gray-200"
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
            {/* Chat header (like Messenger) */}
            {selectedChat ? (
              <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-200 bg-white/80">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Mobile back */}
                  <button
                    className="md:hidden p-2 rounded-lg hover:bg-gray-100 shrink-0"
                    onClick={() => setSelectedChat(null)}
                    aria-label="Back"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  {selectedProfile?.photoURL ? (
                    <img
                      src={selectedProfile.photoURL}
                      alt={selectedProfile.displayName}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center">
                      {selectedProfile?.displayName?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {selectedProfile?.displayName || selectedChat}
                    </div>
                    <div className="text-xs text-muted-foreground">Conversation</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConfirmOpen(true)}
                    title="Delete conversation"
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 px-3 py-2"
                  >
                    <Trash2 size={16} />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="md:hidden flex items-center gap-2 p-3 border-b border-gray-200 bg-white/80">
                <div className="font-medium">Select a chat</div>
              </div>
            )}

            {/* Chat body & composer */}
            {selectedChat ? (
              <>
                <div className="h-[48vh] md:h-[54vh] overflow-y-auto p-4 bg-gray-50">
                  {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                      Say hello 👋
                    </div>
                  ) : (
                    messages.map((m) => (
                      <ChatBubble key={m.id} own={m.senderId === currentUser}>
                        <span className="text-sm">{m.message}</span>
                      </ChatBubble>
                    ))
                  )}
                  <div ref={bottomRef} />
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
                      disabled={!newMessage.trim()}
                      className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 shadow"
                      aria-label="Send message"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-[48vh] md:h-[60vh] flex flex-col items-center justify-center text-muted-foreground">
                <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center bg-white/60">
                  <MessageSquare className="mx-auto mb-2" />
                  <p className="text-base">Select a conversation to start chatting</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => !deleting && setConfirmOpen(false)}
          />
          <div className="relative w-[92%] max-w-sm rounded-2xl bg-white p-5 shadow-xl border border-gray-200">
            <h3 className="text-lg font-semibold mb-1">Delete conversation?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This will remove all messages between you and
              {" "}
              <span className="font-medium">{selectedProfile?.displayName}</span>.
              This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                className="rounded-xl px-3 py-2 border border-gray-200 hover:bg-gray-50"
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="rounded-xl px-3 py-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                onClick={deleteConversation}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
