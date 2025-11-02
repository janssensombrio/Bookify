import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { auth, database } from "../../config/firebase";

import Sidebar from "./components/sidebar.jsx";
import { useSidebar } from "../../context/SidebarContext";
import BookifyLogo from "../../components/bookify-logo.jsx";

import HostCategModal from "../../components/host-categ-modal.jsx";
import HostPoliciesModal from "./components/HostPoliciesModal.jsx";
import HomeDetailsModal from "../../components/HomeDetailsModal";
import ExperienceDetailsModal from "../../components/ExperienceDetailsModal";
import ServiceDetailsModal from "../../components/ServiceDetailsModal";

import { Menu, Heart, Compass } from "lucide-react";

const FavoritesPage = () => {
  const navigate = useNavigate();
  const { sidebarOpen, setSidebarOpen } = useSidebar();

  const [selectedListingId, setSelectedListingId] = useState(null);
  const [favorites, setFavorites] = useState([]); // listingId[]
  const [favoriteListings, setFavoriteListings] = useState([]); // full listing docs (published only)
  const [loading, setLoading] = useState(true);

  // Host state (no local remember of policies)
  const [isHost, setIsHost] = useState(
    typeof window !== "undefined" && localStorage.getItem("isHost") === "true"
  );
  const [showHostModal, setShowHostModal] = useState(false);
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);

  // Check if user is a host (mirrors Explore/Dashboard)
  useEffect(() => {
    const checkIfHost = async () => {
      const u = auth.currentUser;
      if (!u) return;
      try {
        const hostsRef = collection(database, "hosts");
        const qh = query(hostsRef, where("uid", "==", u.uid));
        const snapshot = await getDocs(qh);
        const hostStatus = !snapshot.empty;
        setIsHost(hostStatus);
        localStorage.setItem("isHost", hostStatus ? "true" : "false");
      } catch (e) {
        console.error("Host check failed:", e);
      }
    };
    checkIfHost();
  }, []);

  // Load user's favorites + listing docs (published only)
  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        if (!auth.currentUser) {
          setLoading(false);
          return;
        }
        const favRef = collection(database, "favorites");
        const qFav = query(favRef, where("userId", "==", auth.currentUser.uid));
        const favSnapshot = await getDocs(qFav);
        const favData = favSnapshot.docs.map((d) => d.data());
        const favIds = favData.map((f) => f.listingId);
        setFavorites(favIds);

        const docsPromises = favData.map(async (f) => {
          const listingDoc = await getDoc(doc(database, "listings", f.listingId));
          if (listingDoc.exists()) {
            const listing = { id: f.listingId, ...listingDoc.data() };
            return listing.status === "published" ? listing : null;
          }
          return null;
        });

        const listings = (await Promise.all(docsPromises)).filter(Boolean);
        setFavoriteListings(listings);
      } catch (err) {
        console.error("Error fetching favorites:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, []);

  const toggleFavorite = async (listingId) => {
    if (!auth.currentUser) return;
    const favRef = doc(database, "favorites", `${auth.currentUser.uid}_${listingId}`);

    if (favorites.includes(listingId)) {
      await deleteDoc(favRef);
      setFavorites((prev) => prev.filter((id) => id !== listingId));
      setFavoriteListings((prev) => prev.filter((it) => it.id !== listingId));
    } else {
      await setDoc(favRef, {
        uid: auth.currentUser.uid,
        userId: auth.currentUser.uid,
        listingId,
        createdAt: new Date(),
      });
      setFavorites((prev) => [...prev, listingId]);
    }
  };

  // 🔔 Always show policies for non-hosts; after Agree → open category picker
  const handleHostClick = () => {
    if (isHost) {
      navigate("/hostpage");
    } else {
      setShowPoliciesModal(true);
    }
  };

  const handleCloseHostModal = () => setShowHostModal(false);
  const handleClosePoliciesModal = () => setShowPoliciesModal(false);
  const handleAgreePolicies = () => {
    setShowPoliciesModal(false);
    setShowHostModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-hidden">
      {/* Sidebar with shared responsive behavior */}
      <Sidebar onHostClick={handleHostClick} isHost={isHost} />

      {/* Top Navbar (matches Explore/Dashboard) */}
      <header
        className={`
          fixed top-0 right-0 z-30
          bg-white text-gray-800 border-b border-gray-200 shadow-sm
          transition-all duration-300
          left-0 ${sidebarOpen ? "md:left-72" : "md:left-20"}
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
              <span className="hidden sm:inline font-semibold text-gray-800">
                Favorites
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

      {/* Main area with desktop push; mobile no push */}
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
            <h1 className="text-3xl font-bold text-foreground">Your Favorites</h1>
            <p className="text-muted-foreground">
              All your saved Homes, Experiences, and Services in one place.
            </p>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-3xl bg-white/70 border border-white/40 shadow animate-pulse overflow-hidden"
                >
                  <div className="h-40 bg-gray-200/70" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-gray-200/70 rounded" />
                    <div className="h-3 bg-gray-200/70 rounded w-3/4" />
                    <div className="h-4 bg-gray-200/70 rounded w-1/3 mt-4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Content */}
          {!loading && (
            <>
              {favoriteListings.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                  {favoriteListings.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedListingId(item.id)}
                      className="group text-left rounded-3xl bg-white/80 border border-white/40 shadow-lg hover:shadow-xl transition overflow-hidden"
                    >
                      <div className="relative">
                        <img
                          src={item.photos?.[0] || item.photos?.[1]}
                          alt={item.title}
                          className="w-full h-44 object-cover"
                        />
                        {/* Heart toggle */}
                        <div className="absolute top-3 right-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(item.id);
                            }}
                            className={`rounded-full p-2 shadow border ${
                              favorites.includes(item.id)
                                ? "bg-white text-red-500 border-gray-200"
                                : "bg-white/90 text-gray-700 border-gray-200 hover:bg-white"
                            }`}
                            aria-label="Toggle favorite"
                          >
                            <Heart
                              size={18}
                              className={favorites.includes(item.id) ? "fill-current" : ""}
                            />
                          </button>
                        </div>
                        {/* Category chip */}
                        {item.category && (
                          <span className="absolute bottom-3 left-3 text-xs px-2 py-1 rounded-full bg-black/60 text-white">
                            {item.category}
                          </span>
                        )}
                      </div>

                      <div className="p-4">
                        <h3 className="font-semibold text-foreground line-clamp-1">
                          {item.title}
                        </h3>
                        {item.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {item.description}
                          </p>
                        )}
                        {item.price && (
                          <div className="mt-3 font-bold text-blue-600">₱{item.price}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="glass rounded-3xl p-8 bg-white/70 border border-white/40 shadow text-center">
                  <p className="text-muted-foreground">
                    You don’t have any favorites yet.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Details Modals */}
      {selectedListingId && (
        <>
          {favoriteListings.find((it) => it.id === selectedListingId)?.category ===
            "Homes" && (
            <HomeDetailsModal
              listingId={selectedListingId}
              onClose={() => setSelectedListingId(null)}
            />
          )}
          {favoriteListings.find((it) => it.id === selectedListingId)?.category ===
            "Experiences" && (
            <ExperienceDetailsModal
              listingId={selectedListingId}
              onClose={() => setSelectedListingId(null)}
            />
          )}
          {favoriteListings.find((it) => it.id === selectedListingId)?.category ===
            "Services" && (
            <ServiceDetailsModal
              listingId={selectedListingId}
              onClose={() => setSelectedListingId(null)}
            />
          )}
        </>
      )}

      {/* Hosting Policies (always shown for non-hosts on action) */}
      {showPoliciesModal && (
        <HostPoliciesModal
          onClose={handleClosePoliciesModal}
          onAgree={handleAgreePolicies}
        />
      )}

      {/* Host Category Modal (opens after Agree) */}
      {showHostModal && (
        <HostCategModal
          onClose={handleCloseHostModal}
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
    </div>
  );
};

export default FavoritesPage;
