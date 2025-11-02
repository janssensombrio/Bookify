import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  CalendarDays,
  MessageSquare,
  List as ListIcon,
  Calendar as CalendarIcon,
  Compass,
} from "lucide-react";
import Sidebar from "../pages/guest/components/sidebar.jsx"; 
import BookifyLogo from "../components/bookify-logo.jsx";
import { useSidebar } from "../context/SidebarContext";
import LogoutConfirmationModal from "../pages/host/components/logout-confirmation-modal";
import { auth } from "../config/firebase";

function HostNavigation({ setActivePage }) {
  const navigate = useNavigate();
  const { sidebarOpen, setSidebarOpen } = useSidebar();

  const pages = ["bookings", "messages", "listings", "calendar"];
  const pageLabels = ["Bookings", "Messages", "Listings", "Calendar"];
  const tabIcons = [CalendarDays, MessageSquare, ListIcon, CalendarIcon];

  const [activeTab, setActiveTab] = useState(0);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

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

  return (
    <>
      {/* Sidebar (shared responsive behavior) */}
      <Sidebar />

      {/* Top Navbar — matches Dashboard/Explore styling */}
      <header
        className={`
          fixed top-0 right-0 z-30
          bg-white text-gray-800 border-b border-gray-200 shadow-sm
          transition-all duration-300
          left-0 ${sidebarOpen ? "md:left-72" : "md:left-20"} /* desktop offset for sidebar */
        `}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8 py-3">
          {/* Left: hamburger (mobile) + logo/name */}
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
                  <Icon size={18} />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Right actions: Switch to Travelling (desktop only) */}
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

      {/* Spacer so the page content below doesn't sit under the fixed header */}
      <div className="h-[56px] md:h-[56px]" />

      {/* Mobile Bottom Navigation — keeps original quick switching functionality */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30">
        <div className="mx-4 mb-4 rounded-2xl bg-white/95 border border-gray-200 shadow-lg">
          <nav className="grid grid-cols-4">
            {pageLabels.map((label, index) => {
              const Icon = tabIcons[index];
              const active = activeTab === index;
              return (
                <button
                  key={label}
                  onClick={() => handlePageClick(index)}
                  className={`flex flex-col items-center justify-center gap-1 py-2 text-xs font-medium ${
                    active ? "text-blue-600" : "text-gray-600"
                  }`}
                  aria-label={label}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Logout Modal (unchanged behavior) */}
      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onLogout={handleLogout}
      />
    </>
  );
}

export default HostNavigation;
