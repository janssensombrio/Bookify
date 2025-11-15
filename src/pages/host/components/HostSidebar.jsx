// src/pages/host/components/HostSidebar.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Menu,
  X,
  CalendarDays,
  MessageSquareText,
  List,
  Calendar,
  User,
  LogOut,
  Compass,
  Wallet,
} from "lucide-react";

import { auth } from "../../../config/firebase";
import { useSidebar } from "../../../context/SidebarContext";
import LogoutConfirmationModal from "./logout-confirmation-modal";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { database } from "../../../config/firebase";

const tsToMs = (ts) => {
  if (!ts) return 0;
  const sec = ts.seconds ?? 0;
  const ns = ts.nanoseconds ?? 0;
  return sec * 1000 + Math.floor(ns / 1e6);
};

const HostSidebar = ({ setActivePage, activePage, navigate }) => {
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // Auth
  const [currentUid, setCurrentUid] = useState(null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUid(u?.uid || null));
    return () => unsub();
  }, []);

  // Navigation items
  const navItems = [
    { icon: CalendarDays, label: "Bookings", page: "bookings" },
    { icon: MessageSquareText, label: "Messages", page: "messages" },
    { icon: List, label: "Listings", page: "listings" },
    { icon: Calendar, label: "Calendar", page: "calendar" },
    { icon: Wallet, label: "Wallet", page: "wallet" },
    { icon: User, label: "Profile", page: "profile" },
  ];

  const messagesIndex = navItems.findIndex((item) => item.page === "messages");

  const handleNavClick = (page) => {
    if (setActivePage) {
      setActivePage(page);
    }
    // close drawer on mobile
    const isMobile = window.matchMedia("(max-width: 767.98px)").matches;
    if (isMobile) setSidebarOpen(false);
  };

  // Prevent background scroll when sidebar is open on mobile
  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 767.98px)").matches;
    document.body.style.overflow = sidebarOpen && isMobile ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      localStorage.removeItem("isHost");
      if (navigate) {
        navigate("/");
      } else {
        window.location.href = "/";
      }
    } catch (err) {
      console.error("Logout error:", err?.message);
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

  // ---------- Anti-flicker optimistic "seen" window ----------
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

  const onMessagesPage = activePage === "messages";

  // When leaving the Messages page, start a short optimistic window
  useEffect(() => {
    const wasOn = prevOnMessagesRef.current;
    if (wasOn && !onMessagesPage) {
      optimisticSeenRef.current = Math.max(
        optimisticSeenRef.current,
        latestInboundMs || Date.now()
      );
      setOptimisticUntil(Date.now() + 2500);
    }
    prevOnMessagesRef.current = onMessagesPage;
  }, [onMessagesPage, latestInboundMs]);

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

  // Stable unread state to prevent flickering
  const [hasUnread, setHasUnread] = useState(false);

  // Calculate unread status with debouncing to prevent flickering
  useEffect(() => {
    // Don't show if user is not logged in
    if (!currentUid) {
      setHasUnread(false);
      return;
    }
    
    // Never show while viewing Messages page
    if (onMessagesPage) {
      setHasUnread(false);
      return;
    }
    
    // Wait for both data sources to be loaded before making a decision
    if (!inboundLoaded || !lastSeenLoaded) {
      // Don't change state while loading to prevent flickering
      return;
    }
    
    // If no inbound messages exist, no unread
    if (latestInboundMs === 0) {
      setHasUnread(false);
      return;
    }
    
    // Only show if latest inbound message is definitively newer than last seen
    // Add a small threshold (100ms) to prevent flickering from timestamp precision issues
    const threshold = 100;
    const shouldShowUnread = latestInboundMs > (effectiveLastSeenMs + threshold);
    
    // Use a small timeout to debounce rapid state changes
    const timeoutId = setTimeout(() => {
      setHasUnread(shouldShowUnread);
    }, 50); // 50ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [
    currentUid,
    onMessagesPage,
    inboundLoaded,
    lastSeenLoaded,
    latestInboundMs,
    effectiveLastSeenMs,
  ]);

  return (
    <>
      <aside
        id="host-sidebar"
        aria-label="Host Sidebar"
        className={`
          fixed inset-y-0 left-0 z-50
          flex flex-col overflow-hidden
          transition-[transform,width] duration-300 will-change-transform
          w-72
          bg-white md:bg-white
          border-r border-gray-200
          shadow-lg md:shadow-none
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
          ${sidebarOpen ? "md:w-72" : "md:w-20"}
        `}
      >
        {/* Top bar with toggle */}
        <div className="flex justify-end p-3 border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={sidebarOpen}
            aria-controls="host-sidebar"
          >
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          {navItems.map((item) => {
            const isActive = activePage === item.page;
            const isMessages = item.page === "messages";

            const iconNode = (
              <div className="relative inline-flex">
                <item.icon size={20} />
                {/* Red dot for Messages only */}
                {isMessages && hasUnread && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 inline-block w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white"
                  />
                )}
              </div>
            );

            return (
              <button
                key={item.page}
                onClick={() => handleNavClick(item.page)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30"
                    : "text-slate-900 hover:bg-gray-100"
                }`}
                title={item.label}
                aria-current={isActive ? "page" : undefined}
              >
                {iconNode}
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          {/* Switch to Travelling */}
          {navigate && (
            <button
              onClick={() => navigate("/explore")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-900 hover:bg-gray-100 transition-all duration-200"
              title="Switch to Travelling"
            >
              <Compass size={20} />
              {sidebarOpen && <span className="font-medium">Switch to Travelling</span>}
            </button>
          )}
          
          {/* Logout */}
          <button
            onClick={() => setIsLogoutModalOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-900 hover:bg-gray-100 transition-all duration-200"
          >
            <LogOut size={20} />
            {sidebarOpen && <span className="font-medium">Log Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          aria-hidden="true"
        />
      )}

      <LogoutConfirmationModal
        open={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onLogout={handleLogout}
      />
    </>
  );
};

export default HostSidebar;

