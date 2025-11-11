// src/pages/MessagesPage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  onSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { database, auth } from "../config/firebase";
import { ArrowLeft, Send, MessageSquare, Trash2 } from "lucide-react";

/* ---------------- helpers ---------------- */
const pick = (...vals) => {
  for (const v of vals) {
    if (v == null) continue;
    if (typeof v === "string") {
      const t = v.trim();
      if (t) return t;
      continue;
    }
    if (v) return v;
  }
  return null;
};

const normalizeUserDoc = (d = {}, fallbackUid) => {
  const first = pick(d.firstName, d.givenName, d.first_name);
  const last = pick(d.lastName, d.familyName, d.last_name);
  const displayName = pick(d.displayName, d.name, [first, last].filter(Boolean).join(" "));
  const photoURL = pick(d.photoURL, d.photoUrl, d.avatarURL, d.photo, d.avatar, d.profileImageUrl);
  return {
    uid: pick(d.uid, fallbackUid),
    displayName: (displayName || fallbackUid || "User").trim(),
    photoURL: photoURL || null,
    email: pick(d.email),
  };
};

const Avatar = ({ url, alt, size = 40, name = "U" }) => {
  const initial = (name?.[0] || "U").toUpperCase();
  return url ? (
    <img
      src={url}
      alt={alt || name}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      loading="lazy"
    />
  ) : (
    <div
      className="rounded-full bg-blue-600 text-white grid place-items-center"
      style={{ width: size, height: size }}
    >
      <span className="font-semibold">{initial}</span>
    </div>
  );
};

const tsToMs = (ts) => {
  if (!ts) return 0;
  const sec = ts.seconds ?? 0;
  const ns = ts.nanoseconds ?? 0;
  return sec * 1000 + Math.floor(ns / 1e6);
};

// Unified getter for message time (server first, then client fallback)
const getMsgMs = (m) => tsToMs(m?.timestamp) || m?.clientMs || 0;

const emitOptimisticSeen = (ms = Date.now()) => {
  try {
    window.dispatchEvent(new CustomEvent("messages:optimistic-seen", { detail: { ms } }));
  } catch {}
};

const formatTime12 = (ms) => {
  if (!ms) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(ms));
  } catch {
    const d = new Date(ms);
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }
};

/* ---------------- page ---------------- */
export default function MessagesPage() {
  /* ---------- auth ---------- */
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u || null);
      setAuthLoading(false);
    });
    return unsub;
  }, []);
  const currentUid = authUser?.uid ?? null;

  /* ---------- conversations & users ---------- */
  const [conversationUserIds, setConversationUserIds] = useState([]); // array of counterpart UIDs
  const [userMap, setUserMap] = useState({}); // { [uid]: {displayName, photoURL, ...} }
  const [selectedChat, setSelectedChat] = useState(null); // counterpart uid

  // messages in the open chat
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  // soft delete/hide
  const [hiddenAtMap, setHiddenAtMap] = useState({}); // { [otherUid]: ms }
  const [lastActivityMs, setLastActivityMs] = useState({}); // { [otherUid]: ms }
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // scrolling refs
  const scrollBoxRef = useRef(null);
  const msgEndRef = useRef(null);

  // sentinel to scroll via old API if needed elsewhere
  const bottomRef = msgEndRef;

  // One-shot "force scroll after my send is rendered"
  const forceScrollNextRef = useRef(false);

  // Track initial snapshot readiness for the open chat
  const initARef = useRef(false); // me → them
  const initBRef = useRef(false); // them → me
  const openedChatPendingScrollRef = useRef(false);

  /* ---------- subscribe: deletedConversations (hidden markers) ---------- */
  useEffect(() => {
    if (!currentUid) {
      setHiddenAtMap({});
      return;
    }
    const colRef = collection(database, "users", currentUid, "deletedConversations");
    return onSnapshot(
      colRef,
      (snap) => {
        const next = {};
        snap.forEach((d) => {
          const da = d.data()?.deletedAt || null;
          next[d.id] = tsToMs(da);
        });
        setHiddenAtMap(next);
      },
      (err) => console.error("deletedConversations error:", err)
    );
  }, [currentUid]);

  /* ---------- conversations list & activity (live, index-free) ---------- */
  useEffect(() => {
    if (!currentUid) {
      setConversationUserIds([]);
      setLastActivityMs({});
      return;
    }

    const col = collection(database, "messages");
    const qSent = query(col, where("senderId", "==", currentUid)); // me → others
    const qRecv = query(col, where("receiverId", "==", currentUid)); // others → me

    let setA = new Set();
    let setB = new Set();
    let lastA = new Map();
    let lastB = new Map();

    const emit = () => {
      const ids = Array.from(new Set([...setA, ...setB]));
      setConversationUserIds(ids);
      const merged = {};
      ids.forEach((id) => {
        const a = lastA.get(id) ?? 0;
        const b = lastB.get(id) ?? 0;
        merged[id] = Math.max(a, b);
      });
      setLastActivityMs(merged);
    };

    const unsub1 = onSnapshot(
      qSent,
      (snap) => {
        setA = new Set();
        lastA = new Map();
        snap.forEach((d) => {
          const m = d.data();
          const other = m?.receiverId;
          if (!other || other === currentUid) return;
          setA.add(other);
          const t = tsToMs(m.timestamp);
          lastA.set(other, Math.max(lastA.get(other) ?? 0, t));
        });
        emit();
      },
      (err) => console.error("conv sent error:", err)
    );

    const unsub2 = onSnapshot(
      qRecv,
      (snap) => {
        setB = new Set();
        lastB = new Map();
        snap.forEach((d) => {
          const m = d.data();
          const other = m?.senderId;
          if (!other || other === currentUid) return;
          setB.add(other);
          const t = tsToMs(m.timestamp);
          lastB.set(other, Math.max(lastB.get(other) ?? 0, t));
        });
        emit();
      },
      (err) => console.error("conv recv error:", err)
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, [currentUid]);

  /* ---------- fetch user profiles for conversation list ---------- */
  useEffect(() => {
    if (!conversationUserIds.length) return;

    (async () => {
      const updates = {};
      await Promise.all(
        conversationUserIds.map(async (uid) => {
          if (userMap[uid]) return;
          try {
            const userQs = await getDocs(query(collection(database, "users"), where("uid", "==", uid)));
            if (!userQs.empty) {
              updates[uid] = normalizeUserDoc(userQs.docs[0].data(), uid);
              return;
            }
            updates[uid] = { uid, displayName: uid, photoURL: null };
          } catch {
            updates[uid] = { uid, displayName: uid, photoURL: null };
          }
        })
      );
      if (Object.keys(updates).length) {
        setUserMap((prev) => ({ ...prev, ...updates }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationUserIds]);

  /* ---------- derived visible conversation lists ---------- */
  const visibleConversations = useMemo(() => {
    return conversationUserIds.filter((uid) => {
      const hiddenAt = hiddenAtMap[uid] ?? 0;
      const lastMs = lastActivityMs[uid] ?? 0;
      return hiddenAt === 0 || lastMs > hiddenAt; // auto-unhide if new activity after deletion
    });
  }, [conversationUserIds, hiddenAtMap, lastActivityMs]);

  const finalConversations = useMemo(() => {
    const arr = visibleConversations.slice();
    if (selectedChat && !arr.includes(selectedChat) && conversationUserIds.includes(selectedChat)) {
      arr.push(selectedChat);
    }
    return arr;
  }, [visibleConversations, selectedChat, conversationUserIds]);

  const sortedConversations = useMemo(
    () =>
      finalConversations
        .slice()
        .sort((a, b) => (userMap[a]?.displayName || a).localeCompare(userMap[b]?.displayName || b)),
    [finalConversations, userMap]
  );

  /* ---------- open chat (live subscription, index-free) ---------- */
  useEffect(() => {
    if (!currentUid || !selectedChat) {
      setMessages([]);
      return;
    }

    // reset initial-load flags whenever we open/switch a chat
    initARef.current = false;
    initBRef.current = false;
    openedChatPendingScrollRef.current = true;

    const msgs = [];
    const col = collection(database, "messages");
    const qA = query(col, where("senderId", "==", currentUid)); // me → others
    const qB = query(col, where("senderId", "==", selectedChat)); // them → others

    const mergeAndSet = () => {
      const map = new Map();
      for (const m of msgs) map.set(m.__id, m);
      const merged = Array.from(map.values()).sort((a, b) => {
        const ta = getMsgMs(a);
        const tb = getMsgMs(b);
        if (ta !== tb) return ta - tb;
        // stable tie-breaker to avoid jitter
        return a.__id > b.__id ? 1 : -1;
      });
      setMessages(merged);
    };

    const maybeScrollAfterInitialLoad = () => {
      if (openedChatPendingScrollRef.current && initARef.current && initBRef.current) {
        // wait for DOM to paint with the first full batch
        requestAnimationFrame(() => requestAnimationFrame(() => scrollToBottom(true)));
        openedChatPendingScrollRef.current = false;
      }
    };

    const unsubA = onSnapshot(
      qA,
      (snap) => {
        const filtered = [];
        snap.forEach((d) => {
          const m = d.data();
          if (m.receiverId === selectedChat)
            filtered.push({
              __id: d.id,
              ...m,
              _dir: "A",
              _pending: d.metadata?.hasPendingWrites === true,
            });
        });
        for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i]?._dir === "A") msgs.splice(i, 1);
        msgs.push(...filtered);
        mergeAndSet();
        initARef.current = true;
        maybeScrollAfterInitialLoad();
      },
      (err) => console.error("messages A error:", err)
    );

    const unsubB = onSnapshot(
      qB,
      (snap) => {
        const filtered = [];
        snap.forEach((d) => {
          const m = d.data();
          if (m.receiverId === currentUid)
            filtered.push({
              __id: d.id,
              ...m,
              _dir: "B",
              _pending: d.metadata?.hasPendingWrites === true,
            });
        });
        for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i]?._dir === "B") msgs.splice(i, 1);
        msgs.push(...filtered);
        mergeAndSet();
        initBRef.current = true;
        maybeScrollAfterInitialLoad();
      },
      (err) => console.error("messages B error:", err)
    );

    return () => {
      unsubA();
      unsubB();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUid, selectedChat]);

  /* ---------- Update last seen (server) + emit optimistic (client) ---------- */
  const writeSeenRef = useRef(0);
  const updateLastSeenServer = useCallback(async () => {
    if (!currentUid) return;
    const now = Date.now();
    // de-bounce rapid writes
    if (now - writeSeenRef.current < 1500) {
      emitOptimisticSeen(now);
      return;
    }
    writeSeenRef.current = now;
    try {
      await setDoc(
        doc(database, "users", currentUid),
        { messagesLastSeenAt: serverTimestamp(), uid: currentUid },
        { merge: true }
      );
    } catch (e) {
      console.warn("Failed to update messagesLastSeenAt:", e);
    } finally {
      emitOptimisticSeen(now);
    }
  }, [currentUid]);

  // On mount/unmount
  useEffect(() => {
    updateLastSeenServer();
    return () => {
      emitOptimisticSeen(Date.now());
    };
  }, [updateLastSeenServer]);

  // When switching chats, mark seen
  useEffect(() => {
    if (!selectedChat) return;
    updateLastSeenServer();
  }, [selectedChat, updateLastSeenServer]);

  // When messages change in the open thread, emit optimistic seen for latest inbound
  useEffect(() => {
    if (!currentUid || !selectedChat) return;
    const latestInbound = messages.reduce((acc, m) => {
      if (m.senderId !== currentUid) {
        const ms = tsToMs(m.timestamp);
        return ms > acc ? ms : acc;
      }
      return acc;
    }, 0);
    emitOptimisticSeen(latestInbound || Date.now());
  }, [messages.length, selectedChat, currentUid, messages]);

  /* ---------- auto-scroll helpers ---------- */
  const scrollToBottom = useCallback((force = true) => {
    const box = scrollBoxRef.current;
    const end = msgEndRef.current;
    if (!box || !end) return;

    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 64;
    if (!force && !nearBottom) return;

    // wait for DOM layout to include the newly rendered message
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        box.scrollTop = box.scrollHeight;
        end.scrollIntoView({ behavior: "auto", block: "end", inline: "nearest" });
      });
    });
  }, []);

  // After messages render:
  // - If we just sent one, force-scroll (one-shot).
  // - Otherwise, keep the "only if near bottom" behavior.
  useEffect(() => {
    if (forceScrollNextRef.current) {
      forceScrollNextRef.current = false;
      scrollToBottom(true);
    } else {
      scrollToBottom(false);
    }
  }, [messages.length, scrollToBottom]);

  // NOTE: Removed the old "immediate scroll on selecting a chat".
  // We now scroll after both initial snapshots arrive (see open chat effect).

  /* ---------- send message (unhide if needed) ---------- */
  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!currentUid || !selectedChat || !text) return;

    // Clear immediately so the user sees it "sent"
    setNewMessage("");

    try {
      const nowMs = Date.now(); // local ms for optimistic sort & display
      forceScrollNextRef.current = true; // force scroll after the bubble actually renders
      await deleteDoc(doc(database, "users", currentUid, "deletedConversations", selectedChat)).catch(() => {});
      await addDoc(collection(database, "messages"), {
        uid: currentUid, // so you can delete your own messages per rules
        senderId: currentUid,
        receiverId: selectedChat,
        message: text,
        timestamp: serverTimestamp(),
        clientMs: nowMs, // fallback while server timestamp isn't ready
      });
      // no scroll here; handled in the messages.length effect after render
    } catch (e) {
      forceScrollNextRef.current = false; // don't force-scroll if send failed
      console.error("Send failed:", e);
      // put text back if needed
      setNewMessage(text);
    }
  };

  /* ---------- delete conversation (soft-delete compliant) ---------- */
  const deleteConversation = async () => {
    if (!currentUid || !selectedChat) return;
    setDeleting(true);
    try {
      const colRef = collection(database, "messages");
      const myOutSnap = await getDocs(query(colRef, where("senderId", "==", currentUid)));
      const targets = myOutSnap.docs.filter((d) => d.data()?.receiverId === selectedChat);

      const CHUNK = 450;
      for (let i = 0; i < targets.length; i += CHUNK) {
        const slice = targets.slice(i, i + CHUNK);
        const batch = writeBatch(database);
        slice.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      await setDoc(
        doc(database, "users", currentUid, "deletedConversations", selectedChat),
        { uid: currentUid, otherUserId: selectedChat, deletedAt: serverTimestamp() }
      );

      setSelectedChat(null);
      setMessages([]);
      setConfirmOpen(false);
    } catch (e) {
      console.error("Failed to delete conversation:", e);
      alert("You can only delete your own messages. The rest will be hidden from your view.");
    } finally {
      setDeleting(false);
    }
  };

  /* ---------- derived profile for header ---------- */
  const selectedProfile = useMemo(() => {
    if (!selectedChat) return null;
    const u = userMap[selectedChat];
    if (u) return u;
    return { displayName: selectedChat, photoURL: null };
  }, [selectedChat, userMap]);

  /* ---------- UI bits ---------- */
  const ChatBubble = ({ own, children, timeMs }) => (
    <div className={`flex ${own ? "justify-end" : "justify-start"} mb-2`}>
      <div className={`max-w-[72%]`}>
        <div
          className={`rounded-2xl px-3 py-2 shadow ${
            own ? "bg-blue-600 text-white" : "bg-white text-gray-800 border border-gray-200"
          }`}
        >
          {children}
        </div>
        <div className={`mt-1 text-[11px] text-gray-500 ${own ? "text-right" : "text-left"}`}>
          {formatTime12(timeMs)}
        </div>
      </div>
    </div>
  );

  /* ---------- gates ---------- */
  if (authLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-gray-600">Loading your session…</div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">Please sign in to view your messages</h2>
        </div>
      </div>
    );
  }

  /* ---------- main UI ---------- */
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
              {sortedConversations.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">No conversations yet</div>
              ) : (
                sortedConversations.map((uid) => {
                  const data = userMap[uid] || { displayName: uid, photoURL: null };
                  const active = selectedChat === uid;
                  return (
                    <button
                      key={uid}
                      onClick={() => setSelectedChat(uid)}
                      className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2 transition ${
                        active ? "bg-blue-50 border border-blue-200" : "bg-white/60 border border-gray-200 hover:bg-white"
                      }`}
                      title={data.displayName}
                    >
                      <Avatar url={data.photoURL} name={data.displayName} size={40} />
                      <div className="text-left min-w-0">
                        <p className="font-medium text-foreground truncate">{data.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">Tap to open chat</p>
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
            {/* Chat header */}
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

                  <Avatar
                    url={selectedProfile?.photoURL}
                    name={selectedProfile?.displayName || selectedChat}
                    size={36}
                  />

                  <div className="min-w-0">
                    <div className="font-semibold truncate">{selectedProfile?.displayName || selectedChat}</div>
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
                <div
                  ref={scrollBoxRef}
                  className="h-[48vh] md:h-[54vh] overflow-y-auto p-4 bg-gray-50"
                  style={{ overscrollBehavior: "contain" }}
                >
                  {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                      Say hello 👋
                    </div>
                  ) : (
                    messages.map((m) => {
                      const own = m.senderId === currentUid;
                      const ms = getMsgMs(m);
                      const dim = m._pending && !m.timestamp?.seconds;
                      return (
                        <div key={m.__id} className={dim ? "opacity-70 transition-opacity" : "opacity-100"}>
                          <ChatBubble own={own} timeMs={ms}>
                            <span className="text-sm">{m.message}</span>
                          </ChatBubble>
                        </div>
                      );
                    })
                  )}
                  <div ref={msgEndRef} aria-hidden="true" />
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
          <div className="absolute inset-0 bg-black/30" onClick={() => !deleting && setConfirmOpen(false)} />
          <div className="relative w-[92%] max-w-sm rounded-2xl bg-white p-5 shadow-xl border border-gray-200">
            <h3 className="text-lg font-semibold mb-1">Delete conversation?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This will remove your messages and hide this thread from your view. You can't undo this.
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
