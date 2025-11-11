// src/pages/guest/messages.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  writeBatch,
  deleteDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { database, auth } from "../../config/firebase";

import Sidebar from "./components/sidebar.jsx";
import { useSidebar } from "../../context/SidebarContext";
import BookifyLogo from "../../components/bookify-logo.jsx";
import HostCategModal from "../../components/host-categ-modal.jsx";
import HostPoliciesModal from "./components/HostPoliciesModal.jsx";

import {
  Menu,
  Compass,
  MessageSquare,
  Send,
  ArrowLeft,
  Trash2,
} from "lucide-react";

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
  const displayName = pick(
    d.displayName,
    d.name,
    [first, last].filter(Boolean).join(" ")
  );
  const photoURL = pick(
    d.photoURL,
    d.photoUrl,
    d.avatarURL,
    d.photo,
    d.avatar,
    d.profileImageUrl
  );
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

// dd-mm-yy key to detect day changes
const dayKey = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

// Friendly date labels: Today / Yesterday / Month Day
const formatDateLabel = (ms) => {
  const d = new Date(ms);
  const today = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  const diff = Math.floor(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()) -
      new Date(d.getFullYear(), d.getMonth(), d.getDate())) /
      oneDay
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
};

// 12-hour clock with lowercase am/pm
const formatTime12 = (ms) => {
  const d = new Date(ms);
  const h = d.getHours();
  const hour12 = ((h + 11) % 12) + 1; // 1–12
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "pm" : "am";
  return `${hour12}:${m} ${ampm}`;
};

// Broadcast "optimistic seen" (used by other UI parts such as nav badges)
const emitOptimisticSeen = (ms = Date.now()) => {
  try {
    window.dispatchEvent(
      new CustomEvent("messages:optimistic-seen", { detail: { ms } })
    );
  } catch {}
};

/* ---------------- main page ---------------- */
const GuestMessagesPage = () => {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { sidebarOpen, setSidebarOpen } = useSidebar();

  // Auth
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

  // Host state + modals
  const [isHost, setIsHost] = useState(
    typeof window !== "undefined" && localStorage.getItem("isHost") === "true"
  );
  const [showHostModal, setShowHostModal] = useState(false);
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);

  // Host status
  useEffect(() => {
    const run = async () => {
      try {
        if (!currentUid) return;
        const qs = await getDocs(
          query(collection(database, "hosts"), where("uid", "==", currentUid))
        );
        const hostStatus = !qs.empty;
        setIsHost(hostStatus);
        localStorage.setItem("isHost", hostStatus ? "true" : "false");
      } catch (e) {
        console.error("Host check failed:", e);
      }
    };
    run();
  }, [currentUid]);

  // Conversations & messages
  const [conversationUserIds, setConversationUserIds] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [selectedChatUid, setSelectedChatUid] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Soft-delete state & recency
  const [hiddenAtMap, setHiddenAtMap] = useState({}); // { [otherUid]: ms }
  const [lastActivityMs, setLastActivityMs] = useState({}); // { [otherUid]: ms }

  // UI states
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Scroll refs
  const msgEndRef = useRef(null);
  const scrollBoxRef = useRef(null);

  // One-shot "force scroll after my send is rendered"
  const forceScrollNextRef = useRef(false);

  // When opening a chat, wait until both initial snapshots arrive, then scroll
  const initARef = useRef(false); // me → them
  const initBRef = useRef(false); // them → me
  const openedChatPendingScrollRef = useRef(false);

  // Preselect chat via URL ?with=<uid>
  useEffect(() => {
    const preset = search.get("with");
    if (preset) setSelectedChatUid(decodeURIComponent(preset));
  }, [search]);

  /* ---------- subscribe to per-user deleted markers ---------- */
  useEffect(() => {
    if (!currentUid) {
      setHiddenAtMap({});
      return;
    }
    const colRef = collection(
      database,
      "users",
      currentUid,
      "deletedConversations"
    );
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

  /* ---------- build conversation list + last activity (index-free) ---------- */
  useEffect(() => {
    if (!currentUid) {
      setConversationUserIds([]);
      setLastActivityMs({});
      return;
    }

    const col = collection(database, "messages");
    const q1 = query(col, where("senderId", "==", currentUid)); // me -> others
    const q2 = query(col, where("receiverId", "==", currentUid)); // others -> me

    let othersA = new Set();
    let othersB = new Set();
    let lastA = new Map(); // otherUid -> ms
    let lastB = new Map();

    const emit = () => {
      const ids = Array.from(new Set([...othersA, ...othersB]));
      setConversationUserIds(ids);
      // merge last activity
      const merged = {};
      ids.forEach((id) => {
        const a = lastA.get(id) ?? 0;
        const b = lastB.get(id) ?? 0;
        merged[id] = Math.max(a, b);
      });
      setLastActivityMs(merged);
    };

    const unsub1 = onSnapshot(
      q1,
      (snap) => {
        othersA = new Set();
        lastA = new Map();
        snap.forEach((d) => {
          const m = d.data();
          const other = m?.receiverId;
          if (!other || other === currentUid) return;
          othersA.add(other);
          const t = tsToMs(m.timestamp);
          lastA.set(other, Math.max(lastA.get(other) ?? 0, t));
        });
        emit();
      },
      (err) => console.error("conv q1 error:", err)
    );

    const unsub2 = onSnapshot(
      q2,
      (snap) => {
        othersB = new Set();
        lastB = new Map();
        snap.forEach((d) => {
          const m = d.data();
          const other = m?.senderId;
          if (!other || other === currentUid) return;
          othersB.add(other);
          const t = tsToMs(m.timestamp);
          lastB.set(other, Math.max(lastB.get(other) ?? 0, t));
        });
        emit();
      },
      (err) => console.error("conv q2 error:", err)
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, [currentUid]);

  /* ---------- fetch display info ---------- */
  useEffect(() => {
    if (!conversationUserIds.length) return;

    (async () => {
      const updates = {};
      await Promise.all(
        conversationUserIds.map(async (uid) => {
          if (userMap[uid]) return;
          try {
            const hostQs = await getDocs(
              query(collection(database, "hosts"), where("uid", "==", uid))
            );
            if (!hostQs.empty) {
              updates[uid] = normalizeUserDoc(hostQs.docs[0].data(), uid);
              return;
            }
            const userQs = await getDocs(
              query(collection(database, "users"), where("uid", "==", uid))
            );
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

  /* ---------- open chat (live, index-free, merged + sorted) ---------- */
  useEffect(() => {
    if (!currentUid || !selectedChatUid) {
      setMessages([]);
      return;
    }

    // Reset initial-load flags whenever we open/switch a chat
    initARef.current = false;
    initBRef.current = false;
    openedChatPendingScrollRef.current = true;

    const msgs = [];
    const col = collection(database, "messages");
    const qA = query(col, where("senderId", "==", currentUid)); // me → others
    const qB = query(col, where("senderId", "==", selectedChatUid)); // them → others

    const mergeAndSet = () => {
      const map = new Map();
      for (const m of msgs) map.set(m.__id, m);
      const merged = Array.from(map.values()).sort((a, b) => {
        const ta = getMsgMs(a);
        const tb = getMsgMs(b);
        if (ta !== tb) return ta - tb;
        // stable tiebreaker to avoid jitter
        return a.__id > b.__id ? 1 : -1;
      });
      setMessages(merged);
    };

    const scrollToBottomAfterFirstLoad = () => {
      if (
        openedChatPendingScrollRef.current &&
        initARef.current &&
        initBRef.current
      ) {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => scrollToBottom(true))
        );
        openedChatPendingScrollRef.current = false;
      }
    };

    const unsubA = onSnapshot(
      qA,
      (snap) => {
        const filtered = [];
        snap.forEach((d) => {
          const m = d.data();
          if (m.receiverId === selectedChatUid)
            filtered.push({
              __id: d.id,
              ...m,
              _dir: "A",
              _pending: d.metadata?.hasPendingWrites === true,
            });
        });
        for (let i = msgs.length - 1; i >= 0; i--)
          if (msgs[i]?._dir === "A") msgs.splice(i, 1);
        msgs.push(...filtered);
        mergeAndSet();
        initARef.current = true;
        scrollToBottomAfterFirstLoad();
      },
      (err) => console.error("messages qA error:", err)
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
        for (let i = msgs.length - 1; i >= 0; i--)
          if (msgs[i]?._dir === "B") msgs.splice(i, 1);
        msgs.push(...filtered);
        mergeAndSet();
        initBRef.current = true;
        scrollToBottomAfterFirstLoad();
      },
      (err) => console.error("messages qB error:", err)
    );

    return () => {
      unsubA();
      unsubB();
    };
  }, [currentUid, selectedChatUid]);

  /* ---------- scroll helpers ---------- */
  const scrollToBottom = useCallback((force = true) => {
    const el = scrollBoxRef.current;
    const end = msgEndRef.current;
    if (!el || !end) return;

    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
    if (!force && !nearBottom) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
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

  /* ---------- derived lists (auto-unhide if new messages exist) ---------- */
  const visibleConversations = useMemo(() => {
    return conversationUserIds.filter((uid) => {
      const hiddenAt = hiddenAtMap[uid] ?? 0;
      const lastMs = lastActivityMs[uid] ?? 0;
      // Show if not hidden, OR there is newer activity than the deletion time.
      return hiddenAt === 0 || lastMs > hiddenAt;
    });
  }, [conversationUserIds, hiddenAtMap, lastActivityMs]);

  // Keep selected chat visible even if hidden (e.g., deep link)
  const finalConversations = useMemo(() => {
    const arr = visibleConversations.slice();
    if (
      selectedChatUid &&
      !arr.includes(selectedChatUid) &&
      conversationUserIds.includes(selectedChatUid)
    ) {
      arr.push(selectedChatUid);
    }
    return arr;
  }, [visibleConversations, selectedChatUid, conversationUserIds]);

  const sortedConversations = useMemo(
    () =>
      finalConversations
        .slice()
        .sort((a, b) =>
          (userMap[a]?.displayName || a).localeCompare(
            userMap[b]?.displayName || b
          )
        ),
    [finalConversations, userMap]
  );

  /* ---------- Update last seen (server) + emit optimistic (client) ---------- */
  const writeSeenRef = useRef(0);
  const updateLastSeenServer = useCallback(async () => {
    if (!currentUid) return;
    // De-bounce rapid writes (avoid spamming Firestore)
    const now = Date.now();
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

  // On mount & unmount
  useEffect(() => {
    updateLastSeenServer();
    return () => {
      emitOptimisticSeen(Date.now());
    };
  }, [updateLastSeenServer]);

  // When switching chats, mark seen
  useEffect(() => {
    if (!selectedChatUid) return;
    updateLastSeenServer();
  }, [selectedChatUid, updateLastSeenServer]);

  // When message list changes, mark seen for newest inbound in open thread
  useEffect(() => {
    if (!currentUid || !selectedChatUid) return;
    const latestInbound = messages.reduce((acc, m) => {
      if (m.senderId !== currentUid) {
        const ms = tsToMs(m.timestamp);
        return ms > acc ? ms : acc;
      }
      return acc;
    }, 0);
    emitOptimisticSeen(latestInbound || Date.now());
  }, [messages.length, selectedChatUid, currentUid, messages]);

  // Visibility changes (tab focus)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        updateLastSeenServer();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [updateLastSeenServer]);

  /* ---------- delete conversation (soft-delete compliant) ---------- */
  const deleteConversation = async () => {
    if (!currentUid || !selectedChatUid) return;
    try {
      setDeleting(true);

      // Delete only your outgoing docs; client-filter the receiver.
      const colRef = collection(database, "messages");
      const myOutSnap = await getDocs(
        query(colRef, where("senderId", "==", currentUid))
      );
      const targets = myOutSnap.docs.filter(
        (d) => d.data()?.receiverId === selectedChatUid
      );

      const CHUNK = 450;
      for (let i = 0; i < targets.length; i += CHUNK) {
        const slice = targets.slice(i, i + CHUNK);
        const batch = writeBatch(database);
        slice.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      // Mark hidden for YOU (with deletedAt)
      await deleteDoc(
        doc(
          database,
          "users",
          currentUid,
          "deletedConversations",
          selectedChatUid
        )
      ).catch(() => {});
      await addDoc(
        collection(database, "users", currentUid, "deletedConversations"),
        {}
      ); // noop write to warm cache

      await setDoc(
        doc(
          database,
          "users",
          currentUid,
          "deletedConversations",
          selectedChatUid
        ),
        { uid: currentUid, otherUserId: selectedChatUid, deletedAt: serverTimestamp() }
      );

      setSelectedChatUid(null);
      setMessages([]);
      setConfirmOpen(false);
    } catch (e) {
      console.error("Failed to delete conversation:", e);
      alert(
        "You can only delete the messages you sent. The rest will be hidden from your view."
      );
    } finally {
      setDeleting(false);
    }
  };

  /* ---------- send message (optimistic time + one-shot scroll) ---------- */
  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!currentUid || !selectedChatUid || !text || sending) return;

    setSending(true);
    setNewMessage(""); // clear immediately for snappy UX

    try {
      // If previously hidden, unhide for current user
      try {
        await deleteDoc(
          doc(
            database,
            "users",
            currentUid,
            "deletedConversations",
            selectedChatUid
          )
        );
      } catch {
        /* ignore */
      }

      const nowMs = Date.now(); // local fallback time
      forceScrollNextRef.current = true; // scroll after snapshot paints the bubble

      await addDoc(collection(database, "messages"), {
        uid: currentUid, // matches your delete rule
        senderId: currentUid,
        receiverId: selectedChatUid,
        message: text,
        timestamp: serverTimestamp(),
        clientMs: nowMs, // fallback while server timestamp isn't ready
      });

      // no immediate scroll here; handled after render via effect
    } catch (e) {
      // Restore the text if send fails
      console.error("Send failed:", e);
      setNewMessage(text);
      alert("Failed to send. Please try again.");
      forceScrollNextRef.current = false;
    } finally {
      setSending(false);
    }
  };

  /* ---------- render messages (with date separators & pending dim) ---------- */
  const renderMessages = (list, uid) => {
    const nodes = [];
    let lastDay = null;

    list.forEach((m, idx) => {
      const own = m.senderId === uid;
      const ms = getMsgMs(m);
      const dk = dayKey(ms);
      const dim = m._pending && !m.timestamp?.seconds;

      if (dk !== lastDay) {
        nodes.push(
          <div key={`date-${dk}-${idx}`} className="my-3 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-500">{formatDateLabel(ms)}</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        );
        lastDay = dk;
      }

      nodes.push(
        <div
          key={m.__id}
          className={`flex ${own ? "justify-end" : "justify-start"} mb-2 ${
            dim ? "opacity-70 transition-opacity" : "opacity-100"
          }`}
        >
          <div
            className={`max-w-[72%] flex flex-col ${
              own ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`w-fit rounded-2xl px-3 py-2 shadow ${
                own
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-800 border border-gray-200"
              }`}
            >
              <span className="text-sm block">{m.message}</span>
            </div>
            <span className="mt-1 text-[10px] leading-none text-gray-500 select-none">
              {formatTime12(ms)}
            </span>
          </div>
        </div>
      );
    });

    return nodes;
  };

  /* ---------- host CTA ---------- */
  const handleHostClick = () => {
    if (isHost) {
      navigate("/hostpage");
    } else {
      setShowPoliciesModal(true);
    }
  };
  const handleAgreePolicies = () => {
    setShowPoliciesModal(false);
    setShowHostModal(true);
  };

  /* ---------- auth gates ---------- */
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
          <button
            onClick={() => navigate("/login")}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-white font-semibold hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  /* ---------- main UI ---------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar onHostClick={handleHostClick} isHost={isHost} />

      {/* Top Navbar */}
      <header
        className={`
          fixed top-0 right-0 z-30
          bg-white text-gray-800 border-b border-gray-200 shadow-sm
          transition-all duration-300
          left-0 ${sidebarOpen ? "md:left-72" : "md:left-20"}
        `}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8 py-3">
          {/* Left: Hamburger + Logo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open menu"
              aria-controls="app-sidebar"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
              className={`md:hidden rounded-lg bg-white border border-gray-200 p-2 shadow-sm ${
                sidebarOpen ? "hidden" : ""
              }`}
            >
              <Menu size={20} />
            </button>

            <div
              className="flex items-center gap-2 cursor-pointer select-none"
              onClick={() => navigate("/dashboard")}
            >
              <BookifyLogo />
              <span className="hidden sm:inline font-semibold text-gray-800">
                Messages
              </span>
            </div>
          </div>

          {/* Right: Host action (desktop only) */}
          <button
            onClick={handleHostClick}
            className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all"
          >
            <Compass size={18} />
            {isHost ? "Switch to Hosting" : "Become a Host"}
          </button>
        </div>
      </header>

      {/* Spacer below fixed header */}
      <div className="h-[56px] md:h-[56px]" />

      {/* Main content */}
      <main
        className={`
          transition-[margin] duration-300 ml-0
          ${sidebarOpen ? "md:ml-72" : "md:ml-20"}
          px-4 sm:px-6 lg:px-12 py-6
        `}
      >
        <div className="max-w-7xl mx-auto">
          {/* Page header */}
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="text-blue-600" size={22} />
              <h1 className="text-3xl font-bold text-foreground">Your Messages</h1>
            </div>
            <p className="text-muted-foreground">
              Chat with hosts and keep track of your conversations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Conversations list */}
            <div className="md:col-span-5">
              <div className="glass rounded-3xl p-6 bg-white/70 border border-white/40 shadow-lg">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-semibold text-foreground">Conversations</h2>
                </div>
                <p className="text-muted-foreground mb-4">Select a chat to view messages.</p>

                <div className="space-y-2 max-h=[60vh] max-h-[60vh] overflow-y-auto pr-1">
                  {sortedConversations.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-6">
                      No conversations yet
                    </div>
                  ) : (
                    sortedConversations.map((uid) => {
                      const data = userMap[uid] || {
                        displayName: uid,
                        photoURL: null,
                      };
                      const active = selectedChatUid === uid;
                      return (
                        <button
                          key={uid}
                          onClick={() => setSelectedChatUid(uid)}
                          className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2 transition ${
                            active
                              ? "bg-blue-50 border border-blue-200"
                              : "bg-white/60 border border-gray-200 hover:bg-white"
                          }`}
                          title={data.displayName}
                        >
                          <Avatar
                            url={data.photoURL}
                            name={data.displayName}
                            size={40}
                          />
                          <div className="text-left min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {data.displayName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              Tap to open chat
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Chat area */}
            <div className="md:col-span-7">
              <div className="glass rounded-3xl bg-white/70 border border-white/40 shadow-lg overflow-hidden">
                {/* Messenger-style chat header */}
                {selectedChatUid ? (
                  <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-200 bg-white/80">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Mobile back */}
                      <button
                        className="md:hidden p-2 rounded-lg hover:bg-gray-100 shrink-0"
                        onClick={() => setSelectedChatUid(null)}
                        aria-label="Back"
                      >
                        <ArrowLeft size={18} />
                      </button>

                      <Avatar
                        url={userMap[selectedChatUid]?.photoURL}
                        name={
                          userMap[selectedChatUid]?.displayName ||
                          selectedChatUid
                        }
                        size={36}
                      />

                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {userMap[selectedChatUid]?.displayName ||
                            selectedChatUid}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Conversation
                        </div>
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
                    <div className="font-medium truncate">Select a chat</div>
                  </div>
                )}

                {selectedChatUid ? (
                  <>
                    <div
                      ref={scrollBoxRef}
                      className="h-[48vh] md:h-[54vh] overflow-y-auto p-4 bg-gray-50"
                    >
                      {messages.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                          Say hello 👋
                        </div>
                      ) : (
                        renderMessages(messages, currentUid)
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
                          disabled={sending}
                        />
                        <button
                          onClick={sendMessage}
                          disabled={!newMessage.trim() || sending}
                          className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 shadow disabled:opacity-50 disabled:pointer-events-none"
                          aria-label="Send"
                        >
                          <Send size={18} />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-[48vh] md:h-[60vh] flex items-center justify-center text-muted-foreground">
                    <p className="text-base">
                      Select a conversation to start chatting
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Hosting Policies (opened ONLY by clicking “Become a Host”) */}
      {showPoliciesModal && !isHost && (
        <HostPoliciesModal
          onClose={() => setShowPoliciesModal(false)}
          onAgree={handleAgreePolicies}
        />
      )}

      {/* Host Category Modal (opens after Agree) */}
      {showHostModal && (
        <HostCategModal
          onClose={() => setShowHostModal(false)}
          onSelectCategory={(category) => {
            setShowHostModal(false);
            if (category === "Homes") {
              navigate("/host-set-up", { state: { category } });
            } else if (category === "Experiences") {
              navigate("/host-set-up-2", { state: { category } });
            } else if (category === "Services") {
              navigate("/host-set-up-3", { state: { category } });
            }
          }}
        />
      )}

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
              This will remove your messages and hide this thread from your view.
              You can't undo this.
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
};

export default GuestMessagesPage;
