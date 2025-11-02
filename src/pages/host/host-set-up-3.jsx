import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { doc, collection, addDoc, updateDoc, query, where, getDocs, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, database } from "../../config/firebase";
import "./styles/host-set-up.css";
import PolicyComplianceModal from "./components/PolicyComplianceModal";

// lucide-react icons
import {
  GraduationCap,
  Flower2,
  Camera,
  Briefcase,
  Wrench,
  MoreHorizontal,
  MapPin,
  Clock3,
  Check,
  Plus,
  X,
  BadgeDollarSign,
  Info,
  Type,
  FileText,
  Package,
  Users,
  CalendarDays,
  Percent,
  Tags,
  ShieldCheck,
  BadgeCheck,
  Minus,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Clock,
  Languages,
} from "lucide-react";

const CLOUD_NAME = "dijmlbysr";
const UPLOAD_PRESET = "listing-uploads";

export const HostSetUpServices = () => {
  const location = useLocation();
  const initialCategory = location.state?.category || "Services";

  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [draftId, setDraftId] = useState(null);

  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ date: "", time: "" });

  const [languageInput, setLanguageInput] = useState("");
  
  const [openPolicyModal, setOpenPolicyModal] = useState(false);

  const [formData, setFormData] = useState({
    category: initialCategory,
    serviceType: "",
    title: "",
    description: "",
    includes: "",
    targetAudience: "",
    availability: [],
    schedule: [],
    duration: "",
    recurrence: "",
    price: "",
    pricingType: "",
    cancellationPolicy: "",
    qualifications: "",
    clientRequirements: "",
    maxParticipants: 1,
    ageRestriction: { min: 0, max: 100 },
    photos: [],
    languages: [],
    locationType: "", // "in-person" | "online"
    address: "",
    agreeToTerms: false,
  });

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);
  const handleChange = (key, value) => setFormData({ ...formData, [key]: value });

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

  const saveDraft = async () => {
    try {
      await saveHost();

      const user = auth.currentUser;
      if (!user) {
        alert("You must be logged in to save a draft.");
        return;
      }
      if (draftId) {
        const draftRef = doc(database, "listings", draftId);
        await updateDoc(draftRef, { ...formData, updatedAt: new Date() });
        alert("Draft updated!");
        navigate("/hostpage", { state: { activePage: "listings", showDrafts: true } });
      } else {
        const docRef = await addDoc(collection(database, "listings"), {
          ...formData,
          uid: user.uid,
          status: "draft",
          createdAt: new Date(),
        });
        setDraftId(docRef.id);
        alert("Draft saved!");
        navigate("/hostpage", { state: { activePage: "listings", showDrafts: true } });
      }
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

    const { min, max } = formData.ageRestriction || {};
    if (min > max) {
      alert("Min age cannot be greater than max age.");
      return;
    }

    const normalized = {
      ...formData,
      price: formData.price === "" ? null : Number(formData.price),
      maxParticipants: Number(formData.maxParticipants ?? 1),
      ageRestriction: {
        min: Number(formData.ageRestriction?.min ?? 0),
        max: Number(formData.ageRestriction?.max ?? 100),
      },
    };

    // 👇 This is what we actually persist on publish
    const payload = {
      ...normalized,
      uid: user.uid,
      status: "published",
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (draftId) {
      await updateDoc(doc(database, "listings", draftId), payload);
    } else {
      await addDoc(collection(database, "listings"), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }

    alert("Your listing has been published!");
    navigate("/hostpage", { state: { activePage: "listings", showDrafts: false } });
  } catch (error) {
    console.error("Error publishing listing:", error);
    alert("Failed to publish listing.");
    navigate("/hostpage");
  }
};

  const handleBack = async () => {
    const user = auth.currentUser;
    if (!user) return navigate("/home");

    const hostsRef = collection(database, "hosts");
    const q = query(hostsRef, where("uid", "==", user.uid));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      navigate("/hostpage");
    } else {
      navigate("/dashboard");
    }
  };

  const languageOptions = [
    "English","Spanish","French","Mandarin","Tagalog","Arabic","Hindi","Bengali",
    "Portuguese","Russian","Japanese","Korean","German","Italian","Turkish","Vietnamese",
    "Polish","Dutch","Thai","Greek","Swedish","Czech","Finnish","Hungarian","Romanian",
    "Hebrew","Indonesian","Malay","Tamil","Urdu","Persian","Punjabi","Ukrainian",
    "Serbian","Croatian","Bulgarian","Danish","Norwegian","Slovak","Slovenian","Latvian",
    "Lithuanian","Estonian","Swahili","Filipino","Cantonese","Nepali","Sinhala","Burmese",
    "Khmer","Lao","Mongolian","Amharic","Zulu","Xhosa","Afrikaans"
  ];

  // SHARED styles
  const btn = "inline-flex items-center justify-center px-5 py-2.5 rounded-full font-medium transition shadow-sm";
  const btnPrimary = `${btn} bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700`;
  const btnSecondary = `${btn} border border-gray-300 bg-white text-gray-800 hover:bg-gray-50`;
  const btnGhost = `${btn} text-gray-700 hover:text-gray-900 hover:bg-gray-100`;
  const input = "w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500";
  const area = input;
  const select = input;

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Choose Service Type
  if (step === 1) {
    const options = [
      { value: "Tutoring", label: "Tutoring", desc: "Educational support and teaching services.", Icon: GraduationCap },
      { value: "Wellness", label: "Wellness", desc: "Health and relaxation services.", Icon: Flower2 },
      { value: "Photography", label: "Photography", desc: "Professional photo and video services.", Icon: Camera },
      { value: "Consulting", label: "Consulting", desc: "Expert advice and consultation services.", Icon: Briefcase },
      { value: "Repair", label: "Repair", desc: "Fixing and maintenance services.", Icon: Wrench },
      { value: "Other", label: "Other", desc: "Any other type of service.", Icon: MoreHorizontal },
    ];

    return (
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
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">What kind of service are you offering?</h1>
          <p className="mt-2 text-gray-700">Choose the type of service to get started.</p>
        </div>

        {/* Cards */}
        <div
          className="
            max-w-6xl mx-auto w-full
            grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6
            h-full
          "
          role="radiogroup"
          aria-label="Service type"
        >
          {options.map(({ value, label, desc, Icon }) => {
            const active = formData.serviceType === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleChange("serviceType", value)}
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
                  "flex flex-col min-h-[260px]"
                ].join(" ")}
              >
                <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-white/50 to-transparent" />
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
                      active ? "bg-blue-600 text-white shadow shadow-blue-600/30" : "bg-gray-100 text-gray-700",
                    ].join(" ")}
                  >
                    {label}
                  </span>
                </div>
                <div className="pointer-events-none absolute -bottom-3 left-6 right-6 h-6 rounded-[2rem] bg-gradient-to-b from-blue-500/10 to-transparent blur-md" />
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={handleBack} className={btnSecondary}>Back to Home</button>
          <button
            type="button"
            onClick={nextStep}
            disabled={!formData.serviceType}
            className={`${btnPrimary} disabled:opacity-50 disabled:pointer-events-none`}
          >
            Get Started
          </button>
        </div>
      </section>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2 — Description (redesigned)
if (step === 2) {
  const MAX_TITLE = 60;
  const MAX_DESC = 600;

  const includeSuggestions = [
    "Materials provided",
    "Snacks & water",
    "Safety gear",
    "Photos/Videos",
    "Post-session notes",
    "Transport assistance",
  ];

  const audienceSuggestions = [
    "Beginners",
    "Families",
    "Professionals",
    "Students",
    "Travelers",
    "Teams",
  ];

  const addInclude = (text) => {
    const curr = formData.includes || "";
    if (!curr.toLowerCase().includes(text.toLowerCase())) {
      const needsBreak = curr && !curr.endsWith("\n") ? "\n" : "";
      handleChange("includes", `${curr}${needsBreak}• ${text}`);
    }
  };

  const addAudience = (text) => {
    const curr = (formData.targetAudience || "").trim();
    const exists = curr
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .includes(text.toLowerCase());
    if (!exists) {
      handleChange("targetAudience", curr ? `${curr}, ${text}` : text);
    }
  };

  const titleCount = formData.title?.length || 0;
  const descCount = formData.description?.length || 0;

  return (
    <section
      className="
        px-4 md:px-8 py-12 sm:py-16
        min-h-[calc(100vh-56px)]
        grid grid-rows-[auto,1fr,auto] gap-6
        bg-gradient-to-br from-blue-50 via-white to-indigo-50
      "
    >
      {/* Header */}
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
          Describe your service
        </h1>
        <p className="mt-2 text-gray-700">
          Provide details to help guests understand what you're offering.
        </p>
      </div>

      {/* Form (single column, mobile-first) */}
      <div className="w-full max-w-3xl mx-auto grid gap-4 sm:gap-5">
        {/* Title */}
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-gray-900">Title</label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
              <Type className="w-5 h-5" />
            </div>
            <input
              className="pl-16 pr-4 py-3 w-full rounded-2xl border border-gray-300 bg-white/90 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
              placeholder="Service Title (clear & catchy)"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
            />
            <div className="absolute right-3 bottom-2 text-xs text-gray-500">
              {titleCount}/{MAX_TITLE}
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Aim for under {MAX_TITLE} characters so it looks great in cards and search.
          </p>
        </div>

        {/* Description */}
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-gray-900">Description</label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-3 grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
              <FileText className="w-5 h-5" />
            </div>
            <textarea
              className="pl-16 pr-4 py-3 w-full rounded-2xl border border-gray-300 bg-white/90 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500 min-h-[140px] resize-y"
              rows={6}
              placeholder="Describe your service in detail. What will guests do or receive? Any special touches?"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
            />
            <div className="absolute right-3 -bottom-5 text-xs text-gray-500">
              {descCount}/{MAX_DESC} (recommended)
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-3 flex items-start gap-2 text-sm text-blue-900">
            <Info className="w-4 h-4 mt-0.5" />
            <p>
              Tip: Cover <b>what happens</b>, <b>what’s included</b>, <b>who it’s for</b>, and any
              <b> safety or accessibility</b> notes.
            </p>
          </div>
        </div>

        {/* What's included */}
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-gray-900">What’s included</label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-3 grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
              <Package className="w-5 h-5" />
            </div>
            <textarea
              className="pl-16 pr-4 py-3 w-full rounded-2xl border border-gray-300 bg-white/90 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500 min-h-[110px] resize-y"
              rows={4}
              placeholder="List what's included (e.g., • Materials • Snacks & water • Safety gear)"
              value={formData.includes}
              onChange={(e) => handleChange("includes", e.target.value)}
            />
          </div>

          {/* Quick-add chips */}
          <div className="flex flex-wrap gap-2">
            {includeSuggestions.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => addInclude(label)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
              >
                <Plus className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Target Audience */}
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-gray-900">Target audience</label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
              <Users className="w-5 h-5" />
            </div>
            <input
              className="pl-16 pr-4 py-3 w-full rounded-2xl border border-gray-300 bg-white/90 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
              placeholder="e.g., Students, professionals, beginners"
              value={formData.targetAudience}
              onChange={(e) => handleChange("targetAudience", e.target.value)}
            />
          </div>

          {/* Audience chips */}
          <div className="flex flex-wrap gap-2">
            {audienceSuggestions.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => addAudience(label)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
              >
                <Plus className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
        <button type="button" onClick={prevStep} className={btnSecondary}>
          Back
        </button>
        <button type="button" onClick={saveDraft} className={btnGhost}>
          Save Draft
        </button>
        <button
          type="button"
          onClick={nextStep}
          disabled={!formData.title || !formData.description}
          className={`${btnPrimary} disabled:opacity-50 disabled:pointer-events-none`}
        >
          Next
        </button>
      </div>
    </section>
  );
};


  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 3 — Schedule
if (step === 3) {
  const durationChips = ["30 min", "1 hour", "90 min", "2 hours", "Half-day"];
  const timeChips = ["08:00", "10:00", "13:00", "15:00", "18:00"];
  const recOptions = [
    { key: "one-time",  label: "One-time"  },
    { key: "weekly",    label: "Weekly"    },
    { key: "monthly",   label: "Monthly"   },
  ];

  return (
    <section
      className="
        px-4 md:px-8 py-12 sm:py-16
        min-h-[calc(100vh-56px)]
        grid grid-rows-[auto,1fr,auto] gap-6
        bg-gradient-to-br from-blue-50 via-white to-indigo-50
      "
    >
      {/* Header */}
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
          Set your schedule
        </h1>
        <p className="mt-2 text-gray-700">
          Define duration, recurrence, and specific slots.
        </p>
      </div>

      {/* Content grid */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
        {/* LEFT: Schedule list */}
        <div
          className="
            lg:col-span-2 rounded-3xl bg-white/80 backdrop-blur-md border border-white/60
            shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]
            p-5 sm:p-6
          "
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                <CalendarDays className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Schedule List</h3>
                <p className="text-sm text-gray-600">
                  {formData.schedule?.length || 0} slot{(formData.schedule?.length || 0) === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </div>

          {/* List or empty state */}
          <div className="mt-5 grid gap-3">
            {formData.schedule?.length ? (
              formData.schedule.map((s, i) => (
                <div
                  key={`${s.date}-${s.time}-${i}`}
                  className="
                    group rounded-2xl border border-gray-200 bg-white/90
                    shadow-sm hover:shadow-md transition
                    p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3
                  "
                >
                  {/* Date input */}
                  <div className="relative w-full sm:w-1/2">
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                      <CalendarDays className="w-4.5 h-4.5" />
                    </div>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-gray-300 bg-white/90 pl-14 pr-3 py-2.5 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-500"
                      value={s.date}
                      onChange={(e) => {
                        const updated = [...formData.schedule];
                        updated[i].date = e.target.value;
                        setFormData({ ...formData, schedule: updated });
                      }}
                    />
                  </div>

                  {/* Time input */}
                  <div className="relative w-full sm:w-1/2">
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                      <Clock3 className="w-4.5 h-4.5" />
                    </div>
                    <input
                      type="time"
                      className="w-full rounded-xl border border-gray-300 bg-white/90 pl-14 pr-3 py-2.5 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-500"
                      value={s.time}
                      onChange={(e) => {
                        const updated = [...formData.schedule];
                        updated[i].time = e.target.value;
                        setFormData({ ...formData, schedule: updated });
                      }}
                    />
                  </div>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => {
                      const filtered = formData.schedule.filter((_, idx) => idx !== i);
                      setFormData({ ...formData, schedule: filtered });
                    }}
                    className="
                      inline-flex items-center justify-center gap-2 px-3 py-2
                      rounded-xl border border-red-200 bg-white text-red-600
                      hover:bg-red-50 transition self-stretch sm:self-auto
                    "
                  >
                    <X className="w-4 h-4" /> Remove
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white/70 p-6 text-center text-sm text-gray-600">
                No schedules yet. Add slots from the panel on the right.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Basics + Add slot */}
        <aside
          className="
            lg:sticky lg:top-24 rounded-3xl bg-white/80 backdrop-blur-md border border-white/60
            shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]
            p-5 sm:p-6 grid gap-4
          "
        >
          {/* Duration */}
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-gray-900">Duration</label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                <Clock3 className="w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="e.g., 1 hour"
                className="w-full rounded-2xl border border-gray-300 bg-white/90 pl-16 pr-3 py-3 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-500"
                value={formData.duration}
                onChange={(e) => handleChange("duration", e.target.value)}
              />
            </div>

            {/* Duration chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {durationChips.map((d) => {
                const on = (formData.duration || "").toLowerCase() === d.toLowerCase();
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleChange("duration", d)}
                    className={[
                      "px-3 py-1.5 rounded-full text-xs font-semibold transition",
                      on
                        ? "bg-blue-600 text-white shadow shadow-blue-600/30"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                    ].join(" ")}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recurrence segmented */}
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-gray-900">Recurrence</label>
            <div className="grid grid-cols-3 gap-2">
              {recOptions.map(({ key, label }) => {
                const on = formData.recurrence === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => handleChange("recurrence", key)}
                    className={[
                      "w-full rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                      on
                        ? "border-blue-500 bg-blue-50/80 text-blue-800 shadow"
                        : "border-gray-200 bg-white/70 hover:bg-gray-50 text-gray-800",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Add a slot */}
          <div className="grid gap-3">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                <Plus className="w-5 h-5" />
              </span>
              <div>
                <h4 className="text-base font-semibold text-gray-900">Add a new slot</h4>
                <p className="text-sm text-gray-600">Pick date & time, then save.</p>
              </div>
            </div>

            {!showAddSchedule && (
              <button
                type="button"
                className="
                  inline-flex items-center justify-center rounded-full
                  bg-gradient-to-r from-blue-500 to-blue-600
                  px-5 py-2.5 text-sm font-semibold text-white shadow-md
                  hover:from-blue-600 hover:to-blue-700 transition
                "
                onClick={() => setShowAddSchedule(true)}
              >
                <Plus className="w-4 h-4 mr-2" /> Add Schedule
              </button>
            )}

            {showAddSchedule && (
              <div className="grid gap-3">
                {/* Date */}
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                    <CalendarDays className="w-4.5 h-4.5" />
                  </div>
                  <input
                    type="date"
                    value={newSchedule.date}
                    onChange={(e) => setNewSchedule({ ...newSchedule, date: e.target.value })}
                    className="w-full rounded-2xl border border-gray-300 bg-white/90 pl-14 pr-3 py-3 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-500"
                  />
                </div>

                {/* Time */}
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                    <Clock3 className="w-4.5 h-4.5" />
                  </div>
                  <input
                    type="time"
                    value={newSchedule.time}
                    onChange={(e) => setNewSchedule({ ...newSchedule, time: e.target.value })}
                    className="w-full rounded-2xl border border-gray-300 bg-white/90 pl-14 pr-3 py-3 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-500"
                  />
                </div>

                {/* Quick time chips */}
                <div className="flex flex-wrap gap-2">
                  {timeChips.map((t) => {
                    const on = (newSchedule.time || "") === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewSchedule({ ...newSchedule, time: t })}
                        className={[
                          "px-3 py-1.5 rounded-full text-xs font-semibold transition",
                          on
                            ? "bg-blue-600 text-white shadow shadow-blue-600/30"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                        ].join(" ")}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="
                      inline-flex items-center justify-center rounded-full
                      bg-gradient-to-r from-blue-500 to-blue-600
                      px-5 py-2.5 text-sm font-semibold text-white shadow-md
                      hover:from-blue-600 hover:to-blue-700 transition
                    "
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
                  >
                    Save Schedule
                  </button>
                  <button
                    type="button"
                    className="
                      inline-flex items-center justify-center rounded-full
                      border border-gray-300 bg-white px-5 py-2.5
                      text-sm font-semibold text-gray-800 hover:bg-gray-50 transition
                    "
                    onClick={() => setShowAddSchedule(false)}
                  >
                    Cancel
                  </button>
                </div>

                <p className="text-xs text-gray-500">Times use your current timezone.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Footer actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={prevStep}
          className="
            inline-flex items-center justify-center rounded-full
            border border-gray-300 bg-white
            px-6 py-3 text-sm font-medium text-gray-800
            hover:bg-gray-50 transition
          "
        >
          Back
        </button>
        <button
          type="button"
          onClick={saveDraft}
          className="
            inline-flex items-center justify-center rounded-full
            px-5 py-3 text-sm font-semibold text-gray-700
            hover:text-gray-900 hover:bg-gray-100 transition
          "
        >
          Save Draft
        </button>
        <button
          type="button"
          onClick={nextStep}
          disabled={!formData.duration || !formData.recurrence}
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
  );
}

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 4 — Pricing & Policy (redesigned, responsive, same logic)
if (step === 4) {
  const priceChips = [500, 800, 1000, 1500, 2500, 5000];
  const pricingTypes = ["per session", "per hour", "per package"];

  const templates = {
    flexible:
      "Full refund up to 24 hours before start. 50% refund within 24 hours. No refund after start.",
    moderate:
      "Full refund up to 48 hours before start. 50% refund within 24–48 hours. No refund within 24 hours.",
    strict:
      "50% refund up to 7 days before start. No refund within 7 days of the start time.",
  };

  return (
    <section
      className="
        px-4 md:px-8 py-12 sm:py-16
        min-h-[calc(100vh-56px)]
        grid grid-rows-[auto,1fr,auto] gap-6
        bg-gradient-to-br from-blue-50 via-white to-indigo-50
      "
    >
      {/* Header */}
      <div className="max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 text-blue-800 px-3 py-1 text-xs font-semibold">
          <Percent className="w-4 h-4" /> Step 4 of 8
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
          Pricing &amp; Policy
        </h1>
        <p className="mt-2 text-gray-700">
          Set your service price, pricing type, and cancellation policy.
        </p>
      </div>

      {/* Content grid */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
        {/* LEFT: Main form */}
        <div
          className="
            lg:col-span-2 rounded-3xl bg-white/80 backdrop-blur-md border border-white/60
            shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]
            p-5 sm:p-6 grid gap-5
          "
        >
          {/* Price */}
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-gray-900">Price</label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                <BadgeDollarSign className="w-5 h-5" />
              </div>
              <span className="absolute left-14 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                ₱
              </span>
              <input
                type="number"
                min={0}
                className="
                  pl-20 pr-4 py-3 w-full rounded-2xl border border-gray-300
                  bg-white/90 text-gray-900 shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500
                "
                placeholder="Enter your price"
                value={formData.price}
                onChange={(e) => handleChange("price", e.target.value)}
              />
            </div>

            {/* Quick price chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {priceChips.map((p) => {
                const on = Number(formData.price) === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleChange("price", p)}
                    className={[
                      "px-3 py-1.5 rounded-full text-xs font-semibold transition",
                      on
                        ? "bg-blue-600 text-white shadow shadow-blue-600/30"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                    ].join(" ")}
                  >
                    ₱{p.toLocaleString()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pricing Type */}
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-gray-900">
              Pricing Type
            </label>
            {/* Select (kept for accessibility & original logic) */}
            <select
              className={select}
              value={formData.pricingType}
              onChange={(e) => handleChange("pricingType", e.target.value)}
            >
              <option value="">Select pricing type</option>
              <option value="per session">Per session</option>
              <option value="per hour">Per hour</option>
              <option value="per package">Per package</option>
            </select>

            {/* Quick-pick segmented options */}
            <div className="grid grid-cols-3 gap-2">
              {pricingTypes.map((t) => {
                const on = formData.pricingType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleChange("pricingType", t)}
                    className={[
                      "w-full rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                      on
                        ? "border-blue-500 bg-blue-50/80 text-blue-800 shadow"
                        : "border-gray-200 bg-white/70 hover:bg-gray-50 text-gray-800",
                    ].join(" ")}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cancellation Policy */}
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-gray-900">
              Cancellation Policy
            </label>
            <textarea
              className={area}
              rows={5}
              placeholder="Enter your cancellation policy"
              value={formData.cancellationPolicy}
              onChange={(e) => handleChange("cancellationPolicy", e.target.value)}
            />
            {/* Template chips */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleChange("cancellationPolicy", templates.flexible)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-semibold"
              >
                <Tags className="w-4 h-4" /> Flexible 24h
              </button>
              <button
                type="button"
                onClick={() => handleChange("cancellationPolicy", templates.moderate)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-semibold"
              >
                <Tags className="w-4 h-4" /> Moderate 48h
              </button>
              <button
                type="button"
                onClick={() => handleChange("cancellationPolicy", templates.strict)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-semibold"
              >
                <Tags className="w-4 h-4" /> Strict 7d
              </button>
            </div>

            <p className="text-xs text-gray-600 flex items-center gap-1">
              <Info className="w-4 h-4" />
              Be precise about time windows and refunds.
            </p>
          </div>
        </div>

        {/* RIGHT: Helper / Tips */}
        <aside
          className="
            rounded-3xl bg-white/80 backdrop-blur-md border border-white/60
            shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]
            p-5 sm:p-6 grid gap-4
          "
        >
          <div className="flex items-center gap-3">
            <span className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
              <Percent className="w-6 h-6" />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Pricing tips
              </h3>
              <p className="text-sm text-gray-600">
                Start competitive. You can adjust later as demand grows.
              </p>
            </div>
          </div>

          <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
            <li>Consider your experience level and market rates.</li>
            <li>“Per hour” works well for open-ended sessions.</li>
            <li>“Per package” fits bundled deliverables.</li>
          </ul>

          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
            <p className="text-sm text-blue-900">
              Tip: Clear cancellation terms reduce disputes and increase bookings.
            </p>
          </div>
        </aside>
      </div>

      {/* Footer actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={prevStep}
          className="
            inline-flex items-center justify-center rounded-full
            border border-gray-300 bg-white
            px-6 py-3 text-sm font-medium text-gray-800
            hover:bg-gray-50 transition
          "
        >
          Back
        </button>
        <button
          type="button"
          onClick={saveDraft}
          className="
            inline-flex items-center justify-center rounded-full
            px-5 py-3 text-sm font-semibold text-gray-700
            hover:text-gray-900 hover:bg-gray-100 transition
          "
        >
          Save Draft
        </button>
        <button
          type="button"
          onClick={nextStep}
          disabled={!formData.price || !formData.pricingType || !formData.cancellationPolicy}
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
  );
}

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 5 — Host Requirements (redesigned, responsive, same logic)
if (step === 5) {
  // Quick helpers (no new state)
  const participantChips = [5, 10, 12, 15, 20, 30];
  const minAgeChips = [0, 12, 16, 18, 21];
  const maxAgeChips = [50, 60, 65, 70];

  const addQual = (text) => {
    const cur = (formData.qualifications || "").trim();
    const sep = cur && !cur.endsWith(".") ? "; " : cur ? " " : "";
    handleChange("qualifications", `${cur}${sep}${text}`);
  };

  const addClientReq = (text) => {
    const cur = (formData.clientRequirements || "").trim();
    const sep = cur && !cur.endsWith(".") ? "; " : cur ? " " : "";
    handleChange("clientRequirements", `${cur}${sep}${text}`);
  };

  return (
    <section
      className="
        px-4 md:px-8 py-12 sm:py-16
        min-h-[calc(100vh-56px)]
        grid grid-rows-[auto,1fr,auto] gap-6
        bg-gradient-to-br from-blue-50 via-white to-indigo-50
      "
    >
      {/* Header */}
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
          Host Requirements
        </h1>
        <p className="mt-2 text-gray-700">
          Specify qualifications, client requirements, and participant limits.
        </p>
      </div>

      {/* Content grid */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
        {/* LEFT: Main form */}
        <div
          className="
            lg:col-span-2 rounded-3xl bg-white/80 backdrop-blur-md border border-white/60
            shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]
            p-5 sm:p-6 grid gap-5
          "
        >
          {/* Qualifications */}
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                <BadgeCheck className="w-5 h-5" />
              </span>
              Qualifications / experience
            </label>
            <textarea
              className={area}
              rows={4}
              placeholder="e.g., First Aid certified, mountaineering experience, government accreditation"
              value={formData.qualifications}
              onChange={(e) => handleChange("qualifications", e.target.value)}
            />
            {/* Quick chips */}
            <div className="flex flex-wrap gap-2">
              {[
                "First Aid certified",
                "CPR certified",
                "5+ years experience",
                "Government-accredited guide",
                "Background checked",
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => addQual(q)}
                  className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-semibold"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Max participants with stepper + chips */}
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                <Users className="w-5 h-5" />
              </span>
              Max participants
            </label>

            <div className="flex items-stretch gap-2">
              <button
                type="button"
                aria-label="Decrease"
                onClick={() =>
                  handleChange(
                    "maxParticipants",
                    Math.max(1, Number(formData.maxParticipants || 1) - 1)
                  )
                }
                className="inline-flex items-center justify-center rounded-2xl border border-gray-300 bg-white px-3 py-2 hover:bg-gray-50"
              >
                <Minus className="w-5 h-5" />
              </button>

              <input
                type="number"
                min={1}
                className={input}
                placeholder="Max participants"
                value={formData.maxParticipants}
                onChange={(e) =>
                  handleChange("maxParticipants", Number(e.target.value))
                }
              />

              <button
                type="button"
                aria-label="Increase"
                onClick={() =>
                  handleChange(
                    "maxParticipants",
                    Math.max(1, Number(formData.maxParticipants || 1) + 1)
                  )
                }
                className="inline-flex items-center justify-center rounded-2xl border border-gray-300 bg-white px-3 py-2 hover:bg-gray-50"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {participantChips.map((n) => {
                const on = Number(formData.maxParticipants) === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleChange("maxParticipants", n)}
                    className={[
                      "px-3 py-1.5 rounded-full text-xs font-semibold transition",
                      on
                        ? "bg-blue-600 text-white shadow shadow-blue-600/30"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                    ].join(" ")}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Client Requirements */}
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                <ClipboardList className="w-5 h-5" />
              </span>
              Client requirements
            </label>
            <textarea
              className={area}
              rows={3}
              placeholder="e.g., Bring valid ID; Wear closed-toe shoes; Waiver required"
              value={formData.clientRequirements}
              onChange={(e) => handleChange("clientRequirements", e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {[
                "Bring valid ID",
                "Wear closed-toe shoes",
                "No alcohol or drugs",
                "Signed waiver required",
                "Hydration required (1L water)",
              ].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => addClientReq(r)}
                  className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-semibold"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Age Restriction */}
          <div className="grid gap-3">
            <label className="text-sm font-semibold text-gray-900">Age restriction</label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Min age */}
              <div className="grid gap-2">
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <input
                    type="number"
                    min={0}
                    className="pl-14 pr-4 py-3 w-full rounded-2xl border border-gray-300 bg-white/90 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                    placeholder="Min age"
                    value={formData.ageRestriction.min}
                    onChange={(e) =>
                      handleChange("ageRestriction", {
                        ...formData.ageRestriction,
                        min: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {minAgeChips.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        handleChange("ageRestriction", {
                          ...formData.ageRestriction,
                          min: n,
                        })
                      }
                      className={[
                        "px-3 py-1.5 rounded-full text-xs font-semibold transition",
                        Number(formData.ageRestriction.min) === n
                          ? "bg-blue-600 text-white shadow shadow-blue-600/30"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                      ].join(" ")}
                    >
                      {n}+
                    </button>
                  ))}
                </div>
              </div>

              {/* Max age */}
              <div className="grid gap-2">
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <input
                    type="number"
                    min={0}
                    className="pl-14 pr-4 py-3 w-full rounded-2xl border border-gray-300 bg-white/90 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                    placeholder="Max age"
                    value={formData.ageRestriction.max}
                    onChange={(e) =>
                      handleChange("ageRestriction", {
                        ...formData.ageRestriction,
                        max: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {maxAgeChips.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        handleChange("ageRestriction", {
                          ...formData.ageRestriction,
                          max: n,
                        })
                      }
                      className={[
                        "px-3 py-1.5 rounded-full text-xs font-semibold transition",
                        Number(formData.ageRestriction.max) === n
                          ? "bg-blue-600 text-white shadow shadow-blue-600/30"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                      ].join(" ")}
                    >
                      ≤ {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-600 flex items-center gap-1">
              <Info className="w-4 h-4" />
              Set an appropriate range for safety and comfort. You can refine this later.
            </p>
          </div>
        </div>

        {/* RIGHT: Tips / Helper */}
        <aside
          className="
            rounded-3xl bg-white/80 backdrop-blur-md border border-white/60
            shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]
            p-5 sm:p-6 grid gap-4
          "
        >
          <div className="flex items-center gap-3">
            <span className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
              <Users className="w-6 h-6" />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Good to know</h3>
              <p className="text-sm text-gray-600">
                Clear requirements help guests prepare and reduce cancellations.
              </p>
            </div>
          </div>

          <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
            <li>Be explicit about fitness or skill levels needed.</li>
            <li>Mention any safety gear you’ll provide or require.</li>
            <li>Use reasonable participant caps for quality and safety.</li>
          </ul>

          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
            <p className="text-sm text-blue-900">
              Tip: Add brief, scannable bullet points — guests book faster when things are clear.
            </p>
          </div>
        </aside>
      </div>

      {/* Footer actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={prevStep}
          className="
            inline-flex items-center justify-center rounded-full
            border border-gray-300 bg-white
            px-6 py-3 text-sm font-medium text-gray-800
            hover:bg-gray-50 transition
          "
        >
          Back
        </button>
        <button
          type="button"
          onClick={saveDraft}
          className="
            inline-flex items-center justify-center rounded-full
            px-5 py-3 text-sm font-semibold text-gray-700
            hover:text-gray-900 hover:bg-gray-100 transition
          "
        >
          Save Draft
        </button>
        <button
          type="button"
          onClick={nextStep}
          className="
            inline-flex items-center justify-center rounded-full
            bg-gradient-to-r from-blue-500 to-blue-600
            px-7 py-3 text-sm font-semibold text-white shadow-md
            hover:from-blue-600 hover:to-blue-700 transition
          "
        >
          Next
        </button>
      </div>
    </section>
  );
}


  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 6 — Media Upload
if (step === 6) {
  return (
    <section className="px-4 md:px-8 py-12 sm:py-16 min-h-[calc(100vh-56px)] grid grid-rows-[auto,1fr,auto] gap-6 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Upload media</h1>
        <p className="mt-2 text-gray-700">Upload high-quality images to showcase your service.</p>
      </div>

      {/* Uploader (left) + Carousel (right) */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* Uploader */}
        <label
          className="
            cursor-pointer rounded-3xl border-2 border-dashed border-blue-300
            bg-white/70 backdrop-blur-md
            shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]
            p-6 sm:p-8
            flex flex-col items-center justify-center gap-3
            min-h-[260px] sm:min-h-[320px] md:min-h-[440px]
          "
        >
          <div className="grid place-items-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
            <Camera className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
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
                  const response = await fetch(
                    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
                    { method: "POST", body: formDataUpload }
                  );
                  const data = await response.json();
                  if (data.secure_url) uploadedUrls.push(data.secure_url);
                } catch (error) {
                  console.error("Upload failed:", error);
                  alert("Failed to upload image. Try again.");
                }
              }
              setFormData((prev) => ({ ...prev, photos: [...prev.photos, ...uploadedUrls] }));
            }}
          />
        </label>

        {/* Carousel (right) */}
        <div
          className="
            relative rounded-3xl bg-white/80 backdrop-blur-md border border-white/60
            shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]
            overflow-hidden
            min-h-[260px] sm:min-h-[320px] md:min-h-[440px]
          "
        >
          {formData.photos?.length > 0 ? (
            <>
              {/* Slides (swipeable) */}
              <div
                id="media-carousel"
                className="
                  flex w-full h-full
                  overflow-x-auto snap-x snap-mandatory scroll-smooth
                "
              >
                {formData.photos.map((url, i) => (
                  <div key={i} id={`slide-${i}`} className="relative flex-none w-full h-full snap-center">
                    <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" draggable={false} />
                    {/* Remove button on slide */}
                    <button
                      type="button"
                      className="
                        absolute top-3 right-3 inline-flex items-center justify-center
                        w-9 h-9 rounded-full bg-white/90 hover:bg-white border border-gray-200 shadow
                      "
                      onClick={() => {
                        const newPhotos = formData.photos.filter((_, idx) => idx !== i);
                        setFormData({ ...formData, photos: newPhotos });
                      }}
                    >
                      <X className="w-4 h-4 text-gray-700" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Soft gradient edges */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/50 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/40 to-transparent" />

              {/* Arrows */}
              <button
                type="button"
                aria-label="Previous"
                className="
                  absolute left-3 top-1/2 -translate-y-1/2
                  inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11
                  rounded-full bg-white/90 hover:bg-white border border-gray-200 shadow
                "
                onClick={() => {
                  const el = document.getElementById("media-carousel");
                  if (!el) return;
                  el.scrollBy({ left: -el.clientWidth, behavior: "smooth" });
                }}
              >
                <ChevronLeft className="w-5 h-5 text-gray-800" />
              </button>
              <button
                type="button"
                aria-label="Next"
                className="
                  absolute right-3 top-1/2 -translate-y-1/2
                  inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11
                  rounded-full bg-white/90 hover:bg-white border border-gray-200 shadow
                "
                onClick={() => {
                  const el = document.getElementById("media-carousel");
                  if (!el) return;
                  el.scrollBy({ left: el.clientWidth, behavior: "smooth" });
                }}
              >
                <ChevronRight className="w-5 h-5 text-gray-800" />
              </button>

              {/* Dots */}
              <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5">
                {formData.photos.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className="pointer-events-auto w-2.5 h-2.5 rounded-full bg-white/70 hover:bg-white shadow border border-white/60"
                    onClick={() =>
                      document
                        .getElementById(`slide-${i}`)
                        ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
                    }
                  />
                ))}
              </div>
            </>
          ) : (
            // Empty state when no photos yet
            <div className="h-full w-full grid place-items-center text-center p-8">
              <div className="flex flex-col items-center gap-3">
                <div className="grid place-items-center w-14 h-14 rounded-2xl bg-gray-100 text-gray-500">
                  <Camera className="w-7 h-7" />
                </div>
                <p className="text-gray-700 text-sm">Your photos will appear here after upload.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Thumbnails grid (below both columns) */}
      {formData.photos?.length > 0 && (
        <div className="w-full max-w-6xl mx-auto">
          <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)] p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Uploaded photos</h3>
              <span className="text-xs text-gray-600">{formData.photos?.length || 0} total</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {formData.photos.map((url, index) => (
                <button
                  key={index}
                  type="button"
                  className="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-gray-200 bg-gray-50"
                  onClick={() =>
                    document
                      .getElementById(`slide-${index}`)
                      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
                  }
                >
                  <img
                    src={url}
                    alt={`Thumb ${index + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute inset-0 ring-0 group-hover:ring-4 ring-blue-400/40 rounded-2xl transition" />
                  <button
                    type="button"
                    className="
                      absolute top-2 right-2 inline-flex items-center justify-center
                      w-8 h-8 rounded-full bg-white/90 hover:bg-white border border-gray-200 shadow
                    "
                    onClick={(e) => {
                      e.stopPropagation();
                      const newPhotos = formData.photos.filter((_, i) => i !== index);
                      setFormData({ ...formData, photos: newPhotos });
                    }}
                  >
                    <X className="w-4 h-4 text-gray-700" />
                  </button>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
        <button type="button" onClick={prevStep} className={btnSecondary}>Back</button>
        <button type="button" onClick={saveDraft} className={btnGhost}>Save Draft</button>
        <button type="button" onClick={nextStep} className={btnPrimary}>Next</button>
      </div>
    </section>
  );
}

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 7 — Communication (Languages & Location)
  if (step === 7) {
    return (
      <section className="px-4 md:px-8 py-12 sm:py-16 min-h-[calc(100vh-56px)] grid grid-rows-[auto,1fr,auto] gap-6 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Communication details</h1>
          <p className="mt-2 text-gray-700">Select languages and how guests can reach you.</p>
        </div>

        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
          {/* LEFT: selected + popular */}
          <div className="lg:col-span-2 grid gap-4">
            {/* Your languages */}
            <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-5 sm:p-6 shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                    <Check className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Your languages</h3>
                    <p className="text-sm text-gray-600">{formData.languages?.length || 0} selected</p>
                  </div>
                </div>
                {formData.languages?.length > 0 && (
                  <button type="button" onClick={() => handleChange("languages", [])} className={btnSecondary}>Clear all</button>
                )}
              </div>

              <div className="mt-4">
                {formData.languages?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {formData.languages.map((lang, i) => (
                      <span key={`${lang}-${i}`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-sm shadow-sm">
                        {lang}
                        <button
                          type="button"
                          className="rounded-full p-1 hover:bg-blue-100"
                          onClick={() => handleChange("languages", formData.languages.filter((l) => l !== lang))}
                          aria-label={`Remove ${lang}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 rounded-2xl border border-dashed border-gray-300 bg-white/70 p-6 text-center text-sm text-gray-600">
                    No languages selected yet. Use the search or popular options to add some.
                  </div>
                )}
              </div>
            </div>

            {/* Popular languages */}
            <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-5 sm:p-6 shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Popular languages</h3>
                <p className="text-sm text-gray-600">Tap to toggle</p>
              </div>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {["English","Spanish","French","Mandarin","Japanese","Korean","German","Italian","Portuguese","Russian","Tagalog","Hindi"]
                  .map((label) => {
                    const on = formData.languages.includes(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() =>
                          handleChange("languages",
                            on ? formData.languages.filter((l) => l !== label) : [...formData.languages, label]
                          )
                        }
                        className={[
                          "w-full rounded-2xl border p-4 text-left transition-all duration-200",
                          on ? "border-blue-500 bg-blue-50/80 shadow-[0_8px_20px_rgba(30,58,138,0.10)]"
                             : "border-gray-200 bg-white/70 hover:bg-gray-50",
                          "flex items-center justify-between gap-3",
                        ].join(" ")}
                      >
                        <span className="text-sm font-semibold text-gray-900">{label}</span>
                        <span className={[
                          "grid place-items-center rounded-xl w-8 h-8 ring-4 ring-white/60 shadow",
                          on ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
                             : "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700",
                        ].join(" ")}>
                          {on ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* RIGHT: search/add + location */}
          <aside className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-5 sm:p-6 shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)] grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-gray-900">Search or add a language</label>
              <div className="relative">
                <input
                  type="text"
                  className={input}
                  placeholder="e.g., English, Tagalog, Japanese"
                  value={languageInput}
                  onChange={(e) => setLanguageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = (languageInput || "").trim();
                      if (val && !formData.languages.includes(val)) {
                        handleChange("languages", [...formData.languages, val]);
                      }
                      setLanguageInput("");
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = (languageInput || "").trim();
                    if (val && !formData.languages.includes(val)) {
                      handleChange("languages", [...formData.languages, val]);
                    }
                    setLanguageInput("");
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add
                </button>
              </div>
              <p className="text-xs text-gray-500">Press Enter to add quickly.</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Suggestions</h3>
              <div className="flex flex-wrap gap-2">
                {languageOptions
                  .filter((opt) => (languageInput ? opt.toLowerCase().includes(languageInput.toLowerCase()) : true))
                  .slice(0, 12)
                  .map((opt) => {
                    const on = formData.languages.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          handleChange("languages", on ? formData.languages.filter((l) => l !== opt) : [...formData.languages, opt])
                        }
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

            {/* Location type */}
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-gray-900">Location Type</label>
              <select className={select} value={formData.locationType} onChange={(e) => handleChange("locationType", e.target.value)}>
                <option value="">Select location type</option>
                <option value="in-person">In-person</option>
                <option value="online">Online</option>
              </select>
            </div>

            {formData.locationType === "in-person" && (
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-gray-900">Service Address</label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                    <MapPin className="w-4.5 h-4.5" />
                  </div>
                  <input
                    className="pl-14 pr-4 py-3 w-full rounded-2xl border border-gray-300 bg-white/90 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                    placeholder="Enter your service address"
                    value={formData.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                  />
                </div>
              </div>
            )}
          </aside>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
          <button type="button" onClick={prevStep} className={btnSecondary}>Back</button>
          <button type="button" onClick={saveDraft} className={btnGhost}>Save Draft</button>
          <button
            type="button"
            onClick={nextStep}
            disabled={formData.languages.length === 0 || (formData.locationType === "in-person" && !formData.address)}
            className={`${btnPrimary} disabled:opacity-50 disabled:pointer-events-none`}
          >
            Next
          </button>
        </div>
      </section>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 8 — Review & Publish
  return (
  <section className="px-4 md:px-8 py-12 sm:py-16 min-h-[calc(100vh-56px)] grid grid-rows-[auto,1fr,auto] gap-6 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
    {/* Header */}
    <div className="max-w-3xl mx-auto text-center">
      <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Review & Publish</h1>
      <p className="mt-2 text-gray-700">Double-check your details before publishing your service.</p>
    </div>

    {/* Content */}
    <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Photos / Carousel */}
      <div className="relative rounded-3xl overflow-hidden bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-4 sm:p-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
              <ImageIcon className="w-5 h-5" />
            </span>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Photos</h3>
          </div>
          <span className="text-xs sm:text-sm text-gray-600">{formData.photos?.length || 0} total</span>
        </div>

        {/* Carousel */}
        <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 h-[240px] sm:h-[300px] md:h-[360px] lg:h-[420px]">
          {formData.photos?.length ? (
            <>
              {/* Slides */}
              <div
                id="review-carousel"
                className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scroll-smooth"
              >
                {formData.photos.map((url, i) => (
                  <div key={i} id={`rev-slide-${i}`} className="relative flex-none w-full h-full snap-center">
                    {/* Placeholder while loading */}
                    <div className="absolute inset-0 grid place-items-center bg-gray-100">
                      <ImageIcon className="w-6 h-6 text-gray-400" />
                    </div>
                    <img
                      src={url}
                      alt={`Photo ${i + 1}`}
                      className="relative z-10 h-full w-full object-cover"
                      loading="lazy"
                      draggable={false}
                    />
                  </div>
                ))}
              </div>

              {/* Top/Bottom soft fades */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/50 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/40 to-transparent" />

              {/* Arrows */}
              <button
                type="button"
                aria-label="Previous"
                className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/90 hover:bg-white border border-gray-200 shadow"
                onClick={() => {
                  const el = document.getElementById("review-carousel");
                  if (!el) return;
                  el.scrollBy({ left: -el.clientWidth, behavior: "smooth" });
                }}
              >
                <ChevronLeft className="w-5 h-5 text-gray-800" />
              </button>
              <button
                type="button"
                aria-label="Next"
                className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/90 hover:bg-white border border-gray-200 shadow"
                onClick={() => {
                  const el = document.getElementById("review-carousel");
                  if (!el) return;
                  el.scrollBy({ left: el.clientWidth, behavior: "smooth" });
                }}
              >
                <ChevronRight className="w-5 h-5 text-gray-800" />
              </button>

              {/* Dots */}
              <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5">
                {formData.photos.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className="pointer-events-auto w-2.5 h-2.5 rounded-full bg-white/70 hover:bg-white shadow border border-white/60"
                    onClick={() =>
                      document
                        .getElementById(`rev-slide-${i}`)
                        ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
                    }
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="grid place-items-center w-full h-full text-gray-600">No photos uploaded</div>
          )}
        </div>

        {/* Filmstrip thumbnails */}
        {formData.photos?.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {formData.photos.map((url, index) => (
              <button
                key={index}
                type="button"
                title={`Go to photo ${index + 1}`}
                className="group relative flex-none w-24 sm:w-28 md:w-32 aspect-[4/3] rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm"
                onClick={() =>
                  document
                    .getElementById(`rev-slide-${index}`)
                    ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
                }
              >
                <img
                  src={url}
                  alt={`Thumb ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <span className="absolute inset-0 ring-0 group-hover:ring-4 ring-blue-400/40 rounded-xl transition" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-6 sm:p-8 text-left">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Service Details</h2>

        {/* Highlight chips */}
        <div className="flex flex-wrap gap-2 mb-5">
          {formData.duration && (
            <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> {formData.duration}
            </span>
          )}
          {formData.recurrence && (
            <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 inline-flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> {formData.recurrence}
            </span>
          )}
          {formData.maxParticipants && (
            <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 border border-gray-200 inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> {formData.maxParticipants} pax
            </span>
          )}
          {formData.price && (
            <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 inline-flex items-center gap-1.5">
              <BadgeDollarSign className="w-3.5 h-3.5" /> ₱{formData.price}
              {formData.pricingType ? ` / ${formData.pricingType}` : ""}
            </span>
          )}
        </div>

        {/* Info list */}
        <ul className="space-y-3">
          <li className="flex gap-3">
            <FileText className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <p><span className="font-semibold text-gray-800">Category:</span> <span className="text-gray-700">{formData.category}</span></p>
          </li>
          <li className="flex gap-3">
            <FileText className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <p><span className="font-semibold text-gray-800">Service Type:</span> <span className="text-gray-700">{formData.serviceType || "Not set"}</span></p>
          </li>
          <li className="flex gap-3">
            <FileText className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <p><span className="font-semibold text-gray-800">Title:</span> <span className="text-gray-700">{formData.title || "Not set"}</span></p>
          </li>
          <li className="flex gap-3">
            <FileText className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <p className="text-gray-700"><span className="font-semibold text-gray-800">Description:</span> {formData.description || "Not set"}</p>
          </li>
          <li className="flex gap-3">
            <FileText className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <p className="text-gray-700"><span className="font-semibold text-gray-800">Includes:</span> {formData.includes || "None"}</p>
          </li>
          <li className="flex gap-3">
            <Users className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <p className="text-gray-700"><span className="font-semibold text-gray-800">Target Audience:</span> {formData.targetAudience || "Not set"}</p>
          </li>
          <li className="flex gap-3">
            <Clock className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <p className="text-gray-700"><span className="font-semibold text-gray-800">Duration:</span> {formData.duration || "Not set"}</p>
          </li>
          <li className="flex gap-3">
            <CalendarDays className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <p className="text-gray-700"><span className="font-semibold text-gray-800">Recurrence:</span> {formData.recurrence || "Not set"}</p>
          </li>
          <li className="flex gap-3">
            <BadgeDollarSign className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <p className="text-gray-700">
              <span className="font-semibold text-gray-800">Price:</span>{" "}
              {formData.price || "Not set"}{formData.pricingType ? ` (${formData.pricingType})` : ""}
            </p>
          </li>
          <li className="flex gap-3">
            <FileText className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <p className="text-gray-700"><span className="font-semibold text-gray-800">Cancellation Policy:</span> {formData.cancellationPolicy || "Not set"}</p>
          </li>
          <li className="flex gap-3">
            <FileText className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <p className="text-gray-700"><span className="font-semibold text-gray-800">Qualifications:</span> {formData.qualifications || "None"}</p>
          </li>
          <li className="flex gap-3">
            <Users className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <p className="text-gray-700"><span className="font-semibold text-gray-800">Client Requirements:</span> {formData.clientRequirements || "None"}</p>
          </li>
          <li className="flex gap-3">
            <Users className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <p className="text-gray-700"><span className="font-semibold text-gray-800">Max Participants:</span> {formData.maxParticipants || 1}</p>
          </li>
          <li className="flex gap-3">
            <FileText className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <p className="text-gray-700">
              <span className="font-semibold text-gray-800">Age Restriction:</span>{" "}
              {formData.ageRestriction?.min} - {formData.ageRestriction?.max}
            </p>
          </li>
          <li className="flex gap-3">
            <Languages className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold text-gray-800">Languages:</span>{" "}
              {formData.languages?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {formData.languages.map((lang, i) => (
                    <span
                      key={`${lang}-${i}`}
                      className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-700">None</span>
              )}
            </div>
          </li>
          <li className="flex gap-3">
            <MapPin className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <div className="text-gray-700">
              <p>
                <span className="font-semibold text-gray-800">Location Type:</span>{" "}
                {formData.locationType || "Not set"}
              </p>
              {formData.locationType === "in-person" && (
                <p className="mt-1">
                  <span className="font-semibold text-gray-800">Address:</span>{" "}
                  {formData.address || "Not set"}
                </p>
              )}
            </div>
          </li>
        </ul>

        {/* Terms (checkbox + link to modal) */}
        <label className="mt-6 flex items-start gap-3 select-none cursor-pointer">
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

    {/* Actions */}
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
      <button type="button" onClick={prevStep} className={btnSecondary}>Back</button>
      <button type="button" onClick={saveDraft} className={btnGhost}>Save to Drafts</button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!formData.agreeToTerms}
        className={`${btnPrimary} disabled:opacity-50 disabled:pointer-events-none`}
      >
        Publish
      </button>
    </div>

    <PolicyComplianceModal
      open={openPolicyModal}
      onClose={() => setOpenPolicyModal(false)}
      onConfirm={() => {
        // mark agreement when they confirm the policy
        handleChange("agreeToTerms", true);
        setOpenPolicyModal(false);
      }}
    />

  </section>
);

};
