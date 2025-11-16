import React, { useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// Adjust this import path to where your map component lives
import LocationPickerMapString from "./LocationPickerMap";

import {
  Home,
  BedDouble,
  Users,
  Building2,
  Crown,
  Mountain,
  Tent,
  Wifi,
  Coffee,
  Tv,
  Car,
  Dumbbell,
  PawPrint,
  Snowflake,
  Waves,
  ShowerHead,
  KeyRound,
  Utensils,
  Wind,
  Lock,
  X,
  UploadCloud,
  Image as ImageIcon,
  Heading1,
  AlignLeft,
  ShieldCheck,
  BadgeDollarSign,
  Brush,
  Percent,
  Tag,
  Info,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/** Cloudinary (same as your setup page) */
const CLOUD_NAME = "dijmlbysr";
const UPLOAD_PRESET = "listing-uploads";

/** Helpers from Host Setup theme */
const nightsBetween = (s, e) => {
  if (!s || !e) return 0;
  const msPerDay = 1000 * 60 * 60 * 24;
  const startMs = new Date(`${s}T00:00:00`).setHours(12);
  const endMs = new Date(`${e}T00:00:00`).setHours(12);
  return Math.max(0, Math.ceil((endMs - startMs) / msPerDay));
};

const formatYMD = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const LISTING_TYPES = [
  { value: "Entire place", label: "Entire place", desc: "Guests have the whole space.", Icon: Home },
  { value: "Private room", label: "Private room", desc: "Private room, shared commons.", Icon: BedDouble },
  { value: "Shared room", label: "Shared room", desc: "Shared room & common areas.", Icon: Users },
];

const PROPERTY_TYPES = [
  { value: "Apartment", label: "Apartment", desc: "A self-contained unit.", Icon: Building2 },
  { value: "House", label: "House", desc: "Standalone with full privacy.", Icon: Home },
  { value: "Cottage", label: "Cottage", desc: "Cozy small/rural home.", Icon: Mountain },
  { value: "Villa", label: "Villa", desc: "Spacious & luxurious.", Icon: Crown },
  { value: "Cabin", label: "Cabin", desc: "Rustic nature retreat.", Icon: Tent },
];

const POPULAR_AMENITIES = [
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
];

export default function EditHomeModal({
  open = false,
  onClose = () => {},
  listing = {},
  onSave = async () => {},
}) {
  /** Mirror HostSetUp’s field model */
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
    cancellationPolicy: "",           // ✅ added
    agreeToTerms: false,
  });

  const [newAmenity, setNewAmenity] = useState("");
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showFullPolicy, setShowFullPolicy] = useState(false); // ✅ for read-more/less

  /** Hydrate from incoming listing */
  useEffect(() => {
    if (!open) return;
    const safe = { ...formData, ...listing };

    // normalize guests object
    if (listing?.guests && typeof listing.guests === "object") {
      const g = listing.guests;
      safe.guests = {
        adults: Number(g.adults ?? 1),
        children: Number(g.children ?? 0),
        infants: Number(g.infants ?? 0),
      };
    }

    // normalize photos to array of strings
    if (Array.isArray(listing?.photos)) {
      safe.photos = listing.photos;
    }

    // ensure availability keys exist
    safe.availability = {
      start: listing?.availability?.start || "",
      end: listing?.availability?.end || "",
    };

    // cancellation policy hydrate
    safe.cancellationPolicy = listing?.cancellationPolicy || "";

    // default category if missing
    if (!safe.category) safe.category = "Homes";

    setFormData(safe);
    setCurrentPhotoIndex(0);
    setShowFullPolicy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, listing]);

  const handleChange = (key, value) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  /** Guests helpers */
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

  /** Availability helpers */
  const startDate = formData?.availability?.start
    ? new Date(formData.availability.start + "T00:00:00")
    : null;
  const endDate = formData?.availability?.end
    ? new Date(formData.availability.end + "T00:00:00")
    : null;

  const handleRangeChange = (dates) => {
    const [start, end] = dates || [];
    setFormData((prev) => ({
      ...prev,
      availability: {
        start: start ? formatYMD(start) : "",
        end: end ? formatYMD(end) : "",
      },
    }));
  };
  const invalidRange =
    formData?.availability?.start && formData?.availability?.end
      ? new Date(`${formData.availability.start}T00:00:00`).setHours(12) >
        new Date(`${formData.availability.end}T00:00:00`).setHours(12)
      : false;

  /** Pricing summary (same logic as setup) */
  const priceSummary = useMemo(() => {
    const price = Number(formData.price || 0);
    const clean = Number(formData.cleaningFee || 0);
    const type = formData.discountType || "none";
    const dVal = Number(formData.discountValue || 0);

    const discountPerNight = type === "percentage" ? Math.max(0, (price * dVal) / 100) : 0;
    const nightlyAfter = Math.max(0, price - discountPerNight);

    const hasDates = !!(formData?.availability?.start && formData?.availability?.end);
    const nightsSel = nightsBetween(formData?.availability?.start, formData?.availability?.end);
    const displayNights = hasDates && nightsSel > 0 ? nightsSel : 1;

    const fixedDiscount = type === "fixed" ? Math.max(0, dVal) : 0;
    const staySubtotal = displayNights * nightlyAfter;
    const bookingTotal = Math.max(0, staySubtotal + clean - fixedDiscount);

    return {
      price,
      clean,
      type,
      dVal,
      discountPerNight,
      nightlyAfter,
      displayNights,
      fixedDiscount,
      bookingTotal,
      hasDates,
      nightsSel,
    };
  }, [formData]);

  /** Save */
  const handleSave = async () => {
    // minimal required checks (align with setup flow)
    const missing = [];
    if (!formData.listingType) missing.push("Listing Type");
    if (!formData.location) missing.push("Location");
    if (!formData.propertyType) missing.push("Property Type");
    if (!formData.title) missing.push("Title");
    if (!formData.description) missing.push("Description");
    if (formData.price === "" || isNaN(Number(formData.price))) missing.push("Price");

    if (missing.length) {
      alert(`Please complete: \n\n• ${missing.join("\n• ")}`);
      return;
    }

    // Match the exact structure from host-set-up.jsx
    // Normalize numeric fields (matching host-set-up.jsx handleSubmit)
    const normalized = {
      ...formData, // includes all fields: listingType, location, propertyType, uniqueDescription, amenities, photos, title, description, availability, cancellationPolicy, bedrooms, beds, bathrooms, etc.
      price: Number(formData.price || 0),
      cleaningFee: Number(formData.cleaningFee || 0),
      discountValue: Number(formData.discountValue || 0),
    };

    // Normalize guests object (matching host-set-up.jsx)
    const g = formData.guests || {};
    const adults = Number(g.adults ?? 1);
    const children = Number(g.children ?? 0);
    const infants = Number(g.infants ?? 0);
    const guests = { adults, children, infants, total: adults + children + infants };

    // Final data structure matching host-set-up.jsx dataToSave structure
    // All fields from formData are included via spread, with explicit normalization for price, cleaningFee, discountValue, and guests
    const dataToSave = {
      ...normalized,
      guests,
      location: formData.location || "",
      // Note: category is excluded as per user request
      // Note: status, publishedAt, updatedAt are handled by the parent component (listings.jsx)
    };

    setSaving(true);
    try {
      await onSave(dataToSave);
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  /** Upload images to Cloudinary */
  const uploadImages = async (files) => {
    if (!files?.length) return [];
    const uploadedUrls = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", UPLOAD_PRESET);
      try {
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
          { method: "POST", body: fd }
        );
        const data = await res.json();
        if (data.secure_url) uploadedUrls.push(data.secure_url);
      } catch (err) {
        console.error("Upload failed:", err);
        alert("An image failed to upload. Try again.");
      }
    }
    return uploadedUrls;
  };

  /** Modal shell */
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
          style={{ WebkitOverflowScrolling: "touch" }}  // helps iOS inertial scrolling
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white/70 backdrop-blur-md border-b border-white/60 px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                <ShieldCheck className="w-4.5 h-4.5" />
              </span>
              <h2 id="edit-exp-title" className="text-lg sm:text-xl font-semibold text-gray-900">
                Edit Home
              </h2>
            </div>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/90 hover:bg-white border border-gray-200 shadow"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
          </div>

          {/* Body (scroll) */}
          <div className="overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6">
            {/* Listing Type */}
            <section>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">
                What kind of place are you listing?
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {LISTING_TYPES.map(({ value, label, desc, Icon }) => {
                  const active = formData.listingType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleChange("listingType", value)}
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
                      <div className="relative flex items-start gap-3">
                        <div
                          className={[
                            "grid place-items-center rounded-xl w-12 h-12",
                            active
                              ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
                              : "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700",
                            "shadow-lg shadow-blue-500/20 ring-4 ring-white/50",
                          ].join(" ")}
                        >
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {label}
                          </div>
                          <div className="text-xs text-gray-600">{desc}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Location */}
            <section>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">
                Where’s your place located?
              </h3>
              <div className="rounded-3xl border border-white/20 bg-white/80 backdrop-blur-md p-4 sm:p-6 shadow-[0_12px_30px_rgba(30,58,138,0.10),0_30px_60px_rgba(30,58,138,0.08)] grid gap-4">
                <LocationPickerMapString
                  address={formData.location}
                  onAddressChange={(addr) => handleChange("location", addr)}
                />
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    Detected address (editable)
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleChange("location", e.target.value)}
                    placeholder="Click on the map to populate, or type an address"
                    className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
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
            </section>

            {/* Property Type + Unique Description */}
            <section className="space-y-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                Property type
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {PROPERTY_TYPES.map(({ value, label, desc, Icon }) => {
                  const active = formData.propertyType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleChange("propertyType", value)}
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
                      <div className="relative flex items-start gap-3">
                        <div
                          className={[
                            "grid place-items-center rounded-xl w-12 h-12",
                            active
                              ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
                              : "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700",
                            "shadow-lg shadow-blue-500/20 ring-4 ring-white/50",
                          ].join(" ")}
                        >
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {label}
                          </div>
                          <div className="text-xs text-gray-600">{desc}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl sm:rounded-3xl overflow-hidden bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-4 sm:p-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  What makes your place unique? <span className="text-gray-500">(optional)</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe any special features or highlights..."
                  value={formData.uniqueDescription}
                  onChange={(e) => handleChange("uniqueDescription", e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                />
              </div>
            </section>

            {/* Capacity */}
            <section className="space-y-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                Capacity & rooms
              </h3>
              <p className="text-xs text-gray-600">Total guests: <b className="text-gray-900">{totalGuests}</b></p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Adults */}
                <CounterCard
                  title="Adults"
                  subtitle="Ages 13+ (min 1)"
                  value={formData.guests?.adults ?? 1}
                  onDec={() => adjGuests("adults", -1)}
                  onInc={() => adjGuests("adults", 1)}
                  onInput={(v) => setGuests("adults", v)}
                />
                {/* Children */}
                <CounterCard
                  title="Children"
                  subtitle="Ages 2–12"
                  value={formData.guests?.children ?? 0}
                  onDec={() => adjGuests("children", -1)}
                  onInc={() => adjGuests("children", 1)}
                  onInput={(v) => setGuests("children", v)}
                />
                {/* Infants */}
                <CounterCard
                  title="Infants"
                  subtitle="Under 2"
                  value={formData.guests?.infants ?? 0}
                  onDec={() => adjGuests("infants", -1)}
                  onInc={() => adjGuests("infants", 1)}
                  onInput={(v) => setGuests("infants", v)}
                />
                {/* Bedrooms */}
                <RoomCounter
                  title="Bedrooms"
                  value={formData.bedrooms}
                  onDec={() => handleChange("bedrooms", Math.max(0, Number(formData.bedrooms) - 1))}
                  onInc={() => handleChange("bedrooms", Number(formData.bedrooms) + 1)}
                  onInput={(v) => handleChange("bedrooms", Math.max(0, Number(v || 0)))}
                />
                {/* Beds */}
                <RoomCounter
                  title="Beds"
                  value={formData.beds}
                  onDec={() => handleChange("beds", Math.max(0, Number(formData.beds) - 1))}
                  onInc={() => handleChange("beds", Number(formData.beds) + 1)}
                  onInput={(v) => handleChange("beds", Math.max(0, Number(v || 0)))}
                />
                {/* Bathrooms */}
                <RoomCounter
                  title="Bathrooms"
                  value={formData.bathrooms}
                  onDec={() => handleChange("bathrooms", Math.max(0, Number(formData.bathrooms) - 1))}
                  onInc={() => handleChange("bathrooms", Number(formData.bathrooms) + 1)}
                  onInput={(v) => handleChange("bathrooms", Math.max(0, Number(v || 0)))}
                />
              </div>
            </section>

            {/* Amenities */}
            <section className="space-y-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                Amenities
              </h3>

              {/* Selected */}
              <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-4 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)]">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Selected amenities</h4>
                {formData.amenities?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {formData.amenities.map((amenity, idx) => (
                      <span
                        key={`${amenity}-${idx}`}
                        className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-xs sm:text-sm font-medium shadow-sm"
                      >
                        {amenity}
                        <button
                          type="button"
                          onClick={() =>
                            handleChange(
                              "amenities",
                              formData.amenities.filter((_, i) => i !== idx)
                            )
                          }
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

              {/* Popular toggles */}
              <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-4 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)]">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Popular amenities</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {POPULAR_AMENITIES.map(({ label, Icon }) => {
                    const on = formData.amenities?.includes(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          const next = on
                            ? formData.amenities.filter((a) => a !== label)
                            : [...(formData.amenities || []), label];
                          handleChange("amenities", next);
                        }}
                        aria-pressed={on}
                        className={[
                          "group w-full rounded-2xl border p-4 text-left transition-all duration-200 flex items-center gap-3",
                          on
                            ? "border-blue-500 bg-blue-50/80 shadow-[0_8px_20px_rgba(30,58,138,0.10)]"
                            : "border-gray-200 bg-white/70 hover:bg-gray-50",
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
                        <span className="text-sm font-medium text-gray-900">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom amenity */}
              <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-4 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)]">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">
                  Add a custom amenity
                </h4>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newAmenity}
                    onChange={(e) => setNewAmenity(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const a = (newAmenity || "").trim();
                        if (a && !(formData.amenities || []).includes(a)) {
                          handleChange("amenities", [...(formData.amenities || []), a]);
                          setNewAmenity("");
                        }
                      }
                    }}
                    placeholder="e.g., Fireplace, EV charger, Crib"
                    className="flex-1 rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const a = (newAmenity || "").trim();
                      if (a && !(formData.amenities || []).includes(a)) {
                        handleChange("amenities", [...(formData.amenities || []), a]);
                        setNewAmenity("");
                      }
                    }}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition"
                  >
                    Add
                  </button>
                </div>
              </div>
            </section>

            {/* Photos */}
            <section className="space-y-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                Photos
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
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    const urls = await uploadImages(files);
                    if (urls.length) {
                      setFormData((prev) => ({ ...prev, photos: [...(prev.photos || []), ...urls] }));
                    }
                    // e.target.value = "";
                  }}
                />
              </div>

              {/* Grid */}
              <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900">Uploaded photos</h4>
                  <span className="text-xs text-gray-600">{formData.photos?.length || 0} total</span>
                </div>

                {formData.photos?.length ? (
                  <>
                    {/* Hero */}
                    <div className="relative w-full rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 h-[220px] sm:h-[300px] md:h-[380px]">
                      <img
                        src={formData.photos[currentPhotoIndex || 0]}
                        alt={`Photo ${(currentPhotoIndex || 0) + 1}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute top-3 right-3 rounded-full bg-black/55 text-white text-xs font-medium px-3 py-1">
                        {(currentPhotoIndex || 0) + 1} / {formData.photos.length}
                      </div>

                      {formData.photos.length > 1 && (
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
                            onClick={() => setCurrentPhotoIndex((p) => Math.min(formData.photos.length - 1, (p || 0) + 1))}
                            disabled={(currentPhotoIndex || 0) === formData.photos.length - 1}
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/85 hover:bg-white border border-white/60 shadow grid place-items-center disabled:opacity-50"
                          >
                            <ChevronRight className="w-5 h-5 text-gray-700" />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Thumbs */}
                    <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                      {formData.photos.map((url, idx) => {
                        const active = idx === (currentPhotoIndex || 0);
                        return (
                          <div
                            key={idx}
                            className={[
                              "relative aspect-[4/3] w-full overflow-hidden rounded-xl border bg-white shadow-sm",
                              active ? "border-blue-500 ring-2 ring-blue-400/60" : "border-gray-200",
                            ].join(" ")}
                          >
                            <button
                              type="button"
                              onClick={() => setCurrentPhotoIndex(idx)}
                              className="absolute inset-0"
                              aria-label={`Select photo ${idx + 1}`}
                            />
                            <img src={url} alt={`Thumb ${idx + 1}`} className="h-full w-full object-cover" loading="lazy" />
                            <button
                              type="button"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  photos: prev.photos.filter((_, i) => i !== idx),
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
                ) : (
                  <div className="flex items-center justify-center py-10 text-gray-500 text-sm">
                    No photos uploaded yet.
                  </div>
                )}
              </div>
            </section>

            {/* Title & Description */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-4 sm:p-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">Listing Title</label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                    <Heading1 className="w-4.5 h-4.5" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g., Cozy Beachfront Villa"
                    value={formData.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                    className="w-full rounded-2xl border border-gray-300 bg-white/90 pl-14 pr-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-gray-600">Keep it short and compelling (≈ 50–60 chars)</p>
                  <span className="text-xs font-medium text-gray-700">{(formData.title?.length || 0)}/60</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                    style={{ width: `${Math.min(100, ((formData.title?.length || 0) / 60) * 100)}%` }}
                  />
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
                  rows={7}
                  placeholder="Describe your place, amenities, and what makes it special..."
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500 resize-y"
                />
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-gray-600">Aim for clarity and helpful details (≈ 200–600 chars)</p>
                  <span className="text-xs font-medium text-gray-700">{(formData.description?.length || 0)}/1000</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                    style={{ width: `${Math.min(100, ((formData.description?.length || 0) / 1000) * 100)}%` }}
                  />
                </div>
              </div>
            </section>

            {/* Pricing */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                {/* Nightly price */}
                <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-4 sm:p-6 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)]">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Price per night</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                      <BadgeDollarSign className="w-5 h-5" />
                    </div>
                    <span className="absolute left-14 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₱</span>
                    <input
                      type="number"
                      min={0}
                      inputMode="decimal"
                      placeholder="e.g., 2500"
                      value={formData.price}
                      onChange={(e) => handleChange("price", e.target.value)}
                      className="w-full rounded-2xl border border-gray-300 bg-white/90 pl-20 pr-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-600 flex items-center gap-1">
                    <Info className="w-4 h-4" /> You can adjust this anytime after publishing.
                  </p>
                </div>

                {/* Cleaning fee */}
                <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-4 sm:p-6 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)]">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Cleaning fee <span className="text-gray-500">(optional)</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                      <Brush className="w-5 h-5" />
                    </div>
                    <span className="absolute left-14 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₱</span>
                    <input
                      type="number"
                      min={0}
                      inputMode="decimal"
                      placeholder="e.g., 500"
                      value={formData.cleaningFee}
                      onChange={(e) => handleChange("cleaningFee", e.target.value)}
                      className="w-full rounded-2xl border border-gray-300 bg-white/90 pl-20 pr-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-600">One-time fee added to each booking.</p>
                </div>

                {/* Discounts */}
                <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-4 sm:p-6 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] space-y-4">
                  <label className="block text-sm font-semibold text-gray-900">Discounts <span className="text-gray-500">(optional)</span></label>
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
                            "w-full rounded-2xl border px-3 py-2.5 sm:py-3 flex items-center justify-center gap-2 transition-all duration-200 text-sm font-semibold",
                            active
                              ? "border-blue-500 bg-blue-50/80 shadow-[0_8px_20px_rgba(30,58,138,0.10)] text-gray-900"
                              : "border-gray-200 bg-white/70 hover:bg-gray-50 text-gray-900",
                          ].join(" ")}
                        >
                          <Icon className="w-4 h-4" />
                          {label}
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
                            : "pl-4 border-gray-200 opacity-50 pointer-events-none",
                        ].join(" ")}
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-600">
                      Percentage applies to nightly price only; fixed amount is deducted per booking.
                    </p>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)] p-4 sm:p-6 md:p-8 h-fit">
                <div className="flex items-center gap-3">
                  <div className="grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                    <BadgeDollarSign className="w-5 h-5" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900">Price summary</h4>
                </div>

                <div className="mt-4 space-y-3 text-sm text-gray-800">
                  <Row label="Nightly price" value={`₱${priceSummary.price.toLocaleString()}`} />
                  {priceSummary.type === "percentage" && (
                    <Row
                      label={`Discount per night (${priceSummary.dVal || 0}%)`}
                      value={`− ₱${priceSummary.discountPerNight.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                    />
                  )}
                  <Row label="Nights" value={String(priceSummary.displayNights)} />
                  <Row label="Cleaning fee" value={`₱${priceSummary.clean.toLocaleString()}`} />
                  {priceSummary.type === "fixed" && priceSummary.dVal > 0 && (
                    <Row
                      label="Discount (fixed, per booking)"
                      value={`− ₱${priceSummary.fixedDiscount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                    />
                  )}
                  <div className="h-px bg-gray-200 my-1" />
                  <div className="flex items-center justify-between text-base">
                    <span className="font-semibold text-gray-900">Estimated total / booking</span>
                    <span className="font-bold text-blue-700">
                      ₱{priceSummary.bookingTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {(!priceSummary.hasDates || priceSummary.nightsSel <= 0) && (
                    <p className="text-xs text-gray-600 mt-2">
                      Preview assumes <b>1 night</b>. Select dates to see the exact total.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Availability */}
            <section className="space-y-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                Availability (date range)
              </h3>
              <div className="rounded-3xl border border-white/20 bg-white/80 backdrop-blur-md p-4 sm:p-6 shadow-[0_12px_30px_rgba(30,58,138,0.10),0_30px_60px_rgba(30,58,138,0.08)]">
                <div className="rounded-2xl border border-gray-300 bg-white/90 p-3 shadow-sm overflow-hidden">
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

                <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-sm text-gray-700">
                    {formData.availability.start && formData.availability.end && !invalidRange ? (
                      <>
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-blue-700 font-semibold text-xs shadow-sm">
                          {nightsBetween(formData.availability.start, formData.availability.end)}{" "}
                          {nightsBetween(formData.availability.start, formData.availability.end) === 1 ? "night" : "nights"}
                        </span>
                        <span className="ml-2 text-gray-700">
                          {formData.availability.start} → {formData.availability.end}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-600">Select a start and end date</span>
                    )}
                  </div>

                  {invalidRange && (
                    <p className="text-sm font-medium text-red-600">End date must be after the start date.</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleChange("availability", { start: "", end: "" })}
                      className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* 🛡️ Cancellation Policy (edit + preview) */}
            <section className="space-y-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                Cancellation Policy
              </h3>

              <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 p-4 sm:p-6 shadow-[0_8px_20px_rgba(30,58,138,0.08),_0_20px_40px_rgba(30,58,138,0.06)]">
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                    <ShieldCheck className="w-6 h-6" />
                  </span>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Your policy</h4>
                    <p className="text-sm text-gray-600">Be precise about time windows and refunds.</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-2">
                  <label className="text-sm font-semibold text-gray-900">Cancellation Policy</label>
                  <textarea
                    rows={6}
                    value={formData.cancellationPolicy}
                    onChange={(e) => handleChange("cancellationPolicy", e.target.value)}
                    placeholder="e.g., Full refund up to 48 hours before the start time. 50% refund for 24–48 hours. No refund within 24 hours."
                    className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                  />
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>Tip: Include a clear time cutoff and what refund applies.</span>
                    <span>{(formData.cancellationPolicy || "").length} chars</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                      style={{
                        width: `${Math.min(100, ((formData.cancellationPolicy?.length || 0) / 600) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Preview with read-more/less */}
                <div className="mt-6 rounded-2xl border border-gray-200 bg-white/70 p-4">
                  <span className="text-sm font-semibold text-gray-900">Preview</span>
                  {formData.cancellationPolicy ? (
                    <>
                      <p
                        className={[
                          "mt-1 text-sm text-gray-800 whitespace-pre-line transition-all",
                          showFullPolicy ? "" : "max-h-24 overflow-hidden",
                        ].join(" ")}
                      >
                        {formData.cancellationPolicy}
                      </p>
                      {formData.cancellationPolicy.length > 200 && (
                        <button
                          type="button"
                          onClick={() => setShowFullPolicy((v) => !v)}
                          className="mt-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          {showFullPolicy ? "Show less" : "Show more"}
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-gray-500">Add your policy above to preview it here.</p>
                  )}
                </div>

                {/* Example helper */}
                <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 flex items-start gap-3">
                  <span className="grid place-items-center w-9 h-9 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                    <Info className="w-5 h-5" />
                  </span>
                  <p className="text-sm text-blue-900">
                    <span className="font-medium">Example:</span> “Full refund up to 48 hours before the start time. 50% refund for cancellations 24–48 hours prior. No refund within 24 hours.”
                  </p>
                </div>
              </div>
            </section>
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
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-2.5 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 disabled:pointer-events-none"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Small UI subcomponents */

function CounterCard({ title, subtitle, value, onDec, onInc, onInput }) {
  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur-md border border-white/60 p-5 shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]">
      <div className="flex items-center gap-3">
        <div className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow" />
        <div>
          <h4 className="text-base font-semibold text-gray-900">{title}</h4>
          <p className="text-sm text-gray-600">{subtitle}</p>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={onDec}
          className="w-11 h-11 rounded-full border border-gray-300 bg-white hover:bg-gray-50 active:scale-95 transition"
          aria-label={`Decrease ${title}`}
        >
          −
        </button>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onInput(e.target.value)}
          className="w-20 text-center text-lg font-semibold text-gray-900 bg-transparent outline-none"
        />
        <button
          type="button"
          onClick={onInc}
          className="w-11 h-11 rounded-full border border-blue-500 text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow active:scale-95 transition"
          aria-label={`Increase ${title}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function RoomCounter({ title, value, onDec, onInc, onInput }) {
  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur-md border border-white/60 p-5 shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]">
      <div className="flex items-center gap-3">
        <div className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow" />
        <div>
          <h4 className="text-base font-semibold text-gray-900">{title}</h4>
          <p className="text-sm text-gray-600">Optional</p>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <button type="button" onClick={onDec} className="w-11 h-11 rounded-full border border-gray-300 bg-white hover:bg-gray-50 active:scale-95 transition">−</button>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onInput(e.target.value)}
          className="w-20 text-center text-lg font-semibold text-gray-900 bg-transparent outline-none"
        />
        <button type="button" onClick={onInc} className="w-11 h-11 rounded-full border border-blue-500 text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow active:scale-95 transition">+</button>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
