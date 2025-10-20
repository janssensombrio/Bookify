import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Listings from "./components/listings.jsx";
import { MessagesPage } from "../../components/messaging-page.jsx";
import HostNavigation from "../../components/HostNav.jsx";
import { Toolbar } from "@mui/material";

function HostPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [activePage, setActivePage] = useState(location.state?.activePage || "today");
  const [showDrafts, setShowDrafts] = useState(location.state?.showDrafts || false);

  // 🧹 Clear the navigation state once used (prevents it from reloading with same data)
  useEffect(() => {
    if (location.state) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const renderContent = () => {
    switch (activePage) {
      case "today":
        return <h2>Today’s Tasks</h2>;
      case "messages":
        return (
          <>
            <MessagesPage />
          </>
        );
      case "calendar":
        return <h2>Calendar</h2>;
      case "listings":
      default:
        return <Listings showDrafts={showDrafts} />;
    }
  };

  return (
    <div className="host-page">
      {/* Navigation */}
      <HostNavigation setActivePage={setActivePage} />
      <Toolbar />

      {/* Main Section */}
      <div className="main-section">
        <div className="page-content">{renderContent()}</div>
      </div>
    </div>
  );
}

export default HostPage;
