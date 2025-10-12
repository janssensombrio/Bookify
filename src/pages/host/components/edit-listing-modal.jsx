import React, { useState, useEffect } from "react";
import '../styles/edit-listing-modal.css';
import { doc, updateDoc } from "firebase/firestore";
import { database } from '../../../config/firebase';

function EditListingModal({ listing, onClose, refreshList }) {
  const [formData, setFormData] = useState(listing);
  
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [barangays, setBarangays] = useState([]);

  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ date: "", time: "" });

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      // Convert codes to names
      const selectedRegion = regions.find(r => r.code === formData.region)?.name || "";
      const selectedProvince = provinces.find(p => p.code === formData.province)?.name || "";
      const selectedMunicipality = municipalities.find(m => m.code === formData.municipality)?.name || "";
      const selectedBarangay = barangays.find(b => b.code === formData.barangay)?.name || "";

      // Update only the names
      const updatedData = {
        ...formData,
        region: selectedRegion,
        province: selectedProvince,
        municipality: selectedMunicipality,
        barangay: selectedBarangay,
      };

      const docRef = doc(database, "listings", listing.id);
      await updateDoc(docRef, updatedData);

      refreshList();
      onClose();
      alert("Listing updated successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to update listing.");
    }
  };
  
  useEffect(() => {
  const fetchRegions = async () => {
    const resRegions = await fetch("https://psgc.gitlab.io/api/regions/");
    const regionData = await resRegions.json();
    setRegions(regionData);

    if (listing.region) {
      // Convert name -> code
      const regionObj = regionData.find(r => r.name === listing.region);
      if (regionObj) {
        const regionCode = regionObj.code;
        setFormData(prev => ({ ...prev, region: regionCode }));

        const resProvinces = await fetch(`https://psgc.gitlab.io/api/regions/${regionCode}/provinces/`);
        const provinceData = await resProvinces.json();
        setProvinces(provinceData);

        const provinceObj = provinceData.find(p => p.name === listing.province);
        if (provinceObj) {
          const provinceCode = provinceObj.code;
          setFormData(prev => ({ ...prev, province: provinceCode }));

          const resMunicipalities = await fetch(`https://psgc.gitlab.io/api/provinces/${provinceCode}/municipalities/`);
          const municipalityData = await resMunicipalities.json();
          setMunicipalities(municipalityData);

          const municipalityObj = municipalityData.find(m => m.name === listing.municipality);
          if (municipalityObj) {
            const municipalityCode = municipalityObj.code;
            setFormData(prev => ({ ...prev, municipality: municipalityCode }));

            const resBarangays = await fetch(`https://psgc.gitlab.io/api/municipalities/${municipalityCode}/barangays/`);
            const barangayData = await resBarangays.json();
            setBarangays(barangayData);

            const barangayObj = barangayData.find(b => b.name === listing.barangay);
            if (barangayObj) setFormData(prev => ({ ...prev, barangay: barangayObj.code }));
          }
        }
      }
    }
  };

  fetchRegions();
}, [listing]);

  return (
  <div className="modal-overlay">
    <div className="modal-content">
      <h2>Edit Listing</h2>

      {/* Common Fields for All Categories */}
      <div className="section">
        <h3>Basic Info</h3>
        <input
          type="text"
          placeholder="Title"
          value={formData.title || ""}
          onChange={(e) => handleChange("title", e.target.value)}
        />
        <textarea
          placeholder="Description"
          value={formData.description || ""}
          onChange={(e) => handleChange("description", e.target.value)}
        />
        <input
          type="text"
          placeholder="Category"
          value={formData.category || ""}
          disabled
        />
      </div>

      {/* 🏠 HOMES FIELDS */}
      {formData.category === "Homes" && (
        <>
          {/* 📍 LOCATION SECTION */}
          <div className="section">
            <h3>Location</h3>

            {/* Region */}
            <select
              value={formData.region || ""}
              onChange={async (e) => {
                const code = e.target.value;
                handleChange("region", code);
                handleChange("province", "");
                handleChange("municipality", "");
                handleChange("barangay", "");
                setProvinces([]);
                setMunicipalities([]);
                setBarangays([]);

                if (code) {
                  const res = await fetch(`https://psgc.gitlab.io/api/regions/${code}/provinces/`);
                  const data = await res.json();
                  setProvinces(data);
                }
              }}
            >
              <option value="">Select Region</option>
              {regions.map((region) => (
                <option key={region.code} value={region.code}>
                  {region.name}
                </option>
              ))}
            </select>

            {/* Province */}
            <select
              value={formData.province || ""}
              onChange={async (e) => {
                const code = e.target.value;
                handleChange("province", code);
                handleChange("municipality", "");
                handleChange("barangay", "");
                setMunicipalities([]);
                setBarangays([]);

                if (code) {
                  const res = await fetch(`https://psgc.gitlab.io/api/provinces/${code}/municipalities/`);
                  const data = await res.json();
                  setMunicipalities(data);
                }
              }}
              disabled={!formData.region}
            >
              <option value="">Select Province</option>
              {provinces.map((prov) => (
                <option key={prov.code} value={prov.code}>
                  {prov.name}
                </option>
              ))}
            </select>

            {/* Municipality */}
            <select
              value={formData.municipality || ""}
              onChange={async (e) => {
                const code = e.target.value;
                handleChange("municipality", code);
                handleChange("barangay", "");
                setBarangays([]);

                if (code) {
                  const res = await fetch(`https://psgc.gitlab.io/api/municipalities/${code}/barangays/`);
                  const data = await res.json();
                  setBarangays(data);
                }
              }}
              disabled={!formData.province}
            >
              <option value="">Select Municipality</option>
              {municipalities.map((mun) => (
                <option key={mun.code} value={mun.code}>
                  {mun.name}
                </option>
              ))}
            </select>

            {/* Barangay */}
            <select
              value={formData.barangay || ""}
              onChange={(e) => handleChange("barangay", e.target.value)}
              disabled={!formData.municipality}
            >
              <option value="">Select Barangay</option>
              {barangays.map((brgy) => (
                <option key={brgy.code} value={brgy.code}>
                  {brgy.name}
                </option>
              ))}
            </select>

            {/* Street */}
            <input
              type="text"
              placeholder="Street / House No."
              value={formData.street || ""}
              onChange={(e) => handleChange("street", e.target.value)}
            />
          </div>

          {/* 🏡 PROPERTY DETAILS SECTION */}
          <div className="section">
            <h3>Property Details</h3>

            {/* Listing Type */}
            <select
              value={formData.listingType || ""}
              onChange={(e) => handleChange("listingType", e.target.value)}
            >
              <option value="">Select Listing Type</option>
              {["Entire place", "Private room", "Shared room"].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            {/* Property Type */}
            <select
              value={formData.propertyType || ""}
              onChange={(e) => handleChange("propertyType", e.target.value)}
            >
              <option value="">Select Property Type</option>
              {["Apartment", "House", "Cottage", "Villa", "Cabin"].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Guests"
              value={formData.guests || 1}
              onChange={(e) => handleChange("guests", Number(e.target.value))}
            />
            <input
              type="number"
              placeholder="Bedrooms"
              value={formData.bedrooms || 1}
              onChange={(e) => handleChange("bedrooms", Number(e.target.value))}
            />
            <input
              type="number"
              placeholder="Beds"
              value={formData.beds || 1}
              onChange={(e) => handleChange("beds", Number(e.target.value))}
            />
            <input
              type="number"
              placeholder="Bathrooms"
              value={formData.bathrooms || 1}
              onChange={(e) => handleChange("bathrooms", Number(e.target.value))}
            />

            {/* Unique Description */}
            <textarea
              placeholder="What makes your place unique? (optional)"
              value={formData.uniqueDescription || ""}
              onChange={(e) => handleChange("uniqueDescription", e.target.value)}
            />

            {/* Availability */}
            <label>Availability Start:</label>
            <input
              type="date"
              value={formData.availability?.start || ""}
              onChange={(e) =>
                handleChange("availability", { ...formData.availability, start: e.target.value })
              }
            />
            <label>Availability End:</label>
            <input
              type="date"
              value={formData.availability?.end || ""}
              onChange={(e) =>
                handleChange("availability", { ...formData.availability, end: e.target.value })
              }
            />
          </div>

          {/* 💰 PRICING SECTION */}
          <div className="section">
            <h3>Pricing</h3>
            <input
              type="number"
              placeholder="Price"
              value={formData.price || ""}
              onChange={(e) => handleChange("price", e.target.value)}
            />
            <input
              type="number"
              placeholder="Cleaning Fee"
              value={formData.cleaningFee || ""}
              onChange={(e) => handleChange("cleaningFee", e.target.value)}
            />
            <select
              value={formData.discountType || ""}
              onChange={(e) => handleChange("discountType", e.target.value)}
            >
              <option value="">Select Discount Type</option>
              <option value="none">None</option>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed amount</option>
            </select>
            <input
              type="number"
              placeholder="Discount Value"
              value={formData.discountValue || 0}
              onChange={(e) => handleChange("discountValue", Number(e.target.value))}
            />
          </div>
        </>
      )}

      {/* 🧭 EXPERIENCES FIELDS */}
      {formData.category === "Experiences" && (
        <>
          {/* Address / Location */}
          <div className="section">
            <h3>Address</h3>
            {/* Region */}
            <select
              value={formData.region || ""}
              onChange={async (e) => {
                const code = e.target.value;
                handleChange("region", code);
                handleChange("province", "");
                handleChange("municipality", "");
                handleChange("barangay", "");
                setProvinces([]);
                setMunicipalities([]);
                setBarangays([]);
                if (code) {
                  const res = await fetch(`https://psgc.gitlab.io/api/regions/${code}/provinces/`);
                  setProvinces(await res.json());
                }
              }}
            >
              <option value="">Select Region</option>
              {regions.map((region) => (
                <option key={region.code} value={region.code}>
                  {region.name}
                </option>
              ))}
            </select>

            {/* Province */}
            <select
              value={formData.province || ""}
              onChange={async (e) => {
                const code = e.target.value;
                handleChange("province", code);
                handleChange("municipality", "");
                handleChange("barangay", "");
                setMunicipalities([]);
                setBarangays([]);
                if (code) {
                  const res = await fetch(`https://psgc.gitlab.io/api/provinces/${code}/municipalities/`);
                  setMunicipalities(await res.json());
                }
              }}
              disabled={!formData.region}
            >
              <option value="">Select Province</option>
              {provinces.map((prov) => (
                <option key={prov.code} value={prov.code}>
                  {prov.name}
                </option>
              ))}
            </select>

            {/* Municipality */}
            <select
              value={formData.municipality || ""}
              onChange={async (e) => {
                const code = e.target.value;
                handleChange("municipality", code);
                handleChange("barangay", "");
                setBarangays([]);
                if (code) {
                  const res = await fetch(`https://psgc.gitlab.io/api/municipalities/${code}/barangays/`);
                  setBarangays(await res.json());
                }
              }}
              disabled={!formData.province}
            >
              <option value="">Select Municipality</option>
              {municipalities.map((mun) => (
                <option key={mun.code} value={mun.code}>
                  {mun.name}
                </option>
              ))}
            </select>

            {/* Barangay */}
            <select
              value={formData.barangay || ""}
              onChange={(e) => handleChange("barangay", e.target.value)}
              disabled={!formData.municipality}
            >
              <option value="">Select Barangay</option>
              {barangays.map((brgy) => (
                <option key={brgy.code} value={brgy.code}>
                  {brgy.name}
                </option>
              ))}
            </select>

            {/* Street */}
            <input
              type="text"
              placeholder="Street / House No."
              value={formData.street || ""}
              onChange={(e) => handleChange("street", e.target.value)}
            />
          </div>

          {/* Experience Details */}
          <div className="section">
            <h3>Experience Details</h3>
            <input
              type="text"
              placeholder="Duration (e.g., 2 hours)"
              value={formData.duration || ""}
              onChange={(e) => handleChange("duration", e.target.value)}
            />
            <input
              type="number"
              placeholder="Max Participants"
              value={formData.maxParticipants || 1}
              onChange={(e) => handleChange("maxParticipants", Number(e.target.value))}
            />
            <select
              value={formData.experienceType || "in-person"}
              onChange={(e) => handleChange("experienceType", e.target.value)}
            >
              <option value="in-person">In-Person</option>
              <option value="online">Online</option>
            </select>
            <input
              type="number"
              placeholder="Min Age"
              value={formData.ageRestriction?.min || 0}
              onChange={(e) =>
                handleChange("ageRestriction", { ...formData.ageRestriction, min: Number(e.target.value) })
              }
            />
            <input
              type="number"
              placeholder="Max Age"
              value={formData.ageRestriction?.max || 100}
              onChange={(e) =>
                handleChange("ageRestriction", { ...formData.ageRestriction, max: Number(e.target.value) })
              }
            />
          </div>

          {/* Schedule Section */}
          <div
            style={{
              marginTop: "20px",
              border: "1px solid #ddd",
              borderRadius: "8px",
              padding: "15px",
            }}
          >
            <h4>Schedule</h4>

            {/* Display existing schedules */}
            {formData.schedule && formData.schedule.length > 0 ? (
              <ul style={{ marginBottom: "10px" }}>
                {formData.schedule.map((s, i) => (
                  <li key={i} style={{ marginBottom: "8px" }}>
                    📅{" "}
                    <input
                      type="date"
                      value={s.date}
                      onChange={(e) => {
                        const updated = [...formData.schedule];
                        updated[i].date = e.target.value;
                        setFormData({ ...formData, schedule: updated });
                      }}
                      style={{ padding: "4px" }}
                    />{" "}
                    🕒{" "}
                    <input
                      type="time"
                      value={s.time}
                      onChange={(e) => {
                        const updated = [...formData.schedule];
                        updated[i].time = e.target.value;
                        setFormData({ ...formData, schedule: updated });
                      }}
                      style={{ padding: "4px" }}
                    />{" "}
                    <button
                      onClick={() => {
                        const filtered = formData.schedule.filter((_, idx) => idx !== i);
                        setFormData({ ...formData, schedule: filtered });
                      }}
                      style={{
                        marginLeft: "8px",
                        background: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        padding: "4px 8px",
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No schedules yet.</p>
            )}

            {/* Add schedule button */}
            <button
              onClick={() => setShowAddSchedule(true)}
              style={{
                padding: "8px 12px",
                background: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                marginBottom: "10px",
              }}
            >
              + Add Schedule
            </button>

            {/* Add new schedule form */}
            {showAddSchedule && (
              <div style={{ marginTop: "10px" }}>
                <label style={{ display: "block", marginBottom: "6px" }}>
                  Date:
                  <input
                    type="date"
                    value={newSchedule.date}
                    onChange={(e) =>
                      setNewSchedule({ ...newSchedule, date: e.target.value })
                    }
                    style={{ marginLeft: "10px", padding: "5px" }}
                  />
                </label>

                <label style={{ display: "block", marginBottom: "6px" }}>
                  Time:
                  <input
                    type="time"
                    value={newSchedule.time}
                    onChange={(e) =>
                      setNewSchedule({ ...newSchedule, time: e.target.value })
                    }
                    style={{ marginLeft: "10px", padding: "5px" }}
                  />
                </label>

                <button
                  onClick={() => {
                    if (!newSchedule.date || !newSchedule.time) {
                      alert("Please fill in both date and time.");
                      return;
                    }
                    setFormData({
                      ...formData,
                      schedule: [...(formData.schedule || []), newSchedule],
                    });
                    setNewSchedule({ date: "", time: "" });
                    setShowAddSchedule(false);
                  }}
                  style={{
                    padding: "6px 10px",
                    background: "#28a745",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Save Schedule
                </button>
              </div>
            )}
          </div>

          {/* Price & Amenities */}
          <div className="section">
            <h3>Price & Amenities</h3>
            <input
              type="number"
              placeholder="Price per participant"
              value={formData.price || ""}
              onChange={(e) => handleChange("price", Number(e.target.value))}
            />
            <p>Select amenities included:</p>
            {["Food", "Drinks", "Equipment", "Transportation"].map((a) => (
              <label key={a}>
                <input
                  type="checkbox"
                  checked={formData.amenities?.includes(a) || false}
                  onChange={() => {
                    const newAmenities = formData.amenities?.includes(a)
                      ? formData.amenities.filter(am => am !== a)
                      : [...(formData.amenities || []), a];
                    handleChange("amenities", newAmenities);
                  }}
                />
                {a}
              </label>
            ))}
          </div>

          {/* Host Requirements & Policies */}
          <div className="section">
            <h3>Host Requirements & Policies</h3>
            <textarea
              placeholder="Host Requirements / Prerequisites"
              value={formData.hostRequirements || ""}
              onChange={(e) => handleChange("hostRequirements", e.target.value)}
            />
            <textarea
              placeholder="Cancellation Policy"
              value={formData.cancellationPolicy || ""}
              onChange={(e) => handleChange("cancellationPolicy", e.target.value)}
            />
          </div>

          {/* Languages */}
          <div className="section">
            <h3>Languages</h3>
            <input
              type="text"
              placeholder="Comma-separated languages"
              value={formData.languages?.join(", ") || ""}
              onChange={(e) =>
                handleChange("languages", e.target.value.split(",").map(lang => lang.trim()))
              }
            />
          </div>
        </>
      )}

      {/* 🧰 SERVICES FIELDS */}
      {formData.category === "Services" && (
        <div className="section">
          <h3>Service Details</h3>

          <select
            value={formData.serviceType || ""}
            onChange={(e) => handleChange("serviceType", e.target.value)}
          >
            <option value="">Select Service Type</option>
            <option value="Tutoring">Tutoring</option>
            <option value="Wellness">Wellness</option>
            <option value="Photography">Photography</option>
            <option value="Consulting">Consulting</option>
            <option value="Repair">Repair</option>
            <option value="Other">Other</option>
          </select>

          <input
            type="text"
            placeholder="Target Audience"
            value={formData.targetAudience || ""}
            onChange={(e) => handleChange("targetAudience", e.target.value)}
          />

          <input
            type="text"
            placeholder="Duration (e.g., 1 hour)"
            value={formData.duration || ""}
            onChange={(e) => handleChange("duration", e.target.value)}
          />

          {/* Recurrence Dropdown */}
          <select
            value={formData.recurrence || ""}
            onChange={(e) => handleChange("recurrence", e.target.value)}
          >
            <option value="">Recurrence</option>
            <option value="one-time">One-time</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>

          {/* Schedule Section */}
          <h4>Schedule</h4>

          {formData.schedule && formData.schedule.length > 0 ? (
            <ul style={{ marginBottom: "10px" }}>
              {formData.schedule.map((s, i) => (
                <li key={i} style={{ marginBottom: "8px" }}>
                  📅{" "}
                  <input
                    type="date"
                    value={s.date}
                    onChange={(e) => {
                      const updated = [...formData.schedule];
                      updated[i].date = e.target.value;
                      setFormData({ ...formData, schedule: updated });
                    }}
                    style={{ padding: "4px" }}
                  />{" "}
                  🕒{" "}
                  <input
                    type="time"
                    value={s.time}
                    onChange={(e) => {
                      const updated = [...formData.schedule];
                      updated[i].time = e.target.value;
                      setFormData({ ...formData, schedule: updated });
                    }}
                    style={{ padding: "4px" }}
                  />{" "}
                  <button
                    onClick={() => {
                      const filtered = formData.schedule.filter((_, idx) => idx !== i);
                      setFormData({ ...formData, schedule: filtered });
                    }}
                    style={{
                      marginLeft: "8px",
                      background: "#dc3545",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      padding: "4px 8px",
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No schedules yet.</p>
          )}

          {/* Add New Schedule */}
          <button
            onClick={() => setShowAddSchedule(true)}
            style={{
              padding: "8px 12px",
              background: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              marginBottom: "10px",
            }}
          >
            + Add Schedule
          </button>

          {showAddSchedule && (
            <div style={{ marginTop: "10px" }}>
              <label style={{ display: "block", marginBottom: "6px" }}>
                Date:
                <input
                  type="date"
                  value={newSchedule.date}
                  onChange={(e) => setNewSchedule({ ...newSchedule, date: e.target.value })}
                  style={{ marginLeft: "10px", padding: "5px" }}
                />
              </label>

              <label style={{ display: "block", marginBottom: "6px" }}>
                Time:
                <input
                  type="time"
                  value={newSchedule.time}
                  onChange={(e) => setNewSchedule({ ...newSchedule, time: e.target.value })}
                  style={{ marginLeft: "10px", padding: "5px" }}
                />
              </label>

              <button
                onClick={() => {
                  if (!newSchedule.date || !newSchedule.time) {
                    alert("Please fill in both date and time.");
                    return;
                  }
                  setFormData({
                    ...formData,
                    schedule: [...(formData.schedule || []), newSchedule],
                  });
                  setNewSchedule({ date: "", time: "" });
                  setShowAddSchedule(false);
                }}
                style={{
                  padding: "6px 10px",
                  background: "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Save Schedule
              </button>
            </div>
          )}

          <textarea
            placeholder="Description"
            value={formData.description || ""}
            onChange={(e) => handleChange("description", e.target.value)}
          />

          <textarea
            placeholder="What's included?"
            value={formData.includes || ""}
            onChange={(e) => handleChange("includes", e.target.value)}
          />

          <textarea
            placeholder="Qualifications / Host Requirements"
            value={formData.qualifications || ""}
            onChange={(e) => handleChange("qualifications", e.target.value)}
          />

          <textarea
            placeholder="Client Requirements"
            value={formData.clientRequirements || ""}
            onChange={(e) => handleChange("clientRequirements", e.target.value)}
          />
          
          <label>Max Participants:</label>
          <input
            type="number"
            min="1"
            value={formData.maxParticipants}
            onChange={(e) => handleChange("maxParticipants", Number(e.target.value))}
          />

          <div className="age-restriction">
            <label>Age Restriction:</label>
            <input
              type="number"
              placeholder="Min Age"
              value={formData.ageRestriction?.min || 0}
              onChange={(e) =>
                handleChange("ageRestriction", { ...formData.ageRestriction, min: Number(e.target.value) })
              }
            />
            <input
              type="number"
              placeholder="Max Age"
              value={formData.ageRestriction?.max || 100}
              onChange={(e) =>
                handleChange("ageRestriction", { ...formData.ageRestriction, max: Number(e.target.value) })
              }
            />
          </div>

          {/* Languages input */}
          <input
            type="text"
            placeholder="Languages (comma-separated)"
            value={formData.languages?.join(", ") || ""}
            onChange={(e) => handleChange("languages", e.target.value.split(","))}
          />

          {/* Location Type Dropdown */}
          <select
            value={formData.locationType || "in-person"}
            onChange={(e) => handleChange("locationType", e.target.value)}
          >
            <option value="in-person">In-person</option>
            <option value="online">Online</option>
          </select>

          {/* Address input only if in-person */}
          {formData.locationType === "in-person" && (
            <input
              type="text"
              placeholder="Service Address"
              value={formData.address || ""}
              onChange={(e) => handleChange("address", e.target.value)}
            />
          )}

          <input
            type="number"
            placeholder="Price"
            value={formData.price || ""}
            onChange={(e) => handleChange("price", e.target.value)}
          />

          {/* Pricing Type Dropdown */}
          <select
            value={formData.pricingType || ""}
            onChange={(e) => handleChange("pricingType", e.target.value)}
          >
            <option value="">Pricing Type</option>
            <option value="per session">Per session</option>
            <option value="per hour">Per hour</option>
            <option value="per package">Per package</option>
          </select>

          <textarea
            placeholder="Cancellation Policy"
            value={formData.cancellationPolicy || ""}
            onChange={(e) => handleChange("cancellationPolicy", e.target.value)}
          />
        </div>
      )}

      {/* PHOTOS (common to all) */}
      <div className="section">
        <h3>Photos</h3>
        {formData.photos?.map((link, idx) => (
          <div key={idx} className="photo-link-input">
            <input
              type="text"
              value={link}
              placeholder="Image URL"
              onChange={(e) => {
                const newPhotos = [...formData.photos];
                newPhotos[idx] = e.target.value;
                handleChange("photos", newPhotos);
              }}
            />
            <button
              type="button"
              onClick={() =>
                handleChange(
                  "photos",
                  formData.photos.filter((_, i) => i !== idx)
                )
              }
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            handleChange("photos", [...(formData.photos || []), ""])
          }
        >
          + Add another link
        </button>

        <div className="photo-preview">
            {formData.photos.map(
              (link, index) =>
                link && (
                  <img
                    key={index}
                    src={link}
                    alt="" //{`Photo ${index + 1}`}
                    style={{
                      width: "150px",
                      height: "100px",
                      objectFit: "cover",
                      borderRadius: "8px",
                      margin: "5px",
                    }}
                  />
                )
            )}
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