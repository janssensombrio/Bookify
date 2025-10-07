import React, { useState, useEffect } from "react";
import { database, auth } from '../../../config/firebase';
import { collection, doc, getDocs, deleteDoc } from 'firebase/firestore';
import EditListingModal from './edit-listing-modal';
import HostCategModal from '../../../components/host-categ-modal';
import '../styles/listings.css';
import { useNavigate } from "react-router-dom";

function Listings() {
  const [homesList, setHomesList] = useState([]);
  const [selectedListing, setSelectedListing] = useState(null); // selected listing for modal
  const [isModalOpen, setIsModalOpen] = useState(false); // modal visibility

    const [isCategModalOpen, setIsCategModalOpen] = useState(false);

    const openCategModal = () => setIsCategModalOpen(true);
    const closeCategModal = () => setIsCategModalOpen(false);

  const homesCollectionRef = collection(database, 'listings');

  const getHomesList = async () => {
    try {
      const data = await getDocs(homesCollectionRef);
      const filteredData = data.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHomesList(filteredData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    getHomesList();
  }, []);

  const openEditModal = (home) => {
    setSelectedListing(home);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedListing(null);
    setIsModalOpen(false);
  };

  const deleteListing = async (id) => {
    const listingDoc = doc(database, 'listings', id);
    await deleteDoc(listingDoc);

    getHomesList();
  };

  const navigate = useNavigate();

    const handleSelectCategory = (category) => {
      setIsCategModalOpen(false); // close modal
      if (category === "Homes") {
        navigate("/host-set-up", { state: { category } });
      } else if (category === "Experiences") {
        navigate("/host-set-up-2", { state: { category } });
      } else if (category === "Services") {
        navigate("/host-set-up-3", { state: { category } });
      }
    };

  return (
    <div className="listings-page">
      <div className="listing-header">
        <div className="header-text">
          <h2>Your Listings</h2>
          <p>Manage and view all your property listings here.</p>
        </div>
        <button onClick={openCategModal}>Add New</button>
      </div>

      <div className="listings-container">
        {homesList
          .filter(item => item.uid === auth.currentUser.uid) // only show items for current user
          .map((item) => (
            <div className="listing-card" key={item.id}>
              <h2>{item.title || "No Title"}</h2>

              {item.category === "Homes" && (
                <>
                  <p><strong>Category:</strong> {item.category}</p>
                  <p><strong>Listing Type:</strong> {item.listingType || "N/A"}</p>
                  <p><strong>Address:</strong> {item.street}, {item.barangay}, {item.municipality}, {item.province}, {item.region}</p>
                  <p><strong>Property Type:</strong> {item.propertyType || "N/A"}</p>
                  <p><strong>Guests:</strong> {item.guests} | <strong>Bedrooms:</strong> {item.bedrooms} | <strong>Beds:</strong> {item.beds} | <strong>Bathrooms:</strong> {item.bathrooms}</p>
                  <p><strong>Amenities:</strong> {item.amenities?.length > 0 ? item.amenities.join(", ") : "None"}</p>
                  <p><strong>Description:</strong> {item.description || "N/A"}</p>
                  <p><strong>Price:</strong> {item.price || "N/A"}</p>
                </>
              )}

              {item.category === "Experiences" && (
                <>
                  <p><strong>Experience Type:</strong> {item.experienceType}</p>
                  <p><strong>Location:</strong> {item.location}</p>
                  <p><strong>Duration:</strong> {item.duration}</p>
                  <p><strong>Max Participants:</strong> {item.maxParticipants}</p>
                  <p><strong>Languages:</strong> {item.languages?.length > 0 ? item.languages.join(", ") : "None"}</p>
                  <p><strong>Description:</strong> {item.description || "N/A"}</p>
                  <p><strong>Price:</strong> {item.price || "N/A"}</p>
                </>
              )}

              {item.category === "Services" && (
                <>
                  <p><strong>Service Type:</strong> {item.serviceType}</p>
                  <p><strong>Target Audience:</strong> {item.targetAudience}</p>
                  <p><strong>Duration:</strong> {item.duration}</p>
                  <p><strong>Recurrence:</strong> {item.recurrence}</p>
                  <p><strong>Languages:</strong> {item.languages?.length > 0 ? item.languages.join(", ") : "None"}</p>
                  <p><strong>Description:</strong> {item.description || "N/A"}</p>
                  <p><strong>Price:</strong> {item.price || "N/A"}</p>
                </>
              )}

              {/* Photos fallback */}
              {item.photos?.length > 0 ? (
                <div className="photos-container">
                  {item.photos.map((link, idx) => (
                    <img key={idx} src={link} alt={`Photo ${idx + 1}`} className="listing-photo" />
                  ))}
                </div>
              ) : (
                <p>No photos available</p>
              )}

              <div className="card-btns">
                <button onClick={() => openEditModal(item)}>Edit</button>
                <button onClick={() => deleteListing(item.id)}>Delete</button>
              </div>
            </div>
        ))}
      </div>

      {isModalOpen && selectedListing && (
        <EditListingModal
          listing={selectedListing}
          onClose={closeModal}
          refreshList={getHomesList} // optional to refresh after edit
        />
      )}

      
      {isCategModalOpen && (
        <HostCategModal
          onClose={closeCategModal}
          onSelectCategory={handleSelectCategory}
        />
      )}
    </div>
  );
}

export default Listings;
