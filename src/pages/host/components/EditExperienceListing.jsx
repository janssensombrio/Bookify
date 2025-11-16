import React, { useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { database } from "../../../config/firebase";
import LocationPickerMapString from "./LocationPickerMap";
import {
  X,
  Save,
  Image as ImageIcon,
  UploadCloud,
  CalendarClock,
  Clock3,
  Users,
  MapPin,
  Languages,
  Tag,
  Plus,
  Trash2,
  BadgeDollarSign,
  BadgePercent,
  ShieldCheck,
  ShieldAlert,
  LocateFixed,
  UtensilsCrossed,
  Mountain,
  Heart,
  Landmark,
  Film,
  Heading1,
  AlignLeft,
  Info,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// 👉 Configure your Cloudinary details
const CLOUD_NAME = "dijmlbysr"; // update if needed
const UPLOAD_PRESET = "listing-uploads"; // unsigned preset

// Listing type options (subcategories) matching host-set-up-2.jsx
const LISTING_TYPES = [
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
];

/**
 * ExperienceEditModal (Improved UI matching EditHomeListing style)
 * - Matches all fields from host-set-up-2.jsx (except category)
 * - Improved UI with better spacing, organization, and responsiveness
 * - Scrollable body with sticky header/footer
 * - Uploads new photos to Cloudinary, preserves existing URLs
 */
export default function ExperienceEditModal({ open, onClose, listingId, refreshList }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [experience, setExperience] = useState(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const fileInputRef = useRef(null);

  // ---------- Fetch document ----------
  useEffect(() => {
    if (!open || !listingId) return;
    (async () => {
      try {
        setLoading(true);
        const ref = doc(database, "listings", listingId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          // Normalize some fields for safe editing
          const age = data.ageRestriction || { min: 0, max: 100 };
          const langs = Array.isArray(data.languages) ? data.languages : [];
          const photos = Array.isArray(data.photos) ? data.photos : [];
          const schedule = Array.isArray(data.schedule) ? data.schedule : [];
          // Normalize discount fields
          const discountType = data.discountType || "none";
          const discountValue = Number(data.discountValue || 0);
          setExperience({
            listingType: "",
            title: "",
            description: "",
            duration: "",
            maxParticipants: 1,
            experienceType: "in-person",
            languages: [],
            location: "",
            price: 0,
            amenities: [],
            hostRequirements: "",
            cancellationPolicy: "",
            photos: [],
            schedule: [],
            ageRestriction: { min: 0, max: 100 },
            discountType: "none",
            discountValue: 0,
            ...data,
            ageRestriction: { min: Number(age.min ?? 0), max: Number(age.max ?? 100) },
            languages: langs,
            photos,
            schedule: schedule.map((s) => ({ date: s.date || "", time: s.time || "" })),
            discountType: discountType === "percentage" || discountType === "fixed" ? discountType : "none",
            discountValue,
          });
        }
      } catch (e) {
        console.error(e);
        alert("Failed to load listing");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, listingId]);

  const setField = (key, value) => setExperience((p) => ({ ...p, [key]: value }));

  const addAmenity = (txt) => {
    const val = (txt || "").trim();
    if (!val) return;
    setExperience((p) => ({ ...p, amenities: [...(p.amenities || []), val] }));
  };

  const addLanguage = (txt) => {
    const val = (txt || "").trim();
    if (!val) return;
    setExperience((p) => ({ ...p, languages: Array.from(new Set([...(p.languages || []), val])) }));
  };

  const addSchedule = (date, time) => {
    if (!date || !time) return;
    setExperience((p) => {
      const exists = (p.schedule || []).some((s) => s.date === date && s.time === time);
      if (exists) return p;
      return { ...p, schedule: [...(p.schedule || []), { date, time }] };
    });
  };

  // ---------- Save (matching host-set-up-2.jsx structure) ----------
  const handleSave = async () => {
    if (!listingId || !experience) return;

    // Validation
    const missing = [];
    if (!experience.listingType) missing.push("Listing Type");
    if (!experience.title) missing.push("Title");
    if (!experience.description) missing.push("Description");
    if (!experience.duration) missing.push("Duration");
    if (experience.price === "" || isNaN(Number(experience.price))) missing.push("Price");

    if (missing.length) {
      alert(`Please complete: \n\n• ${missing.join("\n• ")}`);
      return;
    }

    setSaving(true);
    try {
      // Separate existing URLs from new File objects
      const existing = (experience.photos || []).filter((p) => typeof p === "string");
      const toUpload = (experience.photos || []).filter((p) => p instanceof File);

      // Upload to Cloudinary (if any files)
      let uploadedUrls = [];
      if (toUpload.length) {
        uploadedUrls = await Promise.all(
          toUpload.map(async (file) => {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("upload_preset", UPLOAD_PRESET);
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
              method: "POST",
              body: fd,
            });
            const json = await res.json();
            if (!json.secure_url) throw new Error("Upload failed");
            return json.secure_url;
          })
        );
      }

      // Match the exact structure from host-set-up-2.jsx
      const normalized = {
        ...experience, // includes all fields: listingType, title, description, duration, maxParticipants, experienceType, languages, location, amenities, hostRequirements, cancellationPolicy, etc.
        price: Number(experience.price || 0),
        discountValue: Number(experience.discountValue || 0),
      };

      // Final data structure matching host-set-up-2.jsx dataToSave structure
      const dataToSave = {
        ...normalized,
        maxParticipants: Number(experience.maxParticipants || 1),
        ageRestriction: {
          min: Number(experience.ageRestriction?.min || 0),
          max: Number(experience.ageRestriction?.max || 0),
        },
        photos: [...existing, ...uploadedUrls],
        languages: (experience.languages || []).map((l) => String(l)),
        schedule: (experience.schedule || []).map((s) => ({ date: s.date || "", time: s.time || "" })),
        location: experience.location || "",
        // Normalize discount fields
        discountType: (experience.discountType === "percentage" || experience.discountType === "fixed") ? experience.discountType : "none",
        discountValue: Number(experience.discountValue || 0),
        // Note: category is excluded as per user request
        // Note: status, publishedAt, updatedAt are handled by the parent component
      };

      // If discount is invalid/empty, reset to "none"
      const hasDiscount = (dataToSave.discountType !== "none" && dataToSave.discountValue > 0);
      if (!hasDiscount) {
        dataToSave.discountType = "none";
        dataToSave.discountValue = 0;
      }

      // Persist
      const ref = doc(database, "listings", listingId);
      await updateDoc(ref, dataToSave);

      refreshList && refreshList();
      alert("Experience updated successfully!");
      onClose && onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to save changes. Try again.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!experience) return;
    if (experience.experienceType === "online" && experience.location) {
      setField("location", "");
    }
  }, [experience?.experienceType]);

  // ---------- Derived helpers ----------
  const minAge = Number(experience?.ageRestriction?.min ?? 0);
  const maxAge = Number(experience?.ageRestriction?.max ?? 100);
  const invalidAge = minAge > maxAge || minAge < 0 || maxAge < 0;

  const isOnline = (experience?.experienceType || "") === "online";

  // Discount helpers
  const discountType = experience?.discountType || "none";
  const discountValue = Number(experience?.discountValue || 0);
  const price = Number(experience?.price || 0);
  const pctInvalid = discountType === "percentage" && (discountValue <= 0 || discountValue > 100);
  const fixedInvalid = discountType === "fixed" && discountValue < 0;

  // ---------- Render ----------
  if (!open) return null;

  return (
    <div
      className={[
        "fixed inset-0 z-50 transition",
        open ? "opacity-100" : "opacity-0 pointer-events-none",
      ].join(" ")}
      aria-hidden={!open}
      role="dialog"
      aria-modal="true"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="absolute inset-0 p-3 sm:p-6 grid place-items-center">
        <div
          className="w-full max-w-6xl max-h-[92vh] rounded-3xl overflow-y-auto
                    bg-gradient-to-br from-blue-50 via-white to-indigo-50
                    shadow-[0_12px_30px_rgba(30,58,138,0.12),_0_40px_80px_rgba(30,58,138,0.12)]
                    border border-white/60 scroll-smooth overscroll-contain"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white/70 backdrop-blur-md border-b border-white/60 px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                <ShieldCheck className="w-4.5 h-4.5" />
              </span>
              <h2 id="edit-exp-title" className="text-lg sm:text-xl font-semibold text-gray-900">
                Edit Experience
              </h2>
              {loading && (
                <span className="ml-2 text-xs text-gray-500">Loading…</span>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/90 hover:bg-white border border-gray-200 shadow"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
          </div>

          {/* Body (scroll) */}
          <div className="overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6">
            {!experience ? (
              <div className="grid place-items-center h-64 text-gray-600">Fetching data…</div>
            ) : (
              <>
                {/* Listing Type (NEW - matching host-set-up-2.jsx) */}
                <section>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">
                    Experience Type (Subcategory)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
                    {LISTING_TYPES.map(({ value, label, desc, Icon }) => {
                      const active = experience.listingType === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setField("listingType", value)}
                          aria-pressed={active}
                          className={[
                            "group relative w-full rounded-2xl overflow-hidden text-left",
                            "bg-white/80 backdrop-blur-md border border-white/60",
                            "shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]",
                            "hover:shadow-[0_12px_30px_rgba(30,58,138,0.12),0_30px_60px_rgba(30,58,138,0.12)]",
                            "transition-all duration-300 hover:-translate-y-0.5",
                            active ? "ring-2 ring-blue-400/50 border-blue-600/60" : "",
                            "p-4",
                          ].join(" ")}
                        >
                          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/50 to-transparent" />
                          <div className="relative flex flex-col items-center text-center">
                            <div
                              className={[
                                "grid place-items-center rounded-xl w-12 h-12 mb-2",
                                active
                                  ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
                                  : "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700",
                                "shadow-lg shadow-blue-500/20 ring-4 ring-white/50",
                              ].join(" ")}
                            >
                              <Icon className="w-6 h-6" />
                            </div>
                            <div className="text-sm font-semibold text-gray-900">{label}</div>
                            <div className="text-xs text-gray-600 mt-1">{desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Title & Description */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-4 sm:p-6">
                    <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Heading1 className="w-4.5 h-4.5" /> Listing Title
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                      value={experience.title || ""}
                      onChange={(e) => setField("title", e.target.value)}
                      placeholder="e.g., Sunrise Hike & Coffee"
                    />
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>Keep it short and compelling</span>
                      <span className="font-medium">{(experience.title?.length || 0)}/60</span>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-4 sm:p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                        <AlignLeft className="w-4.5 h-4.5" />
                      </div>
                      <label className="text-sm font-semibold text-gray-900">Detailed Description</label>
                    </div>
                    <textarea
                      rows={5}
                      className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500 resize-y"
                      value={experience.description || ""}
                      onChange={(e) => setField("description", e.target.value)}
                      placeholder="What will guests do? What's unique?"
                    />
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>Aim for clarity and helpful details</span>
                      <span className="font-medium">{(experience.description?.length || 0)}/1000</span>
                    </div>
                  </div>
                </section>

                {/* Photos */}
                <section className="space-y-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" /> Photos
                  </h3>

                  {/* Dropzone */}
                  <div className="rounded-3xl border-2 border-dashed border-blue-300 bg-white/70 backdrop-blur-md shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-5 sm:p-6 md:p-8 text-center">
                    <label htmlFor="photo-upload" className="cursor-pointer select-none flex flex-col items-center justify-center gap-3">
                      <span className="grid place-items-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                        <UploadCloud className="w-8 h-8 sm:w-10 sm:h-10" />
                      </span>
                      <div>
                        <p className="text-base sm:text-lg font-semibold text-gray-900">Click to upload images</p>
                        <p className="text-xs sm:text-sm text-gray-600">You can select multiple files (PNG, JPG)</p>
                      </div>
                    </label>
                    <input
                      id="photo-upload"
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (!files.length) return;
                        setExperience((p) => ({ ...p, photos: [...(p.photos || []), ...files] }));
                        e.target.value = "";
                      }}
                    />
                  </div>

                  {/* Preview grid */}
                  {experience.photos?.length > 0 && (
                    <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-4 sm:p-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-900">Uploaded photos</h4>
                        <span className="text-xs text-gray-600">{experience.photos.length} total</span>
                      </div>

                      {/* Hero image */}
                      {experience.photos.length > 0 && (
                        <>
                          <div className="relative w-full rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 h-[220px] sm:h-[300px] md:h-[380px] mb-4">
                            <img
                              src={typeof experience.photos[currentPhotoIndex || 0] === "string" 
                                ? experience.photos[currentPhotoIndex || 0] 
                                : URL.createObjectURL(experience.photos[currentPhotoIndex || 0])}
                              alt={`Photo ${(currentPhotoIndex || 0) + 1}`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                            <div className="absolute top-3 right-3 rounded-full bg-black/55 text-white text-xs font-medium px-3 py-1">
                              {(currentPhotoIndex || 0) + 1} / {experience.photos.length}
                            </div>

                            {experience.photos.length > 1 && (
                              <>
                                <button
                                  type="button"
                                  aria-label="Previous photo"
                                  onClick={() => setCurrentPhotoIndex((p) => Math.max(0, (p || 0) - 1))}
                                  disabled={(currentPhotoIndex || 0) === 0}
                                  className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/85 hover:bg-white border border-white/60 shadow grid place-items-center disabled:opacity-50"
                                >
                                  <ChevronLeft className="w-5 h-5 text-gray-700" />
                                </button>
                                <button
                                  type="button"
                                  aria-label="Next photo"
                                  onClick={() => setCurrentPhotoIndex((p) => Math.min(experience.photos.length - 1, (p || 0) + 1))}
                                  disabled={(currentPhotoIndex || 0) === experience.photos.length - 1}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/85 hover:bg-white border border-white/60 shadow grid place-items-center disabled:opacity-50"
                                >
                                  <ChevronRight className="w-5 h-5 text-gray-700" />
                                </button>
                              </>
                            )}
                          </div>

                          {/* Thumbnails */}
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {experience.photos.map((ph, idx) => {
                              const active = idx === (currentPhotoIndex || 0);
                              return (
                                <div
                                  key={idx}
                                  className={[
                                    "relative aspect-[4/3] w-full overflow-hidden rounded-xl border bg-white shadow-sm cursor-pointer",
                                    active ? "border-blue-500 ring-2 ring-blue-400/60" : "border-gray-200",
                                  ].join(" ")}
                                >
                                  <button
                                    type="button"
                                    onClick={() => setCurrentPhotoIndex(idx)}
                                    className="absolute inset-0"
                                    aria-label={`Select photo ${idx + 1}`}
                                  />
                                  <img 
                                    src={typeof ph === "string" ? ph : URL.createObjectURL(ph)} 
                                    alt={`Thumb ${idx + 1}`} 
                                    className="h-full w-full object-cover" 
                                    loading="lazy" 
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExperience((p) => ({
                                        ...p,
                                        photos: (p.photos || []).filter((_, i) => i !== idx),
                                      }))
                                    }
                                    aria-label={`Remove photo ${idx + 1}`}
                                    className="absolute z-10 top-2 right-2 inline-flex w-7 h-7 items-center justify-center rounded-full bg-white/90 hover:bg-white border border-gray-200 shadow"
                                  >
                                    <X className="w-4 h-4 text-gray-700" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </section>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                  {/* LEFT (span 2) */}
                  <div className="lg:col-span-2 grid gap-4 sm:gap-6">
                    {/* Location (hidden for online experiences) */}
                    {!isOnline && (
                      <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-4 sm:p-6">
                        <label className="block text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <MapPin className="w-4.5 h-4.5" /> Address / Location
                        </label>

                        {/* Map picker */}
                        <div className="rounded-2xl overflow-hidden border border-gray-200 mb-3">
                          <div className="h-56 sm:h-64">
                            <LocationPickerMapString
                              address={experience.location}
                              onAddressChange={(addr) => setField("location", addr || "")}
                            />
                          </div>
                        </div>

                        {/* Editable address field */}
                        <div className="relative mb-3">
                          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                            <MapPin className="w-4.5 h-4.5" />
                          </div>
                          <input
                            className="w-full rounded-2xl border border-gray-300 bg-white/90 pl-14 pr-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                            value={experience.location || ""}
                            onChange={(e) => setField("location", e.target.value)}
                            placeholder="Click on the map to populate, or type an address"
                          />
                        </div>

                        {/* Quick actions */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!navigator.geolocation) return;
                              navigator.geolocation.getCurrentPosition(async ({ coords }) => {
                                try {
                                  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=18&addressdetails=1&accept-language=en`;
                                  const res = await fetch(url);
                                  const data = await res.json();
                                  setField("location", data?.display_name || "");
                                } catch {
                                  setField("location", `${coords.latitude}, ${coords.longitude}`);
                                }
                              });
                            }}
                            className="inline-flex items-center gap-2 justify-center rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
                          >
                            <LocateFixed className="w-4 h-4" />
                            Use my location
                          </button>
                          <button
                            type="button"
                            onClick={() => setField("location", "")}
                            className="inline-flex items-center justify-center rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition"
                          >
                            Clear
                          </button>
                        </div>
                      </section>
                    )}

                    {/* Amenities */}
                    <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-4 sm:p-6">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Tag className="w-5 h-5" /> Amenities
                      </h3>
                      {experience.amenities?.length ? (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {experience.amenities.map((a, i) => (
                            <span key={i} className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-xs sm:text-sm font-medium shadow-sm">
                              {a}
                              <button
                                type="button"
                                className="rounded-full p-1 hover:bg-blue-100"
                                onClick={() =>
                                  setExperience((p) => ({
                                    ...p,
                                    amenities: (p.amenities || []).filter((_, idx) => idx !== i),
                                  }))
                                }
                                aria-label={`Remove ${a}`}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mb-3 text-sm text-gray-600">No amenities yet.</p>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          placeholder="e.g., Snacks, Drinks, Equipment provided"
                          className="flex-1 rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addAmenity(e.currentTarget.value);
                              e.currentTarget.value = "";
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition"
                          onClick={(e) => {
                            const inp = e.currentTarget.previousSibling;
                            if (inp && inp.value) {
                              addAmenity(inp.value);
                              inp.value = "";
                            }
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" /> Add
                        </button>
                      </div>
                    </section>

                    {/* Schedule */}
                    <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-4 sm:p-6">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <CalendarClock className="w-5 h-5" /> Schedule
                      </h3>
                      {experience.schedule?.length > 0 ? (
                        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {experience.schedule.map((s, i) => (
                            <div key={`${s.date}-${s.time}-${i}`} className="relative rounded-2xl border border-gray-200 p-4 bg-white/70">
                              <div className="text-sm text-gray-500">Date</div>
                              <div className="font-semibold text-gray-900">{s.date || "—"}</div>
                              <div className="mt-1 inline-flex items-center gap-2 px-2 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-semibold">
                                <Clock3 className="w-3.5 h-3.5" /> {s.time || "—"}
                              </div>
                              <button
                                type="button"
                                className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/90 border border-gray-200 shadow hover:bg-white"
                                onClick={() => setExperience((p) => ({ ...p, schedule: p.schedule.filter((_, idx) => idx !== i) }))}
                                aria-label="Remove schedule"
                              >
                                <Trash2 className="w-4.5 h-4.5 text-gray-700" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mb-4 text-sm text-gray-600">No schedule slots yet.</p>
                      )}

                      {/* Add new slot */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="date"
                          className="rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                          id="sched-date"
                        />
                        <input
                          type="time"
                          className="rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                          id="sched-time"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const d = document.getElementById("sched-date");
                            const t = document.getElementById("sched-time");
                            addSchedule(d?.value, t?.value);
                            if (d) d.value = "";
                            if (t) t.value = "";
                          }}
                          className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition"
                        >
                          <Plus className="w-4 h-4 mr-1" /> Add slot
                        </button>
                      </div>
                    </section>

                    {/* Host Requirements & Cancellation Policy */}
                    <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-4 sm:p-6 space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          <ShieldCheck className="w-4.5 h-4.5" /> Host Requirements
                        </label>
                        <textarea
                          rows={4}
                          className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                          value={experience.hostRequirements || ""}
                          onChange={(e) => setField("hostRequirements", e.target.value)}
                          placeholder="What guests should prepare (ID, attire, fitness, etc.)"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          <ShieldAlert className="w-4.5 h-4.5" /> Cancellation Policy
                        </label>
                        <textarea
                          rows={4}
                          className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                          value={experience.cancellationPolicy || ""}
                          onChange={(e) => setField("cancellationPolicy", e.target.value)}
                          placeholder="e.g., Full refund up to 48 hours before start, 50% within 24–48h, none within 24h."
                        />
                      </div>
                    </section>
                  </div>

                  {/* RIGHT column */}
                  <div className="grid gap-4 sm:gap-6">
                    {/* Duration + Participants */}
                    <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-4 sm:p-5 space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          <Clock3 className="w-4.5 h-4.5" /> Duration
                        </label>
                        <input
                          type="text"
                          className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                          value={experience.duration || ""}
                          onChange={(e) => setField("duration", e.target.value)}
                          placeholder="e.g., 2 hours"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          <Users className="w-4.5 h-4.5" /> Max participants
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setField("maxParticipants", Math.max(1, Number(experience.maxParticipants || 1) - 1))}
                            className="w-10 h-10 rounded-full border border-gray-300 bg-white hover:bg-gray-50 transition"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={experience.maxParticipants || 1}
                            onChange={(e) => setField("maxParticipants", Math.max(1, Number(e.target.value || 1)))}
                            className="w-24 text-center rounded-xl border border-gray-300 bg-white/90 px-3 py-2 font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() => setField("maxParticipants", Math.max(1, Number(experience.maxParticipants || 1) + 1))}
                            className="w-10 h-10 rounded-full border border-blue-500 text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow transition"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </section>

                    {/* Experience type */}
                    <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-4 sm:p-5">
                      <label className="block text-sm font-semibold text-gray-900 mb-3">Experience type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[{ key: "in-person", label: "In-person" }, { key: "online", label: "Online" }].map(({ key, label }) => {
                          const on = (experience.experienceType || "") === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() =>
                                setExperience((p) => ({
                                  ...p,
                                  experienceType: key,
                                  ...(key === "online" ? { location: "" } : {}),
                                }))
                              }
                              className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${on ? "border-blue-500 bg-blue-50/80 shadow" : "border-gray-200 bg-white/70 hover:bg-gray-50"}`}
                            >
                              <div className="font-semibold text-sm text-gray-900">{label}</div>
                              <div className="text-xs text-gray-600">{key === "online" ? "Live via video call" : "On location"}</div>
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    {/* Languages */}
                    <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-4 sm:p-5">
                      <label className="block text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Languages className="w-4.5 h-4.5" /> Languages
                      </label>
                      {experience.languages?.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {experience.languages.map((lang, i) => (
                            <span key={lang + i} className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-xs sm:text-sm font-medium shadow-sm">
                              {lang}
                              <button
                                type="button"
                                className="rounded-full p-1 hover:bg-blue-100"
                                onClick={() => setExperience((p) => ({ ...p, languages: p.languages.filter((_, idx) => idx !== i) }))}
                                aria-label={`Remove ${lang}`}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600 mb-3">No languages yet.</p>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g., English, Tagalog"
                          className="flex-1 rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addLanguage(e.currentTarget.value);
                              e.currentTarget.value = "";
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition"
                          onClick={(e) => {
                            const inp = e.currentTarget.previousSibling;
                            if (inp && inp.value) {
                              addLanguage(inp.value);
                              inp.value = "";
                            }
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" /> Add
                        </button>
                      </div>
                    </section>

                    {/* Age restriction */}
                    <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-4 sm:p-5">
                      <label className="block text-sm font-semibold text-gray-900 mb-3">Age restriction</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min={0}
                          className="rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                          value={minAge}
                          onChange={(e) => setField("ageRestriction", { ...experience.ageRestriction, min: Math.max(0, Number(e.target.value || 0)) })}
                          placeholder="Min age"
                        />
                        <input
                          type="number"
                          min={0}
                          className="rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                          value={maxAge}
                          onChange={(e) => setField("ageRestriction", { ...experience.ageRestriction, max: Math.max(0, Number(e.target.value || 0)) })}
                          placeholder="Max age"
                        />
                      </div>
                      {invalidAge && (
                        <p className="mt-2 text-sm font-medium text-red-600">Max age must be ≥ Min age.</p>
                      )}
                    </section>

                    {/* Price */}
                    <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-4 sm:p-5">
                      <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <BadgeDollarSign className="w-4.5 h-4.5" /> Price per participant (₱)
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                          <BadgeDollarSign className="w-5 h-5" />
                        </div>
                        <span className="absolute left-14 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₱</span>
                        <input
                          type="number"
                          min={0}
                          className="w-full rounded-2xl border border-gray-300 bg-white/90 pl-20 pr-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                          value={Number(experience.price || 0)}
                          onChange={(e) => setField("price", Number(e.target.value || 0))}
                          placeholder="e.g., 1200"
                        />
                      </div>
                    </section>

                    {/* Discount */}
                    <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-4 sm:p-5 space-y-3">
                      <label className="block text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <BadgePercent className="w-4.5 h-4.5" /> Discount (optional)
                      </label>

                      {/* Type selector */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { key: "none", label: "None" },
                          { key: "percentage", label: "%" },
                          { key: "fixed", label: "₱" },
                        ].map(({ key, label }) => {
                          const on = (discountType || "none") === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setField("discountType", key)}
                              className={`w-full rounded-2xl border px-3 py-2 text-sm font-semibold transition-all ${on ? "border-blue-500 bg-blue-50/80 shadow" : "border-gray-200 bg-white/70 hover:bg-gray-50"}`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Value input */}
                      {discountType !== "none" && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            {discountType === "percentage" ? "Percent off" : "Amount off (₱)"}
                          </label>
                          <input
                            type="number"
                            min={discountType === "percentage" ? 1 : 0}
                            max={discountType === "percentage" ? 100 : undefined}
                            className={`w-full rounded-2xl border px-4 py-3 bg-white/90 ${pctInvalid || fixedInvalid ? "border-red-400" : "border-gray-300"} focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500`}
                            value={Number(discountValue)}
                            onChange={(e) => setField("discountValue", Number(e.target.value || 0))}
                            placeholder={discountType === "percentage" ? "e.g., 10" : "e.g., 200"}
                          />
                          {pctInvalid && (
                            <p className="mt-1 text-xs text-red-600">Enter a value between 1 and 100.</p>
                          )}
                          {fixedInvalid && (
                            <p className="mt-1 text-xs text-red-600">Amount cannot be negative.</p>
                          )}
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 z-10 bg-white/70 backdrop-blur-md border-t border-white/60 px-4 sm:px-6 py-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || invalidAge || pctInvalid || fixedInvalid}
              onClick={handleSave}
              className={`inline-flex items-center justify-center rounded-full px-7 py-2.5 text-sm font-semibold text-white shadow-md transition ${saving || invalidAge || pctInvalid || fixedInvalid ? "opacity-60 cursor-not-allowed bg-blue-500" : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"}`}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
