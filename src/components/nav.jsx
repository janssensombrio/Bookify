import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, database } from "../config/firebase";
import './styles/nav.css'; 

function Navigation({ onOpenHostModal }) {
  const [isHost, setIsHost] = useState(localStorage.getItem("isHost") === "true");
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
    <nav>
      <div className="left-header">
        <h1>Bookify</h1>
      </div>

      <div className="categories-wrapper">
        <button>Homes</button>
        <button>Experiences</button>
        <button>Services</button>
      </div>

      <div className="right-header">
        <button onClick={handleHostClick}>
          {isHost ? "Switch to hosting" : "Become a host"}
        </button>
        <button>Menu</button>
        <button onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  );
}

export default Navigation;
