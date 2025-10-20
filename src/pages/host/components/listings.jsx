import React, { useState, useEffect } from "react";
import { database, auth } from '../../../config/firebase';
import { collection, doc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import DeleteConfirmationModal from './delete-confirmation-modal.jsx';
import HostCategModal from '../../../components/host-categ-modal';
import '../styles/listings.css';
import { useNavigate } from "react-router-dom";
import EditHomeModal from "./EditHomeListing.jsx";
import EditExperienceModal from "./EditExperienceListing.jsx";
import ConfirmStatusModal from "./confirm-status-modal.jsx";
import { EditServiceModal } from "./EditServiceListing.jsx";

// Material UI imports
import {
  Box,
  Typography,
  Button,
  Card,
  IconButton,
  Divider,
  Toolbar,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AddRoundedIcon from '@mui/icons-material/AddRounded';

function Listings(props) {

  const [homesList, setHomesList] = useState([]);
  const [showDrafts, setShowDrafts] = useState(props.showDrafts || false);

  const [isCategModalOpen, setIsCategModalOpen] = useState(false);

  const openCategModal = () => setIsCategModalOpen(true);
  const closeCategModal = () => setIsCategModalOpen(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedToDelete, setSelectedToDelete] = useState(null);

  const [isExperienceEditModalOpen, setIsExperienceEditModalOpen] = useState(false);

  const [isServiceEditModalOpen, setIsServiceEditModalOpen] = useState(false);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null); // listing object
  const [statusNewValue, setStatusNewValue] = useState(""); // "draft" or "published"

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

  const handleDeleteClick = (home) => {
    setSelectedToDelete(home);
    setIsDeleteModalOpen(true);
  };

  const handleEditClick = (listing) => {
    setSelectedListing(listing);

    if (listing.category === "Homes") {
      setIsEditModalOpen(true);
    } else if (listing.category === "Experiences") {
      setIsExperienceEditModalOpen(true);
    } else if (listing.category === "Services") {
      setIsServiceEditModalOpen(true);
    } else {
      alert("Editing is only available for Homes, Experiences, and Services right now.");
    }
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

  // Carousel state for each listing
  const [carouselIndices, setCarouselIndices] = useState({});

  const handlePrevImage = (listingId) => {
    setCarouselIndices(prev => ({
      ...prev,
      [listingId]: Math.max(0, (prev[listingId] || 0) - 1)
    }));
  };

  const handleNextImage = (listingId, photosLength) => {
    setCarouselIndices(prev => ({
      ...prev,
      [listingId]: Math.min(photosLength - 1, (prev[listingId] || 0) + 1)
    }));
  };

  const handleStatusChange = async (item, newStatus) => {
    try {
      const listingRef = doc(database, "listings", item.id);
      await updateDoc(listingRef, { status: newStatus, updatedAt: new Date() });
      await getHomesList(); // refresh the list
      alert(`Listing ${newStatus === "draft" ? "saved as draft" : "published"} successfully!`);
    } catch (err) {
      console.error(err);
      alert("Failed to update listing status.");
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!statusTarget) return;

    try {
      const listingRef = doc(database, "listings", statusTarget.id);
      await updateDoc(listingRef, { status: statusNewValue, updatedAt: new Date() });
      await getHomesList(); // refresh list
      alert(`Listing ${statusNewValue === "draft" ? "saved as draft" : "published"} successfully!`);
    } catch (err) {
      console.error(err);
      alert("Failed to update listing status.");
    } finally {
      setStatusModalOpen(false);
      setStatusTarget(null);
      setStatusNewValue("");
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Toolbar/>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 10, mx: 14.4}}>
        <Box>
          <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 600, color: '#1976d2' }}>
            Your Listings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage and view all your property listings here.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant={!showDrafts ? "contained" : "outlined"}
            onClick={() => setShowDrafts(false)}
          >
            All Listings
          </Button>

          <Button
            variant={showDrafts === "published" ? "contained" : "outlined"}
            onClick={() => setShowDrafts("published")}
          >
            Published
          </Button>

          <Button
            variant={showDrafts === "draft" ? "contained" : "outlined"}
            onClick={() => setShowDrafts("draft")}
          >
            Drafts
          </Button>
          
          <Button variant="contained" onClick={openCategModal}>
            <AddRoundedIcon/>
            Add New
          </Button>
        </Box>
      </Box>

      {/* Listings Container */}
      <Box sx={{ maxWidth: '88%', mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}> {/* Flex column for 1 card per row */}
        {homesList
          .filter(item => item.uid === auth.currentUser.uid)
          .filter(item => {
                    if (showDrafts === "draft") return item.status === "draft";
                    if (showDrafts === "published") return item.status === "published";
                    return true; // all listings
                  })
          .map((item) => (
            <Card
                key={item.id}
                sx={{
                  width: '100%',
                  minHeight: 500,
                  display: 'flex',
                  borderRadius: 3,
                  boxShadow: 3,
                  overflow: 'hidden',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'scale(1.01)' }
                }}
              >
                {/* Left Side: Details */}
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    p: 3,
                    backgroundColor: '#fafafa',
                    borderRight: '1px solid #e0e0e0',
                  }}
                >
                  <Box sx={{ flexGrow: 1, overflowY: 'auto', pr: 1 }}>
                    <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 600 }}>
                      {item.title || "No Title"}
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    {item.category === "Homes" && (
                    <>
                      <Typography variant="body2"><strong>Category:</strong> {item.category || "N/A"}</Typography>
                      <Typography variant="body2"><strong>Listing Type:</strong> {item.listingType || "N/A"}</Typography>
                      <Typography variant="body2"><strong>Property Type:</strong> {item.propertyType || "N/A"}</Typography>
                      <Typography variant="body2"><strong>Title:</strong> {item.title || "N/A"}</Typography>
                      <Typography variant="body2"><strong>Description:</strong> {item.description || "N/A"}</Typography>
                      <Typography variant="body2"><strong>Unique Description:</strong> {item.uniqueDescription || "N/A"}</Typography>

                      <Typography variant="body2">
                        <strong>Address:</strong>{" "}
                        {[
                          item.street,
                          item.barangay.name,
                          item.municipality.name,
                          item.province.name,
                          item.region.name
                        ].filter(Boolean).join(", ") || "N/A"}
                      </Typography>

                      <Typography variant="body2">
                        <strong>Guests:</strong> {item.guests || 0} |{" "}
                        <strong>Bedrooms:</strong> {item.bedrooms || 0} |{" "}
                        <strong>Beds:</strong> {item.beds || 0} |{" "}
                        <strong>Bathrooms:</strong> {item.bathrooms || 0}
                      </Typography>

                      <Typography variant="body2"><strong>Amenities:</strong> {item.amenities?.length > 0 ? item.amenities.join(", ") : "None"}</Typography>

                      <Typography variant="body2"><strong>Price:</strong> ₱{item.price || "N/A"}</Typography>
                      <Typography variant="body2"><strong>Cleaning Fee:</strong> ₱{item.cleaningFee || "N/A"}</Typography>
                      <Typography variant="body2"><strong>Discount Type:</strong> {item.discountType || "N/A"}</Typography>
                      <Typography variant="body2"><strong>Discount Value:</strong> {item.discountValue ? `${item.discountValue}%` : "N/A"}</Typography>

                      <Typography variant="body2">
                        <strong>Availability:</strong>{" "}
                        {item.availability
                          ? `${item.availability.start} to ${item.availability.end}`
                          : "Not specified"}
                      </Typography>
                    </>
                  )}

                  {item.category === "Experiences" && (
                    <>
                      <Typography variant="body2"><strong>Title:</strong> {item.title || "N/A"}</Typography>
                      <Typography variant="body2"><strong>Experience Type:</strong> {item.experienceType || "N/A"}</Typography>
                      <Typography variant="body2">
                        <strong>Location:</strong>{" "}
                        {[item.street, item.barangay?.name, item.municipality?.name, item.province?.name, item.region?.name]
                          .filter(Boolean)
                          .join(", ") || "N/A"}
                      </Typography>
                      <Typography variant="body2"><strong>Duration:</strong> {item.duration || "N/A"}</Typography>
                      <Typography variant="body2"><strong>Max Participants:</strong> {item.maxParticipants || "N/A"}</Typography>
                      <Typography variant="body2">
                        <strong>Age Restriction:</strong>{" "}
                        {item.ageRestriction
                          ? `${item.ageRestriction.min} - ${item.ageRestriction.max}`
                          : "None"}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Schedule:</strong>{" "}
                        {item.schedule?.length > 0
                          ? item.schedule.map(s => `${s.date} ${s.time}`).join(", ")
                          : "N/A"}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Languages:</strong>{" "}
                        {item.languages?.length > 0 ? item.languages.join(", ") : "None"}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Amenities:</strong>{" "}
                        {item.amenities?.length > 0 ? item.amenities.join(", ") : "None"}
                      </Typography>
                      <Typography variant="body2"><strong>Price per Participant:</strong> ₱{item.price || "N/A"}</Typography>
                      <Typography variant="body2"><strong>Description:</strong> {item.description || "N/A"}</Typography>
                      <Typography variant="body2"><strong>Host Requirements:</strong> {item.hostRequirements || "N/A"}</Typography>
                      <Typography variant="body2"><strong>Cancellation Policy:</strong> {item.cancellationPolicy || "N/A"}</Typography>
                    </>
                  )}

                  {item.category === "Services" && (
                    <>
                      <Typography variant="body2"><strong>Title:</strong> {item.title || "N/A"}</Typography>
                      <Typography variant="body2"><strong>Service Type:</strong> {item.serviceType || "N/A"}</Typography>
                      <Typography variant="body2"><strong>Target Audience:</strong> {item.targetAudience || "N/A"}</Typography>
                      <Typography variant="body2"><strong>Duration:</strong> {item.duration || "N/A"}</Typography>
                      <Typography variant="body2"><strong>Recurrence:</strong> {item.recurrence || "N/A"}</Typography>
                      <Typography variant="body2">
                      <Typography variant="body2">
                        <strong>Max Participants:</strong> {item.maxParticipants || "N/A"}
                      </Typography>

                      {item.schedule?.length > 0 && (
                        <Typography variant="body2">
                          <strong>Schedule:</strong>{" "}
                          {item.schedule.map(s => `${s.date} at ${s.time}`).join(", ")}
                        </Typography>
                      )}
                      <strong>Age Restriction:</strong>{" "}
                      {item.ageRestriction
                        ? `${item.ageRestriction.min} - ${item.ageRestriction.max}`
                        : "None"}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Languages:</strong>{" "}
                        {item.languages?.length > 0
                          ? item.languages.map(lang => (typeof lang === "string" ? lang : lang.name)).join(", ")
                          : "None"}
                      </Typography>
                      <Typography variant="body2"><strong>Description:</strong> {item.description || "N/A"}</Typography>
                      <Typography variant="body2"><strong>Includes:</strong> {item.includes || "N/A"}</Typography>
                      <Typography variant="body2"><strong>Qualifications:</strong> {item.qualifications || "N/A"}</Typography>
                      <Typography variant="body2"><strong>Client Requirements:</strong> {item.clientRequirements || "N/A"}</Typography>
                      <Typography variant="body2"><strong>Cancellation Policy:</strong> {item.cancellationPolicy || "N/A"}</Typography>
                      <Typography variant="body2">
                        <strong>Location:</strong>{" "}
                        {item.locationType === "online"
                          ? "Online"
                          : item.address || "N/A"}
                      </Typography>
                      <Typography variant="body2"><strong>Price:</strong> {item.price ? `${item.price} (${item.pricingType || "N/A"})` : "N/A"}</Typography>
                    </>
                  )}

                  </Box>

                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleEditClick(item)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      onClick={() => handleDeleteClick(item)}
                    >
                      Delete
                    </Button>
                    {item.status === "published" && (
                      <Button
                        size="small"
                        variant="contained"
                        color="warning"
                        onClick={() => {
                          setStatusTarget(item);
                          setStatusNewValue("draft");
                          setStatusModalOpen(true);
                        }}
                      >
                        Save as Draft
                      </Button>
                    )}
                    {item.status === "draft" && (
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        onClick={() => {
                          setStatusTarget(item);
                          setStatusNewValue("published");
                          setStatusModalOpen(true);
                        }}
                      >
                        Publish
                      </Button>
                    )}
                  </Box>
                </Box>

                {/* Right Side: Image Carousel */}
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 1,
                    backgroundColor: '#f5f5f5',
                    position: 'relative'
                  }}
                >
                  {item.photos?.length > 0 ? (
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                      }}
                    >
                      <img
                        src={item.photos[carouselIndices[item.id] || 0]}
                        alt={`Photo ${(carouselIndices[item.id] || 0) + 1}`}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: 12,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                      />
                      {item.photos.length > 1 && (
                        <>
                          <IconButton
                            sx={{
                              position: 'absolute',
                              left: 12,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              bgcolor: 'rgba(255,255,255,0.85)',
                              '&:hover': { bgcolor: 'rgba(255,255,255,1)' },
                              boxShadow: 2
                            }}
                            onClick={() => handlePrevImage(item.id)}
                            disabled={(carouselIndices[item.id] || 0) === 0}
                          >
                            <ArrowBackIcon />
                          </IconButton>
                          <IconButton
                            sx={{
                              position: 'absolute',
                              right: 12,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              bgcolor: 'rgba(255,255,255,0.85)',
                              '&:hover': { bgcolor: 'rgba(255,255,255,1)' },
                              boxShadow: 2
                            }}
                            onClick={() => handleNextImage(item.id, item.photos.length)}
                            disabled={(carouselIndices[item.id] || 0) === item.photos.length - 1}
                          >
                            <ArrowForwardIcon />
                          </IconButton>
                        </>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary' }}>
                      No photos available
                    </Typography>
                  )}
                </Box>
              </Card>
          ))}
      </Box>

      {homesList.filter(item => {
        if (showDrafts === "draft") return item.uid === auth.currentUser.uid && item.status === "draft";
        if (showDrafts === "published") return item.uid === auth.currentUser.uid && item.status === "published";
        return item.uid === auth.currentUser.uid;
      }).length === 0 && (
        <Typography variant="body1" sx={{ mt: 3, textAlign: 'center' }}>
          {showDrafts === "draft"
            ? "No draft listings available."
            : showDrafts === "published"
            ? "No published listings available."
            : "No listings available."}
        </Typography>
      )}

      {isEditModalOpen && selectedListing && (
        <EditHomeModal
          open={isEditModalOpen}
          listing={selectedListing}
          onClose={() => setIsEditModalOpen(false)}
          refreshList={getHomesList}
          onSave={async (updatedData) => {
            try {
              const listingRef = doc(database, "listings", selectedListing.id);
              await updateDoc(listingRef, {
                ...updatedData,
                updatedAt: new Date(),
              });
              await getHomesList(); // refresh listings
              setIsEditModalOpen(false);
              alert("Listing updated successfully!");
            } catch (error) {
              console.error("Error updating listing:", error);
              alert("Failed to update listing.");
            }
          }}
        />
      )}

      {isExperienceEditModalOpen && selectedListing && (
        <EditExperienceModal
          listingId={selectedListing.id}
          onClose={() => setIsExperienceEditModalOpen(false)}
          refreshList={getHomesList}
        />
      )}

      {isServiceEditModalOpen && selectedListing && (
        <EditServiceModal
          open={isServiceEditModalOpen}
          listingData={selectedListing}
          onClose={() => setIsServiceEditModalOpen(false)}
          refreshList={getHomesList} // modal will call this after upload/save
        />
      )}

      <ConfirmStatusModal
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        onConfirm={handleConfirmStatusChange}
        newStatus={statusNewValue}
        listingTitle={statusTarget?.title}
      />

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
    </Box>
  );
}

export default Listings;