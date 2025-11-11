// EditServiceListing.jsx
import React, { useEffect, useRef, useState } from "react";
import { doc, getDoc, updateDoc, deleteField } from "firebase/firestore";
import { database } from "../../../config/firebase";
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
  Plus,
  Trash2,
  BadgeDollarSign,
  ShieldCheck,
  ShieldAlert,
  Type,
  FileText,
  Package,
  Percent,
} from "lucide-react";

// 👉 Cloudinary config
const CLOUD_NAME = "dijmlbysr";
const UPLOAD_PRESET = "listing-uploads";

const normalizeLocationType = (v) => (v || "").toLowerCase().trim();

// ✅ Discount normalizer (keeps schema tidy)
const normalizeDiscount = (type, value) => {
  const t = type || "";
  const v = Number(value || 0);
  if (t === "percentage") {
    const pct = Math.round(v);
    if (pct >= 1 && pct <= 100) return { discountType: "percentage", discountValue: pct };
    return { discountType: "", discountValue: 0 };
  }
  if (t === "fixed") {
    const amt = Math.max(0, v);
    if (Number.isFinite(amt)) return { discountType: "fixed", discountValue: amt };
    return { discountType: "", discountValue: 0 };
  }
  return { discountType: "", discountValue: 0 };
};

function ServiceEditModalBase({
  open,
  onClose,
  listingId,
  refreshList,
  listingData,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [service, setService] = useState(null);
  const fileInputRef = useRef(null);

  const serviceTypes = ["Tutoring", "Wellness", "Photography", "Consulting", "Repair", "Other"];
  const pricingTypes = ["per session", "per hour", "per package"];

  // ---------- Fetch / hydrate ----------
  useEffect(() => {
    if (!open) return;

    const id = listingData?.id || listingId;
    if (!id && !listingData) return;

    (async () => {
      try {
        setLoading(true);

        let data = listingData || null;
        if (!data) {
          const ref = doc(database, "listings", id);
          const snap = await getDoc(ref);
          if (snap.exists()) data = { id: snap.id, ...snap.data() };
        }

        if (data) {
          const age = data.ageRestriction || { min: 0, max: 100 };
          const langs = Array.isArray(data.languages) ? data.languages : [];
          const photos = Array.isArray(data.photos) ? data.photos : [];
          const schedule = Array.isArray(data.schedule) ? data.schedule : [];
          const price = data.price === null || data.price === undefined ? "" : String(data.price);

          setService({
            serviceType: "",
            title: "",
            description: "",
            includes: "",
            targetAudience: "",
            schedule: [],
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
            duration: "",
            recurrence: "",
            // NEW: discount fields (default + hydrated)
            discountType: "",
            discountValue: 0,
            ...data,
            price,
            ageRestriction: { min: Number(age.min ?? 0), max: Number(age.max ?? 100) },
            languages: langs,
            photos,
            schedule: schedule.map((s) => ({ date: s?.date || "", time: s?.time || "" })),
            locationType: normalizeLocationType(data.locationType),
            discountType: (data.discountType || ""),
            discountValue: Number(data.discountValue || 0),
          });
        }
      } catch (e) {
        console.error(e);
        alert("Failed to load listing");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, listingId, listingData]);

  const setField = (key, value) => setService((p) => ({ ...p, [key]: value }));

  // ✅ Dedicated setter that clears address immediately when selecting "online"
  const setLocationType = (keyRaw) => {
    const key = normalizeLocationType(keyRaw);
    setService((p) => {
      if (!p) return p;
      const next = { ...p, locationType: key };
      if (key === "online") next.address = "";
      return next;
    });
  };

  const addLanguage = (txt) => {
    const val = (txt || "").trim();
    if (!val) return;
    setService((p) => ({ ...p, languages: Array.from(new Set([...(p.languages || []), val])) }));
  };

  const addSchedule = (date, time) => {
    if (!date || !time) return;
    setService((p) => {
      const exists = (p.schedule || []).some((s) => s.date === date && s.time === time);
      if (exists) return p;
      return { ...p, schedule: [...(p.schedule || []), { date, time }] };
    });
  };

  // ✅ Re-clear address on any rehydration/state change to "online"
  useEffect(() => {
    if (!service) return;
    if (normalizeLocationType(service.locationType) === "online" && service.address) {
      setService((p) => ({ ...p, address: "" }));
    }
  }, [service?.locationType]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Save ----------
  const handleSave = async () => {
    const id = service?.id || listingId || listingData?.id;
    if (!id || !service) return;

    const min = Number(service.ageRestriction?.min ?? 0);
    const max = Number(service.ageRestriction?.max ?? 100);
    if (min > max) {
      alert("Min age cannot be greater than max age.");
      return;
    }

    setSaving(true);
    try {
      // split photos
      const existing = (service.photos || []).filter((p) => typeof p === "string");
      const toUpload = (service.photos || []).filter((p) => p instanceof File);

      // upload new ones
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

      const lt = normalizeLocationType(service.locationType);

      // Do not send local 'id' back into the doc
      const { id: _ignoreId, ...rest } = service;

      // Merge normalized discount
      const nd = normalizeDiscount(service.discountType, service.discountValue);

      // Base payload (without address/location; we add them after)
      const basePayload = {
        ...rest,
        ...nd,
        maxParticipants: Number(service.maxParticipants || 1),
        price: service.price === "" ? null : Number(service.price || 0),
        ageRestriction: { min, max },
        photos: [...existing, ...uploadedUrls],
        languages: (service.languages || []).map(String),
        schedule: (service.schedule || []).map((s) => ({ date: s.date || "", time: s.time || "" })),
        updatedAt: new Date(),
      };

      // ✅ Hard-delete address (and optional 'location') when online
      if (lt === "online") {
        basePayload.address = deleteField();
        // If your doc sometimes uses a plain `location` string, remove that too:
        basePayload.location = deleteField();
      } else {
        basePayload.address = service.address || "";
      }

      const ref = doc(database, "listings", id);
      await updateDoc(ref, basePayload);

      if (typeof refreshList === "function") refreshList();
      alert("Service updated successfully!");
      if (typeof onClose === "function") onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to save changes. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const minAge = Number(service?.ageRestriction?.min ?? 0);
  const maxAge = Number(service?.ageRestriction?.max ?? 100);
  const invalidAge = minAge > maxAge || minAge < 0 || maxAge < 0;

  // ---------- Discount derived values for UI ----------
  const dType = service?.discountType || "";
  const dVal = Number(service?.discountValue || 0);
  const isPct = dType === "percentage";
  const isFixed = dType === "fixed";
  const discountInvalid = isPct ? !(dVal >= 1 && dVal <= 100) : isFixed ? dVal < 0 : false;

  const basePriceNum = Number(service?.price || 0) || 0;
  const afterPct = isPct ? Math.max(0, basePriceNum * (1 - dVal / 100)) : basePriceNum;
  const afterFixed = isFixed ? Math.max(0, basePriceNum - dVal) : basePriceNum;
  const previewPrice = isPct ? afterPct : isFixed ? afterFixed : basePriceNum;

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
        aria-labelledby="edit-service-title"
      >
        <div className="w-full max-w-6xl max-h-[92vh] rounded-3xl border border-white/60 bg-gradient-to-br from-blue-50 via-white to-indigo-50 shadow-[0_12px_30px_rgba(30,58,138,0.12),_0_40px_80px_rgba(30,58,138,0.12)] overflow-hidden flex flex-col">
          {/* Header (sticky) */}
          <div className="sticky top-0 z-10 bg-white/70 backdrop-blur-md border-b border-white/60 px-5 sm:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                <ShieldCheck className="w-4.5 h-4.5" />
              </span>
              <h2 id="edit-service-title" className="text-lg sm:text-xl font-semibold text-gray-900">
                Edit Service
              </h2>
              {loading && <span className="ml-2 text-xs text-gray-500">Loading…</span>}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/90 hover:bg-white border border-gray-200 shadow"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
          </div>

          {/* Body (scrollable) */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5">
            {!service ? (
              <div className="grid place-items-center h-64 text-gray-600">Fetching data…</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* LEFT (span 2) */}
                <div className="lg:col-span-2 grid gap-4 sm:gap-6">
                  {/* Service Type */}
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Service Type
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {serviceTypes.map((t) => {
                        const on = (service.serviceType || "") === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setField("serviceType", t)}
                            className={`w-full rounded-2xl border px-4 py-3 text-left ${
                              on
                                ? "border-blue-500 bg-blue-50/80 text-blue-800 shadow"
                                : "border-gray-200 bg-white/70 hover:bg-gray-50 text-gray-800"
                            }`}
                          >
                            <div className="font-semibold text-sm">{t}</div>
                            <div className="text-xs text-gray-600">
                              {t === "Other" ? "Custom / mixed" : "Tap to select"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* Title */}
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5">
                    <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Type className="w-4.5 h-4.5" /> Title
                    </label>
                    <input
                      className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                      value={service.title || ""}
                      onChange={(e) => setField("title", e.target.value)}
                      placeholder="e.g., 1-on-1 Guitar Coaching"
                    />
                  </section>

                  {/* Description */}
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5">
                    <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <FileText className="w-4.5 h-4.5" /> Description
                    </label>
                    <textarea
                      rows={5}
                      className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                      value={service.description || ""}
                      onChange={(e) => setField("description", e.target.value)}
                      placeholder="What will clients get? What makes this unique?"
                    />
                  </section>

                  {/* Includes + Audience */}
                  <section className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5">
                      <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <Package className="w-4.5 h-4.5" /> What’s included
                      </label>
                      <textarea
                        rows={4}
                        className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3"
                        value={service.includes || ""}
                        onChange={(e) => setField("includes", e.target.value)}
                        placeholder="• Lesson materials (PDF) • Practice plan & chord charts • Video recap"
                      />
                    </div>
                    <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5">
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Target audience</label>
                      <input
                        className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3"
                        value={service.targetAudience || ""}
                        onChange={(e) => setField("targetAudience", e.target.value)}
                        placeholder="e.g., Beginners, returnees, kids 12+"
                      />
                    </div>
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
                          setService((p) => ({ ...p, photos: [...(p.photos || []), ...files] }));
                          e.target.value = "";
                        }}
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                      {(service.photos || []).map((ph, i) => (
                        <div key={i} className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 aspect-[4/3]">
                          <img
                            src={typeof ph === "string" ? ph : URL.createObjectURL(ph)}
                            alt={`Photo ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setService((p) => ({
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

                  {/* Schedule */}
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <CalendarClock className="w-5 h-5" /> Schedule
                    </h3>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(service.schedule || []).map((s, i) => (
                        <div key={`${s.date}-${s.time}-${i}`} className="relative rounded-2xl border border-gray-200 p-4 bg-white/70">
                          <div className="text-sm text-gray-500">Date</div>
                          <div className="font-semibold text-gray-900">{s.date || "—"}</div>
                          <div className="mt-1 inline-flex items-center gap-2 px-2 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-semibold">
                            <Clock3 className="w-3.5 h-3.5" /> {s.time || "—"}
                          </div>
                          <button
                            type="button"
                            className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/90 border border-gray-200 shadow"
                            onClick={() =>
                              setService((p) => ({
                                ...p,
                                schedule: p.schedule.filter((_, idx) => idx !== i),
                              }))
                            }
                            aria-label="Remove slot"
                          >
                            <Trash2 className="w-4.5 h-4.5 text-gray-700" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="date"
                        className="rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                        id="svc-date"
                      />
                      <input
                        type="time"
                        className="rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                        id="svc-time"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const d = document.getElementById("svc-date");
                          const t = document.getElementById("svc-time");
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
                  {/* Duration & Recurrence */}
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5 grid gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Duration</label>
                      <input
                        className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                        value={service.duration || ""}
                        onChange={(e) => setField("duration", e.target.value)}
                        placeholder="e.g., 1 hour"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Recurrence</label>
                      <input
                        className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3"
                        value={service.recurrence || ""}
                        onChange={(e) => setField("recurrence", e.target.value)}
                        placeholder="e.g., one-time, weekly, monthly"
                      />
                    </div>
                  </section>

                  {/* Location type & Address */}
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5">
                    <label className="block text-sm font-semibold text-gray-900">Location Type</label>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {[
                        { key: "in-person", label: "In-person" },
                        { key: "online", label: "Online" },
                      ].map(({ key, label }) => {
                        const on = normalizeLocationType(service.locationType) === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setLocationType(key)}
                            className={`w-full rounded-2xl border px-4 py-3 text-left ${
                              on
                                ? "border-blue-500 bg-blue-50/80 text-blue-800 shadow"
                                : "border-gray-200 bg-white/70 hover:bg-gray-50"
                            }`}
                          >
                            <div className="font-semibold text-sm text-gray-900">{label}</div>
                            <div className="text-xs text-gray-600">
                              {key === "online" ? "Live via video call" : "On location"}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {normalizeLocationType(service.locationType) === "in-person" && (
                      <div className="mt-4">
                        <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          <MapPin className="w-4.5 h-4.5" /> Service Address
                        </label>
                        <input
                          className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                          value={service.address || ""}
                          onChange={(e) => setField("address", e.target.value)}
                          placeholder="Enter address"
                        />
                      </div>
                    )}
                  </section>

                  {/* Pricing & Discount */}
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5 grid gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <BadgeDollarSign className="w-4.5 h-4.5" /> Price
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                          ₱
                        </span>
                        <input
                          type="number"
                          min={0}
                          className="w-full rounded-2xl border border-gray-300 bg-white/90 pl-8 pr-4 py-3"
                          value={service.price}
                          onChange={(e) => setField("price", e.target.value)}
                          placeholder="e.g., 1200"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Pricing Type
                      </label>
                      <select
                        className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3"
                        value={service.pricingType || ""}
                        onChange={(e) => setField("pricingType", e.target.value)}
                      >
                        <option value="">Select pricing type</option>
                        {pricingTypes.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* NEW: Discount editor */}
                    <div className="grid gap-2">
                      <label className="block text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                        <Percent className="w-4.5 h-4.5" /> Discount (optional)
                      </label>

                      {/* Type segmented */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { key: "", label: "None" },
                          { key: "percentage", label: "Percentage (%)" },
                          { key: "fixed", label: "Fixed (₱)" },
                        ].map(({ key, label }) => {
                          const on = (service.discountType || "") === key;
                          return (
                            <button
                              key={label}
                              type="button"
                              onClick={() => setField("discountType", key)}
                              className={`w-full rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                                on
                                  ? "border-blue-500 bg-blue-50/80 text-blue-800 shadow"
                                  : "border-gray-200 bg-white/70 hover:bg-gray-50 text-gray-800"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>

                      {(isPct || isFixed) && (
                        <div className="grid gap-1.5">
                          <div className="relative">
                            {isPct ? (
                              <>
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">%</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  className="pl-10 pr-4 py-3 w-full rounded-2xl border border-gray-300 bg-white/90 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                                  placeholder="e.g., 10"
                                  value={service.discountValue}
                                  onChange={(e) => setField("discountValue", Number(e.target.value || 0))}
                                />
                              </>
                            ) : (
                              <>
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₱</span>
                                <input
                                  type="number"
                                  min={0}
                                  className="pl-10 pr-4 py-3 w-full rounded-2xl border border-gray-300 bg-white/90 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                                  placeholder="e.g., 200"
                                  value={service.discountValue}
                                  onChange={(e) => setField("discountValue", Number(e.target.value || 0))}
                                />
                              </>
                            )}
                          </div>

                          {discountInvalid && (
                            <p className="text-xs font-medium text-red-600">
                              {isPct ? "Percentage must be between 1 and 100." : "Fixed amount cannot be negative."}
                            </p>
                          )}

                          {/* Quick chips for % */}
                          {isPct && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {[5, 10, 15, 20, 25, 30].map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => setField("discountValue", n)}
                                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
                                >
                                  {n}%
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Preview */}
                          <div className="mt-2 text-xs text-gray-700">
                            {isPct && (
                              <p>
                                Preview (per unit): ₱{basePriceNum.toLocaleString()} → <b>₱{afterPct.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b> after {dVal}% off.
                              </p>
                            )}
                            {isFixed && (
                              <p>
                                Preview (per unit): ₱{basePriceNum.toLocaleString()} − ₱{dVal.toLocaleString()} = <b>₱{afterFixed.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>.
                              </p>
                            )}
                            {!isPct && !isFixed && <p>No discount will be applied.</p>}
                          </div>
                        </div>
                      )}

                      {/* Current preview card */}
                      {Boolean(previewPrice) && (
                        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3 text-xs">
                          <p className="text-blue-900">
                            Current preview price per unit: <b>₱{previewPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>
                          </p>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Participants & Age */}
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5 grid gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <Users className="w-4.5 h-4.5" /> Max participants
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setField(
                              "maxParticipants",
                              Math.max(1, Number(service.maxParticipants || 1) - 1)
                            )
                          }
                          className="w-10 h-10 rounded-full border border-gray-300 bg-white hover:bg-gray-50"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={service.maxParticipants || 1}
                          onChange={(e) =>
                            setField("maxParticipants", Math.max(1, Number(e.target.value || 1)))
                          }
                          className="w-24 text-center rounded-xl border border-gray-300 bg-white/90 px-3 py-2"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setField(
                              "maxParticipants",
                              Math.max(1, Number(service.maxParticipants || 1) + 1)
                            )
                          }
                          className="w-10 h-10 rounded-full border border-blue-500 text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Age restriction
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min={0}
                          className="rounded-2xl border border-gray-300 bg-white/90 px-4 py-3"
                          value={minAge}
                          onChange={(e) =>
                            setField("ageRestriction", {
                              ...service.ageRestriction,
                              min: Math.max(0, Number(e.target.value || 0)),
                            })
                          }
                          placeholder="Min age"
                        />
                        <input
                          type="number"
                          min={0}
                          className="rounded-2xl border border-gray-300 bg-white/90 px-4 py-3"
                          value={maxAge}
                          onChange={(e) =>
                            setField("ageRestriction", {
                              ...service.ageRestriction,
                              max: Math.max(0, Number(e.target.value || 0)),
                            })
                          }
                          placeholder="Max age"
                        />
                      </div>
                      {invalidAge && (
                        <p className="mt-2 text-sm font-medium text-red-600">
                          Max age must be ≥ Min age.
                        </p>
                      )}
                    </div>
                  </section>

                  {/* Qualifications & Client Requirements */}
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5 grid gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <ShieldCheck className="w-4.5 h-4.5" /> Qualifications
                      </label>
                      <textarea
                        rows={3}
                        className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3"
                        value={service.qualifications || ""}
                        onChange={(e) => setField("qualifications", e.target.value)}
                        placeholder="e.g., 5+ years teaching, certified coach"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <ShieldAlert className="w-4.5 h-4.5" /> Client Requirements
                      </label>
                      <textarea
                        rows={3}
                        className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3"
                        value={service.clientRequirements || ""}
                        onChange={(e) => setField("clientRequirements", e.target.value)}
                        placeholder="e.g., Bring your own guitar; Short nails; Practice 15–20 mins/day"
                      />
                    </div>
                  </section>

                  {/* Languages */}
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5">
                    <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Languages className="w-4.5 h-4.5" /> Languages
                    </label>
                    {service.languages?.length ? (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {service.languages.map((lang, i) => (
                          <span
                            key={lang + i}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-sm shadow-sm"
                          >
                            {lang}
                            <button
                              type="button"
                              className="rounded-full p-1 hover:bg-blue-100"
                              onClick={() =>
                                setService((p) => ({
                                  ...p,
                                  languages: p.languages.filter((_, idx) => idx !== i),
                                }))
                              }
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

                  {/* Cancellation Policy */}
                  <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow p-5">
                    <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <ShieldAlert className="w-4.5 h-4.5" /> Cancellation Policy
                    </label>
                    <textarea
                      rows={4}
                      className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3"
                      value={service.cancellationPolicy || ""}
                      onChange={(e) => setField("cancellationPolicy", e.target.value)}
                      placeholder="Full refund up to 48 hours before start. 50% refund within 24–48 hours. No refund within 24 hours."
                    />
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
                disabled={saving || invalidAge || discountInvalid}
                onClick={handleSave}
                className={`inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-md ${
                  saving || invalidAge || discountInvalid
                    ? "opacity-60 cursor-not-allowed bg-blue-500"
                    : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                }`}
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Saving…" : discountInvalid ? "Fix discount" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ServiceEditModalBase;
export const EditServiceModal = ServiceEditModalBase;
