import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { doc, collection, addDoc, updateDoc, query, where, getDocs } from "firebase/firestore";
import { auth, database } from "../../config/firebase";
import "./styles/host-set-up.css";

export const HostSetUpServices = () => {
  const location = useLocation();
  const initialCategory = location.state?.category || "Services";

  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [draftId, setDraftId] = useState(null);

  const [formData, setFormData] = useState({
    category: initialCategory,
    serviceType: "",
    title: "",
    description: "",
    includes: "",
    targetAudience: "",
    availability: [],
    duration: "",
    recurrence: "",
    price: "",
    pricingType: "",
    cancellationPolicy: "",
    qualifications: "",
    clientRequirements: "",
    ageRestriction: { min: 0, max: 100 },
    photos: [],
    video: "",
    languages: [],
    locationType: "in-person", // or "online"
    address: "",
    agreeToTerms: false,
  });

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  const handleChange = (key, value) => {
    setFormData({ ...formData, [key]: value });
  };

  const saveDraft = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        alert("You must be logged in to save a draft.");
        return;
      }

      if (draftId) {
        const draftRef = doc(database, "listings", draftId);
        await updateDoc(draftRef, { ...formData, updatedAt: new Date() });
        alert("Draft updated!");
      } else {
        const docRef = await addDoc(collection(database, "listings"), {
          ...formData,
          uid: user.uid,
          status: "draft",
          createdAt: new Date(),
        });
        setDraftId(docRef.id);
        alert("Draft saved!");
      }
    } catch (error) {
      console.error("Error saving draft:", error);
      alert("Failed to save draft.");
    }
  };

  const handleSubmit = async () => {
    try {
      if (!draftId) {
        alert("No draft found to publish. Save as draft first.");
        return;
      }

      const draftRef = doc(database, "listings", draftId);
      await updateDoc(draftRef, { status: "published", publishedAt: new Date() });
      alert("Your service has been published!");
    } catch (error) {
      console.error("Error publishing listing:", error);
      alert("Failed to publish service.");
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

  // 🔹 Screen 1: Choose Service Type
  if (step === 1)
    return (
      <div className="step">
        <h2>What kind of service are you offering?</h2>
        {["Tutoring", "Wellness", "Photography", "Consulting", "Repair", "Other"].map((type) => (
          <button
            key={type}
            className={`card-btn ${formData.serviceType === type ? "selected" : ""}`}
            onClick={() => handleChange("serviceType", type)}
          >
            {type}
          </button>
        ))}
        <div className="buttons">
          <button onClick={() => navigate("/home")}>Back to Home</button>
          <button onClick={saveDraft}>Save Draft</button>
          <button
            className="next-btn"
            onClick={async () => {
              await saveHost(); // save host before moving
              nextStep();
            }}
            disabled={!formData.serviceType}
          >
            Get Started
          </button>
        </div>
      </div>
    );

  // 🔹 Screen 2: Description
  if (step === 2)
    return (
      <div className="step">
        <h2>Describe your service</h2>
        <input
          type="text"
          placeholder="Title"
          value={formData.title}
          onChange={(e) => handleChange("title", e.target.value)}
        />
        <textarea
          placeholder="Description"
          value={formData.description}
          onChange={(e) => handleChange("description", e.target.value)}
        ></textarea>
        <textarea
          placeholder="What's included?"
          value={formData.includes}
          onChange={(e) => handleChange("includes", e.target.value)}
        ></textarea>
        <input
          type="text"
          placeholder="Target Audience"
          value={formData.targetAudience}
          onChange={(e) => handleChange("targetAudience", e.target.value)}
        />
        <div className="buttons">
          <button onClick={prevStep}>Back</button>
          <button onClick={saveDraft}>Save Draft</button>
          <button onClick={nextStep}>Next</button>
        </div>
      </div>
    );

  // 🔹 Screen 3: Schedule
  if (step === 3)
    return (
      <div className="step">
        <h2>Set your schedule</h2>
        <input
          type="text"
          placeholder="Duration (e.g. 1 hour)"
          value={formData.duration}
          onChange={(e) => handleChange("duration", e.target.value)}
        />
        <select
          value={formData.recurrence}
          onChange={(e) => handleChange("recurrence", e.target.value)}
        >
          <option value="">Recurrence</option>
          <option value="one-time">One-time</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <div className="buttons">
          <button onClick={prevStep}>Back</button>
          <button onClick={saveDraft}>Save Draft</button>
          <button onClick={nextStep}>Next</button>
        </div>
      </div>
    );

  // 🔹 Screen 4: Pricing & Policy
  if (step === 4)
    return (
      <div className="step">
        <h2>Pricing and Policy</h2>
        <input
          type="number"
          placeholder="Price"
          value={formData.price}
          onChange={(e) => handleChange("price", e.target.value)}
        />
        <select
          value={formData.pricingType}
          onChange={(e) => handleChange("pricingType", e.target.value)}
        >
          <option value="">Pricing Type</option>
          <option value="per session">Per session</option>
          <option value="per hour">Per hour</option>
          <option value="per package">Per package</option>
        </select>
        <textarea
          placeholder="Cancellation Policy"
          value={formData.cancellationPolicy}
          onChange={(e) => handleChange("cancellationPolicy", e.target.value)}
        ></textarea>
        <div className="buttons">
          <button onClick={prevStep}>Back</button>
          <button onClick={saveDraft}>Save Draft</button>
          <button onClick={nextStep}>Next</button>
        </div>
      </div>
    );

  // 🔹 Screen 5: Host Requirements
  if (step === 5)
    return (
      <div className="step">
        <h2>Host Requirements</h2>
        <textarea
          placeholder="Qualifications / Experience"
          value={formData.qualifications}
          onChange={(e) => handleChange("qualifications", e.target.value)}
        ></textarea>
        <textarea
          placeholder="Client Requirements"
          value={formData.clientRequirements}
          onChange={(e) => handleChange("clientRequirements", e.target.value)}
        ></textarea>
        <label>Age Restriction (min):</label>
        <input
          type="number"
          value={formData.ageRestriction.min}
          onChange={(e) =>
            handleChange("ageRestriction", { ...formData.ageRestriction, min: e.target.value })
          }
        />
        <label>Age Restriction (max):</label>
        <input
          type="number"
          value={formData.ageRestriction.max}
          onChange={(e) =>
            handleChange("ageRestriction", { ...formData.ageRestriction, max: e.target.value })
          }
        />
        <div className="buttons">
          <button onClick={prevStep}>Back</button>
          <button onClick={saveDraft}>Save Draft</button>
          <button onClick={nextStep}>Next</button>
        </div>
      </div>
    );

  // 🔹 Screen 6: Media
  if (step === 6)
    return (
      <div className="step">
        <h2>Upload Media</h2>
        <input
          type="file"
          multiple
          onChange={(e) => handleChange("photos", Array.from(e.target.files))}
        />
        <input
          type="text"
          placeholder="Video link (optional)"
          value={formData.video}
          onChange={(e) => handleChange("video", e.target.value)}
        />
        <div className="buttons">
          <button onClick={prevStep}>Back</button>
          <button onClick={saveDraft}>Save Draft</button>
          <button onClick={nextStep}>Next</button>
        </div>
      </div>
    );

  // 🔹 Screen 7: Communication
  if (step === 7)
    return (
      <div className="step">
        <h2>Communication Details</h2>
        <input
          type="text"
          placeholder="Languages (comma-separated)"
          value={formData.languages.join(", ")}
          onChange={(e) => handleChange("languages", e.target.value.split(","))}
        />
        <select
          value={formData.locationType}
          onChange={(e) => handleChange("locationType", e.target.value)}
        >
          <option value="in-person">In-person</option>
          <option value="online">Online</option>
        </select>
        {formData.locationType === "in-person" && (
          <input
            type="text"
            placeholder="Service Address"
            value={formData.address}
            onChange={(e) => handleChange("address", e.target.value)}
          />
        )}
        <div className="buttons">
          <button onClick={prevStep}>Back</button>
          <button onClick={saveDraft}>Save Draft</button>
          <button onClick={nextStep}>Next</button>
        </div>
      </div>
    );

  // 🔹 Screen 8: Review & Publish
  return (
    <div className="step">
      <h2>Review and Publish</h2>
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
        <button onClick={handleSubmit} disabled={!formData.agreeToTerms}>
          Publish
        </button>
      </div>
    </div>
  );
};
