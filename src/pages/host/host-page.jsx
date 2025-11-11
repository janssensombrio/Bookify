// ./src/pages/host/index.jsx (a.k.a. HostPage.jsx)
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Listings from "./components/listings.jsx";
import MessagesPage from "../../components/messaging-page.jsx";
import HostNavigation from "../../components/HostNav.jsx";
import TodayTab from "./today.jsx";
import HostCalendar from "./host-calendar.jsx";
import HostProfile from "./host-profile.jsx";

const VALID_PAGES = ["bookings", "messages", "listings", "calendar", "profile"];
const FALLBACK_PAGE = "bookings";

function safePage(p) {
  return VALID_PAGES.includes(p) ? p : FALLBACK_PAGE;
}

export default function HostPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // 1) Seed from router state (Option A)
  const seedActive = safePage(location.state?.activePage || FALLBACK_PAGE);
  const seedShowDrafts = Boolean(location.state?.showDrafts) || false;

  const [activePage, setActivePage] = useState(seedActive);
  const [showDrafts, setShowDrafts] = useState(seedShowDrafts);

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
      case "listings":
      default:
        return <Listings showDrafts={showDrafts} />;
    }
  }, [activePage, showDrafts]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-hidden">
      {/* Fixed Host nav */}
      <HostNavigation setActivePage={setActivePage} activePage={activePage} />

      {/* Spacer to avoid content under fixed header */}
      <div className="h-[34px] md:h-[44px]" />

      {/* Main Content area with desktop push, mobile no push */}
      <main className="transition-[margin] duration-300 ml-0 md:ml-2 px-4 sm:px-6 lg:px-12 py-6 pb-24 md:pb-10">
        <div className="max-w-7xl mx-auto space-y-8">{content}</div>
      </main>
    </div>
  );
}
