import { auth, database } from "../../config/firebase";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import Search from "../../components/search.jsx";
import HostCategModal from "../../components/host-categ-modal.jsx";
import Sidebar from "./components/sidebar.jsx";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

import { MapPin, Menu, X, Compass } from "lucide-react";
import BookifyLogo from "../../components/bookify-logo.jsx";
import { useSidebar } from "../../context/SidebarContext";
import ListingCardContainer from "../../components/listing-card-container.jsx";
import FormBg from "../../media/beach.mp4";

export const Explore = () => {
  const { sidebarOpen, setSidebarOpen } = useSidebar();

  const [isHost, setIsHost] = useState(localStorage.getItem("isHost") === "true");
  const [showHostModal, setShowHostModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Homes");
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true); // UI-only
  const navigate = useNavigate();

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

  const handleHostClick = () => {
    if (isHost) navigate("/hostpage");
    else handleOpenHostModal();
  };

  const fetchListings = async (category) => {
    try {
      setLoading(true);
      const listingsRef = collection(database, "listings");
      const snapshot = await getDocs(listingsRef);
      const listingsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const filtered = listingsData.filter((item) => item.category === category);
      setListings(filtered);
    } catch (error) {
      console.error("Error fetching listings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings(selectedCategory);
  }, [selectedCategory]);

  const handleOpenHostModal = () => setShowHostModal(true);
  const handleCloseHostModal = () => setShowHostModal(false);

  // ----- Skeletons (UI only) -----
  const SearchSkeleton = () => (
    <div className="
      w-full max-w-4xl mx-auto
      rounded-3xl border border-white/30 bg-white/20 backdrop-blur-md
      shadow-lg shadow-blue-500/20 overflow-hidden animate-pulse
    ">
      <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-white/20">
        <div className="flex-1 px-5 py-4">
          <div className="h-4 w-40 bg-white/40 rounded mb-2" />
          <div className="h-5 w-60 bg-white/60 rounded" />
        </div>
        <div className="flex-1 px-5 py-4">
          <div className="h-4 w-20 bg-white/40 rounded mb-2" />
          <div className="h-5 w-56 bg-white/60 rounded" />
        </div>
        <div className="flex-1 px-5 py-4">
          <div className="h-4 w-20 bg-white/40 rounded mb-2" />
          <div className="h-5 w-40 bg-white/60 rounded" />
        </div>
        <div className="px-6 py-4 sm:py-0 sm:flex sm:items-center">
          <div className="h-10 w-28 bg-blue-500/70 rounded-full mx-auto my-1 sm:my-0" />
        </div>
      </div>
    </div>
  );

  const HeadingSkeleton = () => (
    <div className="mt-6 mb-4">
      <div className="h-7 w-36 bg-gray-200 rounded mb-2 animate-pulse" />
      <div className="h-4 w-64 bg-gray-200/80 rounded animate-pulse" />
    </div>
  );

  const CardSkeleton = () => (
    <div className="rounded-3xl bg-white/80 border border-white/40 shadow overflow-hidden animate-pulse">
      <div className="h-44 bg-gray-200/80" />
      <div className="p-4">
        <div className="h-5 bg-gray-200 rounded w-2/3 mb-2" />
        <div className="h-4 bg-gray-200/80 rounded w-5/6 mb-1" />
        <div className="h-4 bg-gray-200/80 rounded w-1/3 mt-3" />
      </div>
    </div>
  );

  // ----- Mobile bottom nav (category switcher) -----
  const MobileCategoryBar = () => {
    const items = [
      { key: "Homes", icon: MapPin, label: "Homes" },
      { key: "Experiences", icon: Menu, label: "Experiences" },
      { key: "Services", icon: X, label: "Services" },
    ];
    return (
      <nav
        aria-label="Category navigation"
        className={`fixed bottom-0 left-0 right-0 z-[60] md:hidden ${
          sidebarOpen ? "hidden" : ""
        }`}
      >
        <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <div className="max-w-lg mx-auto rounded-2xl border border-gray-200 bg-white/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <ul className="grid grid-cols-3">
              {items.map(({ key, icon: Icon, label }) => {
                const active = selectedCategory === key;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedCategory(key)}
                      className={`w-full py-3 flex flex-col items-center gap-1 transition ${
                        active ? "text-blue-600" : "text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      <Icon size={18} />
                      <span className="text-xs font-medium">{label}</span>
                      {active && <span className="mt-1 h-0.5 w-8 rounded bg-blue-600" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </nav>
    );
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar onHostClick={handleHostClick} isHost={isHost} />

      {/* Right content area */}
      <div
        className={`flex-1 flex flex-col transition-[margin] duration-300
          ml-0 ${sidebarOpen ? "md:ml-72" : "md:ml-20"}
        `}
      >
        {/* 🧭 Navbar */}
        <header
          className={`
            fixed top-0 right-0 z-30
            bg-white text-gray-800 border-b border-gray-200 shadow-sm
            transition-all duration-300
            left-0 ${sidebarOpen ? "md:left-72" : "md:left-20"}
          `}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8 py-3">
            {/* Left: hamburger + logo */}
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

            {/* Desktop category tabs */}
            <nav className="hidden md:flex space-x-6">
              {["Homes", "Experiences", "Services"].map((cat, index) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-medium text-sm transition-all ${
                    selectedCategory === cat
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                      : "text-gray-700 hover:text-blue-600 hover:bg-blue-50"
                  }`}
                >
                  {index === 0 && <MapPin size={18} />}
                  {index === 1 && <Menu size={18} />}
                  {index === 2 && <X size={18} />}
                  {cat}
                </button>
              ))}
            </nav>

            {/* Desktop host action */}
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

        {/* 🏖 Hero */}
        <section className="relative w-full">
          <video
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            autoPlay
            loop
            muted
            playsInline
          >
            <source src={FormBg} type="video/mp4" />
            Your browser does not support the video tag.
          </video>

          {/* Search overlay (skeleton while loading) */}
          <div className="relative z-20 flex items-center justify-center h-[400px] sm:h-[500px]">
            {loading ? <SearchSkeleton /> : <Search />}
          </div>
        </section>

        {/* 🏘 Main */}
        <main className="relative z-[10] px-6 md:px-12 flex-1 pb-28 md:pb-16">
          {loading ? (
            <>
              <HeadingSkeleton />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            </>
          ) : (
            <ListingCardContainer category={selectedCategory} items={listings} />
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 py-8 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Bookify · Designed with ✨ Glassmorphism
        </footer>
      </div>

      {/* Mobile bottom category bar */}
      <MobileCategoryBar />

      {/* Host Category Modal */}
      {showHostModal && (
        <HostCategModal
          onClose={handleCloseHostModal}
          onSelectCategory={handleCloseHostModal}
        />
      )}
    </div>
  );
};
