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
} from "lucide-react";

// 👉 Configure your Cloudinary details
const CLOUD_NAME = "dijmlbysr"; // update if needed
const UPLOAD_PRESET = "listing-uploads"; // unsigned preset

/**
 * ExperienceEditModal (Tailwind + Headless UI style)
 * - Matches the glassy editing modal style used elsewhere
 * - Scrollable body with sticky header/footer
 * - Uploads new photos to Cloudinary, preserves existing URLs
 */
export default function ExperienceEditModal({ open, onClose, listingId, refreshList }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [experience, setExperience] = useState(null);
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
          // NEW: normalize discount fields
          const discountType = data.discountType || ""; // "percentage" | "fixed" | ""
          const discountValue = Number(data.discountValue || 0);
          setExperience({
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
            discountType: "",
            discountValue: 0,
            ...data,
            ageRestriction: { min: Number(age.min ?? 0), max: Number(age.max ?? 100) },
            languages: langs,
            photos,
            schedule: schedule.map((s) => ({ date: s.date || "", time: s.time || "" })),
            discountType,
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

  // ---------- Save ----------
  const handleSave = async () => {
    if (!listingId || !experience) return;
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

      // Build payload
      const payload = {
        ...experience,
        maxParticipants: Number(experience.maxParticipants || 1),
        price: Number(experience.price || 0),
        ageRestriction: {
          min: Number(experience.ageRestriction?.min || 0),
          max: Number(experience.ageRestriction?.max || 0),
        },
        photos: [...existing, ...uploadedUrls],
        languages: (experience.languages || []).map((l) => String(l)),
        schedule: (experience.schedule || []).map((s) => ({ date: s.date || "", time: s.time || "" })),
        // NEW: persist discount fields cleanly
        discountType: (experience.discountType === "percentage" || experience.discountType === "fixed") ? experience.discountType : "",
        discountValue: Number(experience.discountValue || 0),
      };

      // If discount is invalid/empty, reset both fields
      const hasDiscount = (payload.discountType && payload.discountValue > 0);
      if (!hasDiscount) {
        payload.discountType = "";
        payload.discountValue = 0;
      }

      // Persist
      const ref = doc(database, "listings", listingId);
      await updateDoc(ref, payload);

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
  const discountType = experience?.discountType || ""; // '', 'percentage', 'fixed'
  const discountValue = Number(experience?.discountValue || 0);
  const price = Number(experience?.price || 0);
  const pctInvalid = discountType === "percentage" && (discountValue <= 0 || discountValue > 100);
  const fixedInvalid = discountType === "fixed" && discountValue < 0;

  // ---------- Render ----------
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Card */}
      <div
        className="absolute inset-0 grid place-items-center p-4 sm:p-6"
        aria-modal="true"
        role="dialog"
        aria-labelledby="edit-exp-title"
      >
        <div
          className="w-full max-w-6xl max-h-[92vh] rounded-3xl border border-white/60 bg-gradient-to-br from-blue-50 via-white to-indigo-50 shadow-[0_12px_30px_rgba(30,58,138,0.12),_0_40px_80px_rgba(30,58,138,0.12)] overflow-hidden flex flex-col"
        >
          {/* Header (sticky) */}
          <div className="sticky top-0 z-10 bg-white/70 backdrop-blur-md border-b border-white/60 px-5 sm:px-6 py-4 flex items-center justify-between">
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
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
          </div>

          {/* Body (scroll) */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5">
            {!experience ? (
              <div className="grid place-items-center h-64 text-gray-600">Fetching data…</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* LEFT (span 2) */}
                <div className="lg:col-span-2 grid gap-4 sm:gap-6">
                  {/* Title */}
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Title</label>
                    <input
                      className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                      value={experience.title || ""}
                      onChange={(e) => setField("title", e.target.value)}
                      placeholder="e.g., Sunrise Hike & Coffee"
                    />
                  </section>

                  {/* Description */}
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Description</label>
                    <textarea
                      rows={5}
                      className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                      value={experience.description || ""}
                      onChange={(e) => setField("description", e.target.value)}
                      placeholder="What will guests do? What’s unique?"
                    />
                  </section>

                  {/* Photos */}
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <ImageIcon className="w-5 h-5" /> Photos
                      </h3>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700"
                      >
                        <UploadCloud className="w-4 h-4" /> Upload
                      </button>
                      <input
                        ref={fileInputRef}
                        hidden
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length) return;
                          setExperience((p) => ({ ...p, photos: [...(p.photos || []), ...files] }));
                          e.target.value = "";
                        }}
                      />
                    </div>

                    {/* Preview grid */}
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                      {(experience.photos || []).map((ph, i) => (
                        <div key={i} className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 aspect-[4/3]">
                          <img
                            src={typeof ph === "string" ? ph : URL.createObjectURL(ph)}
                            alt={`Photo ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setExperience((p) => ({
                                ...p,
                                photos: (p.photos || []).filter((_, idx) => idx !== i),
                              }))
                            }
                            className="absolute top-2 right-2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/90 hover:bg-white border border-gray-200 shadow"
                            aria-label="Remove photo"
                          >
                            <X className="w-4.5 h-4.5 text-gray-700" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Amenities */}
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Tag className="w-5 h-5" /> Amenities
                    </h3>
                    {experience.amenities?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {experience.amenities.map((a, i) => (
                          <span key={i} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-sm shadow-sm">
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
                      <p className="mt-2 text-sm text-gray-600">No amenities yet.</p>
                    )}

                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="e.g., Snacks, Drinks, Equipment provided"
                        className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
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
                        className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700"
                        onClick={(e) => {
                          const inp = (e.currentTarget.previousSibling);
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
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <CalendarClock className="w-5 h-5" /> Schedule
                    </h3>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(experience.schedule || []).map((s, i) => (
                        <div key={`${s.date}-${s.time}-${i}`} className="relative rounded-2xl border border-gray-200 p-4 bg-white/70">
                          <div className="text-sm text-gray-500">Date</div>
                          <div className="font-semibold text-gray-900">{s.date || "—"}</div>
                          <div className="mt-1 inline-flex items-center gap-2 px-2 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-semibold">
                            <Clock3 className="w-3.5 h-3.5" /> {s.time || "—"}
                          </div>
                          <button
                            type="button"
                            className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/90 border border-gray-200 shadow"
                            onClick={() => setExperience((p) => ({ ...p, schedule: p.schedule.filter((_, idx) => idx !== i) }))}
                            aria-label="Remove schedule"
                          >
                            <Trash2 className="w-4.5 h-4.5 text-gray-700" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add new slot */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                        className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700"
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add slot
                      </button>
                    </div>
                  </section>
                </div>

                {/* RIGHT column */}
                <div className="grid gap-4 sm:gap-6">
                  {/* Location (hidden for online experiences) */}
                  {!isOnline && (
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5">
                    <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <MapPin className="w-4.5 h-4.5" /> Address / Location
                    </label>

                    {/* Map picker (Leaflet) */}
                    <div className="rounded-2xl overflow-hidden border border-gray-200">
                      <div className="h-56 sm:h-64">
                        <LocationPickerMapString
                          address={experience.location}
                          onAddressChange={(addr) => setField("location", addr || "")}
                        />
                      </div>
                    </div>

                    {/* Editable address field */}
                    <div className="mt-3 relative">
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
                    <div className="mt-2 flex flex-wrap gap-2">
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
                              // fallback: at least write the lat/lon as a string
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

                  {/* Duration + Participants */}
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5 grid gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Duration</label>
                      <input
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
                          className="w-10 h-10 rounded-full border border-gray-300 bg-white hover:bg-gray-50"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={experience.maxParticipants || 1}
                          onChange={(e) => setField("maxParticipants", Math.max(1, Number(e.target.value || 1)))}
                          className="w-24 text-center rounded-xl border border-gray-300 bg-white/90 px-3 py-2"
                        />
                        <button
                          type="button"
                          onClick={() => setField("maxParticipants", Math.max(1, Number(experience.maxParticipants || 1) + 1))}
                          className="w-10 h-10 rounded-full border border-blue-500 text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* Experience type */}
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5">
                    <label className="block text-sm font-semibold text-gray-900">Experience type</label>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {[{ key: "in-person", label: "In-person" }, { key: "online", label: "Online" }].map(({ key, label }) => {
                        const on = (experience.experienceType || "") === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              setExperience(p => ({
                                ...p,
                                experienceType: key,
                                ...(key === "online" ? { location: "" } : {})
                              }))
                            }
                            className={`w-full rounded-2xl border px-4 py-3 text-left ${on ? "border-blue-500 bg-blue-50/80 shadow" : "border-gray-200 bg-white/70 hover:bg-gray-50"}`}
                          >
                            <div className="font-semibold text-sm text-gray-900">{label}</div>
                            <div className="text-xs text-gray-600">{key === "online" ? "Live via video call" : "On location"}</div>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* Languages */}
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5">
                    <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Languages className="w-4.5 h-4.5" /> Languages
                    </label>
                    {experience.languages?.length ? (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {experience.languages.map((lang, i) => (
                          <span key={lang + i} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-sm shadow-sm">
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
                      <p className="text-sm text-gray-600 mb-2">No languages yet.</p>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g., English, Tagalog"
                        className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
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
                        className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700"
                        onClick={(e) => {
                          const inp = (e.currentTarget.previousSibling);
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
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Age restriction</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min={0}
                        className="rounded-2xl border border-gray-300 bg-white/90 px-4 py-3"
                        value={minAge}
                        onChange={(e) => setField("ageRestriction", { ...experience.ageRestriction, min: Math.max(0, Number(e.target.value || 0)) })}
                        placeholder="Min age"
                      />
                      <input
                        type="number"
                        min={0}
                        className="rounded-2xl border border-gray-300 bg-white/90 px-4 py-3"
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
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5">
                    <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <BadgeDollarSign className="w-4.5 h-4.5" /> Price per participant (₱)
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3"
                      value={Number(experience.price || 0)}
                      onChange={(e) => setField("price", Number(e.target.value || 0))}
                      placeholder="e.g., 1200"
                    />
                  </section>

                  {/* NEW: Discount editor */}
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5">
                    <label className="block text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <BadgePercent className="w-4.5 h-4.5" /> Discount (optional)
                    </label>

                    {/* Type selector */}
                    <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Discount type">
                      {[
                        { key: "", label: "None" },
                        { key: "percentage", label: "Percentage (%)" },
                        { key: "fixed", label: "Fixed (₱)" },
                      ].map(({ key, label }) => {
                        const on = (discountType || "") === key;
                        return (
                          <button
                            key={key || "none"}
                            type="button"
                            role="tab"
                            aria-selected={on}
                            onClick={() => setField("discountType", key)}
                            className={`w-full rounded-2xl border px-4 py-2 text-sm font-semibold ${on ? "border-blue-500 bg-blue-50/80 shadow" : "border-gray-200 bg-white/70 hover:bg-gray-50"}`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Value input */}
                    {discountType !== "" && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">{discountType === "percentage" ? "Percent off" : "Amount off (₱)"}</label>
                          <input
                            type="number"
                            min={discountType === "percentage" ? 1 : 0}
                            max={discountType === "percentage" ? 100 : undefined}
                            step={discountType === "percentage" ? 1 : 1}
                            className={`w-full rounded-2xl border px-4 py-3 bg-white/90 ${pctInvalid || fixedInvalid ? "border-red-400" : "border-gray-300"}`}
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

                        {/* Tiny preview/help */}
                        <div className="text-xs text-gray-700 bg-white/70 border border-gray-200 rounded-2xl p-3">
                          {discountType === "percentage" ? (
                            <>
                              <p className="font-semibold">How it applies</p>
                              <p>Percentage discounts apply <span className="font-medium">per participant</span>.</p>
                              <p className="mt-1">Price per person: ₱{price.toLocaleString()} → ₱{Math.max(0, Math.round(price * (1 - (discountValue || 0) / 100))).toLocaleString()}</p>
                            </>
                          ) : (
                            <>
                              <p className="font-semibold">How it applies</p>
                              <p>Fixed discounts apply <span className="font-medium">once per booking</span>, not per person.</p>
                              <p className="mt-1">Example: 2 people subtotal = ₱{(price * 2).toLocaleString()} − ₱{Number(discountValue || 0).toLocaleString()} = ₱{Math.max(0, price * 2 - Number(discountValue || 0)).toLocaleString()}</p>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Requirements & Cancellation */}
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5 grid gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <ShieldCheck className="w-4.5 h-4.5" /> Host Requirements
                      </label>
                      <textarea
                        rows={4}
                        className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3"
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
                        className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3"
                        value={experience.cancellationPolicy || ""}
                        onChange={(e) => setField("cancellationPolicy", e.target.value)}
                        placeholder="e.g., Full refund up to 48 hours before start, 50% within 24–48h, none within 24h."
                      />
                    </div>
                  </section>
                </div>
              </div>
            )}
          </div>

          {/* Footer (sticky) */}
          <div className="sticky bottom-0 z-10 bg-white/80 backdrop-blur-md border-t border-white/60 px-5 sm:px-6 py-4 flex items-center justify-end">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || invalidAge || pctInvalid || fixedInvalid}
                onClick={handleSave}
                className={`inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-md ${saving || invalidAge || pctInvalid || fixedInvalid ? "opacity-60 cursor-not-allowed bg-blue-500" : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"}`}
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
