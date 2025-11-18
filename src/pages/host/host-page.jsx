// ./src/pages/host/index.jsx (a.k.a. HostPage.jsx)
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";

import Listings from "./components/listings.jsx";
import MessagesPage from "../../components/messaging-page.jsx";
import HostSidebar from "./components/HostSidebar.jsx";
import TodayTab from "./today.jsx";
import HostCalendar from "./host-calendar.jsx";
import HostProfile from "./host-profile.jsx";
import HostWalletPage from "./wallet-page.jsx";
import HostRewardsPage from "./rewards-page.jsx";
import BookifyLogo from "../../components/bookify-logo.jsx";
import { useSidebar } from "../../context/SidebarContext";

const VALID_PAGES = ["bookings", "messages", "listings", "calendar", "profile", "wallet", "rewards"];
const FALLBACK_PAGE = "bookings";

function safePage(p) {
  return VALID_PAGES.includes(p) ? p : FALLBACK_PAGE;
}

export default function HostPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarOpen, setSidebarOpen } = useSidebar();

  // 1) Seed from router state (Option A)
  const seedActive = safePage(location.state?.activePage || FALLBACK_PAGE);
  const seedShowDrafts = Boolean(location.state?.showDrafts) || false;

  const [activePage, setActivePage] = useState(seedActive);
  const [showDrafts, setShowDrafts] = useState(seedShowDrafts);
  
  const sideOffset = sidebarOpen ? "md:ml-72" : "md:ml-20";
  // 2) If this page receives NEW state while already mounted, apply it once
  useEffect(() => {
    if (!location.state) return;
    const nextActive = safePage(location.state.activePage || activePage);
    const nextShowDrafts = Boolean(location.state.showDrafts ?? showDrafts);

    // Only update if something actually changed
    const changed = nextActive !== activePage || nextShowDrafts !== showDrafts;
    if (changed) {
      setActivePage(nextActive);
      setShowDrafts(nextShowDrafts);
    }

    // 3) Clear the consumed router state (so refresh/back won't “stick”)
    navigate(".", { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, navigate]);

  // 4) Render the correct section
  const content = useMemo(() => {
    switch (activePage) {
      case "bookings":
        return <TodayTab />;
      case "messages":
        return <MessagesPage />;
      case "calendar":
        return <HostCalendar />;
      case "profile":
        return <HostProfile />;
      case "wallet":
        return <HostWalletPage />;
      case "rewards":
        return <HostRewardsPage />;
      case "listings":
      default:
        return <Listings showDrafts={showDrafts} />;
    }
  }, [activePage, showDrafts]);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 overflow-hidden">
      <HostSidebar setActivePage={setActivePage} activePage={activePage} navigate={navigate} />

      {/* Content area wrapper */}
      <div className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ml-0 ${sideOffset}`}>
        {/* Top bar — sticky */}
        <header className={`fixed top-0 right-0 z-30 bg-white text-gray-800 border-b border-gray-200 shadow-sm transition-all duration-300 left-0`}>
          <div className="max-w-7xl mx-auto flex items-center justify-between px-3 sm:px-4 md:px-8 py-2.5 sm:py-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                aria-expanded={sidebarOpen}
              >
                <Menu size={22} />
              </button>
              <div className="flex items-center gap-1.5 sm:gap-2 cursor-pointer select-none" onClick={() => navigate("/hostpage")}>
                <BookifyLogo />
                <span className="hidden sm:inline font-semibold text-gray-800 text-sm sm:text-base">Host Dashboard</span>
              </div>
            </div>
          </div>
        </header>

        {/* Spacer */}
        <div className="h-[56px] md:h-[56px]" />

        {/* Main Content area */}
        <main className="flex-1 px-4 sm:px-6 md:px-28 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 lg:space-y-8 overflow-y-auto">
          {content}
        </main>
      </div>
    </div>
  );
}
