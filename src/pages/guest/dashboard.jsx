"use client";

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  ChevronRight,
  TrendingUp,
  MapPin,
  Star,
  Wallet,
  Compass
} from "lucide-react";
import Sidebar from "./components/sidebar.jsx";
import BookifyLogo from "../../components/bookify-logo.jsx";
import { useSidebar } from "../../context/SidebarContext";

// ✅ Host state (same as Explore)
import { auth, database } from "../../config/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import HostCategModal from "../../components/host-categ-modal.jsx";
import HostPoliciesModal from "./components/HostPoliciesModal.jsx";

export default function Dashboard() {
  const navigate = useNavigate();
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const user = auth.currentUser;
  const firstName = user?.displayName?.trim().split(/\s+/)[0];

  // ✅ Host state (mirrors Explore)
  const [isHost, setIsHost] = useState(localStorage.getItem("isHost") === "true");
  const [showHostModal, setShowHostModal] = useState(false);
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);
  const [policiesAccepted, setPoliciesAccepted] = useState(false);

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

    // keep a per-user remember flag in localStorage
    useEffect(() => {
      const u = auth.currentUser;
      const key = u?.uid ? `hostPoliciesAccepted:${u.uid}` : null;
      if (!key) return;
      setPoliciesAccepted(localStorage.getItem(key) === "true");
    }, [auth.currentUser?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenHostModal = () => setShowHostModal(true);
  const handleCloseHostModal = () => setShowHostModal(false);

    const handleOpenPoliciesModal = () => setShowPoliciesModal(true);
  const handleClosePoliciesModal = () => setShowPoliciesModal(false);

  const handleAgreePolicies = () => {
    const u = auth.currentUser;
    const key = u?.uid ? `hostPoliciesAccepted:${u.uid}` : null;

    if (key) localStorage.setItem(key, "true");
      setPoliciesAccepted(true);
      setShowPoliciesModal(false);
      // once accepted, immediately open category picker
      setShowHostModal(true);
  };


  // ✅ What the mobile-only button in Sidebar will call
  const handleHostClick = () => {
    if (isHost) {
      navigate("/hostpage");
    } else {
      // not a host: gate with policies
      if (!isHost) {
        setShowPoliciesModal(true);
      } else {
        handleOpenPoliciesModal();
      }
    }
  };

  const stats = [
    {
      label: "Total Bookings",
      value: "24",
      icon: TrendingUp,
      color: "from-blue-400 to-blue-600",
    },
    {
      label: "Nights Booked",
      value: "156",
      icon: TrendingUp,
      color: "from-cyan-400 to-blue-500",
    },
    {
      label: "Saved Places",
      value: "12",
      icon: Star,
      color: "from-blue-500 to-indigo-600",
    },
    {
      label: "Reviews Given",
      value: "18",
      icon: Star,
      color: "from-indigo-400 to-blue-600",
    },
  ];

  const recentBookings = [
    {
      id: 1,
      property: "Beachfront Villa",
      location: "Malibu, CA",
      dates: "Dec 15–20",
      price: "$2,400",
      image: "bg-gradient-to-br from-blue-300 to-cyan-400",
    },
    {
      id: 2,
      property: "Mountain Cabin",
      location: "Aspen, CO",
      dates: "Jan 5–12",
      price: "$1,800",
      image: "bg-gradient-to-br from-blue-400 to-indigo-500",
    },
    {
      id: 3,
      property: "City Apartment",
      location: "NYC, NY",
      dates: "Feb 1–7",
      price: "$3,200",
      image: "bg-gradient-to-br from-indigo-400 to-blue-600",
    },
  ];

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-hidden">
      {/* Sidebar (context-driven; mobile overlay handled inside Sidebar) */}
      <Sidebar onHostClick={handleHostClick} isHost={isHost} />

      {/* Main area — desktop push, mobile no push */}
      <main
        className={`
          flex-1 flex flex-col min-w-0 transition-[margin] duration-300
          ml-0 ${sidebarOpen ? "md:ml-72" : "md:ml-20"}
        `}
      >
        {/* 🧭 Navbar (matches Explore): fixed + desktop left offset, hamburger beside logo */}
        <header
          className={`
            fixed top-0 right-0 z-30
            bg-white text-gray-800 border-b border-gray-200 shadow-sm
            transition-all duration-300
            left-0 ${sidebarOpen ? "md:left-72" : "md:left-20"} /* offset only on desktop */
          `}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8 py-3">
            {/* Left: Hamburger (mobile) + Logo */}
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
              </div>
            </div>

            {/* (No host button in navbar) */}
            <button
              onClick={handleHostClick}
              className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all"
            >
              <Compass size={18} />
              {isHost ? "Switch to Hosting" : "Become a Host"}
            </button>
          </div>
        </header>

        {/* Spacer so content doesn’t slide under the fixed header */}
        <div className="h-[56px] md:h-[56px]" />

        {/* Dashboard Content */}
        <div className="px-6 md:px-28 py-8 space-y-8 overflow-y-auto">
          {/* Welcome Section */}
          <div className="glass rounded-4xl p-8 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-600/10 border-white/30 shadow-lg shadow-gray-300/40 hover:shadow-xl hover:shadow-gray-400/50 transition-all duration-300">
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Welcome back, {firstName}! 👋
            </h1>
            <p className="text-muted-foreground text-lg">
              Ready to explore your next adventure?
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, idx) => (
              <div
                key={idx}
                className="glass rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 group cursor-pointer hover:-translate-y-2"
              >
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}
                >
                  <stat.icon size={24} />
                </div>
                <p className="text-muted-foreground text-sm mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Recent Bookings */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Recent Bookings</h2>
              <button className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold">
                View All <ChevronRight size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recentBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="glass rounded-3xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 group cursor-pointer hover:-translate-y-2"
                >
                  <div className={`h-40 ${booking.image} relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  </div>
                  <div className="p-6">
                    <h3 className="font-bold text-lg text-foreground mb-2">
                      {booking.property}
                    </h3>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
                      <MapPin size={16} />
                      {booking.location}
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Dates</p>
                        <p className="font-semibold text-foreground">{booking.dates}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground mb-1">Total</p>
                        <p className="font-bold text-blue-600">{booking.price}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass rounded-3xl p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-foreground">Booking Trends</h3>
                <TrendingUp className="text-blue-600" size={24} />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">This Month</span>
                  <span className="font-bold text-foreground">8 bookings</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full"
                    style={{ width: "65%" }}
                  />
                </div>
              </div>
            </div>

            <div className="glass rounded-3xl p-6 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-foreground">Total Spent</h3>
                <Wallet className="text-indigo-600" size={24} />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Year to Date</span>
                  <span className="font-bold text-foreground text-xl">$18,400</span>
                </div>
                <p className="text-sm text-muted-foreground">+12% from last year</p>
              </div>
            </div>
          </div>
        </div>

         {/* Hosting Policies (first-time gate) */}
        {showPoliciesModal && (
          <HostPoliciesModal
            onClose={handleClosePoliciesModal}
            onAgree={handleAgreePolicies}
          />
        )}

        {/* Host Category Modal (opens after Agree, or if already accepted) */}
        {showHostModal && (
          <HostCategModal
            onClose={handleCloseHostModal}
            onSelectCategory={handleCloseHostModal}  // or pass nothing if your modal auto-navigates
          />
        )}
      </main>
    </div>
  );
}
