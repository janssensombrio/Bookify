import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, database } from "../config/firebase";
import './styles/nav.css'; 
import LogoutConfirmationModal from "../pages/host/components/logout-confirmation-modal";

function Navigation({ onOpenHostModal, onCategorySelect }) {
  const [isHost, setIsHost] = useState(localStorage.getItem("isHost") === "true");

  
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

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
    if (isHost) {
      navigate("/hostpage"); 
    } else {
      onOpenHostModal();
    }
  };

  const handleCategoryClick = (category) => {
    if (onCategorySelect) onCategorySelect(category);
  };

  const handleLogout = async () => {
    try {
      await auth.signOut(); // Sign out the user
      localStorage.removeItem("isHost"); // Clear host status
      navigate("/login"); // Redirect to login page
    } catch (err) {
      console.error("Logout error:", err.message);
      alert("Failed to logout. Try again.");
    }
  };

  return (
    <>
      <nav>
        <div className="left-header">
          <h1>Bookify</h1>
        </div>

        <div className="categories-wrapper">
          <button onClick={() => handleCategoryClick("Homes")}>Homes</button>
          <button onClick={() => handleCategoryClick("Experiences")}>Experiences</button>
          <button onClick={() => handleCategoryClick("Services")}>Services</button>
        </div>

        <div className="right-header">
          <button onClick={handleHostClick}>
            {isHost ? "Switch to hosting" : "Become a host"}
          </button>
          <button onClick={() => navigate("/messages")}>Messages</button>
          <button onClick={() => setIsLogoutModalOpen(true)}>Logout</button>
        </div>
      </nav>

      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onLogout={handleLogout}
      />
    </>
  );
}

export default Navigation;
