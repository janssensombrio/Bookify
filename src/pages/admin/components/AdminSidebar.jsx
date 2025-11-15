// src/pages/admin/components/AdminSidebar.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  Home,
  Users,
  UserCheck,
  Building2,
  Calendar,
  Wallet,
  LogOut,
  LayoutDashboard,
} from "lucide-react";

import { auth } from "../../../config/firebase";
import { useSidebar } from "../../../context/SidebarContext";
import LogoutConfirmationModal from "../../host/components/logout-confirmation-modal";

const AdminSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarOpen, setSidebarOpen } = useSidebar();

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

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
      console.error("Logout error:", err?.message);
      alert("Failed to logout. Try again.");
    }
  };

  // Admin nav items
  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/admin-dashboard", activeMatch: /^\/admin-dashboard/ },
    { icon: Users,     label: "Hosts",     path: "/admin/hosts",     activeMatch: /^\/admin\/hosts/ },
    { icon: UserCheck, label: "Guests",    path: "/admin/guests",    activeMatch: /^\/admin\/guests/ },
    { icon: Building2, label: "Listings",  path: "/admin/listings",  activeMatch: /^\/admin\/listings/ },
    { icon: Calendar,  label: "Bookings",  path: "/admin/bookings",  activeMatch: /^\/admin\/bookings/ },
    { icon: Wallet,    label: "E-Wallet",  path: "/admin/wallet",    activeMatch: /^\/admin\/wallet/ },
  ];

  return (
    <>
      <aside
        id="admin-sidebar"
        aria-label="Admin Sidebar"
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
        <div className={`flex p-3 border-b border-gray-200 ${sidebarOpen ? "justify-end" : "justify-center"}`}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={sidebarOpen}
            aria-controls="admin-sidebar"
          >
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          {navItems.map((item) => {
            const isActive = item.activeMatch.test(location.pathname);
            return (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30"
                    : "text-slate-900 hover:bg-gray-100"
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
        <div className="p-4 border-t border-gray-200">
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

export default AdminSidebar;
