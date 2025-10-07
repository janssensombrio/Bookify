import React, { useState } from "react";
import '../styles/edit-listing-modal.css';
import { doc, updateDoc } from "firebase/firestore";
import { database } from '../../../config/firebase';

const amenitiesList = ["Wi-Fi", "Kitchen", "TV", "Air conditioning", "Washer", "Parking"];

function EditListingModal({ listing, onClose, refreshList }) {
  const [formData, setFormData] = useState(listing);

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleAmenityToggle = (amenity) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const handleSave = async () => {
    try {
      const docRef = doc(database, "listings", listing.id);
      await updateDoc(docRef, formData);
      refreshList();
      onClose();
      alert("Listing updated successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to update listing.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Edit Listing</h2>

        {/* Basic Info */}
        <div className="section">
            <h3>Basic Info</h3>
            <input type="text" placeholder="Title" value={formData.title || ""} onChange={(e) => handleChange("title", e.target.value)} />
            <textarea placeholder="Description" value={formData.description || ""} onChange={(e) => handleChange("description", e.target.value)} />
            <input type="text" placeholder="Category" value={formData.category || ""} onChange={(e) => handleChange("category", e.target.value)} />
            <input type="text" placeholder="Listing Type" value={formData.listingType || ""} onChange={(e) => handleChange("listingType", e.target.value)} />
        </div>

        {/* Address */}
        <div className="section">
            <h3>Address</h3>
            <input type="text" placeholder="Street" value={formData.street || ""} onChange={(e) => handleChange("street", e.target.value)} />
            <input type="text" placeholder="Barangay" value={formData.barangay || ""} onChange={(e) => handleChange("barangay", e.target.value)} />
            <input type="text" placeholder="Municipality" value={formData.municipality || ""} onChange={(e) => handleChange("municipality", e.target.value)} />
            <input type="text" placeholder="Province" value={formData.province || ""} onChange={(e) => handleChange("province", e.target.value)} />
            <input type="text" placeholder="Region" value={formData.region || ""} onChange={(e) => handleChange("region", e.target.value)} />
        </div>

        {/* Property Details */}
        <div className="section">
            <h3>Property Details</h3>
            <input type="text" placeholder="Property Type" value={formData.propertyType || ""} onChange={(e) => handleChange("propertyType", e.target.value)} />
            <textarea placeholder="Unique Description" value={formData.uniqueDescription || ""} onChange={(e) => handleChange("uniqueDescription", e.target.value)} />
            <input type="number" placeholder="Guests" value={formData.guests || 1} onChange={(e) => handleChange("guests", Number(e.target.value))} />
            <input type="number" placeholder="Bedrooms" value={formData.bedrooms || 1} onChange={(e) => handleChange("bedrooms", Number(e.target.value))} />
            <input type="number" placeholder="Beds" value={formData.beds || 1} onChange={(e) => handleChange("beds", Number(e.target.value))} />
            <input type="number" placeholder="Bathrooms" value={formData.bathrooms || 1} onChange={(e) => handleChange("bathrooms", Number(e.target.value))} />
        </div>

        {/* Amenities */}
        <div className="section">
            <h3>Amenities</h3>
            <div className="amenities-section">
            {amenitiesList.map(amenity => (
                <label key={amenity}>
                <input type="checkbox" checked={formData.amenities?.includes(amenity)} onChange={() => handleAmenityToggle(amenity)} />
                {amenity}
                </label>
            ))}
            </div>
        </div>

        {/* Pricing */}
        <div className="section">
            <h3>Pricing</h3>
            <input type="number" placeholder="Price" value={formData.price || ""} onChange={(e) => handleChange("price", e.target.value)} />
            <input type="number" placeholder="Cleaning Fee" value={formData.cleaningFee || ""} onChange={(e) => handleChange("cleaningFee", e.target.value)} />
            <input type="text" placeholder="Discount Type" value={formData.discountType || ""} onChange={(e) => handleChange("discountType", e.target.value)} />
            <input type="number" placeholder="Discount Value" value={formData.discountValue || 0} onChange={(e) => handleChange("discountValue", Number(e.target.value))} />
        </div>

        {/* Availability */}
        <div className="section">
            <h3>Availability</h3>
            <input type="date" value={formData.availability?.start || ""} onChange={(e) => handleChange("availability", { ...formData.availability, start: e.target.value })} />
            <input type="date" value={formData.availability?.end || ""} onChange={(e) => handleChange("availability", { ...formData.availability, end: e.target.value })} />
        </div>

        {/* Photos */}
        <div className="section">
            <h3>Photos</h3>
            <div className="photo-links">
            {formData.photos?.map((link, idx) => (
                <div key={idx} className="photo-link-input">
                <input type="text" value={link} placeholder="Image URL" onChange={(e) => {
                    const newPhotos = [...formData.photos]; newPhotos[idx] = e.target.value; handleChange("photos", newPhotos);
                }} />
                <button type="button" onClick={() => handleChange("photos", formData.photos.filter((_, i) => i !== idx))}>Remove</button>
                </div>
            ))}
            <button type="button" onClick={() => handleChange("photos", [...(formData.photos || []), ""])}>+ Add another link</button>
            </div>
            <div className="photo-preview">
            {formData.photos?.map((link, idx) => link && <img key={idx} src={link} alt={`Photo ${idx + 1}`} />)}
            </div>
        </div>

        <div className="modal-buttons">
            <button onClick={handleSave}>Save</button>
            <button onClick={onClose}>Cancel</button>
        </div>
        </div>
    </div>
  );
}

export default EditListingModal;