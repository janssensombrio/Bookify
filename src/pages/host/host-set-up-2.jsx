import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { doc, collection, addDoc, updateDoc, query, where, getDocs } from "firebase/firestore";
import { auth, database } from "../../config/firebase";
import "./styles/host-set-up.css";

export const HostSetUpExperiences = () => {
  const location = useLocation();
  const initialCategory = location.state?.category || "";

  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [listingType, setListingType] = useState(""); // subcategory selected

  const [formData, setFormData] = useState({
    category: initialCategory,
    listingType: "",
    title: "",
    location: "",
    duration: "", // in hours or minutes
    maxParticipants: 1,
    ageRestriction: { min: 0, max: 100 },
    experienceType: "in-person", // in-person or online
    languages: [],
    schedule: [], // array of date/time objects
    price: "",
    amenities: [], // food, drinks, equipment, transport, etc.
    photos: [],
    description: "",
    hostRequirements: "",
    cancellationPolicy: "",
    agreeToTerms: false,
  });

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const handleChange = (key, value) => {
    setFormData({ ...formData, [key]: value });
  };

  const handleAmenityToggle = (amenity) => {
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  const handleLanguageToggle = (lang) => {
    setFormData((prev) => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter((l) => l !== lang)
        : [...prev.languages, lang],
    }));
  };

  const handlePhotoUpload = (files) => {
    setFormData({ ...formData, photos: Array.from(files) });
  };

  const saveDraft = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return alert("You must be logged in to save a draft.");

      const draftsRef = collection(database, "listings");
      const q = query(draftsRef, where("uid", "==", user.uid));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // const docRef = 
        await addDoc(draftsRef, {
          ...formData,
          uid: user.uid,
          status: "draft",
          createdAt: new Date(),
        });
        alert("Draft saved!");
      } else {
        const draftId = snapshot.docs[0].id;
        const draftRef = doc(database, "listings", draftId);
        await updateDoc(draftRef, { ...formData, updatedAt: new Date() });
        alert("Draft updated!");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save draft.");
    }
  };

  const handleSubmit = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return alert("You must be logged in first.");

      const experiencesRef = collection(database, "listings");
        // const docRef = 
        await addDoc(experiencesRef, {
        ...formData,
        uid: user.uid,
        status: "published",
        createdAt: new Date(),
      });

      alert("Experience published successfully!");
      navigate("/home");
    } catch (err) {
      console.error(err);
      alert("Failed to publish experience.");
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

    const handleGetStarted = async () => {
        if (!listingType) return alert("Please select a subcategory to get started.");
        setFormData({ ...formData, listingType });
        await saveHost();
        setStep(2); // go to the next step
    };

  return (
    <div className="host-setup-page">
      {step === 1 && (
        <div className="step">
          <h2>Select Your Experience Type</h2>
          <div className="subcategories">
            {["Food", "Adventure", "Wellness", "Culture", "Entertainment"].map((type) => (
              <button
                key={type}
                className={listingType === type ? "selected" : ""}
                onClick={() => setListingType(type)}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="buttons">
            <button onClick={() => navigate("/home")}>Back to Home</button>
            <button onClick={handleGetStarted} disabled={!listingType}>
              Get Started
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Basic Info */}
      {step === 2 && (
        <div className="step">
          <h2>Basic Information</h2>
          <input
            type="text"
            placeholder="Experience Title"
            value={formData.title}
            onChange={(e) => handleChange("title", e.target.value)}
          />
          
          <input
            type="text"
            placeholder="Location"
            value={formData.location}
            onChange={(e) => handleChange("location", e.target.value)}
          />

          <input
            type="text"
            placeholder="Duration (e.g., 2 hours)"
            value={formData.duration}
            onChange={(e) => handleChange("duration", e.target.value)}
          />

          <div className="buttons">
            <button onClick={() => navigate('/home')}>Back to Home</button>
            <button onClick={saveDraft}>Save Draft</button>
            <button onClick={nextStep}>Next</button>
          </div>
        </div>
      )}

      {/* Step 3: Participants & Type */}
      {step === 3 && (
        <div className="step">
          <h2>Participants & Type</h2>
          <label>Max Participants:</label>
          <input
            type="number"
            value={formData.maxParticipants}
            onChange={(e) => handleChange("maxParticipants", Number(e.target.value))}
          />
          <label>Experience Type:</label>
          <select
            value={formData.experienceType}
            onChange={(e) => handleChange("experienceType", e.target.value)}
          >
            <option value="in-person">In-Person</option>
            <option value="online">Online</option>
          </select>
          <label>Age Restriction:</label>
          <input
            type="number"
            placeholder="Min Age"
            value={formData.ageRestriction.min}
            onChange={(e) => setFormData({
              ...formData,
              ageRestriction: { ...formData.ageRestriction, min: Number(e.target.value) }
            })}
          />
          <input
            type="number"
            placeholder="Max Age"
            value={formData.ageRestriction.max}
            onChange={(e) => setFormData({
              ...formData,
              ageRestriction: { ...formData.ageRestriction, max: Number(e.target.value) }
            })}
          />
          <div className="buttons">
            <button onClick={prevStep}>Back</button>
            <button onClick={saveDraft}>Save Draft</button>
            <button onClick={nextStep}>Next</button>
          </div>
        </div>
      )}

      {/* Step 4: Languages */}
      {step === 4 && (
        <div className="step">
          <h2>Languages Offered</h2>
          {["English", "Spanish", "French", "Mandarin", "Tagalog"].map((lang) => (
            <label key={lang}>
              <input
                type="checkbox"
                checked={formData.languages.includes(lang)}
                onChange={() => handleLanguageToggle(lang)}
              />
              {lang}
            </label>
          ))}
          <div className="buttons">
            <button onClick={prevStep}>Back</button>
            <button onClick={saveDraft}>Save Draft</button>
            <button onClick={nextStep}>Next</button>
          </div>
        </div>
      )}

      {/* Step 5: Schedule */}
      {step === 5 && (
        <div className="step">
          <h2>Schedule</h2>
          <p>For simplicity, you can add multiple available dates later.</p>
          <input
            type="text"
            placeholder="Example: Saturdays 2-4PM"
            value={formData.schedule.join(", ")}
            onChange={(e) => handleChange("schedule", e.target.value.split(","))}
          />
          <div className="buttons">
            <button onClick={prevStep}>Back</button>
            <button onClick={saveDraft}>Save Draft</button>
            <button onClick={nextStep}>Next</button>
          </div>
        </div>
      )}

      {/* Step 6: Pricing & Amenities */}
      {step === 6 && (
        <div className="step">
          <h2>Price & Amenities</h2>
          <input
            type="number"
            placeholder="Price per participant"
            value={formData.price}
            onChange={(e) => handleChange("price", Number(e.target.value))}
          />
          <p>Select amenities included:</p>
          {["Food", "Drinks", "Equipment", "Transportation"].map((a) => (
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
            <button onClick={saveDraft}>Save Draft</button>
            <button onClick={nextStep}>Next</button>
          </div>
        </div>
      )}

      {/* Step 7: Photos */}
      {step === 7 && (
        <div className="step">
          <h2>Photos & Media</h2>
          <input
            type="file"
            multiple
            onChange={(e) => handlePhotoUpload(e.target.files)}
          />
          <div className="photo-preview">
            {formData.photos.length > 0 && formData.photos.map((p, i) => <p key={i}>{p.name}</p>)}
          </div>
          <div className="buttons">
            <button onClick={prevStep}>Back</button>
            <button onClick={saveDraft}>Save Draft</button>
            <button onClick={nextStep}>Next</button>
          </div>
        </div>
      )}

      {/* Step 8: Description & Host Requirements */}
      {step === 8 && (
        <div className="step">
          <h2>Description & Requirements</h2>
          <textarea
            placeholder="Describe your experience"
            value={formData.description}
            onChange={(e) => handleChange("description", e.target.value)}
          />
          <textarea
            placeholder="Host requirements / prerequisites"
            value={formData.hostRequirements}
            onChange={(e) => handleChange("hostRequirements", e.target.value)}
          />
          <div className="buttons">
            <button onClick={prevStep}>Back</button>
            <button onClick={saveDraft}>Save Draft</button>
            <button onClick={nextStep}>Next</button>
          </div>
        </div>
      )}

      {/* Step 9: Cancellation Policy */}
      {step === 9 && (
        <div className="step">
          <h2>Cancellation Policy</h2>
          <textarea
            placeholder="Specify your cancellation policy"
            value={formData.cancellationPolicy}
            onChange={(e) => handleChange("cancellationPolicy", e.target.value)}
          />
          <div className="buttons">
            <button onClick={prevStep}>Back</button>
            <button onClick={saveDraft}>Save Draft</button>
            <button onClick={nextStep}>Next</button>
          </div>
        </div>
      )}

      {/* Step 10: Review & Publish */}
      {step === 10 && (
        <div className="step">
          <h2>Review & Publish</h2>
          <pre>{JSON.stringify(formData, null, 2)}</pre>
          <label>
            <input
              type="checkbox"
              checked={formData.agreeToTerms}
              onChange={(e) => handleChange("agreeToTerms", e.target.checked)}
            />
            I agree to the hosting terms
          </label>
          <div className="buttons">
            <button onClick={prevStep}>Back</button>
            <button onClick={saveDraft}>Save Draft</button>
            <button onClick={handleSubmit} disabled={!formData.agreeToTerms}>Publish</button>
          </div>
        </div>
      )}
    </div>
  );
};
