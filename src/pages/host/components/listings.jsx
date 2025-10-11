import React, { useState, useEffect } from "react";
import { database, auth } from '../../../config/firebase';
import { collection, doc, getDocs, deleteDoc } from 'firebase/firestore';
import EditListingModal from './edit-listing-modal';
import DeleteConfirmationModal from './delete-confirmation-modal.jsx';
import HostCategModal from '../../../components/host-categ-modal';
import '../styles/listings.css';
import { useNavigate } from "react-router-dom";

function Listings() {
  const [homesList, setHomesList] = useState([]);
  const [selectedListing, setSelectedListing] = useState(null); // selected listing for modal
  const [isModalOpen, setIsModalOpen] = useState(false); // modal visibility
  const [showDrafts, setShowDrafts] = useState(false); // for showing the drfats

    const [isCategModalOpen, setIsCategModalOpen] = useState(false);

    const openCategModal = () => setIsCategModalOpen(true);
    const closeCategModal = () => setIsCategModalOpen(false);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedToDelete, setSelectedToDelete] = useState(null);

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

  const handleDeleteClick = (home) => {
    setSelectedToDelete(home);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteDoc(doc(database, "listings", selectedToDelete.id));
      getHomesList(); // refresh
      setIsDeleteModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to delete");
    }
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
        <div>
          <button onClick={openCategModal}>Add New</button>
          <button
            onClick={() => setShowDrafts(false)}
            className={!showDrafts ? "active-btn" : ""}
          >
            All Listings
          </button>
          <button
            onClick={() => setShowDrafts(true)}
            className={showDrafts ? "active-btn" : ""}
          >
            Drafts
          </button>
        </div>
      </div>

      <div className="listings-container">
        {homesList
          .filter(item => item.uid === auth.currentUser.uid)
          .filter(item => (showDrafts ? item.status === "draft" : true)) // show only drafts if toggle is on
          .map((item) => (
            <div className="listing-card" key={item.id}>
              <h2>{item.title || "No Title"}</h2>

              {item.category === "Homes" && (
                <>
                  <p><strong>Category:</strong> {item.category || "N/A"}</p>
                  <p><strong>Listing Type:</strong> {item.listingType || "N/A"}</p>
                  <p><strong>Address:</strong> {[
                    item.street,
                    item.barangay,
                    item.municipality,
                    item.province,
                    item.region
                  ].filter(Boolean).join(", ") || "N/A"}</p>
                  <p><strong>Property Type:</strong> {item.propertyType || "N/A"}</p>
                  <p>
                    <strong>Guests:</strong> {item.guests || 0} |
                    <strong> Bedrooms:</strong> {item.bedrooms || 0} |
                    <strong> Beds:</strong> {item.beds || 0} |
                    <strong> Bathrooms:</strong> {item.bathrooms || 0}
                  </p>
                  <p><strong>Amenities:</strong> {item.amenities?.length > 0 ? item.amenities.join(", ") : "None"}</p>
                  <p><strong>Description:</strong> {item.description || "N/A"}</p>
                  <p><strong>Price:</strong> {item.price || "N/A"}</p>
                </>
              )}

              {item.category === "Experiences" && (
                <>
                  <p><strong>Title:</strong> {item.title || "N/A"}</p>
                  <p><strong>Experience Type:</strong> {item.experienceType || "N/A"}</p>
                  <p>
                    <strong>Location:</strong>{" "}
                    {[item.street, item.barangay?.name, item.municipality?.name, item.province?.name, item.region?.name]
                      .filter(Boolean)
                      .join(", ") || "N/A"}
                  </p>
                  <p><strong>Duration:</strong> {item.duration || "N/A"}</p>
                  <p><strong>Max Participants:</strong> {item.maxParticipants || "N/A"}</p>
                  <p>
                    <strong>Age Restriction:</strong>{" "}
                    {item.ageRestriction
                      ? `${item.ageRestriction.min} - ${item.ageRestriction.max}`
                      : "None"}
                  </p>
                  <p>
                    <strong>Schedule:</strong>{" "}
                    {item.schedule?.length > 0 ? item.schedule.join(", ") : "N/A"}
                  </p>
                  <p>
                    <strong>Languages:</strong>{" "}
                    {item.languages?.length > 0 ? item.languages.join(", ") : "None"}
                  </p>
                  <p>
                    <strong>Amenities:</strong>{" "}
                    {item.amenities?.length > 0 ? item.amenities.join(", ") : "None"}
                  </p>
                  <p><strong>Price per Participant:</strong> {item.price || "N/A"}</p>
                  <p><strong>Description:</strong> {item.description || "N/A"}</p>
                  <p><strong>Host Requirements:</strong> {item.hostRequirements || "N/A"}</p>
                  <p><strong>Cancellation Policy:</strong> {item.cancellationPolicy || "N/A"}</p>
                </>
              )}

              {item.category === "Services" && (
                <>
                  <p><strong>Title:</strong> {item.title || "N/A"}</p>
                  <p><strong>Service Type:</strong> {item.serviceType || "N/A"}</p>
                  <p><strong>Target Audience:</strong> {item.targetAudience || "N/A"}</p>
                  <p><strong>Duration:</strong> {item.duration || "N/A"}</p>
                  <p><strong>Recurrence:</strong> {item.recurrence || "N/A"}</p>
                  <p>
                    <strong>Age Restriction:</strong>{" "}
                    {item.ageRestriction
                      ? `${item.ageRestriction.min} - ${item.ageRestriction.max}`
                      : "None"}
                  </p>
                  <p>
                    <strong>Languages:</strong>{" "}
                    {item.languages?.length > 0
                      ? item.languages.map(lang => (typeof lang === "string" ? lang : lang.name)).join(", ")
                      : "None"}
                  </p>
                  <p><strong>Description:</strong> {item.description || "N/A"}</p>
                  <p><strong>Includes:</strong> {item.includes || "N/A"}</p>
                  <p><strong>Qualifications:</strong> {item.qualifications || "N/A"}</p>
                  <p><strong>Client Requirements:</strong> {item.clientRequirements || "N/A"}</p>
                  <p><strong>Cancellation Policy:</strong> {item.cancellationPolicy || "N/A"}</p>
                  <p>
                    <strong>Location:</strong>{" "}
                    {item.locationType === "online"
                      ? "Online"
                      : item.address || "N/A"}
                  </p>
                  <p><strong>Price:</strong> {item.price ? `${item.price} (${item.pricingType || "N/A"})` : "N/A"}</p>
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
                <button onClick={() => handleDeleteClick(item)}>Delete</button>
              </div>
            </div>
        ))}
      </div>

      {homesList.filter(item => item.uid === auth.currentUser.uid && (showDrafts ? item.status === "draft" : true)).length === 0 && (
        <p>{showDrafts ? "No draft listings available." : "No published listings available."}</p>
      )}

      {isModalOpen && selectedListing && (
        <EditListingModal
          listing={selectedListing}
          onClose={closeModal}
          refreshList={getHomesList} // optional to refresh after edit
        />
      )}

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onDelete={handleDeleteConfirm}
        itemName={selectedToDelete?.title}
      />

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
