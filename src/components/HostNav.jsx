import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  MessageSquare,
  List as ListIcon,
  Calendar as CalendarIcon,
  Compass,
  User, // ✅ NEW
} from "lucide-react";
import BookifyLogo from "../components/bookify-logo.jsx";
import LogoutConfirmationModal from "../pages/host/components/logout-confirmation-modal";
import { auth } from "../config/firebase";

import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { database } from "../config/firebase";

function tsToMs(ts) {
  if (!ts) return 0;
  const sec = ts.seconds ?? 0;
  const ns = ts.nanoseconds ?? 0;
  return sec * 1000 + Math.floor(ns / 1e6);
}

function HostNavigation({ setActivePage, activePage }) { // ⬅️ accepts activePage (optional)
  const navigate = useNavigate();

  // ✅ Add "profile" here
  const pages = ["bookings", "messages", "listings", "calendar", "profile"];
  const pageLabels = ["Bookings", "Messages", "Listings", "Calendar", "Profile"];
  const tabIcons = [CalendarDays, MessageSquare, ListIcon, CalendarIcon, User];
  const messagesIndex = pages.indexOf("messages");

  // Highlight the right tab even if HostPage sets it initially
  const [activeTab, setActiveTab] = useState(() => {
    const initialIdx = activePage ? pages.indexOf(activePage) : 0;
    return initialIdx >= 0 ? initialIdx : 0;
  });

  useEffect(() => {
    if (!activePage) return;
    const idx = pages.indexOf(activePage);
    if (idx >= 0 && idx !== activeTab) setActiveTab(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage]);

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // ---------- Auth ----------
  const [currentUid, setCurrentUid] = useState(null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUid(u?.uid || null));
    return () => unsub();
  }, []);

  const handlePageClick = (index) => {
    setActiveTab(index);
    setActivePage(pages[index]);
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      localStorage.removeItem("isHost");
      navigate("/");
    } catch (err) {
      console.error("Logout error:", err.message);
      alert("Failed to logout. Try again.");
    }
  };

  // ---------- Unread indicator sources ----------
  const [lastSeenAtMs, setLastSeenAtMs] = useState(0);
  const [lastSeenLoaded, setLastSeenLoaded] = useState(false);

  const [latestInboundMs, setLatestInboundMs] = useState(0);
  const [inboundLoaded, setInboundLoaded] = useState(false);

  // Watch users/{uid}.messagesLastSeenAt
  useEffect(() => {
    setLastSeenLoaded(false);
    setLastSeenAtMs(0);
    if (!currentUid) {
      setLastSeenLoaded(true);
      return;
    }
    const userRef = doc(database, "users", currentUid);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        const data = snap.data() || {};
        setLastSeenAtMs(tsToMs(data.messagesLastSeenAt));
        setLastSeenLoaded(true);
      },
      (err) => {
        console.error("lastSeen snapshot error:", err);
        setLastSeenLoaded(true);
      }
    );
    return () => unsub();
  }, [currentUid]);

  // Watch inbound messages (receiverId == uid) → compute latest inbound ms
  useEffect(() => {
    setInboundLoaded(false);
    setLatestInboundMs(0);
    if (!currentUid) {
      setInboundLoaded(true);
      return;
    }
    const col = collection(database, "messages");
    const q = query(col, where("receiverId", "==", currentUid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        let maxMs = 0;
        snap.forEach((d) => {
          const m = d.data();
          const ms = tsToMs(m.timestamp);
          if (ms > maxMs) maxMs = ms;
        });
        setLatestInboundMs(maxMs);
        setInboundLoaded(true);
      },
      (err) => {
        console.error("inbound snapshot error:", err);
        setInboundLoaded(true);
      }
    );
    return () => unsub();
  }, [currentUid]);

  // ---------- Anti-flicker optimistic “seen” window ----------
  const optimisticSeenRef = useRef(0);
  const [optimisticUntil, setOptimisticUntil] = useState(0);
  const prevOnMessagesRef = useRef(false);

  // Listen to optimistic pings from MessagesPage
  useEffect(() => {
    const handler = (e) => {
      const ms = e?.detail?.ms || Date.now();
      optimisticSeenRef.current = Math.max(optimisticSeenRef.current, ms);
      setOptimisticUntil(Date.now() + 2500); // 2.5s grace window
    };
    window.addEventListener("messages:optimistic-seen", handler);
    return () => window.removeEventListener("messages:optimistic-seen", handler);
  }, []);

  const onMessagesTab = activeTab === messagesIndex;

  // When leaving the Messages tab, start a short optimistic window
  useEffect(() => {
    const wasOn = prevOnMessagesRef.current;
    if (wasOn && !onMessagesTab) {
      optimisticSeenRef.current = Math.max(
        optimisticSeenRef.current,
        latestInboundMs || Date.now()
      );
      setOptimisticUntil(Date.now() + 2500);
    }
    prevOnMessagesRef.current = onMessagesTab;
  }, [onMessagesTab, latestInboundMs]);

  // Clear optimistic window after TTL
  useEffect(() => {
    if (!optimisticUntil) return;
    const delay = Math.max(0, optimisticUntil - Date.now());
    const t = setTimeout(() => setOptimisticUntil(0), delay + 20);
    return () => clearTimeout(t);
  }, [optimisticUntil]);

  const activeOptimistic =
    optimisticUntil && Date.now() < optimisticUntil
      ? optimisticSeenRef.current
      : 0;

  const effectiveLastSeenMs = Math.max(lastSeenAtMs || 0, activeOptimistic || 0);

  const hasUnread = useMemo(() => {
    if (!currentUid) return false;
    if (onMessagesTab) return false; // never show while viewing Messages
    if (!inboundLoaded || !lastSeenLoaded) return false; // wait for data
    if (latestInboundMs === 0) return false; // no inbound messages ever
    return latestInboundMs > effectiveLastSeenMs;
  }, [
    currentUid,
    onMessagesTab,
    inboundLoaded,
    lastSeenLoaded,
    latestInboundMs,
    effectiveLastSeenMs,
  ]);

  return (
    <>
      {/* Top Navbar */}
      <header
        className={`
          fixed top-0 right-0 z-30
          bg-white text-gray-800 border-b border-gray-200 shadow-sm
          transition-all duration-300
          left-0
        `}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8 py-3">
          {/* Left: logo/name */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 cursor-pointer select-none"
              onClick={() => navigate("/hostpage")}
            >
              <BookifyLogo />
              <span className="hidden sm:inline font-semibold text-gray-800">
                Host Dashboard
              </span>
            </div>
          </div>

          {/* Center tabs (desktop only) */}
          <nav className="hidden md:flex items-center gap-2">
            {pageLabels.map((label, index) => {
              const Icon = tabIcons[index];
              const active = activeTab === index;
              const isMessages = index === messagesIndex;

              const iconNode = (
                <span className="relative inline-flex">
                  <Icon size={18} />
                  {isMessages && hasUnread && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1 -right-1 inline-block w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white"
                    />
                  )}
                </span>
              );

              return (
                <button
                  key={label}
                  onClick={() => handlePageClick(index)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    active
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                      : "text-gray-700 hover:text-blue-600 hover:bg-blue-50"
                  }`}
                >
                  {iconNode}
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/explore")}
              className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all"
              title="Switch to Travelling"
            >
              <Compass size={18} />
              Switch to Travelling
            </button>
          </div>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-[56px] md:h-[56px]" />

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30">
        <div className="mx-4 mb-4 rounded-2xl bg-white/95 border border-gray-200 shadow-lg">
          {/* grid-cols-5 to include Profile */}
          <nav className="grid grid-cols-5">
            {pageLabels.map((label, index) => {
              const Icon = tabIcons[index];
              const active = activeTab === index;
              const isMessages = index === messagesIndex;

              const iconNode = (
                <span className="relative inline-flex">
                  <Icon size={20} />
                  {isMessages && hasUnread && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1 -right-1 inline-block w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white"
                    />
                  )}
                </span>
              );

              return (
                <button
                  key={label}
                  onClick={() => handlePageClick(index)}
                  className={`flex flex-col items-center justify-center gap-1 py-2 text-xs font-medium ${
                    active ? "text-blue-600" : "text-gray-600"
                  }`}
                  aria-label={label}
                >
                  {iconNode}
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Logout Modal */}
      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onLogout={handleLogout}
      />
    </>
  );
}

export default HostNavigation;
