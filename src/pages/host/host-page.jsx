import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Listings from "./components/listings.jsx";
import { MessagesPage } from "../../components/messaging-page.jsx";
import HostNavigation from "../../components/HostNav.jsx";
import { useSidebar } from "../../context/SidebarContext";

function HostPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarOpen } = useSidebar();

  const [activePage, setActivePage] = useState(location.state?.activePage || "today");
  const [showDrafts, setShowDrafts] = useState(location.state?.showDrafts || false);

  // 🧹 Clear the navigation state once used
  useEffect(() => {
    if (location.state) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const renderContent = () => {
    switch (activePage) {
      case "today":
        return (
          <div className="glass rounded-3xl p-6 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-600/10 border-white/20 shadow-lg">
            <h2 className="text-2xl font-semibold text-foreground">Today’s Tasks</h2>
            <p className="text-muted-foreground mt-2">You don’t have any tasks yet.</p>
          </div>
        );
      case "messages":
        return <MessagesPage />;
      case "calendar":
        return (
          <div className="glass rounded-3xl p-6 bg-white/70 border border-white/40 shadow-lg">
            <h2 className="text-2xl font-semibold text-foreground">Calendar</h2>
            <p className="text-muted-foreground mt-2">Coming soon.</p>
          </div>
        );
      case "listings":
      default:
        return <Listings showDrafts={showDrafts} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-hidden">
      {/* Fixed Host nav (already uses Sidebar internally) */}
      <HostNavigation setActivePage={setActivePage} />

      {/* Spacer to avoid content under fixed header */}
      <div className="h-[56px] md:h-[56px]" />

      {/* Main Content area with desktop push, mobile no push */}
      <main
        className={`transition-[margin] duration-300 ml-0 ${
          sidebarOpen ? "md:ml-72" : "md:ml-20"
        } px-4 sm:px-6 lg:px-12 py-6 pb-24 md:pb-10`}
      >
        <div className="max-w-7xl mx-auto space-y-8">{renderContent()}</div>
      </main>
    </div>
  );
}

export default HostPage;
