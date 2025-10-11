import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from '../../components/nav.jsx';
import Search from '../../components/search.jsx';
import HostCategModal from '../../components/host-categ-modal.jsx';
import {
  collection,
  getDocs,
  where,
  query
} from "firebase/firestore";
import { database } from "../../config/firebase";
import ListingCardContainer from '../../components/listing-card-container.jsx';
import './styles/home.css';

export const Home = () => {
  const [showHostModal, setShowHostModal] = useState(false);
  const navigate = useNavigate();

  const handleOpenHostModal = () => setShowHostModal(true);
  const handleCloseHostModal = () => setShowHostModal(false);

  const [selectedCategory, setSelectedCategory] = useState("Homes");
  const [listings, setListings] = useState([]);

  // 🔍 Fetch listings filtered by category
  const fetchListings = async (category) => {
    try {
      const listingsRef = collection(database, "listings");
      const q = query(listingsRef, where("category", "==", category));
      const snapshot = await getDocs(q);

      const listingsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setListings(listingsData);
    } catch (error) {
      console.error("Error fetching listings:", error);
    }
  };

  // 🏠 Load default category listings
  useEffect(() => {
    fetchListings(selectedCategory);
  }, [selectedCategory]);

  // 🔁 When user clicks category
  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    fetchListings(category);
  };

  const handleSelectCategory = (category) => {
    setShowHostModal(false);
    if (category === "Homes") {
      navigate('/host-set-up', { state: { category } });
    } else if (category === "Experiences") {
      navigate('/host-set-up-2', { state: { category } });
    } else if (category === "Services") {
      navigate('/host-set-up-3', { state: { category } });
    }
  };

  return (
    <>
      <header>
        <Navigation
          onOpenHostModal={handleOpenHostModal}
          onCategorySelect={handleCategorySelect}
        />
        <Search />
      </header>

      <ListingCardContainer category={selectedCategory} items={listings} />
      {showHostModal && (
        <HostCategModal
          onClose={handleCloseHostModal}
          onSelectCategory={handleSelectCategory}
        />
      )}
    </>
  );
};
