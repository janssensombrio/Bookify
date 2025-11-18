// src/pages/MessagesPage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { ArrowLeft, Send, MessageSquare, Trash2, MoreVertical, Archive } from "lucide-react";

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
  const [imageError, setImageError] = useState(false);
  const initial = (name?.[0] || "U").toUpperCase();
  
  // Reset error state when URL changes
  useEffect(() => {
    setImageError(false);
  }, [url]);
  
  if (!url || imageError) {
    return (
      <div
        className="rounded-full bg-blue-600 text-white grid place-items-center"
        style={{ width: size, height: size }}
      >
        <span className="font-semibold" style={{ fontSize: size * 0.4 }}>{initial}</span>
      </div>
    );
  }
  
  return (
    <img
      src={url}
      alt={alt || name}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setImageError(true)}
      onLoad={() => setImageError(false)}
    />
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

const formatMessageTimestamp = (m) => {
  const ms = getMsgMs(m);
  if (!ms) return "Just now";
  
  const msgDate = new Date(ms);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDateOnly = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());
  
  const hours = msgDate.getHours();
  const minutes = msgDate.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  const minuteStr = minutes.toString().padStart(2, "0");
  const timeStr = `${hour12}:${minuteStr} ${ampm}`;
  
  if (msgDateOnly.getTime() === today.getTime()) {
    return timeStr;
  } else if (msgDateOnly.getTime() === yesterday.getTime()) {
    return `Yesterday ${timeStr}`;
  } else {
    const daysDiff = Math.floor((today - msgDateOnly) / (1000 * 60 * 60 * 24));
    if (daysDiff < 7) {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      return `${dayNames[msgDate.getDay()]} ${timeStr}`;
    } else {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${monthNames[msgDate.getMonth()]} ${msgDate.getDate()}, ${timeStr}`;
    }
  }
};

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
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const typingDebounceRef = useRef(null);
  const typingStatusRef = useRef(null);

  // soft delete/hide
  const [hiddenAtMap, setHiddenAtMap] = useState({}); // { [otherUid]: ms }
  const [archivedAtMap, setArchivedAtMap] = useState({}); // { [otherUid]: ms }
  const [lastActivityMs, setLastActivityMs] = useState({}); // { [otherUid]: ms }
  const [lastMessages, setLastMessages] = useState({}); // { [otherUid]: { text: string, timestamp: ms } }
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [showArchived, setShowArchived] = useState(false);

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

  /* ---------- subscribe: archivedConversations ---------- */
  useEffect(() => {
    if (!currentUid) {
      setArchivedAtMap({});
      return;
    }
    const colRef = collection(database, "users", currentUid, "archivedConversations");
    return onSnapshot(
      colRef,
      (snap) => {
        const next = {};
        snap.forEach((d) => {
          const aa = d.data()?.archivedAt || null;
          next[d.id] = tsToMs(aa);
        });
        setArchivedAtMap(next);
      },
      (err) => console.error("archivedConversations error:", err)
    );
  }, [currentUid]);

  /* ---------- conversations list & activity (live, index-free) ---------- */
  useEffect(() => {
    if (!currentUid) {
      setConversationUserIds([]);
      setLastActivityMs({});
      setLastMessages({});
      return;
    }

    const col = collection(database, "messages");
    const qSent = query(col, where("senderId", "==", currentUid)); // me → others
    const qRecv = query(col, where("receiverId", "==", currentUid)); // others → me

    let setA = new Set();
    let setB = new Set();
    let lastA = new Map();
    let lastB = new Map();
    let lastMsgA = new Map(); // otherUid -> { text, timestamp }
    let lastMsgB = new Map();

    const emit = () => {
      const ids = Array.from(new Set([...setA, ...setB]));
      setConversationUserIds(ids);
      const merged = {};
      const mergedMsgs = {};
      ids.forEach((id) => {
        const a = lastA.get(id) ?? 0;
        const b = lastB.get(id) ?? 0;
        merged[id] = Math.max(a, b);
        
        // Get the most recent message
        const msgA = lastMsgA.get(id);
        const msgB = lastMsgB.get(id);
        if (msgA && msgB) {
          mergedMsgs[id] = msgA.timestamp > msgB.timestamp ? msgA : msgB;
        } else if (msgA) {
          mergedMsgs[id] = msgA;
        } else if (msgB) {
          mergedMsgs[id] = msgB;
        }
      });
      setLastActivityMs(merged);
      setLastMessages(mergedMsgs);
    };

    const unsub1 = onSnapshot(
      qSent,
      (snap) => {
        setA = new Set();
        lastA = new Map();
        lastMsgA = new Map();
        snap.forEach((d) => {
          const m = d.data();
          const other = m?.receiverId;
          if (!other || other === currentUid) return;
          setA.add(other);
          const t = tsToMs(m.timestamp);
          const currentLast = lastA.get(other) ?? 0;
          if (t >= currentLast) {
            lastA.set(other, t);
            lastMsgA.set(other, {
              text: m.text || m.message || "",
              timestamp: t,
            });
          }
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
        lastMsgB = new Map();
        snap.forEach((d) => {
          const m = d.data();
          const other = m?.senderId;
          if (!other || other === currentUid) return;
          setB.add(other);
          const t = tsToMs(m.timestamp);
          const currentLast = lastB.get(other) ?? 0;
          if (t >= currentLast) {
            lastB.set(other, t);
            lastMsgB.set(other, {
              text: m.text || m.message || "",
              timestamp: t,
            });
          }
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
      const archivedAt = archivedAtMap[uid] ?? 0;
      const lastMs = lastActivityMs[uid] ?? 0;
      // Exclude archived conversations
      if (archivedAt > 0) return false;
      // auto-unhide if new activity after deletion
      return hiddenAt === 0 || lastMs > hiddenAt;
    });
  }, [conversationUserIds, hiddenAtMap, archivedAtMap, lastActivityMs]);

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

  /* ---------- archived conversations list ---------- */
  const archivedConversations = useMemo(() => {
    return conversationUserIds.filter((uid) => {
      const archivedAt = archivedAtMap[uid] ?? 0;
      return archivedAt > 0;
    });
  }, [conversationUserIds, archivedAtMap]);

  const sortedArchivedConversations = useMemo(
    () =>
      archivedConversations
        .slice()
        .sort((a, b) => (userMap[a]?.displayName || a).localeCompare(userMap[b]?.displayName || b)),
    [archivedConversations, userMap]
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
    // Query 1: Messages from current user to selected chat (me → them)
    const qA = query(
      col, 
      where("senderId", "==", currentUid),
      where("receiverId", "==", selectedChat)
    );
    // Query 2: Messages from selected chat to current user (them → me)
    const qB = query(
      col, 
      where("senderId", "==", selectedChat),
      where("receiverId", "==", currentUid)
    );

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

    // Real-time listener for messages from current user to selected chat
    const unsubA = onSnapshot(
      qA,
      (snap) => {
        const filtered = [];
        snap.forEach((d) => {
          const m = d.data();
          filtered.push({
            __id: d.id,
            ...m,
            _dir: "A",
            _pending: d.metadata?.hasPendingWrites === true,
          });
        });
        // Remove old messages from this direction and add new ones
        for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i]?._dir === "A") msgs.splice(i, 1);
        msgs.push(...filtered);
        mergeAndSet();
        initARef.current = true;
        maybeScrollAfterInitialLoad();
      },
      (err) => {
        console.error("messages A error:", err);
        // If composite index is needed, Firestore will provide a link in the error
        if (err.code === "failed-precondition") {
          console.warn("Composite index may be required. Check the error message for the index creation link.");
        }
      }
    );

    // Real-time listener for messages from selected chat to current user
    const unsubB = onSnapshot(
      qB,
      (snap) => {
        const filtered = [];
        snap.forEach((d) => {
          const m = d.data();
          filtered.push({
            __id: d.id,
            ...m,
            _dir: "B",
            _pending: d.metadata?.hasPendingWrites === true,
          });
        });
        // Remove old messages from this direction and add new ones
        for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i]?._dir === "B") msgs.splice(i, 1);
        msgs.push(...filtered);
        mergeAndSet();
        initBRef.current = true;
        maybeScrollAfterInitialLoad();
      },
      (err) => {
        console.error("messages B error:", err);
        // If composite index is needed, Firestore will provide a link in the error
        if (err.code === "failed-precondition") {
          console.warn("Composite index may be required. Check the error message for the index creation link.");
        }
      }
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

  /* ---------- typing indicator ---------- */
  // Update typing status when user types
  const updateTypingStatus = useCallback(async (isTyping) => {
    if (!currentUid || !selectedChat) return;
    
    try {
      const typingRef = doc(database, "users", currentUid, "typing", selectedChat);
      if (isTyping) {
        await setDoc(typingRef, {
          isTyping: true,
          timestamp: serverTimestamp(),
          to: selectedChat,
        }, { merge: true });
      } else {
        await deleteDoc(typingRef).catch(() => {});
      }
    } catch (error) {
      console.error("Failed to update typing status:", error);
    }
  }, [currentUid, selectedChat]);

  // Debounced typing status update
  const handleTyping = useCallback(() => {
    if (!currentUid || !selectedChat) return;
    
    // Clear existing debounce timeout
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }
    
    // Clear existing clear timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Debounce typing status update (wait 300ms before updating to avoid spamming)
    typingDebounceRef.current = setTimeout(() => {
      updateTypingStatus(true);
      
      // Set timeout to clear typing status after 3 seconds of no typing
      typingTimeoutRef.current = setTimeout(() => {
        updateTypingStatus(false);
      }, 3000);
    }, 300);
  }, [currentUid, selectedChat, updateTypingStatus]);

  // Listen to other user's typing status
  useEffect(() => {
    if (!selectedChat || !currentUid) {
      setIsOtherUserTyping(false);
      if (typingStatusRef.current) {
        typingStatusRef.current();
        typingStatusRef.current = null;
      }
      return;
    }

    const typingRef = doc(database, "users", selectedChat, "typing", currentUid);
    const unsubscribe = onSnapshot(
      typingRef,
      (snap) => {
        const data = snap.data();
        setIsOtherUserTyping(data?.isTyping === true);
      },
      (error) => {
        // Document doesn't exist means user is not typing
        if (error.code === "permission-denied" || error.code === "not-found") {
          setIsOtherUserTyping(false);
        } else {
          console.error("Typing status error:", error);
        }
      }
    );

    typingStatusRef.current = unsubscribe;

    return () => {
      if (unsubscribe) unsubscribe();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current);
      }
    };
  }, [selectedChat, currentUid]);

  // Clear typing status when message is sent or input is cleared
  useEffect(() => {
    if (newMessage === "") {
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      updateTypingStatus(false);
    }
  }, [newMessage, updateTypingStatus]);

  // Auto-scroll when typing indicator appears
  useEffect(() => {
    if (isOtherUserTyping) {
      const box = scrollBoxRef.current;
      if (box) {
        const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 200;
        if (nearBottom) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => scrollToBottom(true));
          });
        }
      }
    }
  }, [isOtherUserTyping, scrollToBottom]);

  // When messages change in the open thread, emit optimistic seen for latest inbound and auto-scroll
  const prevMessagesLengthRef = useRef(0);
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
    
    // Auto-scroll on new messages if user is near bottom
    const hasNewMessages = messages.length > prevMessagesLengthRef.current;
    if (hasNewMessages && messages.length > 0) {
      const box = scrollBoxRef.current;
      if (box) {
        const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 150;
        if (nearBottom) {
          // Small delay to ensure DOM has updated
          requestAnimationFrame(() => {
            requestAnimationFrame(() => scrollToBottom(true));
          });
        }
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length, selectedChat, currentUid, messages, scrollToBottom]);

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

    // Clear typing status immediately
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    updateTypingStatus(false);

    // Clear immediately so the user sees it "sent"
    setNewMessage("");

    try {
      const nowMs = Date.now(); // local ms for optimistic sort & display
      forceScrollNextRef.current = true; // force scroll after the bubble actually renders
      // Unhide if deleted, and unarchive if archived
      await deleteDoc(doc(database, "users", currentUid, "deletedConversations", selectedChat)).catch(() => {});
      await deleteDoc(doc(database, "users", currentUid, "archivedConversations", selectedChat)).catch(() => {});
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

  /* ---------- archive conversation ---------- */
  const archiveConversation = async () => {
    if (!currentUid || !selectedChat) return;
    setArchiving(true);
    try {
      await setDoc(
        doc(database, "users", currentUid, "archivedConversations", selectedChat),
        { uid: currentUid, otherUserId: selectedChat, archivedAt: serverTimestamp() },
        { merge: true }
      );

      setSelectedChat(null);
      setMessages([]);
      setMenuOpen(false);
    } catch (e) {
      console.error("Failed to archive conversation:", e);
      alert("Failed to archive conversation. Please try again.");
    } finally {
      setArchiving(false);
    }
  };

  /* ---------- unarchive conversation ---------- */
  const unarchiveConversation = async (uid) => {
    if (!currentUid || !uid) return;
    try {
      await deleteDoc(doc(database, "users", currentUid, "archivedConversations", uid));
    } catch (e) {
      console.error("Failed to unarchive conversation:", e);
      alert("Failed to unarchive conversation. Please try again.");
    }
  };

  /* ---------- derived profile for header ---------- */
  const selectedProfile = useMemo(() => {
    if (!selectedChat) return null;
    const u = userMap[selectedChat];
    if (u) return u;
    return { displayName: selectedChat, photoURL: null };
  }, [selectedChat, userMap]);

  /* ---------- user online status ---------- */
  const [otherUserLastSeen, setOtherUserLastSeen] = useState(0);
  const [otherUserOnline, setOtherUserOnline] = useState(false);

  // Check if the other user is online (active within last 5 minutes)
  useEffect(() => {
    if (!selectedChat) {
      setOtherUserLastSeen(0);
      setOtherUserOnline(false);
      return;
    }

    const userRef = doc(database, "users", selectedChat);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        const data = snap.data() || {};
        const lastSeenMs = tsToMs(data.messagesLastSeenAt);
        setOtherUserLastSeen(lastSeenMs);
        
        // Consider user online if they were active within the last 5 minutes
        const now = Date.now();
        const fiveMinutesAgo = now - 5 * 60 * 1000;
        setOtherUserOnline(lastSeenMs > fiveMinutesAgo && lastSeenMs > 0);
      },
      (err) => {
        console.error("Failed to get user last seen:", err);
        setOtherUserLastSeen(0);
        setOtherUserOnline(false);
      }
    );

    return () => unsub();
  }, [selectedChat]);

  /* ---------- calculate menu position and handle click outside ---------- */
  useEffect(() => {
    const updateMenuPosition = () => {
      if (menuButtonRef.current && menuOpen) {
        const rect = menuButtonRef.current.getBoundingClientRect();
        setMenuPosition({
          top: rect.bottom + window.scrollY + 8,
          right: window.innerWidth - rect.right - window.scrollX,
        });
      }
    };

    if (menuOpen) {
      updateMenuPosition();
      window.addEventListener("resize", updateMenuPosition);
      window.addEventListener("scroll", updateMenuPosition, true);
    }

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) && 
          menuButtonRef.current && !menuButtonRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  /* ---------- close menu when chat changes ---------- */
  useEffect(() => {
    setMenuOpen(false);
  }, [selectedChat]);

  /* ---------- UI bits ---------- */
  const ChatBubble = ({ own, children, timestamp, message }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const bubbleRef = useRef(null);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    
    useEffect(() => {
      const updatePosition = () => {
        if (showTooltip && bubbleRef.current) {
          const rect = bubbleRef.current.getBoundingClientRect();
          const tooltipWidth = 150; // Approximate tooltip width
          const tooltipHeight = 28; // Approximate tooltip height
          const offset = 8; // Gap between bubble and tooltip
          
          let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
          let top = rect.top - tooltipHeight - offset;
          
          // Keep tooltip within viewport
          if (left < 8) left = 8;
          if (left + tooltipWidth > window.innerWidth - 8) {
            left = window.innerWidth - tooltipWidth - 8;
          }
          
          // If tooltip would go above viewport, show below instead
          if (top < 8) {
            top = rect.bottom + offset;
          }
          
          setTooltipPosition({ top, left });
        }
      };
      
      if (showTooltip) {
        updatePosition();
        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition);
        return () => {
          window.removeEventListener("scroll", updatePosition, true);
          window.removeEventListener("resize", updatePosition);
        };
      }
    }, [showTooltip]);
    
    const formattedTime = useMemo(() => formatMessageTimestamp(message), [message]);
    
    return (
      <div className={`flex ${own ? "justify-end" : "justify-start"} mb-2 sm:mb-3 relative`}>
        <div className={`max-w-[85%] sm:max-w-[80%] md:max-w-[72%] relative`}>
          <div
            ref={bubbleRef}
            className={`rounded-xl md:rounded-2xl px-3 py-2 sm:px-4 sm:py-3 shadow-lg transition-all duration-300 transform-gpu md:hover:scale-[1.02] cursor-pointer touch-manipulation ${
              own 
                ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-500/30" 
                : "bg-white/90 text-gray-800 border-2 border-white/60 backdrop-blur-sm shadow-md"
            }`}
            onMouseEnter={() => {
              if (window.innerWidth >= 768) setShowTooltip(true);
            }}
            onMouseLeave={() => {
              if (window.innerWidth >= 768) setShowTooltip(false);
            }}
            onTouchStart={() => {
              // Show tooltip on touch for mobile
              if (window.innerWidth < 768) {
                setShowTooltip(true);
                setTimeout(() => setShowTooltip(false), 2000);
              }
            }}
          >
            {children}
          </div>
          
          {showTooltip && formattedTime && typeof document !== "undefined" &&
            createPortal(
              <div
                className="fixed z-[10000] px-3 py-1.5 rounded-lg bg-gray-900/95 text-white text-xs font-medium shadow-xl backdrop-blur-sm pointer-events-none whitespace-nowrap transition-opacity duration-200"
                style={{
                  top: `${tooltipPosition.top}px`,
                  left: `${tooltipPosition.left}px`,
                }}
              >
                {formattedTime}
              </div>,
              document.body
            )}
        </div>
      </div>
    );
  };

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
    <div className="w-full min-h-screen md:min-h-0 space-y-4 md:space-y-6 px-2 sm:px-4 md:px-0">
      {/* Page Header - Hidden on mobile when chat is selected */}
      <div className={`${selectedChat ? "hidden md:block" : "block"}`}>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Messages</h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">Chat with guests and keep track of your conversations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
        {/* Conversations list - Hidden on mobile when chat is selected */}
        <div className={`${selectedChat ? "hidden md:block" : "block"} md:col-span-5 flex flex-col`}>
          <div className={[
            "rounded-2xl md:rounded-[2.5rem] p-4 sm:p-6 md:p-8",
            "bg-white/70 border border-white/50 shadow-2xl",
            "backdrop-blur-2xl",
            "bg-[radial-gradient(1200px_800px_at_0%_-20%,rgba(59,130,246,0.15),transparent_60%),radial-gradient(1000px_600px_at_100%_120%,rgba(139,92,246,0.12),transparent_60%)]",
            "relative overflow-hidden flex flex-col",
            "h-[calc(100vh-180px)] md:h-[calc(100vh-200px)] max-h-[600px]",
            "before:absolute before:inset-0 before:rounded-2xl md:before:rounded-[2.5rem] before:bg-gradient-to-b before:from-white/40 before:to-transparent before:pointer-events-none"
          ].join(" ")}>
            {/* Floating decorative elements - Hidden on mobile */}
            <div className="hidden md:block absolute top-6 left-6 w-16 h-16 bg-blue-200/20 rounded-full blur-xl"></div>
            <div className="hidden md:block absolute bottom-6 right-6 w-20 h-20 bg-purple-200/20 rounded-full blur-xl"></div>
            
            <div className="relative z-10 flex flex-col min-h-0 flex-1">
              <div className="flex-shrink-0 mb-3 md:mb-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="text-blue-600 w-[18px] h-[18px] sm:w-5 sm:h-5" size={18} />
                    <h3 className="text-base sm:text-lg font-semibold text-slate-900">
                      {showArchived ? "Archived" : "Conversations"}
                    </h3>
                  </div>
                  {archivedConversations.length > 0 && (
                    <button
                      onClick={() => setShowArchived(!showArchived)}
                      className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      {showArchived ? "Show Active" : `Archived (${archivedConversations.length})`}
                    </button>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-600">
                  {showArchived ? "View your archived conversations." : "View all your conversations."}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent min-h-0">
                {showArchived ? (
                  sortedArchivedConversations.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="text-xs sm:text-sm text-slate-600 mb-3">No archived conversations</div>
                      <button
                        onClick={() => setShowArchived(false)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-md"
                      >
                        View All Messages
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 overflow-x-hidden">
                      <button
                        onClick={() => setShowArchived(false)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md mb-2"
                      >
                        <ArrowLeft size={16} />
                        View All Messages
                      </button>
                      {sortedArchivedConversations.map((uid) => {
                        const data = userMap[uid] || { displayName: uid, photoURL: null };
                        const active = selectedChat === uid;
                        return (
                          <div key={uid} className="overflow-hidden -mx-1 px-1">
                            <div className={`w-full flex items-center gap-2 sm:gap-3 rounded-xl md:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 transition-all duration-300 ${
                              active 
                                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 border-2 border-white/60" 
                                : "bg-white/60 border-2 border-white/60 backdrop-blur-sm shadow-md"
                            }`}>
                              <button
                                onClick={() => setSelectedChat(uid)}
                                className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0"
                                title={data.displayName}
                              >
                                <Avatar url={data.photoURL} name={data.displayName} size={36} />
                                <div className="text-left min-w-0 flex-1 overflow-hidden">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className={`text-base sm:text-lg font-medium truncate ${active ? "text-white" : "text-slate-900"}`}>{data.displayName}</p>
                                    {lastMessages[uid] && (
                                      <span className={`text-sm whitespace-nowrap shrink-0 ${active ? "text-blue-100" : "text-slate-500"}`}>
                                        {formatTime12(lastMessages[uid].timestamp)}
                                      </span>
                                    )}
                                  </div>
                                  {lastMessages[uid] ? (
                                    <p className={`text-sm truncate ${active ? "text-blue-100" : "text-slate-600"}`}>
                                      {lastMessages[uid].text || "No message"}
                                    </p>
                                  ) : (
                                    <p className={`text-sm truncate ${active ? "text-blue-100" : "text-slate-600"}`}>Tap to open chat</p>
                                  )}
                                </div>
                              </button>
                              <button
                                onClick={() => unarchiveConversation(uid)}
                                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                                title="Unarchive"
                              >
                                <Archive className={`w-4 h-4 ${active ? "text-white" : "text-slate-600"}`} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  sortedConversations.length === 0 ? (
                    <div className="text-xs sm:text-sm text-slate-600 text-center py-6">No conversations yet</div>
                  ) : (
                    <div className="space-y-2 overflow-x-hidden">
                      {sortedConversations.map((uid) => {
                        const data = userMap[uid] || { displayName: uid, photoURL: null };
                        const active = selectedChat === uid;
                        return (
                          <div key={uid} className="overflow-hidden -mx-1 px-1">
                            <button
                              onClick={() => setSelectedChat(uid)}
                              className={`w-full flex items-center gap-2 sm:gap-3 rounded-xl md:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 transition-all duration-300 active:scale-[0.98] md:hover:scale-[1.02] ${
                                active 
                                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 border-2 border-white/60" 
                                  : "bg-white/60 border-2 border-white/60 backdrop-blur-sm active:bg-white/80 md:hover:bg-white/80 shadow-md md:hover:shadow-lg"
                              }`}
                              title={data.displayName}
                            >
                              <Avatar url={data.photoURL} name={data.displayName} size={36} />
                              <div className="text-left min-w-0 flex-1 overflow-hidden">
                                <div className="flex items-center justify-between gap-2">
                                  <p className={`text-base sm:text-lg font-medium truncate ${active ? "text-white" : "text-slate-900"}`}>{data.displayName}</p>
                                  {lastMessages[uid] && (
                                    <span className={`text-sm whitespace-nowrap shrink-0 ${active ? "text-blue-100" : "text-slate-500"}`}>
                                      {formatTime12(lastMessages[uid].timestamp)}
                                    </span>
                                  )}
                                </div>
                                {lastMessages[uid] ? (
                                  <p className={`text-sm truncate ${active ? "text-blue-100" : "text-slate-600"}`}>
                                    {lastMessages[uid].text || "No message"}
                                  </p>
                                ) : (
                                  <p className={`text-sm truncate ${active ? "text-blue-100" : "text-slate-600"}`}>Tap to open chat</p>
                                )}
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Chat Area - Full width on mobile when selected */}
        <div className={`${selectedChat ? "block" : "hidden md:block"} md:col-span-7 flex flex-col`}>
          <div className={[
            "rounded-2xl md:rounded-[2.5rem] bg-white/70 border border-white/50 shadow-2xl overflow-hidden",
            "backdrop-blur-2xl flex flex-col",
            "bg-[radial-gradient(1200px_800px_at_0%_-20%,rgba(59,130,246,0.15),transparent_60%),radial-gradient(1000px_600px_at_100%_120%,rgba(139,92,246,0.12),transparent_60%)]",
            "relative overflow-hidden",
            "h-[calc(100vh-180px)] md:h-[calc(100vh-200px)] max-h-[600px]",
            "before:absolute before:inset-0 before:rounded-2xl md:before:rounded-[2.5rem] before:bg-gradient-to-b before:from-white/40 before:to-transparent before:pointer-events-none"
          ].join(" ")}>
            {/* Floating decorative elements - Hidden on mobile */}
            <div className="hidden md:block absolute top-6 right-6 w-16 h-16 bg-blue-200/20 rounded-full blur-xl"></div>
            <div className="hidden md:block absolute bottom-6 left-6 w-20 h-20 bg-purple-200/20 rounded-full blur-xl"></div>
            
            {/* Chat header */}
            {selectedChat ? (
              <div className="relative z-10 flex items-center justify-between p-3 sm:p-4 border-b border-white/60 bg-white/80 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  {/* Mobile back */}
                  <button
                    className="md:hidden p-1.5 sm:p-2 rounded-lg active:bg-white/90 shrink-0 transition-all duration-200 shadow-sm touch-manipulation"
                    onClick={() => setSelectedChat(null)}
                    aria-label="Back"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  <div className="relative shrink-0">
                    <Avatar
                      url={selectedProfile?.photoURL}
                      name={selectedProfile?.displayName || selectedChat}
                      size={36}
                    />
                    {otherUserOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-4 sm:h-4 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm sm:text-base font-semibold text-slate-900 truncate">{selectedProfile?.displayName || selectedChat}</div>
                    <div className="text-xs text-slate-600">
                      {otherUserOnline ? "Active now" : otherUserLastSeen > 0 ? "Offline" : ""}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  <button
                    ref={menuButtonRef}
                    onClick={() => setMenuOpen(!menuOpen)}
                    title="More options"
                    className="p-1.5 sm:p-2 rounded-lg active:bg-white/90 md:hover:bg-white/90 transition-all duration-200 shadow-sm md:hover:shadow-md backdrop-blur-sm border border-white/60 bg-white/70 touch-manipulation"
                    aria-label="More options"
                    aria-expanded={menuOpen}
                  >
                    <MoreVertical size={16} className="text-slate-700 sm:w-[18px] sm:h-[18px]" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="md:hidden relative z-10 flex items-center gap-2 p-3 sm:p-4 border-b border-white/60 bg-white/80 backdrop-blur-sm shrink-0">
                <div className="text-sm sm:text-base font-medium text-slate-900">Select a chat</div>
              </div>
            )}

            {/* Chat body & composer */}
            {selectedChat ? (
              <>
                <div
                  ref={scrollBoxRef}
                  className="relative z-10 flex-1 overflow-y-auto p-3 sm:p-4 bg-gradient-to-b from-slate-50/50 to-blue-50/30 min-h-0"
                  style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
                >
                  {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-blue-100/80 mb-2 sm:mb-3">
                          <MessageSquare className="text-blue-600 w-6 h-6 sm:w-8 sm:h-8" size={24} />
                        </div>
                        <p className="text-xs sm:text-sm text-slate-600 font-medium">Say hello 👋</p>
                      </div>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const own = m.senderId === currentUid;
                      const dim = m._pending && !m.timestamp?.seconds;
                      return (
                        <div key={m.__id} className={dim ? "opacity-70 transition-opacity" : "opacity-100"}>
                          <ChatBubble own={own} timestamp={m.timestamp} message={m}>
                            <span className="text-sm sm:text-base leading-relaxed break-words">{m.message}</span>
                          </ChatBubble>
                        </div>
                      );
                    })
                  )}
                  {isOtherUserTyping && (
                    <div className="flex justify-start mb-2 sm:mb-3">
                      <div className="max-w-[85%] sm:max-w-[80%] md:max-w-[72%]">
                        <div className="rounded-xl md:rounded-2xl px-4 py-3 bg-white/90 border-2 border-white/60 backdrop-blur-sm shadow-md">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1.5">
                              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms", animationDuration: "1.4s" }}></div>
                              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "200ms", animationDuration: "1.4s" }}></div>
                              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "400ms", animationDuration: "1.4s" }}></div>
                            </div>
                            <span className="text-xs text-slate-500 font-medium">typing...</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={msgEndRef} aria-hidden="true" />
                </div>

                <div className="relative z-10 border-t border-white/60 bg-white/80 backdrop-blur-sm p-3 sm:p-4 shrink-0">
                  <div className="flex items-end gap-2 sm:gap-3">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          sendMessage();
                        } else {
                          handleTyping();
                        }
                      }}
                      className="flex-1 rounded-xl md:rounded-2xl border-2 border-white/60 bg-white/90 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500 shadow-sm"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim()}
                      className="rounded-xl md:rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 active:from-blue-600 active:to-blue-700 md:hover:from-blue-600 md:hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2.5 sm:px-5 sm:py-3 shadow-lg shadow-blue-500/30 md:hover:shadow-xl md:hover:shadow-blue-500/40 transition-all duration-300 transform-gpu active:scale-95 md:hover:scale-105 touch-manipulation"
                      aria-label="Send message"
                    >
                      <Send className="w-4 h-4 sm:w-[18px] sm:h-[18px]" size={16} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 min-h-0">
                <div className="rounded-xl md:rounded-2xl border-2 border-dashed border-white/60 p-6 sm:p-8 text-center bg-white/60 backdrop-blur-sm shadow-md">
                  <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-blue-100/80 mb-3 sm:mb-4">
                    <MessageSquare className="text-blue-600 w-6 h-6 sm:w-8 sm:h-8" size={24} />
                  </div>
                  <p className="text-sm sm:text-base text-slate-700 font-medium">Select a conversation to start chatting</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Menu dropdown (portal) */}
      {menuOpen && menuButtonRef.current && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed w-44 sm:w-48 rounded-xl md:rounded-2xl bg-white/95 backdrop-blur-xl border-2 border-white/60 shadow-2xl overflow-hidden z-[9999]"
            style={{
              top: `${menuPosition.top}px`,
              right: `${menuPosition.right}px`,
            }}
          >
            <button
              onClick={() => {
                setMenuOpen(false);
                archiveConversation();
              }}
              disabled={archiving}
              className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-left text-sm sm:text-base text-slate-700 active:bg-slate-50/80 md:hover:bg-slate-50/80 transition-colors duration-200 touch-manipulation disabled:opacity-50"
            >
              <Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4" size={14} />
              <span className="font-medium">{archiving ? "Archiving..." : "Archive conversation"}</span>
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                setConfirmOpen(true);
              }}
              className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-left text-sm sm:text-base text-red-600 active:bg-red-50/80 md:hover:bg-red-50/80 transition-colors duration-200 border-t border-white/60 touch-manipulation"
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" size={14} />
              <span className="font-medium">Delete conversation</span>
            </button>
          </div>,
          document.body
        )}

      {/* Delete confirmation modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => !deleting && setConfirmOpen(false)} />
          <div className="relative z-10 w-[92%] max-w-sm rounded-2xl md:rounded-[2.5rem] bg-white/95 backdrop-blur-2xl p-5 sm:p-6 shadow-2xl border-2 border-white/60">
            <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-2">Delete conversation?</h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-5 sm:mb-6">
              This will remove your messages and hide this thread from your view. You can't undo this.
            </p>
            <div className="flex items-center justify-end gap-2 sm:gap-3">
              <button
                className="rounded-xl md:rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-white/60 bg-white/80 active:bg-white/90 md:hover:bg-white/90 shadow-sm md:hover:shadow-md transition-all duration-200 text-xs sm:text-sm text-slate-700 font-medium touch-manipulation"
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="rounded-xl md:rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-br from-red-500 to-red-600 text-white active:from-red-600 active:to-red-700 md:hover:from-red-600 md:hover:to-red-700 disabled:opacity-60 shadow-lg shadow-red-500/30 md:hover:shadow-xl md:hover:shadow-red-500/40 transition-all duration-200 transform-gpu active:scale-95 md:hover:scale-105 text-xs sm:text-sm font-medium touch-manipulation"
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
