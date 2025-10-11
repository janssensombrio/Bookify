import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { doc, collection, addDoc, updateDoc, query, where, getDocs } from "firebase/firestore";
import { auth, database } from "../../config/firebase";
import "./styles/host-set-up.css";

export const HostSetUp = () => {
  const location = useLocation();
  const initialCategory = location.state?.category || "";
  
  const navigate = useNavigate();

  const [step, setStep] = useState(1);

  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [barangays, setBarangays] = useState([]);

  const [formData, setFormData] = useState({
    category: initialCategory,
    listingType: "",
    region: "",
    province: "",
    municipality: "",
    barangay: "",
    street: "",
    propertyType: "",
    uniqueDescription: "",
    guests: 1,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: [],
    photos: [],
    title: "",
    description: "",
    price: "",
    cleaningFee: "",
    discountType: "",
    discountValue: 0,
    availability: { start: "", end: "" },
    agreeToTerms: false,
  });

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const handleChange = (key, value) => {
  setFormData(prev => ({ ...prev, [key]: value }));
};

  const [draftId, setDraftId] = useState(null);

  const saveDraft = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return alert("You must be logged in to save a draft.");

      // ✅ Get readable names for location fields
      const selectedRegion = regions.find(r => r.code === formData.region)?.name || "";
      const selectedProvince = provinces.find(p => p.code === formData.province)?.name || "";
      const selectedMunicipality = municipalities.find(m => m.code === formData.municipality)?.name || "";
      const selectedBarangay = barangays.find(b => b.code === formData.barangay)?.name || "";

      const dataToSave = {
        ...formData,
        uid: user.uid,
        region: { code: formData.region, name: selectedRegion },
        province: { code: formData.province, name: selectedProvince },
        municipality: { code: formData.municipality, name: selectedMunicipality },
        barangay: { code: formData.barangay, name: selectedBarangay },
        status: "draft",
        savedAt: new Date(),
      };

      let docRef;

      if (draftId) {
        // ✅ Update existing draft
        docRef = doc(database, "listings", draftId);
        await updateDoc(docRef, dataToSave);
      } else {
        // ✅ Create a new draft
        docRef = await addDoc(collection(database, "listings"), dataToSave);
        setDraftId(docRef.id);
      }

      alert("Draft saved successfully!");
    } catch (error) {
      console.error("Error saving draft:", error);
      alert("Failed to save draft.");
    }
  };

  const handleSelect = (option) => {
    setFormData({ ...formData, listingType: option });
  };

  const handleAmenityToggle = (amenity) => {
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  const handleSubmit = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return alert("You must be logged in to publish.");

      // ✅ Get readable names
      const selectedRegion = regions.find(r => r.code === formData.region)?.name || "";
      const selectedProvince = provinces.find(p => p.code === formData.province)?.name || "";
      const selectedMunicipality = municipalities.find(m => m.code === formData.municipality)?.name || "";
      const selectedBarangay = barangays.find(b => b.code === formData.barangay)?.name || "";

      const dataToSave = {
        ...formData,
        uid: user.uid,
        region: { code: formData.region, name: selectedRegion },
        province: { code: formData.province, name: selectedProvince },
        municipality: { code: formData.municipality, name: selectedMunicipality },
        barangay: { code: formData.barangay, name: selectedBarangay },
        status: "published",
        publishedAt: new Date(),
      };


      if (draftId) {
        // ✅ Update existing draft
        const draftRef = doc(database, "listings", draftId);
        await updateDoc(draftRef, dataToSave);
      } else {
        // ✅ Create a new document
        await addDoc(collection(database, "listings"), dataToSave);
      }

      alert("Your listing has been published!");
    } catch (error) {
      console.error("Error publishing listing:", error);
      alert("Failed to publish listing.");
    }
  };


  const saveHost = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        alert("You must be logged in first.");
        return;
      }

      const hostsRef = collection(database, "hosts");
      const q = query(hostsRef, where("uid", "==", user.uid));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        await addDoc(hostsRef, {
          uid: user.uid,
          email: user.email,
          createdAt: new Date(),
        });
        console.log("Host added successfully!");
      } else {
        console.log("Host already exists, skipping creation.");
      }
    } catch (err) {
      console.error("Error adding host:", err);
      alert("Something went wrong saving host.");
    }
  };

  useEffect(() => {
    fetch("https://psgc.gitlab.io/api/regions/")
      .then((res) => res.json())
      .then((data) => setRegions(data))
      .catch((err) => console.error("Failed to load regions:", err));
  }, []);

  const handleBack = async () => {
    const user = auth.currentUser;
    if (!user) return navigate("/home"); // fallback

    const hostsRef = collection(database, "hosts");
    const q = query(hostsRef, where("uid", "==", user.uid));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      navigate("/hostpage"); // user is already a host
    } else {
      navigate("/home"); // regular user
    }
  };

  return (
    <div className="host-setup-page">
      {/* 🖥️ Screen 1 */}
      {step === 1 && (
        <div className="setup-screen">
          <h1>What kind of place are you listing?</h1>
          <div className="card-options">
            {["Entire place", "Private room", "Shared room"].map((option) => (
              <button
                key={option}
                className={`card-btn ${
                  formData.listingType === option ? "selected" : ""
                }`}
                onClick={() => handleSelect(option)}
              >
                <h3>{option}</h3>
                <p>
                  {option === "Entire place" &&
                    "Guests have the whole space to themselves."}
                  {option === "Private room" &&
                    "Guests have a private room but share common spaces."}
                  {option === "Shared room" &&
                    "Guests share both the room and common areas."}
                </p>
              </button>
            ))}
          </div>

          <button onClick={handleBack}>Back to Home</button>
          <button onClick={nextStep}
          disabled={!formData.listingType}>Next</button>
        </div>
      )}

      {/* 📍 Screen 2 */}
      {step === 2 && (
        <div className="step">
          <h2>Where’s your place located?</h2>

          {/* Region */}
          <select
            value={formData.region}
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
            value={formData.province}
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
            value={formData.municipality}
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
            value={formData.barangay}
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
            value={formData.street}
            disabled={!formData.barangay}
            onChange={(e) => handleChange("street", e.target.value)}
          />

          <div className="buttons">
            <button onClick={prevStep}>Back</button>
            <button
              className="next-btn"
              onClick={async () => {
                await saveHost(); // save host before moving
                nextStep();
              }}
              disabled={!formData.street}
            >
              Get Started
            </button>
          </div>
        </div>
      )}

      {/* 🏡 Screen 3 */}
      {step === 3 && (
        <div className="step">
          <h2>What type of place do you have?</h2>
          <div className="card-options">
            {["Apartment", "House", "Cottage", "Villa", "Cabin"].map((type) => (
              <button
                key={type}
                className={`card-btn ${
                  formData.propertyType === type ? "selected" : ""
                }`}
                onClick={() => handleChange("propertyType", type)}
              >
                <h3>{type}</h3>
                <p>
                  {type === "Apartment" && "A self-contained unit in a building."}
                  {type === "House" && "A standalone home with full privacy."}
                  {type === "Cottage" && "A cozy, small home often in rural areas."}
                  {type === "Villa" && "A luxurious home with spacious amenities."}
                  {type === "Cabin" && "A rustic retreat surrounded by nature."}
                </p>
              </button>
            ))}
          </div>

          <textarea
            placeholder="What makes your place unique? (optional)"
            value={formData.uniqueDescription}
            onChange={(e) => handleChange("uniqueDescription", e.target.value)}
          ></textarea>

          <div className="buttons">
            <button onClick={prevStep}>Back</button>
            <button onClick={saveDraft}>Save to Drafts</button>
            <button
              onClick={nextStep}
              disabled={!formData.propertyType}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* 🛏️ Screen 4 */}
      {step === 4 && (
        <div className="step">
          <h2>How many guests can stay?</h2>
          <label>Guests:</label>
          <input
            type="number"
            value={formData.guests}
            onChange={(e) => handleChange("guests", e.target.value)}
          />
          <label>Bedrooms:</label>
          <input
            type="number"
            value={formData.bedrooms}
            onChange={(e) => handleChange("bedrooms", e.target.value)}
          />
          <label>Beds:</label>
          <input
            type="number"
            value={formData.beds}
            onChange={(e) => handleChange("beds", e.target.value)}
          />
          <label>Bathrooms:</label>
          <input
            type="number"
            value={formData.bathrooms}
            onChange={(e) => handleChange("bathrooms", e.target.value)}
          />
          <div className="buttons">
            <button onClick={prevStep}>Back</button>
            <button onClick={saveDraft}>Save to Drafts</button>
            <button onClick={nextStep}>Next</button>
          </div>
        </div>
      )}

      {/* 🛋️ Screen 5 */}
      {step === 5 && (
        <div className="step">
          <h2>What amenities do you offer?</h2>
          {["Wi-Fi", "Kitchen", "TV", "Air conditioning", "Washer", "Parking"].map((a) => (
            <label key={a}>
              <input
                type="checkbox"
                checked={formData.amenities.includes(a)}
                onChange={() => handleAmenityToggle(a)}
              />
              {a}
            </label>
          ))}
          <div className="buttons">
            <button onClick={prevStep}>Back</button>
            <button onClick={saveDraft}>Save to Drafts</button>
            <button onClick={nextStep}>Next</button>
          </div>
        </div>
      )}

      {/* 📸 Screen 6 */}
      {step === 6 && (
        <div className="step">
          <h2>Show guests what your place looks like</h2>

          {/* Input for image links */}
          <div>
            <label>Add image links (one per line):</label>
            {formData.photos.map((link, index) => (
              <div key={index} className="photo-link-input">
                <input
                  type="text"
                  value={link}
                  placeholder="Paste image URL here"
                  onChange={(e) => {
                    const newLinks = [...formData.photos];
                    newLinks[index] = e.target.value;
                    setFormData({ ...formData, photos: newLinks });
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const newLinks = formData.photos.filter((_, i) => i !== index);
                    setFormData({ ...formData, photos: newLinks });
                  }}
                >
                  Remove
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setFormData({ ...formData, photos: [...formData.photos, ""] })
              }
            >
              + Add another link
            </button>
          </div>

          {/* Preview */}
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

          <div className="buttons">
            <button onClick={prevStep}>Back</button>
            <button onClick={saveDraft}>Save to Drafts</button>
            <button onClick={nextStep}>Next</button>
          </div>
        </div>
      )}

      {/* 📝 Screen 7 */}
      {step === 7 && (
        <div className="step">
          <h2>Add a title and description</h2>
          <input
            type="text"
            placeholder="Listing title"
            value={formData.title}
            onChange={(e) => handleChange("title", e.target.value)}
          />
          <textarea
            placeholder="Detailed description"
            value={formData.description}
            onChange={(e) => handleChange("description", e.target.value)}
          ></textarea>
          <div className="buttons">
            <button onClick={prevStep}>Back</button>
            <button onClick={saveDraft}>Save to Drafts</button>
            <button onClick={nextStep}>Next</button>
          </div>
        </div>
      )}

      {/* 💰 Screen 8 */}
      {step === 8 && (
        <div className="step">
          <h2>Set your nightly price</h2>
          <input
            type="number"
            placeholder="Price per night"
            value={formData.price}
            onChange={(e) => handleChange("price", e.target.value)}
          />
          <input
            type="number"
            placeholder="Cleaning fee (optional)"
            value={formData.cleaningFee}
            onChange={(e) => handleChange("cleaningFee", e.target.value)}
          />
          <select
            value={formData.discountType}
            onChange={(e) => handleChange("discountType", e.target.value)}
          >
            <option value="">Select discount type</option>
            <option value="none">None</option>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed amount</option>
          </select>

          <input
            type="number"
            value={formData.discountValue}
            onChange={(e) => handleChange("discountValue", Number(e.target.value))}
            placeholder="Enter discount value"
          />

          <div className="buttons">
            <button onClick={prevStep}>Back</button>
            <button onClick={saveDraft}>Save to Drafts</button>
            <button onClick={nextStep}>Next</button>
          </div>
        </div>
      )}

      {/* 📅 Screen 9 - Enhanced with Calendar */}
      {step === 9 && (
        <div className="step">
          <h2>When can guests book your place?</h2>
          
          {/* Date inputs */}
          <label>Start date:</label>
          <input
            type="date"
            value={formData.availability.start}
            onChange={(e) =>
              setFormData({
                ...formData,
                availability: { ...formData.availability, start: e.target.value },
              })
            }
          />
          <label>End date:</label>
          <input
            type="date"
            value={formData.availability.end}
            onChange={(e) =>
              setFormData({
                ...formData,
                availability: { ...formData.availability, end: e.target.value },
              })
            }
          />

          <div className="buttons">
            <button onClick={prevStep}>Back</button>
            <button onClick={saveDraft}>Save to Drafts</button>
            <button onClick={nextStep}>Next</button>
          </div>
        </div>
      )}

      {/* ✅ Screen 10 */}
      {step === 10 && (
        <div className="step">
          <h2>Review and publish</h2>
          <pre>{JSON.stringify(formData, null, 2)}</pre>
          <label>
            <input
              type="checkbox"
              checked={formData.agreeToTerms}
              onChange={(e) => handleChange("agreeToTerms", e.target.checked)}
            />{" "}
            I agree to the hosting terms
          </label>
          <div className="buttons">
            <button onClick={prevStep}>Back</button>
            <button onClick={saveDraft}>Save to Drafts</button>
            <button
              onClick={handleSubmit}
              disabled={!formData.agreeToTerms}
            >
              Publish
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
