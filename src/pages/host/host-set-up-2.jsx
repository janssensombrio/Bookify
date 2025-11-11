import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { doc, getDoc, collection, addDoc, updateDoc, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { auth, database } from "../../config/firebase";
import "./styles/host-set-up.css";
import LocationPickerMapString from "./components/LocationPickerMap";
import PolicyComplianceModal from "./components/PolicyComplianceModal";

// Icons (UI only)
import {
  UtensilsCrossed,
  Mountain,
  Heart,
  Landmark,
  Film,
  CalendarDays,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  LocateFixed,
  Clock3,
  Heading1,
  Users,
  MapPin,
  Video,
  Shield,
  Languages,
  Search,
  Plus,
  Check,
  BadgeDollarSign,
  Info,
  UploadCloud,
  Image as ImageIcon,
  FileText,
  ShieldCheck,
  ShieldAlert,
  CalendarClock,
  Percent,
  Tag,
  Calculator,
} from "lucide-react";

const CLOUD_NAME = "dijmlbysr"; // From Cloudinary dashboard
const UPLOAD_PRESET = "listing-uploads"; // Create an unsigned preset in Cloudinary for uploads

export const HostSetUpExperiences = () => {
  const location = useLocation();

  const initialCategory = location.state?.category || "";

  // for the schedule
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ date: "", time: "" });

  const [newAmenity, setNewAmenity] = useState("");
  const [languageInput, setLanguageInput] = useState("");

  const [openPolicyModal, setOpenPolicyModal] = useState(false);

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // for swithcing between pages
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [listingType, setListingType] = useState(""); // subcategory selected

  const [formData, setFormData] = useState({
    category: "Experiences",
    listingType: "",
    title: "",
    location: "",
    duration: "", // in hours or minutes
    maxParticipants: 1,
    ageRestriction: { min: 0, max: 100 },
    experienceType: "in-person", // in-person or online
    languages: [],
    schedule: [], // array of date/time objects {date, time}
    price: 0, // per participant
    // NEW: Discounts (modeled like Homes)
    discountType: "none", // none | percentage | fixed
    discountValue: 0, // number; % or fixed ₱ per booking
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
    setFormData((prev) => ({ ...prev, [key]: value }));
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

  const [draftId, setDraftId] = useState(null);

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
      let lastName = fromAuth.lastName || "";
      let photoURL = user.photoURL || "";
      const isVerified = true;

      // Optional: if you keep a users/{uid} profile doc, prefer its values
      try {
        const profSnap = await getDoc(doc(database, "users", user.uid));
        if (profSnap.exists()) {
          const p = profSnap.data() || {};
          firstName = p.firstName ?? firstName;
          lastName = p.lastName ?? lastName;
          photoURL = p.photoURL ?? photoURL;
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
        displayName: `${firstName} ${lastName}`.trim() || user.displayName || "",
        isVerified,
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

  const saveDraft = async () => {
    try {
      await saveHost();

      const user = auth.currentUser;
      if (!user) return alert("You must be logged in to save a draft.");

      const normalized = {
        ...formData,
        price: Number(formData.price || 0),
        discountValue: Number(formData.discountValue || 0),
      };

      const dataToSave = {
        ...normalized,
        uid: user.uid,
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

  const handleSubmit = async () => {
    try {
      await saveHost();

      const user = auth.currentUser;
      if (!user) return alert("You must be logged in to publish.");

      const normalized = {
        ...formData,
        price: Number(formData.price || 0),
        discountValue: Number(formData.discountValue || 0),
      };

      const dataToSave = {
        ...normalized,
        uid: user.uid,
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

  const handleGetStarted = async () => {
    if (!listingType) return alert("Please select a subcategory to get started.");
    setFormData({ ...formData, listingType });
    setStep(2); // go to the next step
  };

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

  useEffect(() => {
    if (formData.schedule && Array.isArray(formData.schedule)) {
      const normalized = formData.schedule.map((item) =>
        typeof item === "string" ? { date: item, startTime: "", endTime: "" } : item
      );
      setFormData((prev) => ({ ...prev, schedule: normalized }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!formData.schedule) setFormData((prev) => ({ ...prev, schedule: [] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const languageOptions = [
    "English",
    "Spanish",
    "French",
    "Mandarin",
    "Tagalog",
    "Arabic",
    "Hindi",
    "Bengali",
    "Portuguese",
    "Russian",
    "Japanese",
    "Korean",
    "German",
    "Italian",
    "Turkish",
    "Vietnamese",
    "Polish",
    "Dutch",
    "Thai",
    "Greek",
    "Swedish",
    "Czech",
    "Finnish",
    "Hungarian",
    "Romanian",
    "Hebrew",
    "Indonesian",
    "Malay",
    "Tamil",
    "Urdu",
    "Persian",
    "Punjabi",
    "Ukrainian",
    "Serbian",
    "Croatian",
    "Bulgarian",
    "Danish",
    "Norwegian",
    "Slovak",
    "Slovenian",
    "Latvian",
    "Lithuanian",
    "Estonian",
    "Swahili",
    "Filipino",
    "Cantonese",
    "Nepali",
    "Sinhala",
    "Burmese",
    "Khmer",
    "Lao",
    "Mongolian",
    "Amharic",
    "Zulu",
    "Xhosa",
    "Afrikaans",
  ];

  const baseWrap = "max-w-6xl mx-auto px-4 sm:px-6";
  const headerSpacer = <div className="h-10 sm:h-16" />;
  const sectionCard = "bg-white border border-gray-200 rounded-2xl shadow-sm p-6";
  const h1Style = "text-3xl sm:text-4xl font-semibold text-indigo-600";
  const h2Style = "text-2xl font-semibold text-indigo-600";
  const labelStyle = "block text-left text-sm font-medium text-gray-700 mb-1";
  const inputStyle =
    "w-full rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition px-4 py-2";
  const selectStyle = inputStyle;
  const btn = "inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium transition shadow-sm";
  const btnPrimary = `${btn} bg-indigo-600 text-white hover:bg-indigo-700`;
  const btnSecondary = `${btn} border border-gray-300 bg-white hover:bg-gray-50`;
  const btnText = "inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium text-indigo-700 hover:bg-indigo-50";

  return (
    <div className="host-setup-page bg-gray-50 min-h-screen">
      {/* Step 1 — Redesigned */}
      {step === 1 && (
        <section
          className="
            px-4 md:px-8 py-20
            min-h-[calc(100vh-56px)]
            grid grid-rows-[auto,1fr,auto] gap-12
            bg-gradient-to-br from-indigo-50 via-white to-blue-50
          "
        >
          {/* Title */}
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Select Your Experience Type</h1>
            <p className="mt-2 text-gray-700">Choose the type of experience you're offering to get started.</p>
          </div>

          {/* Full-height selectable options */}
          <div
            role="radiogroup"
            aria-label="Experience type"
            className="
              max-w-6xl mx-auto w-full
              grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5
              gap-4 sm:gap-6 h-full
            "
          >
            {[
              {
                value: "Food",
                label: "Food",
                desc: "Culinary adventures and dining experiences.",
                Icon: UtensilsCrossed,
              },
              {
                value: "Adventure",
                label: "Adventure",
                desc: "Thrilling outdoor and exploratory activities.",
                Icon: Mountain,
              },
              {
                value: "Wellness",
                label: "Wellness",
                desc: "Relaxing and health-focused experiences.",
                Icon: Heart,
              },
              {
                value: "Culture",
                label: "Culture",
                desc: "Immersive cultural and historical tours.",
                Icon: Landmark,
              },
              {
                value: "Entertainment",
                label: "Entertainment",
                desc: "Fun events and entertainment options.",
                Icon: Film,
              },
            ].map(({ value, label, desc, Icon }) => {
              const active = listingType === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setListingType(value)}
                  role="radio"
                  aria-checked={active}
                  aria-label={label}
                  className={[
                    "group relative w-full h-full rounded-3xl overflow-hidden",
                    "bg-white/80 backdrop-blur-md border border-white/60",
                    "shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]",
                    "hover:shadow-[0_12px_30px_rgba(30,58,138,0.12),0_30px_60px_rgba(30,58,138,0.12)]",
                    "transition-all duration-300 hover:-translate-y-1 active:translate-y-0",
                    active ? "ring-2 ring-blue-400/50 border-blue-600/60" : "",
                    "flex flex-col",
                  ].join(" ")}
                >
                  {/* Sheen for depth */}
                  <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-white/50 to-transparent" />

                  {/* Icon + text */}
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
                      <Icon className="w-10 h-10 sm:w-12 sm:h-12" />
                    </div>

                    <h3 className="mt-4 text-lg sm:text-xl font-semibold text-gray-900">{label}</h3>
                    <p className="mt-1 text-sm sm:text-base text-gray-700 max-w-[28ch]">{desc}</p>
                  </div>

                  {/* Bottom state bar */}
                  <div
                    className={[
                      "relative px-6 sm:px-7 py-4 border-t",
                      active ? "border-blue-100 bg-blue-50/70" : "border-gray-100 bg-white/70",
                      "flex items-center justify-between",
                    ].join(" ")}
                  >
                    <span className="text-sm font-medium text-gray-700">{active ? "Selected" : "Click to select"}</span>
                    <span
                      className={[
                        "text-xs font-semibold px-3 py-1 rounded-full",
                        active ? "bg-blue-600 text-white shadow shadow-blue-600/30" : "bg-gray-100 text-gray-700",
                      ].join(" ")}
                    >
                      {label}
                    </span>
                  </div>

                  {/* Soft cast shadow */}
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
              onClick={handleGetStarted}
              disabled={!listingType}
              className="
                inline-flex items-center justify-center rounded-full
                bg-gradient-to-r from-blue-500 to-blue-600
                px-7 py-3 text-sm font-semibold text-white shadow-md
                hover:from-blue-600 hover:to-blue-700 transition
                disabled:opacity-50 disabled:pointer-events-none
              "
            >
              Get Started
            </button>
          </div>
        </section>
      )}

      {/* 📍 Step 2 – Map + Sidebar (no scroll) */}
      {step === 2 && (
        <section className="px-4 md:px-8 py-6 min-h-[calc(100vh-56px)] grid grid-rows-[auto,1fr,auto] gap-5 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Where will this experience happen?</h1>
            <p className="mt-2 text-gray-700">Drop a pin on the map, edit the address, then set a title and duration.</p>
          </div>

          {/* Two-column layout: Map (2) + Sticky sidebar (1) */}
          <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
            {/* Map card */}
            <div className="lg:col-span-2 rounded-3xl border border-white/20 bg-white/80 backdrop-blur-md p-4 sm:p-6 md:p-8 shadow-[0_12px_30px_rgba(30,58,138,0.10),0_30px_60px_rgba(30,58,138,0.08)] grid gap-4">
              <div className="rounded-2xl overflow-hidden border border-gray-200">
                {/* Keep your map height visible above the fold */}
                <div className="h-[360px] sm:h-[420px] md:h-[500px]">
                  <LocationPickerMapString
                    address={formData.location}
                    onAddressChange={(addr) => {
                      console.log("Map picked address:", addr);
                      handleChange("location", addr);
                    }}
                  />
                </div>
              </div>

              {/* Address field under the map */}
              <div className="grid gap-2" aria-live="polite">
                <label className="text-sm font-semibold text-gray-900">Address (editable)</label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                    <MapPin className="w-4.5 h-4.5" />
                  </div>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleChange("location", e.target.value)}
                    placeholder="Click on the map to populate, or type an address"
                    className="w-full rounded-2xl border border-gray-300 bg-white/90 pl-14 pr-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                  />
                </div>

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
                    className="inline-flex items-center gap-2 justify-center rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
                  >
                    <LocateFixed className="w-4 h-4" />
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

            {/* Sticky sidebar: Title + Duration + quick actions */}
            <aside className="lg:sticky lg:top-24 rounded-3xl border border-white/20 bg-white/80 backdrop-blur-md p-5 sm:p-6 md:p-8 shadow-[0_12px_30px_rgba(30,58,138,0.10),0_30px_60px_rgba(30,58,138,0.08)] grid gap-5">
              {/* Title */}
              <div className="grid gap-2 text-left">
                <label className="text-sm font-semibold text-gray-900">Experience Title</label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                    <Heading1 className="w-4.5 h-4.5" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g., Sunrise Hike & Coffee"
                    value={formData.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                    className="w-full rounded-2xl border border-gray-300 bg-white/90 pl-14 pr-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                  />
                </div>
                {/* helper meter */}
                <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                    style={{ width: `${Math.min(100, ((formData.title?.length || 0) / 60) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Duration */}
              <div className="grid gap-2 text-left">
                <label className="text-sm font-semibold text-gray-900">Duration</label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                    <Clock3 className="w-4.5 h-4.5" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g., 2 hours"
                    value={formData.duration}
                    onChange={(e) => handleChange("duration", e.target.value)}
                    className="w-full rounded-2xl border border-gray-300 bg-white/90 pl-14 pr-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                  />
                </div>

                {/* quick chips */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {["1 hour", "2 hours", "3 hours", "Half-day", "Full-day"].map((d) => {
                    const on = (formData.duration || "").toLowerCase() === d.toLowerCase();
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleChange("duration", d)}
                        className={[
                          "px-3 py-1.5 rounded-full text-xs font-semibold transition",
                          on ? "bg-blue-600 text-white shadow shadow-blue-600/30" : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                        ].join(" ")}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Inline actions so user doesn’t have to scroll */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={prevStep}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!formData.location || !formData.duration}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 disabled:pointer-events-none"
                >
                  Next
                </button>
              </div>
            </aside>
          </div>
        </section>
      )}

      {/* 🧑‍🤝‍🧑 Step 3 — Participants & Type */}
      {step === 3 && (() => {
        const minAge = Number(formData.ageRestriction?.min ?? 0);
        const maxAge = Number(formData.ageRestriction?.max ?? 100);
        const invalidAge = minAge > maxAge || minAge < 0 || maxAge < 0;

        const setAge = (key, val) =>
          setFormData((prev) => ({
            ...prev,
            ageRestriction: { ...prev.ageRestriction, [key]: Math.max(0, Number(val || 0)) },
          }));

        return (
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
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Participants & Experience Type</h1>
              <p className="mt-2 text-gray-700 text-sm sm:text-base">Set how many people can join, choose the format, and define age limits.</p>
            </div>

            {/* Content */}
            <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
              {/* Card: Max participants */}
              <div
                className="
                  lg:col-span-2 rounded-3xl bg-white/80 backdrop-blur-md border border-white/60
                  shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]
                  p-5 sm:p-6 md:p-8
                "
              >
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                    <Users className="w-6 h-6" />
                  </span>
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Maximum participants</h2>
                    <p className="text-sm text-gray-600">How many guests can attend this experience?</p>
                  </div>
                </div>

                {/* Counter */}
                <div className="mt-6 flex items-center justify-between">
                  <button
                    type="button"
                    aria-label="Decrease participants"
                    onClick={() => handleChange("maxParticipants", Math.max(1, Number(formData.maxParticipants || 1) - 1))}
                    className="w-11 h-11 rounded-full border border-gray-300 bg-white hover:bg-gray-50 active:scale-95 transition"
                  >
                    −
                  </button>

                  <input
                    type="number"
                    min={1}
                    value={formData.maxParticipants || 1}
                    onChange={(e) => handleChange("maxParticipants", Math.max(1, Number(e.target.value || 1)))}
                    className="w-24 text-center text-lg font-semibold text-gray-900 bg-transparent outline-none"
                  />

                  <button
                    type="button"
                    aria-label="Increase participants"
                    onClick={() => handleChange("maxParticipants", Math.max(1, Number(formData.maxParticipants || 1) + 1))}
                    className="w-11 h-11 rounded-full border border-blue-500 text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow active:scale-95 transition"
                  >
                    +
                  </button>
                </div>

                {/* Quick presets */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {[5, 10, 15, 20, 25].map((n) => {
                    const on = Number(formData.maxParticipants || 0) === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => handleChange("maxParticipants", n)}
                        className={[
                          "px-3 py-1.5 rounded-full text-xs font-semibold transition",
                          on ? "bg-blue-600 text-white shadow shadow-blue-600/30" : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                        ].join(" ")}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card: Experience type (segmented) */}
              <div
                className="
                  rounded-3xl bg-white/80 backdrop-blur-md border border-white/60
                  shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]
                  p-5 sm:p-6 md:p-8
                "
              >
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Experience type</h2>
                <p className="text-sm text-gray-600">Choose how guests will join.</p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {[
                    { key: "in-person", label: "In-person", Icon: MapPin, hint: "On-site / on location" },
                    { key: "online", label: "Online", Icon: Video, hint: "Live via video call" },
                  ].map(({ key, label, Icon, hint }) => {
                    const on = (formData.experienceType || "") === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => handleChange("experienceType", key)}
                        className={[
                          "w-full rounded-2xl border px-4 py-4 text-left transition-all duration-200",
                          on ? "border-blue-500 bg-blue-50/80 shadow-[0_8px_20px_rgba(30,58,138,0.10)]" : "border-gray-200 bg-white/70 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={[
                              "grid place-items-center rounded-xl w-10 h-10 ring-4 ring-white/60 shadow",
                              on
                                ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
                                : "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700",
                            ].join(" ")}
                          >
                            <Icon className="w-5 h-5" />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{label}</p>
                            <p className="text-xs text-gray-600">{hint}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card: Age restriction (full width on large) */}
              <div
                className="
                  lg:col-span-3 rounded-3xl bg-white/80 backdrop-blur-md border border-white/60
                  shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]
                  p-5 sm:p-6 md:p-8
                "
              >
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                    <Shield className="w-6 h-6" />
                  </span>
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Age restriction</h2>
                    <p className="text-sm text-gray-600">Set minimum and maximum ages for participants.</p>
                  </div>
                </div>

                {/* Inputs */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Minimum age</label>
                    <input
                      type="number"
                      min={0}
                      value={minAge}
                      onChange={(e) => {
                        const v = Math.max(0, Number(e.target.value || 0));
                        setAge("min", Math.min(v, maxAge)); // keep min <= max
                      }}
                      className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Maximum age</label>
                    <input
                      type="number"
                      min={0}
                      value={maxAge}
                      onChange={(e) => {
                        const v = Math.max(0, Number(e.target.value || 0));
                        setAge("max", Math.max(v, minAge)); // keep max >= min
                      }}
                      className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Summary + error */}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-blue-700 font-semibold text-xs shadow-sm">
                    {minAge} — {maxAge} years
                  </span>
                  {invalidAge && (
                    <span className="text-sm font-medium text-red-600">Maximum age must be greater than or equal to minimum age.</span>
                  )}
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
                disabled={!formData.maxParticipants || !formData.experienceType || invalidAge}
                className="
                  w-full sm:w-auto inline-flex items-center justify-center rounded-full
                  bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md
                  hover:from-blue-600 hover:to-blue-700 transition
                  disabled:opacity-50 disabled:pointer-events-none
                "
              >
                Next
              </button>
            </div>
          </section>
        );
      })()}

      {/* 🗣️ Step 4 — Languages Offered (stacked left) */}
      {step === 4 && (
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
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Languages you’ll offer</h1>
            <p className="mt-2 text-gray-700 text-sm sm:text-base">Search, pick from popular options, or add your own.</p>
          </div>

          {/* Content */}
          <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-6 items-start">
            {/* LEFT: stack Your languages + Popular languages */}
            <div className="lg:col-span-2 grid gap-4 sm:gap-6">
              {/* Your languages */}
              <div
                className="
                  rounded-3xl bg-white/80 backdrop-blur-md border border-white/60
                  shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]
                  p-5 sm:p-6 md:p-8
                "
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                      <Languages className="w-6 h-6" />
                    </span>
                    <div>
                      <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Your languages</h2>
                      <p className="text-sm text-gray-600">{formData.languages?.length || 0} selected</p>
                    </div>
                  </div>

                  {formData.languages?.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, languages: [] })}
                      className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* Chips / empty state */}
                <div className="mt-5">
                  {formData.languages?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {formData.languages.map((lang, i) => (
                        <span
                          key={lang + i}
                          className="
                            inline-flex items-center gap-2 px-3 py-1.5
                            rounded-full border border-blue-200 bg-blue-50 text-blue-700
                            text-sm shadow-sm
                          "
                        >
                          {lang}
                          <button
                            type="button"
                            onClick={() => handleLanguageToggle(lang)}
                            className="rounded-full p-1 hover:bg-blue-100"
                            aria-label={`Remove ${lang}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="
                        mt-2 rounded-2xl border border-dashed border-gray-300 bg-white/70
                        p-6 text-center text-sm text-gray-600
                      "
                    >
                      No languages selected yet. Use the search or popular options to add some.
                    </div>
                  )}
                </div>
              </div>

              {/* Popular languages — stacked right under the chips */}
              <div
                className="
                  rounded-3xl bg-white/80 backdrop-blur-md border border-white/60
                  shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]
                  p-5 sm:p-6 md:p-8
                "
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Popular languages</h2>
                  <p className="text-sm text-gray-600">Tap to toggle on or off</p>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                  {[
                    "English",
                    "Spanish",
                    "French",
                    "Mandarin",
                    "Japanese",
                    "Korean",
                    "German",
                    "Italian",
                    "Portuguese",
                    "Russian",
                    "Tagalog",
                    "Hindi",
                  ].map((label) => {
                    const on = formData.languages.includes(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => handleLanguageToggle(label)}
                        aria-pressed={on}
                        className={[
                          "w-full rounded-2xl border p-4 text-left transition-all duration-200",
                          on ? "border-blue-500 bg-blue-50/80 shadow-[0_8px_20px_rgba(30,58,138,0.10)]" : "border-gray-200 bg-white/70 hover:bg-gray-50",
                          "flex items-center justify-between gap-3",
                        ].join(" ")}
                      >
                        <span className="text-sm font-semibold text-gray-900">{label}</span>
                        <span
                          className={[
                            "grid place-items-center rounded-xl w-8 h-8 ring-4 ring-white/60 shadow",
                            on ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white" : "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700",
                          ].join(" ")}
                        >
                          {on ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT: Sticky sidebar (search/add) */}
            <aside
              className="
                lg:sticky lg:top-24 rounded-3xl bg-white/80 backdrop-blur-md border border-white/60
                shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]
                p-5 sm:p-6 md:p-8 grid gap-4
              "
            >
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-gray-900">Search or add a language</label>
                <div className="relative">
                  <div
                    className="
                      pointer-events-none absolute left-3 top-1/2 -translate-y-1/2
                      grid place-items-center w-9 h-9 rounded-xl
                      bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700
                      ring-4 ring-white/60 shadow
                    "
                  >
                    <Search className="w-4.5 h-4.5" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g., English, Tagalog, Japanese"
                    value={languageInput}
                    onChange={(e) => setLanguageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = (languageInput || "").trim();
                        if (val && !formData.languages.includes(val)) {
                          setFormData({ ...formData, languages: [...formData.languages, val] });
                        }
                        setLanguageInput("");
                      }
                    }}
                    className="
                      w-full rounded-2xl border border-gray-300 bg-white/90
                      pl-14 pr-12 py-3 text-gray-800 shadow-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500
                    "
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = (languageInput || "").trim();
                      if (val && !formData.languages.includes(val)) {
                        setFormData({ ...formData, languages: [...formData.languages, val] });
                      }
                      setLanguageInput("");
                    }}
                    className="
                      absolute right-2 top-1/2 -translate-y-1/2
                      inline-flex items-center justify-center rounded-full
                      bg-gradient-to-r from-blue-500 to-blue-600
                      px-3 py-1.5 text-xs font-semibold text-white shadow-md
                      hover:from-blue-600 hover:to-blue-700 transition
                    "
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </button>
                </div>
                <p className="text-xs text-gray-500">Press Enter to add quickly.</p>
              </div>

              {/* Smart suggestions (filtered by the input) */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Suggestions</h3>
                <div className="flex flex-wrap gap-2">
                  {languageOptions
                    .filter((opt) => ((languageInput || "").trim() ? opt.toLowerCase().includes(languageInput.toLowerCase()) : true))
                    .slice(0, 12)
                    .map((opt) => {
                      const on = formData.languages.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleLanguageToggle(opt)}
                          className={[
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition",
                            on ? "bg-blue-600 text-white shadow shadow-blue-600/30" : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                          ].join(" ")}
                        >
                          {on && <Check className="w-3.5 h-3.5" />} {opt}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Inline actions */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
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
                  disabled={formData.languages.length === 0}
                  className="
                    w-full sm:w-auto inline-flex items-center justify-center rounded-full
                    bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md
                    hover:from-blue-600 hover:to-blue-700 transition
                    disabled:opacity-50 disabled:pointer-events-none
                  "
                >
                  Next
                </button>
              </div>
            </aside>
          </div>
        </section>
      )}

      {/* 🗓️ Step 5 — Schedule (view-only cards) */}
      {step === 5 && (
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
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">When will this experience run?</h1>
            <p className="mt-2 text-gray-700 text-sm sm:text-base">Add specific dates and start times.</p>
          </div>

          {/* Content */}
          <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
            {/* Left: schedule cards (non-editable) */}
            <div
              className="
                lg:col-span-2 rounded-3xl bg-white/80 backdrop-blur-md border border-white/60
                shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]
                p-5 sm:p-6 md:p-8
              "
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                    <CalendarDays className="w-6 h-6" />
                  </span>
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Schedule</h2>
                    <p className="text-sm text-gray-600">{formData.schedule?.length || 0} date{(formData.schedule?.length || 0) === 1 ? "" : "s"} added</p>
                  </div>
                </div>

                {formData.schedule?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, schedule: [] })}
                    className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Cards / Empty state */}
              <div className="mt-5">
                {formData.schedule && formData.schedule.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {[...formData.schedule]
                      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
                      .map((s, i) => {
                        const d = s.date ? new Date(`${s.date}T00:00:00`) : null;
                        const dateStr = d
                          ? d.toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—";
                        const timeStr = s.time
                          ? new Date(`1970-01-01T${s.time}:00`).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "—";

                        return (
                          <div
                            key={`${s.date}-${s.time}-${i}`}
                            className="
                              group relative rounded-2xl sm:rounded-3xl overflow-hidden
                              bg-white/80 border border-white/60
                              shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]
                              hover:shadow-[0_12px_30px_rgba(30,58,138,0.12),0_30px_60px_rgba(30,58,138,0.12)]
                              transition-all
                            "
                          >
                            {/* sheen */}
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/50 to-transparent" />

                            <div className="relative p-5 sm:p-6 flex items-start gap-3">
                              <span className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                                <Clock3 className="w-6 h-6" />
                              </span>
                              <div className="flex-1">
                                <div className="text-sm text-gray-500">Date</div>
                                <div className="text-base sm:text-lg font-semibold text-gray-900">{dateStr}</div>

                                <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-800 px-3 py-1 text-xs font-semibold">
                                  <Clock3 className="w-3.5 h-3.5" /> {timeStr}
                                </div>
                              </div>

                              {/* Remove */}
                              <button
                                type="button"
                                aria-label="Remove schedule"
                                onClick={() => {
                                  const filtered = formData.schedule.filter((_, idx) => idx !== i);
                                  setFormData({ ...formData, schedule: filtered });
                                }}
                                className="
                                  ml-auto inline-flex items-center justify-center w-9 h-9 rounded-full
                                  bg-white/90 hover:bg-white border border-gray-200 shadow
                                "
                              >
                                <Trash2 className="w-4.5 h-4.5 text-gray-700" />
                              </button>
                            </div>

                            {/* soft cast shadow */}
                            <div className="pointer-events-none absolute -bottom-3 left-6 right-6 h-6 rounded-[2rem] bg-gradient-to-b from-blue-500/10 to-transparent blur-md" />
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div
                    className="
                      rounded-2xl border border-dashed border-gray-300 bg-white/70
                      p-8 text-center text-sm text-gray-600
                    "
                  >
                    No schedules yet. Add dates and times from the panel on the right.
                  </div>
                )}
              </div>
            </div>

            {/* Right: sticky add panel */}
            <aside
              className="
                lg:sticky lg:top-24 rounded-3xl bg-white/80 backdrop-blur-md border border-white/60
                shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]
                p-5 sm:p-6 md:p-8 grid gap-4
              "
            >
              <div className="flex items-center gap-3">
                <span className="grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                  <Plus className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Add a new slot</h3>
                  <p className="text-sm text-gray-600">Pick a date and start time, then press Add.</p>
                </div>
              </div>

              {/* Date */}
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-gray-900">Date</label>
                <input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  className="
                    w-full rounded-2xl border border-gray-300 bg-white/90
                    px-4 py-3 text-gray-800 shadow-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500
                  "
                  value={newSchedule.date}
                  onChange={(e) => setNewSchedule({ ...newSchedule, date: e.target.value })}
                />
              </div>

              {/* Time */}
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-gray-900">Start time</label>
                <div className="relative">
                  <input
                    type="time"
                    className="
                      w-full rounded-2xl border border-gray-300 bg-white/90
                      pl-4 pr-12 py-3 text-gray-800 shadow-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500
                    "
                    value={newSchedule.time}
                    onChange={(e) => setNewSchedule({ ...newSchedule, time: e.target.value })}
                  />
                  <Clock3 className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                </div>

                {/* Quick time chips */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {["08:00", "10:00", "13:00", "15:00", "18:00"].map((t) => {
                    const on = (newSchedule.time || "") === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewSchedule({ ...newSchedule, time: t })}
                        className={[
                          "px-3 py-1.5 rounded-full text-xs font-semibold transition",
                          on ? "bg-blue-600 text-white shadow shadow-blue-600/30" : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                        ].join(" ")}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add button */}
              <button
                type="button"
                className="
                  inline-flex items-center justify-center rounded-full
                  bg-gradient-to-r from-blue-500 to-blue-600
                  px-6 py-3 text-sm font-semibold text-white shadow-md
                  hover:from-blue-600 hover:to-blue-700 transition
                  disabled:opacity-50 disabled:pointer-events-none
                "
                disabled={!newSchedule.date || !newSchedule.time}
                onClick={() => {
                  const { date, time } = newSchedule || {};
                  if (!date || !time) return;
                  // prevent duplicates
                  const exists = (formData.schedule || []).some((x) => x.date === date && x.time === time);
                  if (exists) return alert("This schedule already exists.");
                  setFormData({
                    ...formData,
                    schedule: [...(formData.schedule || []), { date, time }],
                  });
                  setNewSchedule({ date: "", time: "" });
                }}
              >
                <Plus className="w-4 h-4 mr-2" /> Add schedule
              </button>

              <p className="text-xs text-gray-500">Times use your current timezone.</p>

              {/* Inline actions */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
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
                  disabled={!formData.schedule || formData.schedule.length === 0}
                  className="
                    w-full sm:w-auto inline-flex items-center justify-center rounded-full
                    bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md
                    hover:from-blue-600 hover:to-blue-700 transition
                    disabled:opacity-50 disabled:pointer-events-none
                  "
                >
                  Next
                </button>
              </div>
            </aside>
          </div>
        </section>
      )}

      {/* 💸 Step 6 — Pricing & Amenities (WITH DISCOUNTS) */}
      {step === 6 && (
        <section
          className="
            px-3 sm:px-6 md:px-8 py-12 sm:py-16
            min-h-[calc(100vh-56px)]
            grid grid-rows-[auto,1fr]
            gap-6 bg-gradient-to-br from-blue-50 via-white to-indigo-50
          "
        >
          {/* Title */}
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Pricing & Amenities</h1>
            <p className="mt-2 text-gray-700 text-sm sm:text-base">Set a clear price and highlight what’s included in your experience.</p>
          </div>

          {/* Content grid */}
          <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
            {/* LEFT — Amenities (span 2 cols) */}
            <div className="lg:col-span-2 grid gap-4 sm:gap-6">
              {/* Selected amenities */}
              <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)] p-5 sm:p-6 md:p-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Included amenities</h3>
                  {formData.amenities?.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleChange("amenities", [])}
                      className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <div className="mt-4">
                  {formData.amenities?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {formData.amenities.map((a, i) => (
                        <span
                          key={a + i}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-sm shadow-sm"
                        >
                          {a}
                          <button
                            type="button"
                            className="rounded-full p-1 hover:bg-blue-100"
                            onClick={() => {
                              const updated = formData.amenities.filter((_, idx) => idx !== i);
                              setFormData({ ...formData, amenities: updated });
                            }}
                            aria-label={`Remove ${a}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 rounded-2xl border border-dashed border-gray-300 bg-white/70 p-6 text-center text-sm text-gray-600">
                      No amenities added yet. Use the quick options below or add a custom one.
                    </div>
                  )}
                </div>
              </div>

              {/* Popular amenities + Custom add */}
              <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)] p-5 sm:p-6 md:p-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Popular amenities</h3>
                  <p className="text-sm text-gray-600">Tap to toggle</p>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                  {[
                    "Snacks",
                    "Drinks",
                    "Equipment provided",
                    "Transport included",
                    "Photos / Videos",
                    "Safety gear",
                    "Restrooms",
                    "Wi-Fi",
                    "First aid",
                    "Souvenir",
                    "Locker",
                    "Charging station",
                  ].map((label) => {
                    const on = formData.amenities?.includes(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => handleAmenityToggle(label)}
                        aria-pressed={on}
                        className={[
                          "w-full rounded-2xl border p-4 text-left transition-all duration-200",
                          on ? "border-blue-500 bg-blue-50/80 shadow-[0_8px_20px_rgba(30,58,138,0.10)]" : "border-gray-200 bg-white/70 hover:bg-gray-50",
                          "flex items-center justify-between gap-3",
                        ].join(" ")}
                      >
                        <span className="text-sm font-semibold text-gray-900">{label}</span>
                        <span
                          className={[
                            "grid place-items-center rounded-xl w-8 h-8 ring-4 ring-white/60 shadow",
                            on ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white" : "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700",
                          ].join(" ")}
                        >
                          {on ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom add */}
                <div className="mt-5 grid gap-2">
                  <label className="text-sm font-semibold text-gray-900">Add a custom amenity</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                      placeholder="e.g., Free snacks, Local guidebook"
                      value={newAmenity}
                      onChange={(e) => setNewAmenity(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const a = (newAmenity || "").trim();
                          if (!a) return;
                          if (!formData.amenities?.includes(a)) {
                            setFormData({
                              ...formData,
                              amenities: [...(formData.amenities || []), a],
                            });
                          }
                          setNewAmenity("");
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition"
                      onClick={() => {
                        const a = (newAmenity || "").trim();
                        if (!a) return alert("Please enter an amenity.");
                        if (!formData.amenities?.includes(a)) {
                          setFormData({
                            ...formData,
                            amenities: [...(formData.amenities || []), a],
                          });
                        }
                        setNewAmenity("");
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT — Price + Discounts + Summary + Actions */}
            <aside className="lg:sticky lg:top-24 h-fit rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)] p-5 sm:p-6 md:p-8 grid gap-5">
              {/* Price input */}
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-gray-900">Price per participant</label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                    <BadgeDollarSign className="w-5 h-5" />
                  </div>
                  <span className="absolute left-14 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₱</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    placeholder="e.g., 1200"
                    value={formData.price}
                    onChange={(e) => handleChange("price", Number(e.target.value || 0))}
                    className="w-full rounded-2xl border border-gray-300 bg-white/90 pl-20 pr-4 py-3 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                  />
                </div>
                <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                  <Info className="w-4 h-4" /> You can update this anytime.
                </p>
              </div>

              {/* Quick price chips */}
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-gray-900">Quick set</label>
                <div className="flex flex-wrap gap-2">
                  {[300, 500, 750, 1000, 1500, 2000].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleChange("price", p)}
                      className={[
                        "px-3 py-1.5 rounded-full text-xs font-semibold transition",
                        Number(formData.price) === p ? "bg-blue-600 text-white shadow shadow-blue-600/30" : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                      ].join(" ")}
                    >
                      ₱{p.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Discounts (like Homes) */}
              <div className="grid gap-3">
                <label className="text-sm font-semibold text-gray-900">Discounts <span className="text-gray-500">(optional)</span></label>

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
                          active ? "border-blue-500 bg-blue-50/80 shadow-[0_8px_20px_rgba(30,58,138,0.10)]" : "border-gray-200 bg-white/70 hover:bg-gray-50",
                          "text-sm font-semibold text-gray-900",
                        ].join(" ")}
                      >
                        <Icon className="w-4 h-4" /> {label}
                      </button>
                    );
                  })}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Discount value</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                      {formData.discountType === "percentage" ? (
                        <Percent className="w-5 h-5" />
                      ) : (
                        <BadgeDollarSign className="w-5 h-5" />
                      )}
                    </div>

                    {formData.discountType === "percentage" && (
                      <span className="absolute left-14 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">%</span>
                    )}
                    {formData.discountType === "fixed" && (
                      <span className="absolute left-14 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₱</span>
                    )}

                    <input
                      type="number"
                      min={0}
                      inputMode="decimal"
                      placeholder={
                        formData.discountType === "percentage"
                          ? "e.g., 10"
                          : formData.discountType === "fixed"
                          ? "e.g., 300"
                          : "Select a discount type first"
                      }
                      value={formData.discountValue}
                      onChange={(e) => handleChange("discountValue", Number(e.target.value || 0))}
                      disabled={!formData.discountType || formData.discountType === "none"}
                      className={[
                        "w-full rounded-2xl border bg-white/90 pr-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400",
                        formData.discountType === "percentage" || formData.discountType === "fixed"
                          ? "pl-20 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                          : "pl-4 border-gray-200",
                        !formData.discountType || formData.discountType === "none" ? "opacity-50 pointer-events-none" : "",
                      ].join(" ")}
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-600">
                    Percentage applies per participant; fixed amount is deducted once per booking.
                  </p>
                </div>
              </div>

              {/* Live summary */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 shadow-[inset_0_1px_0_rgba(59,130,246,0.15)]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="grid place-items-center w-8 h-8 rounded-lg bg-white/80 ring-2 ring-blue-100">
                    <Calculator className="w-4 h-4 text-blue-700" />
                  </span>
                  <p className="text-sm font-semibold text-blue-900">Price summary (full session)</p>
                </div>
                {(() => {
                  const unit = Number(formData.price || 0);
                  const pax = Math.max(1, Number(formData.maxParticipants || 1));
                  const type = formData.discountType || "none";
                  const dVal = Number(formData.discountValue || 0);

                  const discountPerParticipant = type === "percentage" ? Math.max(0, (unit * dVal) / 100) : 0;
                  const perAfter = Math.max(0, unit - discountPerParticipant);
                  const fixedDiscount = type === "fixed" ? Math.max(0, dVal) : 0;

                  const subtotal = unit * pax; // before discounts
                  const total = Math.max(0, perAfter * pax - fixedDiscount);

                  return (
                    <div className="space-y-2 text-sm text-blue-900">
                      <div className="flex items-center justify-between">
                        <span>Participants (from Step 3)</span>
                        <span className="font-semibold">{pax}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Price / participant</span>
                        <span className="font-semibold">₱{unit.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Subtotal (no discount)</span>
                        <span className="font-semibold">₱{subtotal.toLocaleString()}</span>
                      </div>
                      {type === "percentage" && (
                        <div className="flex items-center justify-between">
                          <span>Discount / participant ({dVal || 0}%)</span>
                          <span className="font-semibold">− ₱{discountPerParticipant.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {type === "fixed" && (
                        <div className="flex items-center justify-between">
                          <span>Fixed discount (per booking)</span>
                          <span className="font-semibold">− ₱{fixedDiscount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="h-px bg-blue-100 my-1" />
                      <div className="flex items-center justify-between text-base">
                        <span className="font-semibold">Est. gross per full session</span>
                        <span className="font-bold text-blue-700">₱{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Actions INSIDE the price card */}
              <div className="pt-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={prevStep}
                  className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={saveDraft}
                  className="inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!formData.price || formData.price <= 0}
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 disabled:pointer-events-none"
                >
                  Next
                </button>
              </div>
            </aside>
          </div>
        </section>
      )}

      {/* 📸 Step 7 — Photos (large preview + thumbnails, responsive) */}
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
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Show guests what your experience looks like</h1>
            <p className="mt-2 text-gray-700 text-sm sm:text-base">Upload high-quality photos to attract more guests.</p>
          </div>

          {/* Content grid */}
          <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
            {/* LEFT — Large Preview + Thumbnails */}
            <div className="lg:col-span-2 rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-5 sm:p-6 md:p-8">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                    <ImageIcon className="w-6 h-6" />
                  </span>
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Your photos</h3>
                    <p className="text-sm text-gray-600">{formData.photos?.length || 0} uploaded</p>
                  </div>
                </div>

                {formData.photos?.length > 0 && (
                  <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 shadow-sm">
                    Recommended: 5+ photos
                  </span>
                )}
              </div>

              {/* Big hero preview */}
              <div className="mt-5">
                {formData.photos?.length ? (
                  <>
                    <div className="relative w-full rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 h-[300px] sm:h-[380px] md:h-[460px] lg:h-[560px]">
                      <img src={formData.photos[currentPhotoIndex || 0]} alt={`Photo ${currentPhotoIndex + 1}`} className="h-full w-full object-cover" loading="lazy" />

                      {/* Index badge */}
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
                            className="absolute left-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/85 hover:bg-white border border-white/60 shadow grid place-items-center disabled:opacity-50 disabled:pointer-events-none"
                          >
                            <ChevronLeft className="w-5 h-5 text-gray-700" />
                          </button>

                          <button
                            type="button"
                            aria-label="Next photo"
                            onClick={() => setCurrentPhotoIndex((prev) => Math.min(formData.photos.length - 1, (prev || 0) + 1))}
                            disabled={(currentPhotoIndex || 0) === formData.photos.length - 1}
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/85 hover:bg-white border border-white/60 shadow grid place-items-center disabled:opacity-50 disabled:pointer-events-none"
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
                              active ? "border-blue-500 ring-2 ring-blue-400/60" : "border-gray-200 hover:border-gray-300",
                            ].join(" ")}
                          >
                            <img src={url} alt={`Thumbnail ${index + 1}`} className="h-full w-full object-cover" />
                            {/* Remove on thumbnail */}
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                const newPhotos = formData.photos.filter((_, i) => i !== index);
                                setFormData({ ...formData, photos: newPhotos });
                                setCurrentPhotoIndex((prev) => Math.max(0, Math.min(prev || 0, newPhotos.length - 1)));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  const newPhotos = formData.photos.filter((_, i) => i !== index);
                                  setFormData({ ...formData, photos: newPhotos });
                                  setCurrentPhotoIndex((prev) => Math.max(0, Math.min(prev || 0, newPhotos.length - 1)));
                                }
                              }}
                              className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/90 hover:bg-white border border-gray-200 shadow"
                            >
                              <X className="w-4 h-4 text-gray-700" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="mt-2 rounded-2xl border border-dashed border-gray-300 bg-white/70 p-8 sm:p-10 text-center">
                    <div className="mx-auto grid place-items-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                    <p className="mt-4 text-sm text-gray-600">No photos uploaded yet. Use the uploader to add images.</p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT — Uploader & Tips */}
            <aside className="lg:sticky lg:top-24 h-fit rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-5 sm:p-6 md:p-8 grid gap-4">
              <label className="cursor-pointer rounded-2xl border-2 border-dashed border-blue-300 bg-white/70 hover:bg-indigo-50/40 transition-colors p-6 sm:p-8 flex flex-col items-center justify-center gap-3">
                <span className="grid place-items-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                  <UploadCloud className="w-8 h-8 sm:w-10 sm:h-10" />
                </span>

                <div className="text-center">
                  <p className="text-base sm:text-lg font-semibold text-gray-900">Click to upload images</p>
                  <p className="text-xs sm:text-sm text-gray-600">You can select multiple files (PNG, JPG)</p>
                </div>

                <input
                  type="file"
                  multiple
                  accept="image/*"
                  hidden
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    const uploadedUrls = [];

                    for (const file of files) {
                      const formDataUpload = new FormData();
                      formDataUpload.append("file", file);
                      formDataUpload.append("upload_preset", UPLOAD_PRESET);

                      try {
                        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
                          method: "POST",
                          body: formDataUpload,
                        });
                        const data = await response.json();
                        if (data.secure_url) uploadedUrls.push(data.secure_url);
                      } catch (error) {
                        console.error("Upload failed:", error);
                        alert("Failed to upload image. Try again.");
                      }
                    }

                    setFormData((prev) => ({
                      ...prev,
                      photos: [...prev.photos, ...uploadedUrls],
                    }));
                  }}
                />
              </label>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900">
                <p className="font-semibold">Tips for great photos</p>
                <ul className="mt-2 space-y-1.5 list-disc list-inside">
                  <li>Use bright, natural light</li>
                  <li>Show the activity and the setting</li>
                  <li>Include people (with permission) for context</li>
                  <li>Upload at least 5 photos for best results</li>
                </ul>
              </div>
            </aside>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3 mt-2">
            <button className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 transition" onClick={prevStep}>
              Back
            </button>
            <button className="inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition" onClick={saveDraft}>
              Save to Drafts
            </button>
            <button className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition" onClick={nextStep}>
              Next
            </button>
          </div>
        </section>
      )}

      {/* ✍️ Step 8 — Description & Requirements */}
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
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Description &amp; Requirements</h1>
            <p className="mt-2 text-gray-700 text-sm sm:text-base">Help guests understand what makes your experience special and what they should prepare.</p>
          </div>

          {/* Content */}
          <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
            {/* Left: Inputs */}
            <div className="lg:col-span-2 rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-5 sm:p-6 md:p-8 grid gap-6">
              {/* Description */}
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                    <FileText className="w-4.5 h-4.5" />
                  </span>
                  Experience Description
                </label>

                <div className="relative">
                  <textarea
                    rows={6}
                    className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                    placeholder="What will guests do? What’s unique? Any highlights, flow, or inclusions?"
                    value={formData.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                  />
                  {/* character meter */}
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>Tip: Aim for clear, inviting details (200–600 chars).</span>
                    <span>{(formData.description || "").length} chars</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                      style={{ width: `${Math.min(100, ((formData.description?.length || 0) / 800) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Requirements */}
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                    <ShieldCheck className="w-4.5 h-4.5" />
                  </span>
                  Host Requirements / Prerequisites
                </label>

                <div className="relative">
                  <textarea
                    rows={5}
                    className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                    placeholder="e.g., Minimum age, fitness level, dress code, what to bring, safety notes"
                    value={formData.hostRequirements}
                    onChange={(e) => handleChange("hostRequirements", e.target.value)}
                  />
                  {/* character meter */}
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>Keep it concise and easy to follow.</span>
                    <span>{(formData.hostRequirements || "").length} chars</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                      style={{ width: `${Math.min(100, ((formData.hostRequirements?.length || 0) / 600) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Helpful tips */}
            <aside className="lg:sticky lg:top-24 rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-5 sm:p-6 md:p-8 grid gap-5">
              <div className="flex items-center gap-3">
                <span className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                  <Info className="w-6 h-6" />
                </span>
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Writing tips</h3>
                  <p className="text-sm text-gray-600">Make it easy for guests to say yes.</p>
                </div>
              </div>

              <ul className="text-sm text-gray-700 space-y-2">
                <li>• Start with the hook: what’s exciting or unique?</li>
                <li>• Outline the flow: arrival → main activity → wrap-up.</li>
                <li>• Mention what’s included (gear, snacks, tickets).</li>
                <li>• Set expectations: pace, difficulty, weather alternatives.</li>
                <li>• Requirements: ID, age, attire, fitness, allergies.</li>
              </ul>

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                <p className="text-sm text-indigo-900">
                  Example opener: <span className="font-medium">“Catch the sunrise from a hidden ridge, then enjoy locally-roasted coffee while learning basic landscape photography.”</span>
                </p>
              </div>
            </aside>
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
              disabled={!formData.description.trim()}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 disabled:pointer-events-none"
            >
              Next
            </button>
          </div>
        </section>
      )}

      {/* 🛡️ Step 9 — Cancellation Policy */}
      {step === 9 && (
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
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Cancellation Policy</h1>
            <p className="mt-2 text-gray-700 text-sm sm:text-base">Clearly set expectations so guests know what happens if plans change.</p>
          </div>

          {/* Content */}
          <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
            {/* Left: Policy input */}
            <div className="lg:col-span-2 rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-5 sm:p-6 md:p-8">
              <div className="flex items-center gap-3">
                <span className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                  <ShieldAlert className="w-6 h-6" />
                </span>
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Your policy</h2>
                  <p className="text-sm text-gray-600">Be precise about time windows and refunds.</p>
                </div>
              </div>

              {/* Textarea */}
              <div className="mt-5 grid gap-2">
                <label className="text-sm font-semibold text-gray-900">Cancellation Policy</label>
                <textarea
                  rows={6}
                  className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                  placeholder="e.g., Full refund for cancellations made up to 24 hours before the start time. No refunds for cancellations within 24 hours."
                  value={formData.cancellationPolicy}
                  onChange={(e) => handleChange("cancellationPolicy", e.target.value)}
                />
                {/* Helper: character counter */}
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span>Tip: Include a clear time cutoff and what refund applies.</span>
                  <span>{(formData.cancellationPolicy || "").length} chars</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                    style={{ width: `${Math.min(100, ((formData.cancellationPolicy?.length || 0) / 600) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Examples */}
              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                  <p className="text-sm text-indigo-900">
                    Example: <span className="font-medium">“Full refund up to 48 hours before the start time. 50% refund for cancellations 24–48 hours prior. No refund within 24 hours.”</span>
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                  <p className="text-sm text-blue-900">
                    Weather plan: <span className="font-medium">“If severe weather is forecast, we’ll reschedule or offer a full refund.”</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Tips & checklist */}
            <aside className="lg:sticky lg:top-24 rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-5 sm:p-6 md:p-8 grid gap-5">
              <div className="flex items-center gap-3">
                <span className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                  <CalendarClock className="w-6 h-6" />
                </span>
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Make it clear</h3>
                  <p className="text-sm text-gray-600">Guests should know exactly what applies.</p>
                </div>
              </div>

              <ul className="text-sm text-gray-700 space-y-2">
                <li>• Define the cutoff (e.g., 24/48/72 hours before start time).</li>
                <li>• State refund amounts for each window.</li>
                <li>• Mention no-show consequences.</li>
                <li>• Include weather/force majeure handling.</li>
                <li>• Note how to request a cancellation.</li>
              </ul>

              <div className="rounded-2xl border border-gray-200 bg-white/70 p-4 flex items-start gap-3">
                <span className="grid place-items-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                  <Info className="w-5 h-5" />
                </span>
                <p className="text-sm text-gray-700">Keep language friendly but firm. Avoid ambiguity like “may” or “normally”—use clear “will” statements.</p>
              </div>
            </aside>
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
              disabled={!formData.cancellationPolicy.trim()}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 disabled:pointer-events-none"
            >
              Next
            </button>
          </div>
        </section>
      )}

      {/* ✅ Step 10 — Review & Publish */}
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
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Review &amp; Publish</h1>
            <p className="mt-2 text-gray-700">Double-check your details before publishing your experience.</p>
          </div>

          {/* Content */}
          <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Photo preview / carousel */}
            <div className="relative rounded-3xl overflow-hidden bg-white/70 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] hover:shadow-[0_12px_30px_rgba(30,58,138,0.12),_0_30px_60px_rgba(30,58,138,0.12)] transition-shadow p-4 sm:p-5 flex flex-col">
              {formData.photos?.length ? (
                <>
                  <div className="relative w-full rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 h-[220px] sm:h-[300px] md:h-[360px] lg:h-[420px]">
                    <img src={formData.photos[currentPhotoIndex || 0]} alt={`Listing Photo ${(currentPhotoIndex || 0) + 1}`} className="h-full w-full object-cover" loading="lazy" />
                    <div className="absolute top-3 right-3 rounded-full bg-black/55 text-white text-xs font-medium px-3 py-1">
                      {(currentPhotoIndex || 0) + 1} / {formData.photos.length}
                    </div>
                    {formData.photos.length > 1 && (
                      <>
                        <button
                          type="button"
                          aria-label="Previous photo"
                          onClick={() => setCurrentPhotoIndex((prev) => Math.max(0, (prev || 0) - 1))}
                          disabled={(currentPhotoIndex || 0) === 0}
                          className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/85 hover:bg-white border border-white/60 shadow grid place-items-center disabled:opacity-50 disabled:pointer-events-none"
                        >
                          <ChevronLeft className="w-5 h-5 text-gray-700" />
                        </button>
                        <button
                          type="button"
                          aria-label="Next photo"
                          onClick={() => setCurrentPhotoIndex((prev) => Math.min(formData.photos.length - 1, (prev || 0) + 1))}
                          disabled={(currentPhotoIndex || 0) === formData.photos.length - 1}
                          className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/85 hover:bg-white border border-white/60 shadow grid place-items-center disabled:opacity-50 disabled:pointer-events-none"
                        >
                          <ChevronRight className="w-5 h-5 text-gray-700" />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2 overflow-x-auto">
                    {formData.photos.map((url, index) => {
                      const active = index === (currentPhotoIndex || 0);
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setCurrentPhotoIndex(index)}
                          className={["relative flex-none rounded-xl overflow-hidden border transition", "w-24 sm:w-28 aspect-[4/3]", active ? "border-blue-500 ring-2 ring-blue-400/60" : "border-gray-200 hover:border-gray-300"].join(" ")}
                        >
                          <img src={url} alt={`Thumbnail ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="grid place-items-center rounded-2xl border border-dashed border-gray-300 bg-white/70 h-[220px] sm:h-[300px] md:h-[360px] lg:h-[420px]">
                  <div className="text-center p-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 grid place-items-center shadow-inner mb-3">
                      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 17h16M7 4v16M17 4v16" />
                      </svg>
                    </div>
                    <p className="text-gray-800 font-semibold">No photos uploaded</p>
                    <p className="text-gray-600 text-sm">Add photos on the previous step to preview here.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Simple details card */}
            <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-6 sm:p-8 text-left space-y-2">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Listing Details</h2>
              <p>
                <span className="font-semibold text-gray-800">Category:</span> {formData.category || "Not set"}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Listing Type:</span> {formData.listingType || "Not set"}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Title:</span> {formData.title || "Not set"}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Location:</span> {formData.location || "Not set"}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Duration:</span> {formData.duration || "Not set"}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Max Participants:</span> {formData.maxParticipants || 0}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Age Restriction:</span> {formData.ageRestriction ? `${formData.ageRestriction.min} - ${formData.ageRestriction.max}` : "None"}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Experience Type:</span> {formData.experienceType || "Not set"}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Languages:</span> {formData.languages?.length > 0 ? formData.languages.join(", ") : "None"}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Schedule:</span> {formData.schedule?.length > 0 ? formData.schedule.map((s) => `${s.date} at ${s.time}`).join(", ") : "Not set"}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Price / participant:</span> {formData.price ? `₱${Number(formData.price).toLocaleString()}` : "Not set"}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Discount:</span>{" "}
                {formData.discountType === "percentage"
                  ? `${formData.discountValue || 0}% off`
                  : formData.discountType === "fixed"
                  ? `₱${Number(formData.discountValue || 0).toLocaleString()} off per booking`
                  : "None"}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Amenities:</span> {formData.amenities?.length > 0 ? formData.amenities.join(", ") : "None"}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Description:</span> {formData.description || "Not set"}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Host Requirements:</span> {formData.hostRequirements || "None"}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Cancellation Policy:</span> {formData.cancellationPolicy || "Not set"}
              </p>

              {/* Terms */}
              <div className="pt-2">
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
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 disabled:pointer-events-none"
            >
              Publish
            </button>
          </div>

          {/* Policy modal */}
          <PolicyComplianceModal
            open={openPolicyModal}
            onClose={() => setOpenPolicyModal(false)}
            onConfirm={() => {
              setFormData((prev) => ({ ...prev, agreeToTerms: true }));
              setOpenPolicyModal(false);
            }}
          />
        </section>
      )}
    </div>
  );
};
