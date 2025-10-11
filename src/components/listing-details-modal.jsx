import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { database } from "../config/firebase";
import "./styles/listing-details-modal.css";
import AvailabilityCalendar from "./availability-calendar";

const ListingDetailsModal = ({ listingId, onClose }) => {
  const [listing, setListing] = useState(null);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const docRef = doc(database, "listings", listingId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setListing(docSnap.data());
        } else {
          console.error("Listing not found");
        }
      } catch (error) {
        console.error("Error fetching listing details:", error);
      }
    };

    if (listingId) fetchListing();
  }, [listingId]);

  if (!listing) return null; // wait for data

  // 🧠 render details based on category
  const renderDetails = () => {
    switch (listing.category) {
      case "Homes":
        return (
          <>
            <p><strong>Price:</strong> ₱{listing.price}</p>
            <p><strong>Property Type:</strong> {listing.propertyType}</p>
            <p><strong>Guests:</strong> {listing.guests}</p>
            <p><strong>Bedrooms:</strong> {listing.bedrooms}</p>
            <p><strong>Beds:</strong> {listing.beds}</p>
            <p><strong>Bathrooms:</strong> {listing.bathrooms}</p>
            <p><strong>Location:</strong> {listing.region}, {listing.province}, {listing.municipality}</p>
            <p><strong>Cleaning Fee:</strong> ₱{listing.cleaningFee}</p>
            {listing.discountType && (
              <p>
                <strong>Discount:</strong> {listing.discountValue}% ({listing.discountType})
              </p>
            )}
            <br />
            <AvailabilityCalendar availability={listing.availability}/>
          </>
        );

      case "Experiences":
        return (
          <>
            <p><strong>Price:</strong> ₱{listing.price}</p>
            <p><strong>Duration:</strong> {listing.duration}</p>
            <p><strong>Max Participants:</strong> {listing.maxParticipants}</p>
            <p><strong>Experience Type:</strong> {listing.experienceType}</p>
            <p>
              <strong>Location:</strong>{" "}
              {listing.region?.name || listing.region || "N/A"},{" "}
              {listing.province?.name || listing.province || "N/A"},{" "}
              {listing.municipality?.name || listing.municipality || "N/A"}
            </p>
            <p>
              <strong>Languages:</strong>{" "}
              {Array.isArray(listing.languages)
                ? listing.languages.join(", ")
                : listing.languages || "N/A"}
            </p>
            <p><strong>Cancellation Policy:</strong> {listing.cancellationPolicy}</p>
          </>
        );

      case "Services":
        return (
          <>
            <p><strong>Price:</strong> ₱{listing.price}</p>
            <p><strong>Service Type:</strong> {listing.serviceType}</p>
            <p><strong>Target Audience:</strong> {listing.targetAudience}</p>
            <p><strong>Duration:</strong> {listing.duration}</p>
            <p><strong>Recurrence:</strong> {listing.recurrence}</p>
            <p><strong>Location Type:</strong> {listing.locationType}</p>
            <p><strong>Address:</strong> {listing.address}</p>
            <p><strong>Cancellation Policy:</strong> {listing.cancellationPolicy}</p>
            <p><strong>Qualifications:</strong> {listing.qualifications}</p>
          </>
        );

      default:
        return <p>No details available.</p>;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>×</button>

        <div className="modal-header">
          <h2>{listing.title}</h2>
          <p>{listing.description}</p>
        </div>

        <div className="modal-images">
          {listing.photos?.map((photo, index) => (
            <img key={index} src={photo} alt={`Photo ${index + 1}`} />
          ))}
        </div>

        <div className="modal-details">
          {renderDetails()}

        </div>
      <div className="modal-actions">
        <button className="share-btn">Share</button>
        <button className="favorite-btn">Add to Favorites</button>
        <button className="reserve-btn">Reserve Now</button>
      </div>
      </div>
    </div>
  );
};

export default ListingDetailsModal;