import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from '../../components/nav.jsx';
import Search from '../../components/search.jsx';
import HostCategModal from '../../components/host-categ-modal.jsx';
import ListingCardContainer from '../../components/listing-card-container.jsx';
import { collection, getDocs } from "firebase/firestore";
import { database } from "../../config/firebase";

import Toolbar from "@mui/material/Toolbar";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css"; 
import "slick-carousel/slick/slick-theme.css"; 
import { Box } from "@mui/material";

export const Home = () => {
  const [showHostModal, setShowHostModal] = useState(false);
  const navigate = useNavigate();

  const handleOpenHostModal = () => setShowHostModal(true);
  const handleCloseHostModal = () => setShowHostModal(false);

  const [selectedCategory, setSelectedCategory] = useState("Homes");
  const [listings, setListings] = useState([]);
  const [carouselImages, setCarouselImages] = useState([]);

  // 🔍 Fetch listings filtered by category
  const fetchListings = async (category) => {
    try {
      const listingsRef = collection(database, "listings");
      const snapshot = await getDocs(listingsRef);
      const listingsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Filter by category
      const filtered = listingsData.filter(item => item.category === category);
      setListings(filtered);

      // For carousel, get the first photo of each listing (or all)
      const images = listingsData
        .map(item => item.photos)
        .flat()
        .filter(Boolean); // remove undefined/null
      setCarouselImages(images);
    } catch (error) {
      console.error("Error fetching listings:", error);
    }
  };

  useEffect(() => {
    fetchListings(selectedCategory);
  }, [selectedCategory]);

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

  // Carousel settings
  const sliderSettings = {
    dots: true,
    infinite: true,
    speed: 800,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 4000,
    arrows: false,
  };

  return (
    <>
      <header>
        <Navigation
          onOpenHostModal={handleOpenHostModal}
          onCategorySelect={handleCategorySelect}
        />
      </header>

      {/* Carousel behind search */}
      <Toolbar/>
      <Box sx={{ position: "relative", width: "100%", height: { xs: 330, sm: 400 }, overflow: "hidden" }}>
        <Slider {...sliderSettings}>
          {carouselImages.map((url, index) => (
            <Box
              key={index}
              component="div"
              sx={{
                height: { xs: 340, sm: 400 },
                backgroundImage: `url(${url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          ))}
        </Slider>

        {/* Search component over carousel */}
        <Box sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: { xs: "90%", sm: "60%" },
          zIndex: 2,
        }}>
          <Search />
        </Box>
      </Box>

      <ListingCardContainer category={selectedCategory} items={listings} />
      <Toolbar/>

      {showHostModal && (
        <HostCategModal
          onClose={handleCloseHostModal}
          onSelectCategory={handleSelectCategory}
        />
      )}
    </>
  );
};
