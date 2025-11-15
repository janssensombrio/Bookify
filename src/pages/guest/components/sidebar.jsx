// src/pages/.../components/sidebar.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  Home,
  Compass,
  Calendar,
  Heart,
  Wallet,
  LogOut,
  User,
  MessageSquareText,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";
import { auth } from "../../../config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { database } from "../../../config/firebase";
import { useSidebar } from "../../../context/SidebarContext";
import LogoutConfirmationModal from "../../host/components/logout-confirmation-modal";

const tsToMs = (ts) => {
  if (!ts) return 0;
  const sec = ts.seconds ?? 0;
  const ns = ts.nanoseconds ?? 0;
  return sec * 1000 + Math.floor(ns / 1e6);
};

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // Auth
  const [currentUid, setCurrentUid] = useState(null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUid(u?.uid || null));
    return () => unsub();
  }, []);

  const handleNavClick = (path) => {
    navigate(path);
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
      navigate("/");
    } catch (err) {
      console.error("Logout error:", err.message);
      alert("Failed to logout. Try again.");
    }
  };

  const onMessagesPage = location.pathname.startsWith("/guest-messages");

  // ---------------- Unread indicator data ----------------
  const [lastSeenAtMs, setLastSeenAtMs] = useState(0);
  const [lastSeenLoaded, setLastSeenLoaded] = useState(false);

  const [latestInboundMs, setLatestInboundMs] = useState(0);
  const [inboundLoaded, setInboundLoaded] = useState(false);

  // Watch user's lastSeenAt from users/{uid}.messagesLastSeenAt
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

  // Watch inbound messages (receiverId == uid) and compute latest inbound ms
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

  // ---------------- Optimistic "seen" grace window (anti-flicker) ----------------
  const optimisticSeenRef = useRef(0);                  // max seen ms we trust locally
  const [optimisticUntil, setOptimisticUntil] = useState(0); // epoch ms until trust ends
  const prevOnMessagesRef = useRef(false);

  // Listen for optimistic pings from Messages page
  useEffect(() => {
    const handler = (e) => {
      const ms = e?.detail?.ms || Date.now();
      optimisticSeenRef.current = Math.max(optimisticSeenRef.current, ms);
      setOptimisticUntil(Date.now() + 2500); // 2.5s grace
    };
    window.addEventListener("messages:optimistic-seen", handler);
    return () => window.removeEventListener("messages:optimistic-seen", handler);
  }, []);

  // When leaving the Messages page, begin short optimistic window
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

  // Clear the optimistic window after TTL
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

  // ✅ Profile is now a normal nav item
  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: Compass, label: "Explore", path: "/explore" },
    { icon: Calendar, label: "Bookings", path: "/bookings" },
    { icon: MessageSquareText, label: "Messages", path: "/guest-messages" },
    { icon: Heart, label: "Favorites", path: "/favorites" },
    { icon: Sparkles, label: "Points", path: "/points" },
    { icon: User, label: "Profile", path: "/profile" }, // ← added
    { icon: Wallet, label: "E-Wallet", path: "/wallet" },
  ];

  return (
    <>
      <aside
        id="app-sidebar"
        aria-label="Sidebar"
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
        {/* Top bar with toggle (works for mobile + desktop) */}
        <div className={`flex p-3 border-b border-gray-200 ${sidebarOpen ? "justify-end" : "justify-center"}`}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
          >
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;

            const iconNode = (
              <div className="relative inline-flex">
                <item.icon size={20} />
                {/* Red dot for Messages only */}
                {item.path === "/guest-messages" && hasUnread && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 inline-block w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white"
                  />
                )}
              </div>
            );

            return (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30"
                    : "text-foreground hover:bg-gray-100"
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

        {/* Logout */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => setIsLogoutModalOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-foreground hover:bg-gray-100 transition-all duration-200"
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

export default Sidebar;
