import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  Home,
  Compass,
  Calendar,
  Heart,
  Wallet,
  Settings,
  LogOut,
  User,
  MessageSquareText, // ← added
} from "lucide-react";
import { auth } from "../../../config/firebase";
import { useSidebar } from "../../../context/SidebarContext";
import LogoutConfirmationModal from "../../host/components/logout-confirmation-modal";

const Sidebar = ({ onHostClick, isHost: isHostProp } = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const user = auth.currentUser;

  // Prefer prop (keeps in sync with Explore), otherwise read localStorage
  const isHost =
    typeof isHostProp === "boolean"
      ? isHostProp
      : (typeof window !== "undefined" &&
          localStorage.getItem("isHost") === "true");

  // ✅ Detect if we’re in the host area (e.g., /hostpage or /host/*)
  const isOnHostArea =
    location.pathname.toLowerCase() === "/hostpage" ||
    location.pathname.toLowerCase().startsWith("/host");

  // ✅ One label for all cases
  const actionLabel = isOnHostArea
    ? "Switch to Travelling"
    : isHost
    ? "Switch to Hosting"
    : "Become a Host";

  const navItems = [
    { icon: Home, label: "Dashboard", path: "/dashboard" },
    { icon: Compass, label: "Explore", path: "/explore" },
    { icon: Calendar, label: "Bookings", path: "/bookings" },
    { icon: MessageSquareText, label: "Messages", path: "/guest-messages" }, // ← new shortcut
    { icon: Heart, label: "Favorites", path: "/favorites" },
    { icon: Wallet, label: "E-Wallet", path: "/wallet" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  const handleNavClick = (path) => {
    navigate(path);
    setSidebarOpen(false); // close drawer on mobile
  };

  // Prevent background scroll when sidebar is open on mobile
  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 767.98px)").matches;
    if (sidebarOpen && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  // ✅ Host/Travel action handler
  const triggerHostAction = () => {
    if (isOnHostArea) {
      // On host pages → go to traveller mode
      navigate("/explore");
    } else if (onHostClick) {
      // Use parent-provided logic (modal/navigate)
      onHostClick();
    } else {
      // Fallback
      if (isHost) navigate("/hostpage");
      else navigate("/host-setup");
    }
    setSidebarOpen(false);
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

          /* Background + borders by breakpoint */
          bg-white md:bg-transparent md:glass-dark
          border-r border-gray-200 md:border-white/10
          shadow-lg md:shadow-none

          /* Mobile: off-canvas; Desktop: always mounted */
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0

          /* Desktop width toggle */
          ${sidebarOpen ? "md:w-72" : "md:w-20"}
        `}
      >
        {/* Mobile close button */}
        <div className="flex justify-end p-3 border-b border-white/10 md:hidden">
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <X size={22} />
          </button>
        </div>

        {/* Desktop toggle button */}
        <div className="hidden md:flex justify-end p-3 border-b border-white/10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
          >
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Profile (only when expanded) */}
        {sidebarOpen && (
          <div className="p-5 border-b border-white/10">
            <div className="glass rounded-3xl p-4 mb-4 flex flex-col items-center text-center">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="User avatar"
                  className="w-16 h-16 rounded-full object-cover shadow-md mb-3"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center mb-3 shadow-md">
                  <User className="text-white w-7 h-7" />
                </div>
              )}

              <h3 className="font-semibold text-foreground">
                {user?.displayName || "Guest User"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {user?.email || "guest@example.com"}
              </p>

              <button
                onClick={() => navigate("/profile")}
                className="w-full mt-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-2xl h-9 transition"
              >
                View Profile
              </button>

              {/* 👉 Mobile-only action under View Profile */}
              <button
                onClick={triggerHostAction}
                className="w-full mt-3 md:hidden bg-blue-600 hover:bg-blue-700 text-white rounded-2xl h-9 transition"
                aria-label={actionLabel}
              >
                {actionLabel}
              </button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30"
                    : "text-foreground hover:bg-white/10"
                }`}
                title={item.label}
                aria-current={isActive ? "page" : undefined}
              >
                <item.icon size={20} />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => setIsLogoutModalOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-foreground hover:bg-white/10 transition-all duration-200"
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

      {/* Logout Modal */}
      <LogoutConfirmationModal
        open={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onLogout={handleLogout}
      />
    </>
  );
};

export default Sidebar;
