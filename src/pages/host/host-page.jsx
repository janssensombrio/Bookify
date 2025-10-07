import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Listings from "./components/listings.jsx";

function HostPage() {
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState("listings");

  const renderContent = () => {
    switch (activePage) {
      case "today":
        return <h2>Today’s Tasks</h2>;
      case "messages":
        return <h2>Messages</h2>;
      case "calendar":
        return <h2>Calendar</h2>;
      case "listings":
      default:
        return <Listings/>;
    }
  };

  return (
    <div className="host-page">
      {/* Navigation */}
      <nav className="nav-bar">
        <h1>Host Dashboard</h1>

        <div className="page-buttons">
          <button onClick={() => setActivePage("today")}>Today</button>
          <button onClick={() => setActivePage("messages")}>Messages</button>
          <button onClick={() => setActivePage("listings")}>Listings</button>
          <button onClick={() => setActivePage("calendar")}>Calendar</button>
        </div>

        <div className="nav-actions">
          <button onClick={() => navigate("/home")}>Switch to Travelling</button>
          <button>Menu</button>
          <button>Logout</button>
        </div>
      </nav>

      {/* Main Section */}
      <div className="main-section">
        {/* Body (changes depending on selected page) */}
        <div className="page-content">{renderContent()}</div>
      </div>
    </div>
  );
}

export default HostPage;