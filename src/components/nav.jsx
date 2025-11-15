import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, database } from "../config/firebase";
import LogoutConfirmationModal from "../pages/host/components/logout-confirmation-modal";

import {
  HomeIcon,
  HeartIcon,
  ChatBubbleLeftRightIcon,
  Bars3Icon,
  ArrowRightOnRectangleIcon,
  PlusCircleIcon,
  WrenchScrewdriverIcon,
  GlobeAmericasIcon,
  HomeModernIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

function Navigation({ onOpenHostModal, onCategorySelect }) {
  const [isHost, setIsHost] = useState(localStorage.getItem("isHost") === "true");
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const navigate = useNavigate();
  const categories = ["Homes", "Experiences", "Services"];
  const tabIcons = [
    <HomeModernIcon className="w-5 h-5" />,
    <GlobeAmericasIcon className="w-5 h-5" />,
    <WrenchScrewdriverIcon className="w-5 h-5" />,
  ];

  // 🔍 Check if user is a host
  useEffect(() => {
    const checkIfHost = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const hostsRef = collection(database, "hosts");
      const q = query(hostsRef, where("uid", "==", user.uid));
      const snapshot = await getDocs(q);
      const hostStatus = !snapshot.empty;
      setIsHost(hostStatus);
      localStorage.setItem("isHost", hostStatus ? "true" : "false");
    };
    checkIfHost();
  }, []);

  // 💡 Glass shadow effect on scroll
  useEffect(() => {
    const handleScroll = () => {
      const header = document.querySelector("header");
      if (!header) return;
      if (window.scrollY > 10)
        header.classList.add("shadow-lg", "glass-dark");
      else header.classList.remove("shadow-lg", "glass-dark");
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleHostClick = () => {
    if (isHost) navigate("/hostpage");
    else onOpenHostModal();
  };

  const handleCategoryClick = (index) => {
    setActiveTab(index);
    if (onCategorySelect) onCategorySelect(categories[index]);
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      localStorage.removeItem("isHost");
      navigate("/login");
    } catch (err) {
      console.error("Logout error:", err.message);
      alert("Failed to logout. Try again.");
    }
  };

  return (
    <>
      {/* 🟦 Glass Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-dark backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8 py-3">
          {/* Mobile Menu */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-xl hover:bg-white/10 md:hidden transition"
          >
            <Bars3Icon className="w-6 h-6 text-foreground" />
          </button>

          {/* Logo */}
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => navigate("/home")}
          >
            <HomeModernIcon className="w-7 h-7 text-blue-600 drop-shadow-sm" />
            <span className="text-lg md:text-xl font-bold text-foreground">
              Bookify
            </span>
          </div>

          {/* Desktop Categories */}
          <nav className="hidden md:flex space-x-6">
            {categories.map((cat, index) => (
              <button
                key={cat}
                onClick={() => handleCategoryClick(index)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full font-medium text-sm transition-all ${
                  activeTab === index
                    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/30"
                    : "text-muted-foreground hover:text-blue-600 hover:bg-white/10"
                }`}
              >
                {tabIcons[index]}
                {cat}
              </button>
            ))}
          </nav>

          {/* Host Button */}
          <div className="hidden md:flex">
            <button
              onClick={handleHostClick}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md shadow-blue-500/30 transition-all"
            >
              <HomeModernIcon className="w-5 h-5" />
              {isHost ? "Switch to Hosting" : "Become a Host"}
            </button>
          </div>
        </div>
      </header>

      {/* 🟦 Drawer (Mobile Sidebar) */}
      <div
        className={`fixed inset-0 z-50 transition ${
          drawerOpen ? "visible bg-black/50" : "invisible"
        }`}
        onClick={() => setDrawerOpen(false)}
      >
        <aside
          onClick={(e) => e.stopPropagation()}
          className={`fixed top-0 left-0 w-72 h-full glass-dark border-r border-white/10 shadow-xl transform transition-transform duration-300 ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Drawer Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-5 py-4 text-lg font-semibold flex items-center gap-2 shadow">
            <HomeModernIcon className="w-6 h-6" />
            Bookify
          </div>

          {/* Profile Info */}
          <div className="flex flex-col items-center py-6 border-b border-white/10">
            <img
              src={auth.currentUser?.photoURL || "/default-profile.png"}
              alt="avatar"
              className="w-20 h-20 rounded-full object-cover shadow-lg"
            />
            <p className="mt-3 font-semibold text-foreground">
              {auth.currentUser?.displayName || "Guest User"}
            </p>
            <p className="text-sm text-muted-foreground">
              {auth.currentUser?.email || "guest@example.com"}
            </p>
            <button
              onClick={() => navigate("/profile")}
              className="mt-3 text-sm text-blue-600 border border-blue-400/70 px-4 py-1.5 rounded-full hover:bg-blue-50/30 transition"
            >
              View Profile
            </button>
          </div>

          {/* Drawer Links */}
          <nav className="flex flex-col py-4 space-y-1">
            <button
              onClick={() => navigate("/home")}
              className="flex items-center gap-3 px-6 py-3 text-foreground hover:bg-blue-50/20 hover:text-blue-600 transition rounded-lg"
            >
              <HomeIcon className="w-5 h-5" /> Home
            </button>
            <button
              onClick={() => navigate("/favorites")}
              className="flex items-center gap-3 px-6 py-3 text-foreground hover:bg-blue-50/20 hover:text-blue-600 transition rounded-lg"
            >
              <HeartIcon className="w-5 h-5" /> Favorites
            </button>
            <button
              onClick={() => navigate("/messages")}
              className="flex items-center gap-3 px-6 py-3 text-foreground hover:bg-blue-50/20 hover:text-blue-600 transition rounded-lg"
            >
              <ChatBubbleLeftRightIcon className="w-5 h-5" /> Messages
            </button>
            <button
              onClick={() => {
                setIsLogoutModalOpen(true);
                setDrawerOpen(false);
              }}
              className="flex items-center gap-3 px-6 py-3 text-foreground hover:bg-red-50/20 hover:text-red-500 transition rounded-lg"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" /> Logout
            </button>
          </nav>
        </aside>
      </div>

      {/* 🟦 Bottom Nav (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 glass-dark backdrop-blur-md border-t border-white/10 md:hidden flex justify-around items-center py-2 z-50">
        {categories.map((cat, index) => (
          <button
            key={cat}
            onClick={() => handleCategoryClick(index)}
            className={`flex flex-col items-center text-xs transition-all ${
              activeTab === index ? "text-blue-600 scale-110" : "text-muted-foreground hover:text-blue-600"
            }`}
          >
            {tabIcons[index]}
            <span>{cat}</span>
          </button>
        ))}
      </nav>

      {/* Logout Modal */}
      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onLogout={handleLogout}
      />
    </>
  );
}

export default Navigation;
