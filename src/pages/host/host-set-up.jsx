import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { doc, collection, addDoc, updateDoc, query, where, getDocs, getDoc, serverTimestamp } from "firebase/firestore";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { auth, database } from "../../config/firebase";
import "./styles/host-set-up.css";
import PolicyComplianceModal from "./components/PolicyComplianceModal";
import { Home, BedDouble, Users, Building2, Crown, Mountain, Tent, Wifi, Coffee, Tv, Car, Dumbbell, PawPrint, Snowflake, Waves,
  ShowerHead, KeyRound, Utensils, Wind, Lock, X, UploadCloud, Image as ImageIcon, Heading1, AlignLeft, Sparkles, BadgeDollarSign, Brush, Percent, Tag, Info, Calculator, ChevronLeft, ChevronRight } from "lucide-react";
import LocationPickerMapString from "./components/LocationPickerMap";

const CLOUD_NAME = "dijmlbysr"; // From Cloudinary dashboard
const UPLOAD_PRESET = "listing-uploads"; // Create an unsigned preset in Cloudinary for uploads

function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-[140px,1fr] gap-3 items-start">
      <span className="text-sm font-semibold text-gray-900">{label}:</span>
      <span className="text-sm text-gray-800">{value}</span>
    </div>
  );
}

const nightsBetween = (s, e) => {
  if (!s || !e) return 0;
  const msPerDay = 1000 * 60 * 60 * 24;
  const startMs = new Date(`${s}T00:00:00`).setHours(12);
  const endMs   = new Date(`${e}T00:00:00`).setHours(12);
  return Math.max(0, Math.ceil((endMs - startMs) / msPerDay));
};

export const HostSetUp = () => {
  const location = useLocation();
  
  const navigate = useNavigate();

  const [step, setStep] = useState(1);

  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [barangays, setBarangays] = useState([]);

  const [newAmenity, setNewAmenity] = useState("");  // Add this line
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const [openPolicyModal, setOpenPolicyModal] = useState(false);

  const [formData, setFormData] = useState({
    category: "Homes",
    listingType: "",
    location: "",
    propertyType: "",
    uniqueDescription: "",
    guests: { adults: 1, children: 0, infants: 0 },
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: [],
    photos: [],
    title: "",
    description: "",
    price: "",
    cleaningFee: "",
    discountType: "none",
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
      await saveHost();

      const user = auth.currentUser;
      if (!user) return alert("You must be logged in to save a draft.");

      const g = formData.guests || {};
      const adults = Number(g.adults ?? 1);
      const children = Number(g.children ?? 0);
      const infants = Number(g.infants ?? 0);

      const dataToSave = {
        ...formData,
        uid: user.uid,
        guests: {
          adults,
          children,
          infants,
          total: adults + children + infants,
        },
        location: formData.location || "",
        status: "draft",
        savedAt: serverTimestamp(),
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

      navigate("/hostpage", { state: { activePage: "listings", showDrafts: true } });
      
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

  const parseName = (displayName = "") => {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { firstName: "", lastName: "" };
    const firstName = parts.shift();
    const lastName = parts.join(" ");
    return { firstName, lastName };
  };

  const saveHost = async () => {
  try {
    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in first.");
      return;
    }

    // --- Gather profile fields with safe fallbacks ---
    const fromAuth = parseName(user.displayName || "");
    let firstName = fromAuth.firstName || "";
    let lastName  = fromAuth.lastName  || "";
    let photoURL  = user.photoURL || "";

    // Optional: if you keep a users/{uid} profile doc, prefer its values
    try {
      const profSnap = await getDoc(doc(database, "users", user.uid));
      if (profSnap.exists()) {
        const p = profSnap.data() || {};
        firstName = p.firstName ?? firstName;
        lastName  = p.lastName  ?? lastName;
        photoURL  = p.photoURL  ?? photoURL;
      }
    } catch (e) {
      console.warn("Profile lookup failed (non-fatal):", e);
    }

    const hostsRef = collection(database, "hosts");
    const q = query(hostsRef, where("uid", "==", user.uid));
    const snapshot = await getDocs(q);

    const base = {
      uid: user.uid,
      email: user.email || "",
      firstName,
      lastName,
      photoURL,
      displayName: `${firstName} ${lastName}`.trim() || (user.displayName || ""),
      updatedAt: serverTimestamp(),
    };

    if (snapshot.empty) {
      await addDoc(hostsRef, {
        ...base,
        createdAt: serverTimestamp(),
      });
      console.log("Host added successfully!");
    } else {
      // Update the first matching host doc (you only ever create one per uid)
      const existing = snapshot.docs[0].ref;
      await updateDoc(existing, base);
      console.log("Host already exists, updated profile fields.");
    }
  } catch (err) {
    console.error("Error adding host:", err);
    alert("Something went wrong saving host.");
  }
};

  const handleSubmit = async () => {
    try {
      await saveHost();

      const user = auth.currentUser;
      if (!user) return alert("You must be logged in to publish.");

      const normalized = {
        ...formData,
        price: Number(formData.price || 0),
        cleaningFee: Number(formData.cleaningFee || 0),
        discountValue: Number(formData.discountValue || 0),
      };

      const g = formData.guests || {};
      const adults = Number(g.adults ?? 1);
      const children = Number(g.children ?? 0);
      const infants = Number(g.infants ?? 0);
      const guests = { adults, children, infants, total: adults + children + infants };

      const dataToSave = {
        ...normalized,
        uid: user.uid,
        guests,
        location: formData.location || "",
        status: "published",
        publishedAt: serverTimestamp(),
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
      
      navigate("/hostpage");
    } catch (error) {
      console.error("Error publishing listing:", error);
      alert("Failed to publish listing.");
      navigate("/hostpage");
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
      navigate("/dashboard"); // regular user
    }
  };

  const setGuests = (key, next) => {
    const base = formData.guests || { adults: 1, children: 0, infants: 0 };
    const min = key === "adults" ? 1 : 0;
    const val = Math.max(min, Number(next || 0));
    handleChange("guests", { ...base, [key]: val });
  };

  const adjGuests = (key, delta) => {
    const curr = (formData.guests?.[key] ?? (key === "adults" ? 1 : 0)) + delta;
    setGuests(key, curr);
  };

  const totalGuests =
    (formData.guests?.adults ?? 0) +
    (formData.guests?.children ?? 0) +
    (formData.guests?.infants ?? 0);

    // --- Screen 9 helpers ---
    const start = formData?.availability?.start || "";
    const end   = formData?.availability?.end || "";

    const invalidRange =
      start && end
        ? new Date(`${start}T00:00:00`).setHours(12) >
          new Date(`${end}T00:00:00`).setHours(12)
        : false;

    const nights = nightsBetween(start, end);


  // convert Date -> "YYYY-MM-DD" (no timezone surprises)
  const formatYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // derive Date objects from your stored strings
  const startDate = formData?.availability?.start
    ? new Date(formData.availability.start + "T00:00:00")
    : null;
  const endDate = formData?.availability?.end
    ? new Date(formData.availability.end + "T00:00:00")
    : null;

  // update formData when range changes
  const handleRangeChange = (dates) => {
    const [start, end] = dates || [];
    setFormData(prev => ({
      ...prev,
      availability: {
        start: start ? formatYMD(start) : "",
        end:   end   ? formatYMD(end)   : "",
      },
    }));
  };



  return (
    <div className="host-setup-page">
      {/* 🖥️ Screen 1 */}
      {step === 1 && (
      <section
        className="
          px-4 md:px-8 py-20
          min-h-[calc(100vh-56px)]
          grid grid-rows-[auto,1fr,auto] gap-12
          bg-gradient-to-br from-blue-50 via-white to-indigo-50
        "
      >
        {/* Title */}
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            What kind of place are you listing?
          </h1>
          <p className="mt-2 text-gray-700">
            Choose the type of accommodation you're offering to get started.
          </p>
        </div>

        {/* Full-height selectable options */}
        <div
          role="radiogroup"
          aria-label="Listing type"
          className="
            max-w-6xl mx-auto w-full
            grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6
            h-full
          "
        >
          {[
            {
              value: "Entire place",
              label: "Entire place",
              desc: "Guests have the whole space to themselves.",
              Icon: Home,
            },
            {
              value: "Private room",
              label: "Private room",
              desc: "Guests have a private room but share common spaces.",
              Icon: BedDouble,
            },
            {
              value: "Shared room",
              label: "Shared room",
              desc: "Guests share both the room and common areas.",
              Icon: Users,
            },
          ].map(({ value, label, desc, Icon }) => {
            const active = formData.listingType === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleSelect(value)}
                role="radio"
                aria-checked={active}
                aria-label={label}
                className={[
                  "group relative w-full h-full rounded-3xl overflow-hidden",
                  "bg-white/80 backdrop-blur-md border border-white/60",
                  // 3D look (layered shadows + hover lift)
                  "shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]",
                  "hover:shadow-[0_12px_30px_rgba(30,58,138,0.12),0_30px_60px_rgba(30,58,138,0.12)]",
                  "transition-all duration-300 hover:-translate-y-1 active:translate-y-0",
                  active ? "ring-2 ring-blue-400/50 border-blue-600/60" : "",
                  "flex flex-col"
                ].join(" ")}
              >
                {/* Sheen / highlight for 3D feel */}
                <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-white/50 to-transparent" />

                {/* Icon + text (centered, stacked) */}
                <div className="relative flex-1 p-6 sm:p-8 flex flex-col items-center justify-center text-center">
                  <div
                    className={[
                      "grid place-items-center rounded-2xl",
                      "w-20 h-20 sm:w-24 sm:h-24",
                      active
                        ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
                        : "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700",
                      "shadow-lg shadow-blue-500/20 ring-4 ring-white/50",
                    ].join(" ")}
                  >
                    <Icon size={40} className="sm:w-12 sm:h-12" />
                  </div>

                  <h3
                    className={[
                      "mt-4 text-lg sm:text-xl font-semibold",
                      "text-gray-900",
                    ].join(" ")}
                  >
                    {label}
                  </h3>
                  <p className="mt-1 text-sm sm:text-base text-gray-700 max-w-[28ch]">
                    {desc}
                  </p>
                </div>

                {/* Bottom bar with state */}
                <div
                  className={[
                    "relative px-6 sm:px-7 py-4 border-t",
                    active ? "border-blue-100 bg-blue-50/70" : "border-gray-100 bg-white/70",
                    "flex items-center justify-between",
                  ].join(" ")}
                >
                  <span className="text-sm font-medium text-gray-700">
                    {active ? "Selected" : "Click to select"}
                  </span>
                  <span
                    className={[
                      "text-xs font-semibold px-3 py-1 rounded-full",
                      active
                        ? "bg-blue-600 text-white shadow shadow-blue-600/30"
                        : "bg-gray-100 text-gray-700",
                    ].join(" ")}
                  >
                    {label}
                  </span>
                </div>

                {/* Soft drop shadow “cast” for more depth */}
                <div className="pointer-events-none absolute -bottom-3 left-6 right-6 h-6 rounded-[2rem] bg-gradient-to-b from-blue-500/10 to-transparent blur-md" />
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="
              inline-flex items-center justify-center rounded-full
              border border-gray-300 bg-white
              px-6 py-3 text-sm font-medium text-gray-800
              hover:bg-gray-50 transition
            "
          >
            Back to Home
          </button>

          <button
            type="button"
            onClick={nextStep}
            disabled={!formData.listingType}
            className="
              inline-flex items-center justify-center rounded-full
              bg-gradient-to-r from-blue-500 to-blue-600
              px-7 py-3 text-sm font-semibold text-white shadow-md
              hover:from-blue-600 hover:to-blue-700 transition
              disabled:opacity-50 disabled:pointer-events-none
            "
          >
            Next
          </button>
        </div>
      </section>
    )}

      {/* 📍 Screen 2 */}
      {step === 2 && (
      <section className="px-4 md:px-8 py-6 min-h-[calc(100vh-56px)] grid grid-rows-[auto,1fr,auto] gap-5 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Where’s your place located?</h1>
          <p className="mt-2 text-gray-700">Drop a pin on the map or use your current location.</p>
        </div>

        <div className="max-w-5xl w-full mx-auto h-full">
          <div className="rounded-3xl border border-white/20 bg-white/80 backdrop-blur-md p-5 sm:p-6 md:p-8 shadow-[0_12px_30px_rgba(30,58,138,0.10),0_30px_60px_rgba(30,58,138,0.08)] grid gap-5 content-start">
            <LocationPickerMapString
              address={formData.location}
              onAddressChange={(addr) => handleChange("location", addr)}
            />

            <div className="grid gap-3">
              <label className="text-sm font-semibold text-gray-900">Detected address (editable)</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
                placeholder="Click on the map to populate, or type an address"
                className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
              />

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (!navigator.geolocation) return;
                    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
                      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=18&addressdetails=1&accept-language=en&email=you@example.com`;
                      const res = await fetch(url);
                      const data = await res.json();
                      handleChange("location", data.display_name || "");
                    });
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
                >
                  Use my location
                </button>
                <button
                  type="button"
                  onClick={() => handleChange("location", "")}
                  className="inline-flex items-center justify-center rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={prevStep}
            className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
          >
            Back
          </button>
          <button
            type="button"
            onClick={nextStep}
            disabled={!formData.location}
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 disabled:pointer-events-none"
          >
            Get Started
          </button>
        </div>
      </section>
    )}

      {/* 🏡 Screen 3 */}
      {step === 3 && (
  <section
    className="
      px-3 sm:px-6 md:px-8 py-12 sm:py-16
      min-h-[calc(100vh-56px)]
      grid grid-rows-[auto,auto,1fr,auto] gap-6
      bg-gradient-to-br from-blue-50 via-white to-indigo-50
    "
  >
    {/* Title */}
    <div className="max-w-3xl mx-auto text-center">
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
        What type of place do you have?
      </h1>
      <p className="mt-2 text-gray-700 text-sm sm:text-base">
        Select the best category that describes your property.
      </p>
    </div>

    {/* Cards grid with Unique Description as a grid item */}
    <div className="w-full max-w-7xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {[
          { value: "Apartment", label: "Apartment", desc: "A self-contained unit in a building.", Icon: Building2 },
          { value: "House",     label: "House",     desc: "A standalone home with full privacy.", Icon: Home },
          { value: "Cottage",   label: "Cottage",   desc: "A cozy, small home often in rural areas.", Icon: Mountain },
          { value: "Villa",     label: "Villa",     desc: "A luxurious home with spacious amenities.", Icon: Crown },
          { value: "Cabin",     label: "Cabin",     desc: "A rustic retreat surrounded by nature.", Icon: Tent },
        ].map(({ value, label, desc, Icon }) => {
          const active = formData.propertyType === value;

          const Card = (
            <button
              key={`card-${value}`}
              type="button"
              onClick={() => handleChange("propertyType", value)}
              aria-pressed={active}
              className={[
                "group relative w-full h-full rounded-2xl sm:rounded-3xl overflow-hidden text-left",
                "bg-white/80 backdrop-blur-md border border-white/60",
                "shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]",
                "hover:shadow-[0_12px_30px_rgba(30,58,138,0.12),0_30px_60px_rgba(30,58,138,0.12)]",
                "transition-all duration-300 hover:-translate-y-1 active:translate-y-0",
                active ? "ring-2 ring-blue-400/50 border-blue-600/60" : "",
                "flex flex-col",
              ].join(" ")}
            >
              {/* top sheen */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-white/50 to-transparent" />

              <div className="relative flex-1 p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center text-center">
                <div
                  className={[
                    "grid place-items-center rounded-xl sm:rounded-2xl",
                    "w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24",
                    active
                      ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
                      : "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700",
                    "shadow-lg shadow-blue-500/20 ring-4 ring-white/50",
                  ].join(" ")}
                >
                  <Icon className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12" />
                </div>

                <h3 className="mt-3 sm:mt-4 text-base sm:text-lg md:text-xl font-semibold text-gray-900">
                  {label}
                </h3>
                <p className="mt-1 text-sm sm:text-base text-gray-700 max-w-[40ch] md:max-w-[30ch]">
                  {desc}
                </p>
              </div>

              <div
                className={[
                  "relative px-4 sm:px-6 md:px-7 py-3 sm:py-4 border-t",
                  active ? "border-blue-100 bg-blue-50/70" : "border-gray-100 bg-white/70",
                  "flex flex-col sm:flex-row items-center justify-between gap-2",
                ].join(" ")}
              >
                <span className="text-xs sm:text-sm font-medium text-gray-700">
                  {active ? "Selected" : "Tap to select"}
                </span>
                <span
                  className={[
                    "text-xs font-semibold px-3 py-1 rounded-full",
                    active
                      ? "bg-blue-600 text-white shadow shadow-blue-600/30"
                      : "bg-gray-100 text-gray-700",
                  ].join(" ")}
                >
                  {label}
                </span>
              </div>

              {/* soft cast shadow */}
              <div className="pointer-events-none absolute -bottom-3 left-6 right-6 h-6 rounded-[2rem] bg-gradient-to-b from-blue-500/10 to-transparent blur-md" />
            </button>
          );

          // After rendering the "Cabin" card, inject the Unique Description as a grid item
          if (value === "Cabin") {
            return [
              Card,
              (
                <div
                  key="unique-description-card"
                  className="
                    col-span-1 sm:col-span-1 md:col-span-3
                    rounded-2xl sm:rounded-3xl overflow-hidden
                    bg-white/80 backdrop-blur-md border border-white/60
                    shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]
                    p-4 sm:p-6 md:p-8
                    flex flex-col
                  "
                >
                  <label className="block text-lg font-semibold text-gray-900 mb-6">
                    What makes your place unique? <span className="text-gray-500">(optional)</span>
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Describe any special features or highlights..."
                    value={formData.uniqueDescription}
                    onChange={(e) => handleChange("uniqueDescription", e.target.value)}
                    className="
                      w-full rounded-xl sm:rounded-2xl border border-gray-300 bg-white/90
                      px-3 sm:px-4 py-3 text-gray-800 shadow-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500
                      min-h-[180px]
                    "
                  />
                </div>
              ),
            ];
          }

          return Card;
        })}
      </div>
    </div>

    {/* Actions */}
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
      <button
        type="button"
        onClick={prevStep}
        className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
      >
        Back
      </button>

      <button
        type="button"
        onClick={saveDraft}
        className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition"
      >
        Save to Drafts
      </button>

      <button
        type="button"
        onClick={nextStep}
        disabled={!formData.propertyType}
        className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 disabled:pointer-events-none"
      >
        Next
      </button>
    </div>
  </section>
)}


      {/* 🛏️ Screen 4 */}
      {step === 4 && (
      <section
        className="
          px-3 sm:px-6 md:px-8 py-12 sm:py-16
          min-h-[calc(100vh-56px)]
          grid grid-rows-[auto,auto,1fr,auto] gap-6
          bg-gradient-to-br from-blue-50 via-white to-indigo-50
        "
      >
        {/* Title */}
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
            How many guests can stay?
          </h1>
          <p className="mt-2 text-gray-700 text-sm sm:text-base">
            Provide details about capacity and sleeping arrangements.
          </p>
          <p className="mt-1 text-xs sm:text-sm text-gray-600">
            Total guests: <span className="font-semibold text-gray-900">{totalGuests}</span>
          </p>
        </div>

        {/* Counters Grid */}
        <div className="w-full max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
            {/* Adults */}
            <div className="rounded-2xl sm:rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-5 sm:p-6 shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                  {/* Users icon looks good for adults */}
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/></svg>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Adults</h3>
                  <p className="text-sm text-gray-600">Ages 13+ (min 1)</p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => adjGuests("adults", -1)}
                  className="w-11 h-11 rounded-full border border-gray-300 bg-white hover:bg-gray-50 active:scale-95 transition"
                  aria-label="Decrease adults"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  value={formData.guests?.adults ?? 1}
                  onChange={(e) => setGuests("adults", e.target.value)}
                  className="w-20 text-center text-lg font-semibold text-gray-900 bg-transparent outline-none"
                />
                <button
                  type="button"
                  onClick={() => adjGuests("adults", 1)}
                  className="w-11 h-11 rounded-full border border-blue-500 text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow active:scale-95 transition"
                  aria-label="Increase adults"
                >
                  +
                </button>
              </div>
            </div>

            {/* Children */}
            <div className="rounded-2xl sm:rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-5 sm:p-6 shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                  {/* child-like icon */}
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none"><path d="M7 21v-2a4 4 0 0 1 4-4h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/></svg>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Children</h3>
                  <p className="text-sm text-gray-600">Ages 2–12</p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => adjGuests("children", -1)}
                  className="w-11 h-11 rounded-full border border-gray-300 bg-white hover:bg-gray-50 active:scale-95 transition"
                  aria-label="Decrease children"
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  value={formData.guests?.children ?? 0}
                  onChange={(e) => setGuests("children", e.target.value)}
                  className="w-20 text-center text-lg font-semibold text-gray-900 bg-transparent outline-none"
                />
                <button
                  type="button"
                  onClick={() => adjGuests("children", 1)}
                  className="w-11 h-11 rounded-full border border-blue-500 text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow active:scale-95 transition"
                  aria-label="Increase children"
                >
                  +
                </button>
              </div>
            </div>

            {/* Infants */}
            <div className="rounded-2xl sm:rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-5 sm:p-6 shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                  {/* baby icon */}
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none"><path d="M12 22a5 5 0 0 0 5-5v-2a5 5 0 0 0-10 0v2a5 5 0 0 0 5 5Z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="7" r="3" stroke="currentColor" strokeWidth="2"/></svg>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Infants</h3>
                  <p className="text-sm text-gray-600">Under 2</p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => adjGuests("infants", -1)}
                  className="w-11 h-11 rounded-full border border-gray-300 bg-white hover:bg-gray-50 active:scale-95 transition"
                  aria-label="Decrease infants"
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  value={formData.guests?.infants ?? 0}
                  onChange={(e) => setGuests("infants", e.target.value)}
                  className="w-20 text-center text-lg font-semibold text-gray-900 bg-transparent outline-none"
                />
                <button
                  type="button"
                  onClick={() => adjGuests("infants", 1)}
                  className="w-11 h-11 rounded-full border border-blue-500 text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow active:scale-95 transition"
                  aria-label="Increase infants"
                >
                  +
                </button>
              </div>
            </div>

            {/* Bedrooms */}
            <div className="rounded-2xl sm:rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-5 sm:p-6 shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                  {/* BedDouble icon */}
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none"><path d="M3 10h18v10H3z" stroke="currentColor" strokeWidth="2"/><path d="M7 10V7a2 2 0 0 1 2-2h2v5M19 10V7a2 2 0 0 0-2-2h-2v5" stroke="currentColor" strokeWidth="2"/></svg>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Bedrooms</h3>
                  <p className="text-sm text-gray-600">Optional</p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <button type="button" onClick={() => handleChange("bedrooms", Math.max(0, Number(formData.bedrooms) - 1))} className="w-11 h-11 rounded-full border border-gray-300 bg-white hover:bg-gray-50 active:scale-95 transition">−</button>
                <input type="number" min={0} value={formData.bedrooms} onChange={(e) => handleChange("bedrooms", Math.max(0, Number(e.target.value || 0)))} className="w-20 text-center text-lg font-semibold text-gray-900 bg-transparent outline-none" />
                <button type="button" onClick={() => handleChange("bedrooms", Number(formData.bedrooms) + 1)} className="w-11 h-11 rounded-full border border-blue-500 text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow active:scale-95 transition">+</button>
              </div>
            </div>

            {/* Beds */}
            <div className="rounded-2xl sm:rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-5 sm:p-6 shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                  {/* BedSingle icon */}
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none"><path d="M3 12h18v8H3z" stroke="currentColor" strokeWidth="2"/><path d="M7 12v-1a2 2 0 0 1 2-2h3v3" stroke="currentColor" strokeWidth="2"/></svg>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Beds</h3>
                  <p className="text-sm text-gray-600">Optional</p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <button type="button" onClick={() => handleChange("beds", Math.max(0, Number(formData.beds) - 1))} className="w-11 h-11 rounded-full border border-gray-300 bg-white hover:bg-gray-50 active:scale-95 transition">−</button>
                <input type="number" min={0} value={formData.beds} onChange={(e) => handleChange("beds", Math.max(0, Number(e.target.value || 0)))} className="w-20 text-center text-lg font-semibold text-gray-900 bg-transparent outline-none" />
                <button type="button" onClick={() => handleChange("beds", Number(formData.beds) + 1)} className="w-11 h-11 rounded-full border border-blue-500 text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow active:scale-95 transition">+</button>
              </div>
            </div>

            {/* Bathrooms */}
            <div className="rounded-2xl sm:rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-5 sm:p-6 shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                  {/* Droplet icon */}
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none"><path d="M12 2.5C12 2.5 5 9 5 13.5a7 7 0 1 0 14 0C19 9 12 2.5 12 2.5Z" stroke="currentColor" strokeWidth="2"/></svg>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Bathrooms</h3>
                  <p className="text-sm text-gray-600">Optional</p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <button type="button" onClick={() => handleChange("bathrooms", Math.max(0, Number(formData.bathrooms) - 1))} className="w-11 h-11 rounded-full border border-gray-300 bg-white hover:bg-gray-50 active:scale-95 transition">−</button>
                <input type="number" min={0} value={formData.bathrooms} onChange={(e) => handleChange("bathrooms", Math.max(0, Number(e.target.value || 0)))} className="w-20 text-center text-lg font-semibold text-gray-900 bg-transparent outline-none" />
                <button type="button" onClick={() => handleChange("bathrooms", Number(formData.bathrooms) + 1)} className="w-11 h-11 rounded-full border border-blue-500 text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow active:scale-95 transition">+</button>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
          <button type="button" onClick={prevStep} className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 transition">Back</button>
          <button type="button" onClick={saveDraft} className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition">Save to Drafts</button>
          <button type="button" onClick={nextStep} className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition">Next</button>
        </div>
      </section>
    )}

      {/* 🛋️ Screen 5 */}
      {step === 5 && (
      <section
        className="
          px-3 sm:px-6 md:px-8 py-12 sm:py-16
          min-h-[calc(100vh-56px)]
          grid grid-rows-[auto,auto,1fr,auto] gap-6
          bg-gradient-to-br from-blue-50 via-white to-indigo-50
        "
      >
        {/* Title */}
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
            What amenities do you offer?
          </h1>
          <p className="mt-2 text-gray-700 text-sm sm:text-base">
            Add amenities that guests can enjoy at your place.
          </p>
        </div>

        {/* Content */}
        <div className="w-full max-w-7xl mx-auto space-y-6">
          {/* Selected amenities (pills with remove) */}
          <div className="rounded-2xl sm:rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-4 sm:p-6 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)]">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Selected amenities</h3>

            {formData.amenities?.length ? (
              <div className="flex flex-wrap gap-2">
                {formData.amenities.map((amenity, idx) => (
                  <span
                    key={amenity + idx}
                    className="
                      inline-flex items-center gap-2 pl-3 pr-2 py-1.5
                      rounded-full border border-blue-200 bg-blue-50 text-blue-700
                      text-xs sm:text-sm font-medium shadow-sm
                    "
                  >
                    {amenity}
                    <button
                      type="button"
                      onClick={() => {
                        const updated = formData.amenities.filter((_, i) => i !== idx);
                        handleChange("amenities", updated);
                      }}
                      className="grid place-items-center w-5 h-5 rounded-full hover:bg-blue-100"
                      aria-label={`Remove ${amenity}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">No amenities selected yet.</p>
            )}
          </div>

          {/* Suggested amenities grid (toggle cards) */}
          <div className="rounded-2xl sm:rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-4 sm:p-6 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)]">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Popular amenities</h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {[
                { label: "Wi-Fi", Icon: Wifi },
                { label: "Air conditioning", Icon: Snowflake },
                { label: "Heating", Icon: Wind },
                { label: "TV", Icon: Tv },
                { label: "Kitchen", Icon: Utensils },
                { label: "Coffee maker", Icon: Coffee },
                { label: "Free parking", Icon: Car },
                { label: "Gym", Icon: Dumbbell },
                { label: "Pet-friendly", Icon: PawPrint },
                { label: "Pool", Icon: Waves },
                { label: "Shower", Icon: ShowerHead },
                { label: "Lockbox", Icon: Lock },
                { label: "Key access", Icon: KeyRound },
              ].map(({ label, Icon }) => {
                const on = formData.amenities?.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleAmenityToggle(label)}
                    aria-pressed={on}
                    className={[
                      "group w-full rounded-2xl border p-4 sm:p-5 text-left",
                      "transition-all duration-200",
                      on
                        ? "border-blue-500 bg-blue-50/80 shadow-[0_8px_20px_rgba(30,58,138,0.10)]"
                        : "border-gray-200 bg-white/70 hover:bg-gray-50",
                      "flex items-center gap-3",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "grid place-items-center rounded-xl w-10 h-10",
                        on
                          ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white ring-4 ring-white/60 shadow"
                          : "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow",
                      ].join(" ")}
                    >
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="text-sm sm:text-base font-medium text-gray-900">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Add new amenity */}
          <div className="rounded-2xl sm:rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-4 sm:p-6 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)]">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Add a custom amenity</h3>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <input
                type="text"
                value={newAmenity}
                onChange={(e) => setNewAmenity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const a = (newAmenity || "").trim();
                    if (a && !formData.amenities.includes(a)) {
                      handleChange("amenities", [...formData.amenities, a]);
                      setNewAmenity("");
                    }
                  }
                }}
                placeholder="e.g., Fireplace, EV charger, Crib"
                className="
                  flex-1 rounded-2xl border border-gray-300 bg-white/90
                  px-4 py-3 text-gray-800 shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500
                "
              />
              <button
                type="button"
                onClick={() => {
                  const a = (newAmenity || "").trim();
                  if (a && !formData.amenities.includes(a)) {
                    handleChange("amenities", [...formData.amenities, a]);
                    setNewAmenity("");
                  }
                }}
                className="
                  inline-flex items-center justify-center
                  rounded-full bg-gradient-to-r from-blue-500 to-blue-600
                  px-6 py-3 text-sm font-semibold text-white shadow-md
                  hover:from-blue-600 hover:to-blue-700 transition
                "
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={prevStep}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
          >
            Back
          </button>

          <button
            type="button"
            onClick={saveDraft}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition"
          >
            Save to Drafts
          </button>

          <button
            type="button"
            onClick={nextStep}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition"
          >
            Next
          </button>
        </div>
      </section>
    )}

      {/* 📸 Screen 6 */}
      {step === 6 && (
      <section
        className="
          px-3 sm:px-6 md:px-8 py-12 sm:py-16
          min-h-[calc(100vh-56px)]
          grid grid-rows-[auto,auto,1fr,auto] gap-6
          bg-gradient-to-br from-blue-50 via-white to-indigo-50
        "
      >
        {/* Title */}
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
            Show guests what your place looks like
          </h1>
          <p className="mt-2 text-gray-700 text-sm sm:text-base">
            Upload high-quality photos to attract more guests.
          </p>
        </div>

        {/* Uploader + Grid */}
        <div className="w-full max-w-5xl mx-auto space-y-6">
          {/* Upload Dropzone (click-to-upload) */}
          <div
            className="
              rounded-3xl border-2 border-dashed border-blue-300
              bg-white/70 backdrop-blur-md
              shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)]
              p-5 sm:p-6 md:p-8 text-center
            "
          >
            <label
              htmlFor="photo-upload"
              className="
                cursor-pointer select-none flex flex-col items-center justify-center gap-3
              "
            >
              <span
                className="
                  grid place-items-center w-16 h-16 sm:w-20 sm:h-20
                  rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100
                  text-blue-700 ring-4 ring-white/60 shadow
                "
              >
                <UploadCloud className="w-8 h-8 sm:w-10 sm:h-10" />
              </span>

              <div>
                <p className="text-base sm:text-lg font-semibold text-gray-900">
                  Click to upload images
                </p>
                <p className="text-xs sm:text-sm text-gray-600">
                  You can select multiple files (PNG, JPG)
                </p>
              </div>
            </label>

            <input
              id="photo-upload"
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                if (!files.length) return;

                const uploadedUrls = [];
                for (const file of files) {
                  const formDataUpload = new FormData();
                  formDataUpload.append("file", file);
                  formDataUpload.append("upload_preset", UPLOAD_PRESET);

                  try {
                    const response = await fetch(
                      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
                      { method: "POST", body: formDataUpload }
                    );
                    const data = await response.json();
                    if (data.secure_url) {
                      uploadedUrls.push(data.secure_url);
                    }
                  } catch (err) {
                    console.error("Upload failed:", err);
                    alert("Failed to upload image. Try again.");
                  }
                }

                if (uploadedUrls.length) {
                  setFormData((prev) => ({
                    ...prev,
                    photos: [...prev.photos, ...uploadedUrls],
                  }));
                }
                // optional: e.target.value = ""; // reset file input
              }}
            />
          </div>

          {/* Thumbnails Grid */}
          <div
            className="
              rounded-3xl bg-white/80 backdrop-blur-md border border-white/60
              shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)]
              p-4 sm:p-6
            "
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Uploaded photos</h3>
              <span className="text-xs text-gray-600">{formData.photos?.length || 0} total</span>
            </div>

            {formData.photos?.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {formData.photos.map((url, index) => (
                  <div
                    key={index}
                    className="
                      group relative aspect-[4/3] w-full
                      overflow-hidden rounded-2xl border border-gray-200 bg-white
                      shadow-sm
                    "
                  >
                    {/* placeholder bg while image loads */}
                    <div className="absolute inset-0 grid place-items-center bg-gray-100">
                      <ImageIcon className="w-6 h-6 text-gray-400" />
                    </div>

                    <img
                      src={url}
                      alt={`Photo ${index + 1}`}
                      className="relative z-10 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      loading="lazy"
                    />

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => {
                        const newPhotos = formData.photos.filter((_, i) => i !== index);
                        setFormData({ ...formData, photos: newPhotos });
                      }}
                      aria-label={`Remove photo ${index + 1}`}
                      className="absolute z-20 top-2 right-2 inline-flex w-8 h-8 items-center justify-center rounded-full bg-white/90 hover:bg-white border border-gray-200 shadow"
                    >
                      <X className="w-4 h-4 text-gray-700" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-10 text-gray-500 text-sm">
                No photos uploaded yet.
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={prevStep}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
          >
            Back
          </button>

          <button
            type="button"
            onClick={saveDraft}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition"
          >
            Save to Drafts
          </button>

          <button
            type="button"
            onClick={nextStep}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition"
          >
            Next
          </button>
        </div>
      </section>
    )}

      {/* 📝 Screen 7 */}
      {step === 7 && (
        <section
          className="
            px-3 sm:px-6 md:px-8 py-12 sm:py-16
            min-h-[calc(100vh-56px)]
            grid grid-rows-[auto,1fr,auto] gap-6
            bg-gradient-to-br from-blue-50 via-white to-indigo-50
          "
        >
          {/* Title */}
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
              Add a title and description
            </h1>
            <p className="mt-2 text-gray-700 text-sm sm:text-base">
              Create an appealing title and detailed description to highlight your listing.
            </p>
          </div>

          {/* Content */}
          <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Left: Form */}
            <div className="
              rounded-3xl bg-white/80 backdrop-blur-md border border-white/60
              shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)]
              p-4 sm:p-6 md:p-8
            ">
              {/* Listing Title */}
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Listing Title
              </label>

              <div className="relative">
                <div className="
                  pointer-events-none absolute left-3 top-1/2 -translate-y-1/2
                  grid place-items-center w-9 h-9 rounded-xl
                  bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700
                  ring-4 ring-white/60 shadow
                ">
                  <Heading1 className="w-4.5 h-4.5" />
                </div>

                <input
                  type="text"
                  placeholder="e.g., Cozy Beachfront Villa"
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  className="
                    w-full rounded-2xl border border-gray-300 bg-white/90
                    pl-14 pr-4 py-3 text-gray-900 shadow-sm
                    placeholder:text-gray-400
                    focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500
                  "
                />
              </div>

              {/* Title helper + counter */}
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-gray-600">Keep it short and compelling (≈ 50–60 chars)</p>
                <span className="text-xs font-medium text-gray-700">
                  {(formData.title?.length || 0)}/60
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                  style={{ width: `${Math.min(100, ((formData.title?.length || 0) / 60) * 100)}%` }}
                />
              </div>

              {/* Description */}
              <label className="block text-sm font-semibold text-gray-900 mt-6 mb-2">
                Detailed Description
              </label>

              <div className="relative">
                <div className="
                  pointer-events-none absolute left-3 top-3
                  grid place-items-center w-9 h-9 rounded-xl
                  bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700
                  ring-4 ring-white/60 shadow
                ">
                  <AlignLeft className="w-4.5 h-4.5" />
                </div>

                <textarea
                  rows={8}
                  placeholder="Describe your place, amenities, and what makes it special..."
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  className="
                    w-full rounded-2xl border border-gray-300 bg-white/90
                    pl-14 pr-4 py-3 text-gray-900 shadow-sm
                    placeholder:text-gray-400
                    focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500
                    resize-y
                  "
                />
              </div>

              {/* Description helper + counter */}
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-gray-600">Aim for clarity and helpful details (≈ 200–600 chars)</p>
                <span className="text-xs font-medium text-gray-700">
                  {(formData.description?.length || 0)}/1000
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                  style={{ width: `${Math.min(100, ((formData.description?.length || 0) / 1000) * 100)}%` }}
                />
              </div>
            </div>

            {/* Right: Tips / Suggestions */}
            <div className="
              rounded-3xl bg-white/70 backdrop-blur-md border border-white/60
              shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)]
              p-4 sm:p-6 md:p-8
            ">
              <div className="flex items-center gap-3">
                <div className="
                  grid place-items-center w-10 h-10 rounded-xl
                  bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700
                  ring-4 ring-white/60 shadow
                ">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Writing tips</h3>
              </div>

              <ul className="mt-4 space-y-3 text-sm text-gray-700">
                <li>• Start with the most attractive highlight (e.g., “Beachfront”, “City-view”).</li>
                <li>• Mention capacity, key amenities, and nearby landmarks.</li>
                <li>• Keep sentences concise; avoid all caps and heavy emojis.</li>
                <li>• Proofread for grammar and clarity.</li>
              </ul>

              <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <p className="text-sm text-blue-900">
                  <span className="font-semibold">Example title:</span> Sunny Beachfront Villa with Private Pool
                </p>
                <p className="mt-2 text-sm text-blue-900">
                  <span className="font-semibold">Example description:</span> Wake up to ocean views in this airy 3-bedroom villa.
                  Steps from the beach, with private pool, fast Wi-Fi, full kitchen, and parking. Cafés and markets within a 5-minute walk.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={prevStep}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
            >
              Back
            </button>

            <button
              type="button"
              onClick={saveDraft}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition"
            >
              Save to Drafts
            </button>

            <button
              type="button"
              onClick={nextStep}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition"
            >
              Next
            </button>
          </div>
        </section>
      )}

      {/* 💰 Screen 8 */}
      {step === 8 && (
  <section
    className="
      px-3 sm:px-6 md:px-8 py-12 sm:py-16
      min-h-[calc(100vh-56px)]
      grid grid-rows-[auto,1fr,auto] gap-6
      bg-gradient-to-br from-blue-50 via-white to-indigo-50
    "
  >
    {/* Title */}
    <div className="max-w-3xl mx-auto text-center">
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
        Set your nightly price
      </h1>
      <p className="mt-2 text-gray-700 text-sm sm:text-base">
        Choose a competitive price and optional fees.
      </p>
    </div>

    {/* Content: Form + Summary */}
    <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      {/* Left: Form (2 columns on large) */}
      <div className="lg:col-span-2 space-y-4 sm:space-y-6">
        {/* Nightly Price */}
        <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-4 sm:p-6 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)]">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Price per night
          </label>
          <div className="relative">
            <div className="
              pointer-events-none absolute left-3 top-1/2 -translate-y-1/2
              grid place-items-center w-10 h-10 rounded-xl
              bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700
              ring-4 ring-white/60 shadow
            ">
              <BadgeDollarSign className="w-5 h-5" />
            </div>
            <span className="absolute left-14 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
              ₱
            </span>
            <input
              type="number"
              min={0}
              inputMode="decimal"
              placeholder="e.g., 2500"
              value={formData.price}
              onChange={(e) => handleChange("price", e.target.value)}
              className="
                w-full rounded-2xl border border-gray-300 bg-white/90
                pl-20 pr-4 py-3 text-gray-900 shadow-sm
                placeholder:text-gray-400
                focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500
              "
            />
          </div>
          <p className="mt-2 text-xs text-gray-600 flex items-center gap-1">
            <Info className="w-4 h-4" /> You can adjust this anytime after publishing.
          </p>
        </div>

        {/* Cleaning Fee */}
        <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-4 sm:p-6 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)]">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Cleaning fee <span className="text-gray-500">(optional)</span>
          </label>
          <div className="relative">
            <div className="
              pointer-events-none absolute left-3 top-1/2 -translate-y-1/2
              grid place-items-center w-10 h-10 rounded-xl
              bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700
              ring-4 ring-white/60 shadow
            ">
              <Brush className="w-5 h-5" />
            </div>
            <span className="absolute left-14 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
              ₱
            </span>
            <input
              type="number"
              min={0}
              inputMode="decimal"
              placeholder="e.g., 500"
              value={formData.cleaningFee}
              onChange={(e) => handleChange("cleaningFee", e.target.value)}
              className="
                w-full rounded-2xl border border-gray-300 bg-white/90
                pl-20 pr-4 py-3 text-gray-900 shadow-sm
                placeholder:text-gray-400
                focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500
              "
            />
          </div>
          <p className="mt-2 text-xs text-gray-600">
            One-time fee added to each booking.
          </p>
        </div>

        {/* Discount Controls */}
        <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-4 sm:p-6 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] space-y-4">
          <label className="block text-sm font-semibold text-gray-900">
            Discounts <span className="text-gray-500">(optional)</span>
          </label>

          {/* Discount Type - segmented */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { key: "none", label: "None", Icon: Tag },
              { key: "percentage", label: "% Off", Icon: Percent },
              { key: "fixed", label: "₱ Off", Icon: BadgeDollarSign },
            ].map(({ key, label, Icon }) => {
              const active = (formData.discountType || "none") === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleChange("discountType", key)}
                  aria-pressed={active}
                  className={[
                    "w-full rounded-2xl border px-3 py-2.5 sm:py-3 flex items-center justify-center gap-2",
                    "transition-all duration-200",
                    active
                      ? "border-blue-500 bg-blue-50/80 shadow-[0_8px_20px_rgba(30,58,138,0.10)]"
                      : "border-gray-200 bg-white/70 hover:bg-gray-50",
                    "text-sm font-semibold text-gray-900",
                  ].join(" ")}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Discount Value */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Discount value
            </label>
            <div className="relative">
              {/* left badge shows unit depending on type */}
              <div className="
                pointer-events-none absolute left-3 top-1/2 -translate-y-1/2
                grid place-items-center w-10 h-10 rounded-xl
                bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700
                ring-4 ring-white/60 shadow
              ">
                {(formData.discountType === "percentage") ? (
                  <Percent className="w-5 h-5" />
                ) : (
                  <BadgeDollarSign className="w-5 h-5" />
                )}
              </div>

              {formData.discountType === "percentage" && (
                <span className="absolute left-14 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                  %
                </span>
              )}
              {formData.discountType === "fixed" && (
                <span className="absolute left-14 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                  ₱
                </span>
              )}

              <input
                type="number"
                min={0}
                inputMode="decimal"
                placeholder={
                  formData.discountType === "percentage" ? "e.g., 10" :
                  formData.discountType === "fixed" ? "e.g., 300" :
                  "Select a discount type first"
                }
                value={formData.discountValue}
                onChange={(e) => handleChange("discountValue", Number(e.target.value || 0))}
                disabled={!formData.discountType || formData.discountType === "none"}
                className={[
                  "w-full rounded-2xl border bg-white/90 pr-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400",
                  formData.discountType === "percentage" || formData.discountType === "fixed"
                    ? "pl-20 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                    : "pl-4 border-gray-200",
                  (!formData.discountType || formData.discountType === "none")
                    ? "opacity-50 pointer-events-none"
                    : "",
                ].join(" ")}
              />
            </div>

            {/* tiny helper */}
            <p className="mt-2 text-xs text-gray-600">
              Percentage applies to nightly price only; fixed amount is deducted per booking.
            </p>
          </div>
        </div>
      </div>

      {/* Right: Live Summary */}
      <div className="
        rounded-3xl bg-white/80 backdrop-blur-md border border-white/60
        shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)]
        p-4 sm:p-6 md:p-8 h-fit
      ">
        <div className="flex items-center gap-3">
          <div className="
            grid place-items-center w-10 h-10 rounded-xl
            bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700
            ring-4 ring-white/60 shadow
          ">
            <Calculator className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Price summary</h3>
        </div>

        {(() => {
          const price = Number(formData.price || 0);
          const clean = Number(formData.cleaningFee || 0);
          const type  = formData.discountType || "none";
          const dVal  = Number(formData.discountValue || 0);

          // % discount is per-night
          const discountPerNight = type === "percentage" ? Math.max(0, (price * dVal) / 100) : 0;
          const nightlyAfter     = Math.max(0, price - discountPerNight);

          // Use 1 night as the preview default until real dates are chosen
          const hasDates        = !!(formData?.availability?.start && formData?.availability?.end);
          const nightsSelected  = nightsBetween(formData?.availability?.start, formData?.availability?.end);
          const displayNights   = hasDates && nightsSelected > 0 ? nightsSelected : 1;

          // Fixed discount is per booking
          const fixedDiscount = type === "fixed" ? Math.max(0, dVal) : 0;

          const staySubtotal = displayNights * nightlyAfter;
          const bookingTotal = Math.max(0, staySubtotal + clean - fixedDiscount);

          return (
            <div className="mt-4 space-y-3 text-sm text-gray-800">
              <div className="flex items-center justify-between">
                <span>Nightly price</span>
                <span className="font-semibold">₱{price.toLocaleString()}</span>
              </div>

              {type === "percentage" && (
                <div className="flex items-center justify-between">
                  <span>Discount per night ({dVal || 0}%)</span>
                  <span className="font-semibold">
                    − ₱{discountPerNight.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span>Nights</span>
                <span className="font-semibold">{displayNights}</span>
              </div>

              <div className="flex items-center justify-between">
                <span>Cleaning fee</span>
                <span className="font-semibold">₱{clean.toLocaleString()}</span>
              </div>

              {type === "fixed" && dVal > 0 && (
                <div className="flex items-center justify-between">
                  <span>Discount (fixed, per booking)</span>
                  <span className="font-semibold">
                    − ₱{fixedDiscount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="h-px bg-gray-200 my-1" />

              <div className="flex items-center justify-between text-base">
                <span className="font-semibold text-gray-900">Estimated total / booking</span>
                <span className="font-bold text-blue-700">
                  ₱{bookingTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>

              {(!hasDates || nightsSelected <= 0) && (
                <p className="text-xs text-gray-600 mt-2">
                  Preview assumes <b>1 night</b>. Select dates to see the exact total.
                </p>
              )}
            </div>
          );
        })()}
      </div>
    </div>

    {/* Actions */}
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
      <button
        type="button"
        onClick={prevStep}
        className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
      >
        Back
      </button>

      <button
        type="button"
        onClick={saveDraft}
        className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition"
      >
        Save to Drafts
      </button>

      <button
        type="button"
        onClick={nextStep}
        className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition"
      >
        Next
      </button>
    </div>
  </section>
)}

      {/* 📅 Screen 9 - Enhanced with Calendar */}
      {step === 9 && (
        <section
          className="
            px-4 md:px-8 py-12
            min-h-[calc(100vh-56px)]
            grid grid-rows-[auto,1fr,auto] gap-6
            bg-gradient-to-br from-blue-50 via-white to-indigo-50
          "
        >
          {/* Title */}
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              When can guests book your place?
            </h1>
            <p className="mt-2 text-gray-700">
              Set the dates when your listing is available.
            </p>
          </div>

          {/* Content */}
          <div className="max-w-5xl w-full mx-auto h-full">
            <div className="
              rounded-3xl border border-white/20 bg-white/80 backdrop-blur-md
              p-5 sm:p-6 md:p-8
              shadow-[0_12px_30px_rgba(30,58,138,0.10),0_30px_60px_rgba(30,58,138,0.08)]
            ">
              {/* Inputs */}
              <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-900">Availability (date range)</label>

              <div className="rounded-2xl border border-gray-300 bg-white/90 p-3 shadow-sm">
              <DatePicker
                inline
                selectsRange
                startDate={startDate}
                endDate={endDate}
                onChange={handleRangeChange}
                minDate={new Date()}
                monthsShown={2}
                shouldCloseOnSelect={false}
                calendarClassName="bookify-calendar"
              />
            </div>

              {/* Optional quick actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, availability: { start: "", end: "" } }))
                  }
                  className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
                >
                  Clear
                </button>
              </div>
            </div>

              {/* Summary / validation */}
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {/* Nights badge */}
                <div className="inline-flex items-center gap-2">
                  <span className="text-sm text-gray-700">
                    {start && end && !invalidRange ? (
                      <>
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-blue-700 font-semibold text-xs shadow-sm">
                          {nights} {nights === 1 ? "night" : "nights"}
                        </span>
                        <span className="ml-2 text-gray-700">
                          {start} → {end}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-600">Select a start and end date</span>
                    )}
                  </span>
                </div>

                {/* Error note */}
                {invalidRange && (
                  <p className="text-sm font-medium text-red-600">
                    End date must be after the start date.
                  </p>
                )}

                {/* Quick actions */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        availability: { start: "", end: "" },
                      })
                    }
                    className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={prevStep}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
            >
              Back
            </button>

            <button
              type="button"
              onClick={saveDraft}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition"
            >
              Save to Drafts
            </button>

            <button
              type="button"
              onClick={nextStep}
              disabled={!start || !end || invalidRange}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 disabled:pointer-events-none"
            >
              Next
            </button>
          </div>
        </section>
      )}

      {/* ✅ Screen 10 */}
      {step === 10 && (
      <section
        className="
          px-4 md:px-8 py-10
          min-h-[calc(100vh-56px)]
          grid grid-rows-[auto,1fr,auto] gap-6
          bg-gradient-to-br from-blue-50 via-white to-indigo-50
        "
      >
        {/* Title */}
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Review and publish
          </h1>
          <p className="mt-2 text-gray-700">
            Double-check your details before publishing your listing.
          </p>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Photo preview / carousel */}
          <div
            className="
              relative rounded-3xl overflow-hidden
              bg-white/70 backdrop-blur-md border border-white/60
              shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)]
              hover:shadow-[0_12px_30px_rgba(30,58,138,0.12),_0_30px_60px_rgba(30,58,138,0.12)]
              transition-shadow p-5 sm:p-6 md:p-8
            "
          >
            {formData.photos?.length ? (
              <>
                {/* Hero preview (large) */}
                <div
                  className="
                    relative w-full rounded-2xl overflow-hidden border border-gray-200 bg-gray-50
                    h-[300px] sm:h-[380px] md:h-[460px] lg:h-[560px]
                  "
                >
                  <img
                    src={formData.photos[currentPhotoIndex || 0]}
                    alt={`Listing Photo ${(currentPhotoIndex || 0) + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />

                  {/* Index pill */}
                  <div className="absolute top-3 right-3 rounded-full bg-black/55 text-white text-xs font-medium px-3 py-1">
                    {(currentPhotoIndex || 0) + 1} / {formData.photos.length}
                  </div>

                  {/* Prev / Next */}
                  {formData.photos.length > 1 && (
                    <>
                      <button
                        type="button"
                        aria-label="Previous photo"
                        onClick={() => setCurrentPhotoIndex((prev) => Math.max(0, (prev || 0) - 1))}
                        disabled={(currentPhotoIndex || 0) === 0}
                        className="
                          absolute left-3 top-1/2 -translate-y-1/2
                          h-11 w-11 rounded-full bg-white/85 hover:bg-white
                          border border-white/60 shadow grid place-items-center
                          disabled:opacity-50 disabled:pointer-events-none
                        "
                      >
                        <ChevronLeft className="w-5 h-5 text-gray-700" />
                      </button>

                      <button
                        type="button"
                        aria-label="Next photo"
                        onClick={() =>
                          setCurrentPhotoIndex((prev) =>
                            Math.min(formData.photos.length - 1, (prev || 0) + 1)
                          )
                        }
                        disabled={(currentPhotoIndex || 0) === formData.photos.length - 1}
                        className="
                          absolute right-3 top-1/2 -translate-y-1/2
                          h-11 w-11 rounded-full bg-white/85 hover:bg-white
                          border border-white/60 shadow grid place-items-center
                          disabled:opacity-50 disabled:pointer-events-none
                        "
                      >
                        <ChevronRight className="w-5 h-5 text-gray-700" />
                      </button>
                    </>
                  )}
                </div>

                {/* Thumbnails filmstrip */}
                <div className="mt-4 flex gap-3 overflow-x-auto">
                  {formData.photos.map((url, index) => {
                    const active = index === (currentPhotoIndex || 0);
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setCurrentPhotoIndex(index)}
                        className={[
                          "relative flex-none rounded-xl overflow-hidden border transition",
                          "w-28 sm:w-32 aspect-[4/3]",
                          active
                            ? "border-blue-500 ring-2 ring-blue-400/60"
                            : "border-gray-200 hover:border-gray-300",
                        ].join(" ")}
                      >
                        <img
                          src={url}
                          alt={`Thumbnail ${index + 1}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              // Empty state (same footprint as hero)
              <div className="grid place-items-center rounded-2xl border border-dashed border-gray-300 bg-white/70 h-[300px] sm:h-[380px] md:h-[460px] lg:h-[560px]">
                <div className="text-center p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 grid place-items-center shadow-inner mb-3">
                    <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 17h16M7 4v16M17 4v16"/>
                    </svg>
                  </div>
                  <p className="text-gray-800 font-semibold">No photos uploaded</p>
                  <p className="text-gray-600 text-sm">Add photos on the previous step to preview here.</p>
                </div>
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div className="
            rounded-3xl bg-white/80 backdrop-blur-md border border-white/60
            shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]
            overflow-hidden flex flex-col
          ">
            <div className="px-6 sm:px-8 pt-6">
              <h2 className="text-2xl font-bold text-gray-900">Listing Details</h2>
              <p className="text-gray-600 text-sm mt-1">Here’s a summary of your setup.</p>
            </div>

            <div className="px-6 sm:px-8 py-6 space-y-3 overflow-auto">
              <DetailRow label="Category" value={formData.category || "Not set"} />
              <DetailRow label="Listing Type" value={formData.listingType || "Not set"} />
              <DetailRow
                label="Location"
                value={
                  formData.location ||
                  [
                    regions.find((r) => r.code === formData.region)?.name,
                    provinces.find((p) => p.code === formData.province)?.name,
                    municipalities.find((m) => m.code === formData.municipality)?.name,
                    barangays.find((b) => b.code === formData.barangay)?.name,
                    formData.street,
                  ]
                    .filter(Boolean)
                    .join(", ") || "Not set"
                }
              />
              <DetailRow label="Property Type" value={formData.propertyType || "Not set"} />

              {/* Guests breakdown (object) */}
              <DetailRow
                label="Guests"
                value={
                  (() => {
                    const a = Number(formData?.guests?.adults ?? 0);
                    const c = Number(formData?.guests?.children ?? 0);
                    const i = Number(formData?.guests?.infants ?? 0);
                    const total = a + c + i;
                    return total > 0
                      ? `${total} total (Adults: ${a}, Children: ${c}, Infants: ${i})`
                      : "0";
                  })()
                }
              />

              <DetailRow
                label="Rooms"
                value={`Bedrooms: ${formData.bedrooms || 0} | Beds: ${formData.beds || 0} | Bathrooms: ${formData.bathrooms || 0}`}
              />

              <DetailRow
                label="Amenities"
                value={formData.amenities?.length ? formData.amenities.join(", ") : "None"}
              />

              <DetailRow label="Title" value={formData.title || "Not set"} />
              <DetailRow label="Description" value={formData.description || "Not set"} />

              <DetailRow
                label="Price"
                value={formData.price ? `₱${Number(formData.price).toLocaleString()}` : "Not set"}
              />
              <DetailRow
                label="Cleaning Fee"
                value={
                  formData.cleaningFee
                    ? `₱${Number(formData.cleaningFee).toLocaleString()}`
                    : "Not set"
                }
              />
              <DetailRow
                label="Discount"
                value={
                  formData.discountType && formData.discountType !== "none"
                    ? formData.discountType === "percentage"
                      ? `${formData.discountValue || 0}%`
                      : `₱${Number(formData.discountValue || 0).toLocaleString()}`
                    : "None"
                }
              />
              <DetailRow
                label="Availability"
                value={
                  formData?.availability?.start && formData?.availability?.end
                    ? `${formData.availability.start} to ${formData.availability.end}`
                    : "Not set"
                }
              />
            </div>

            {/* Terms */}
            <div className="px-6 sm:px-8 pb-6">
              <label className="flex items-start gap-3 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!formData.agreeToTerms}
                  onChange={(e) => handleChange("agreeToTerms", e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  I agree to the hosting{" "}
                  <button
                    type="button"
                    className="text-blue-600 hover:text-blue-700 underline underline-offset-2"
                    onClick={() => setOpenPolicyModal(true)}
                  >
                    Policy &amp; Compliance
                  </button>{" "}
                  terms.
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={prevStep}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
          >
            Back
          </button>

          <button
            type="button"
            onClick={saveDraft}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition"
          >
            Save to Drafts
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!formData.agreeToTerms}
            className="
              w-full sm:w-auto inline-flex items-center justify-center
              rounded-full bg-gradient-to-r from-blue-500 to-blue-600
              px-7 py-3 text-sm font-semibold text-white shadow-md
              hover:from-blue-600 hover:to-blue-700
              transition disabled:opacity-50 disabled:pointer-events-none
            "
          >
            Publish
          </button>
        </div>

        {/* Policy modal (unchanged API) */}
        <PolicyComplianceModal
          open={openPolicyModal}
          onClose={() => setOpenPolicyModal(false)} 
          onConfirm={() => { 
            // mark that they agreed via the modal 
            setFormData(prev => ({ ...prev, agreeToTerms: true })); 
          }} 
        />

      </section>
    )}
    </div>
  );
};
