// components/ExperienceDetailsModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { PayPalButtons } from "@paypal/react-paypal-js";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { auth, database } from "../config/firebase";
import emailjs from "@emailjs/browser";

// NEW: host-messaging modal
import { MessageHostModal } from "./message-host-modal";

// Icons
import {
  X as CloseIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Clock,
  Users,
  Languages,
  MapPin,
  Tag,
  MessageSquareText, // NEW
} from "lucide-react";

/* ================= EmailJS config & helper (matches your template) ================= */
// You can swap these to env vars if you prefer (REACT_APP_EMAILJS_*). They're public on the client either way.
const EMAILJS_SERVICE_ID = "service_x9dtjt6";
const EMAILJS_TEMPLATE_ID = "template_vrfey3u";
const EMAILJS_PUBLIC_KEY = "hHgssQum5iOFlnJRD";

// Initialize once (optional when passing publicKey to send; harmless if called repeatedly)
emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

async function sendBookingEmail({
  user,                // { displayName, email }
  title,               // listing/experience title
  category,            // string -> {{listing_category}}
  location,            // string -> {{listing_address}}
  total,               // number -> {{total_price}}
  paymentStatus = "Paid",     // string -> {{payment_status}}
  currencySymbol = "₱",       // string -> {{currency_symbol}}
  brandSiteUrl,               // string -> {{brand_site_url}}
}) {
  const params = {
    to_name: user?.displayName || (user?.email || "").split("@")[0] || "Guest",
    to_email: String(user?.email || ""),
    listing_title: String(title || "Untitled"),
    listing_category: String(category || "—"),
    listing_address: String(location || "Online"),
    payment_status: String(paymentStatus || "Paid"),
    currency_symbol: String(currencySymbol || "₱"),
    total_price: Number(total || 0).toFixed(2),
    brand_site_url: String(brandSiteUrl || (typeof window !== "undefined" ? window.location.origin : "")),
  };

  // Helpful during dev to confirm all fields are present
  console.log("[EmailJS] sending with params:", params);

  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params, EMAILJS_PUBLIC_KEY);
}

/* ================================= helpers ================================= */
const numberOr = (v, d = 0) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : d;
};

const SERVICE_FEE_RATE = 0.20; // 20%

const fmtDate = (isoDate) => {
  if (!isoDate) return "—";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};
const fmtTime = (t) => {
  const hhmm = t || "";
  const probe = new Date(`1970-01-01T${hhmm}:00`);
  if (Number.isNaN(probe.getTime())) return hhmm;
  return probe.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

// Small avatar used in the Host card
function HostAvatar({ host }) {
  const [ok, setOk] = useState(true);
  const name =
    ([host?.firstName, host?.lastName].filter(Boolean).join(" ")) ||
    host?.displayName ||
    host?.email ||
    "H";
  const initial = (name?.[0] || "H").toUpperCase();

  return (
    <div className="relative w-12 h-12 rounded-full bg-white/70 border border-white/60 overflow-hidden shrink-0 grid place-items-center text-gray-900 font-semibold ring-4 ring-white/60">
      {host?.photoURL && ok ? (
        <img
          src={host.photoURL}
          alt="Host avatar"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setOk(false)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

/* ================================ component ================================ */
const ExperienceDetailsModal = ({ listingId, onClose }) => {
  const [experience, setExperience] = useState(null);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [selectedParticipants, setSelectedParticipants] = useState(1);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [payment, setPayment] = useState(null);
  const [showPayPal, setShowPayPal] = useState(false);

  // NEW: host info + message modal
  const [host, setHost] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);

  // Load experience
  useEffect(() => {
    const run = async () => {
      if (!listingId) return;
      try {
        const ref = doc(database, "listings", listingId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return setExperience(null);
        const data = snap.data();
        setExperience({ id: snap.id, ...data });

        // preselect soonest schedule
        const sched = Array.isArray(data.schedule) ? [...data.schedule] : [];
        const sorted = sched
          .filter((s) => s?.date)
          .sort((a, b) =>
            `${a.date} ${a.time || a.startTime || ""}`.localeCompare(
              `${b.date} ${b.time || b.startTime || ""}`
            )
          );
        setSelectedSchedule(sorted[0] || null);
        setSelectedParticipants(1);
        setCurrentPhoto(0);
      } catch (e) {
        console.error("Failed to fetch experience:", e);
        setExperience(null);
      }
    };
    run();
  }, [listingId]);

  // Load host profile (mirrors your Home modal logic, trimmed a bit)
  useEffect(() => {
    let cancelled = false;

    const normalizeHost = (docSnap, fallbackUid) => {
      const d = docSnap.data() || {};
      const first = d.firstName || d.givenName || d.first_name || "";
      const last  = d.lastName  || d.familyName || d.last_name  || "";
      const displayName = d.displayName || d.name || [first, last].filter(Boolean).join(" ");
      const photoURL = d.photoURL || d.photoUrl || d.avatarURL || d.photo || d.avatar || d.profileImageUrl || null;
      return {
        id: docSnap.id,
        uid: d.uid || fallbackUid,
        email: d.email || "",
        firstName: first,
        lastName: last,
        displayName,
        photoURL,
      };
    };

    const tryMergePhoto = async (uid, current) => {
      if (current?.photoURL) return current;
      const candidates = [];
      try {
        const usersDoc = await getDoc(doc(database, "users", uid));
        if (usersDoc.exists()) candidates.push(normalizeHost(usersDoc, uid));
      } catch {}
      try {
        const hostsDoc = await getDoc(doc(database, "hosts", uid));
        if (hostsDoc.exists()) candidates.push(normalizeHost(hostsDoc, uid));
      } catch {}
      try {
        const usersQ = await getDocs(query(collection(database, "users"), where("uid", "==", uid)));
        if (!usersQ.empty) candidates.push(normalizeHost(usersQ.docs[0], uid));
      } catch {}
      try {
        const hostsQ = await getDocs(query(collection(database, "hosts"), where("uid", "==", uid)));
        if (!hostsQ.empty) candidates.push(normalizeHost(hostsQ.docs[0], uid));
      } catch {}
      const photoFromAny = candidates.find((c) => c?.photoURL)?.photoURL || null;
      return { ...current, photoURL: current.photoURL || photoFromAny };
    };

    const run = async () => {
      const uid = experience?.uid || experience?.ownerId || experience?.hostId;
      if (!uid) {
        if (!cancelled) setHost(null);
        return;
      }
      try {
        const hostsDoc = await getDoc(doc(database, "hosts", uid));
        if (hostsDoc.exists()) {
          let h = normalizeHost(hostsDoc, uid);
          h = await tryMergePhoto(uid, h);
          if (!cancelled) setHost(h);
          return;
        }
        const usersDoc = await getDoc(doc(database, "users", uid));
        if (usersDoc.exists()) {
          let h = normalizeHost(usersDoc, uid);
          h = await tryMergePhoto(uid, h);
          if (!cancelled) setHost(h);
          return;
        }
        if (!cancelled) setHost(null);
      } catch (e) {
        console.error("Failed to fetch host:", e);
        if (!cancelled) setHost(null);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [experience?.uid, experience?.ownerId, experience?.hostId]);

  // Keep photo index in bounds
  useEffect(() => {
    if (!experience?.photos?.length) return setCurrentPhoto(0);
    setCurrentPhoto((idx) => {
      const len = experience.photos.length;
      if (idx >= len) return 0;
      if (idx < 0) return (idx + len) % len;
      return idx;
    });
  }, [experience?.photos]);

  // Compute payment
  useEffect(() => {
    if (!experience || !selectedSchedule) return setPayment(null);
    const basePrice = numberOr(experience.price);
    const subtotal = basePrice * selectedParticipants;
    const serviceFee = subtotal * SERVICE_FEE_RATE; // ← 20%
    const total = subtotal + serviceFee;
    setPayment({
      basePrice,
      participants: selectedParticipants,
      subtotal,
      serviceFee,
      total,
    });
  }, [experience, selectedSchedule, selectedParticipants]);

  // Derived
  const photos = useMemo(
    () => (Array.isArray(experience?.photos) ? experience.photos : []),
    [experience?.photos]
  );
  const hasPhotos = photos.length > 0;

  const languages = Array.isArray(experience?.languages) ? experience.languages : [];
  const hasLanguages = languages.length > 0;
  const amenities = Array.isArray(experience?.amenities) ? experience.amenities : [];
  const hasAmenities = amenities.length > 0;
  const schedule = Array.isArray(experience?.schedule) ? experience.schedule : [];
  const hasSchedule = schedule.length > 0;
  const maxParticipants = numberOr(experience?.maxParticipants, 0);

  const title = experience?.title || "Untitled";
  const category = experience?.category || "Experiences";
  const listingType = experience?.listingType || "";
  const exType = experience?.experienceType === "online" ? "Online" : "In-Person";
  const locationStr = experience?.location || "—";
  const duration = experience?.duration || "—";
  const price = numberOr(experience?.price);
  const currencySymbol =
    experience?.currencySymbol ||
    (experience?.currency === "USD" ? "$" : experience?.currency === "EUR" ? "€" : "₱");

  // Carousel controls
  const nextPhoto = (e) => {
    e?.stopPropagation();
    if (!hasPhotos) return;
    setCurrentPhoto((p) => (p + 1) % photos.length);
  };
  const prevPhoto = (e) => {
    e?.stopPropagation();
    if (!hasPhotos) return;
    setCurrentPhoto((p) => (p - 1 + photos.length) % photos.length);
  };

  // Book
  const handleBookNow = () => {
    if (!payment || !selectedSchedule) {
      alert("Please select a schedule first.");
      return;
    }
    setShowPayPal(true);
  };

  if (!experience) return null;

  // ------------------- UI -------------------
  const modal = (
    <div
      className={[
        "fixed inset-0 z-[2147483000] flex items-center justify-center p-0 sm:p-4",
        "bg-black/30",
        "bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.12),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(99,102,241,0.12),transparent_55%)]",
        "backdrop-blur-md sm:backdrop-blur-lg supports-[backdrop-filter]:backdrop-blur-xl",
      ].join(" ")}
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="exp-details-title"
      aria-describedby="exp-details-desc"
    >
      <div
        className={[
          "relative w-full h-[100vh] sm:h-[90vh] sm:max-w-[1200px]",
          "grid grid-rows-[auto,1fr] md:grid-rows-1 md:grid-cols-2",
          "min-h-0 rounded-none sm:rounded-[2rem] overflow-hidden",
          "bg-gradient-to-br from-blue-50/55 via-white/70 to-indigo-50/55",
          "backdrop-blur-xl border border-white/60",
          "shadow-[0_12px_30px_rgba(30,58,138,0.12),_0_30px_60px_rgba(30,58,138,0.12)]",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-[2147483646] inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/95 border border-white/70 shadow hover:shadow-md hover:bg-white transition"
        >
          <CloseIcon className="w-5 h-5 text-gray-700" />
        </button>

        {/* LEFT: Photos */}
        <div className="hidden md:block relative bg-gray-900/90">
          {hasPhotos ? (
            <>
              <img
                src={photos[currentPhoto]}
                alt={`${title} photo ${currentPhoto + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
            </>
          ) : (
            <div className="w-full h-full grid place-items-center text-white/80 p-6">
              No photos available
            </div>
          )}

          {hasPhotos && photos.length > 1 && (
            <>
              <button
                onClick={prevPhoto}
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-gray-800 grid place-items-center shadow"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextPhoto}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-gray-800 grid place-items-center shadow"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentPhoto(i);
                    }}
                    className={`h-2 w-2 rounded-full ${
                      i === currentPhoto ? "bg-white" : "bg-white/60"
                    }`}
                    aria-label={`Go to photo ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* RIGHT: Content with fixed footer row */}
        <div className="relative h-full min-h-0 grid grid-rows-[1fr,auto] bg-gradient-to-br from-blue-50/35 via-white/55 to-indigo-50/35">
          {/* Scrollable content */}
          <div className="min-h-0 overflow-y-auto">
            <div className="max-w-[720px] mx-auto px-5 sm:px-6 md:px-7 py-5 sm:py-6 md:py-7 space-y-6 sm:space-y-7">
              {/* Header & meta */}
              <section className="space-y-3">
                <h2 id="exp-details-title" className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                  {title}
                </h2>

                <div className="flex flex-wrap items-center gap-2">
                  {category && (
                    <span className="inline-flex items-center rounded-full border border-white/60 bg-white/80 backdrop-blur px-3 py-1 text-[12px] sm:text-xs font-semibold text-blue-700 shadow-sm">
                      {category}
                    </span>
                  )}
                  {listingType && (
                    <span className="inline-flex items-center rounded-full border border-white/60 bg-white/80 backdrop-blur px-3 py-1 text-[12px] sm:text-xs font-semibold text-indigo-700 shadow-sm">
                      {listingType}
                    </span>
                  )}
                </div>

                {/* Price per person */}
                <p className="inline-flex items-center gap-2 text-sm sm:text-[15px] text-gray-700">
                  <Tag className="w-6 h-6 text-blue-600" />
                  <span className="font-semibold text-gray-900">
                    {currencySymbol}{price.toLocaleString()}
                  </span>
                  <span className="text-gray-600">/ person</span>
                </p>

                {/* Location */}
                <p className="inline-flex items-center gap-2 text-sm sm:text-[15px] text-gray-700">
                  <MapPin className="w-8 h-8 text-blue-600" />
                  <span className="font-medium text-gray-900">{locationStr}</span>
                </p>

                {experience.description && (
                  <p id="exp-details-desc" className="text-[15px] sm:text-base leading-relaxed text-gray-800">
                    {experience.description}
                  </p>
                )}
              </section>

              {/* Facts grid */}
              <section className="grid grid-cols-2 gap-3">
                {/* Duration */}
                <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow-sm flex items-center gap-3">
                  <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[12px] sm:text-xs text-gray-600">Duration</p>
                    <p className="mt-1 text-sm sm:text-base font-semibold text-gray-900">
                      {duration}
                    </p>
                  </div>
                </div>

                {/* Type */}
                <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow-sm">
                  <p className="text-[12px] sm:text-xs text-gray-600">Experience Type</p>
                  <p className="mt-1 text-sm sm:text-base font-semibold text-gray-900">
                    {exType}
                  </p>
                </div>

                {/* Max participants */}
                <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow-sm flex items-center gap-3">
                  <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[12px] sm:text-xs text-gray-600">Max Participants</p>
                    <p className="mt-1 text-sm sm:text-base font-semibold text-gray-900">
                      {maxParticipants || "—"}
                    </p>
                  </div>
                </div>

                {/* Languages */}
                {hasLanguages && (
                  <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow-sm flex items-center gap-3">
                    <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
                      <Languages className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[12px] sm:text-xs text-gray-600">Languages</p>
                      <p className="mt-1 text-sm sm:text-base font-semibold text-gray-900">
                        {languages.join(", ")}
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* NEW: Host panel + Message Host button */}
              {host && (
                <section className="rounded-3xl bg-white/80 backdrop-blur border border-white/60 p-4 sm:p-5 flex items-center gap-4 shadow-sm">
                  <HostAvatar host={host} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] sm:text-base font-semibold text-gray-900 truncate">
                      {([host.firstName, host.lastName].filter(Boolean).join(" ")) ||
                        host.displayName ||
                        host.email ||
                        "Host"}
                    </p>
                    <p className="text-[13px] sm:text-sm text-gray-600 truncate">Host of this experience</p>
                  </div>
                  <button
                    onClick={() => setShowMessageModal(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-[13px] sm:text-sm font-semibold text-gray-900 hover:bg-white shadow-sm active:scale-[0.98] transition"
                  >
                    <MessageSquareText className="w-4 h-4" /> Message Host
                  </button>
                </section>
              )}

              {/* Age Requirements */}
              {experience?.ageRestriction &&
                (typeof experience.ageRestriction.min !== "undefined" ||
                  typeof experience.ageRestriction.max !== "undefined") && (
                  <section className="rounded-3xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow-sm">
                    <h3 className="text-[13px] sm:text-sm font-semibold text-gray-900 tracking-wide mb-1">
                      Age Requirements
                    </h3>
                    <p className="text-[15px] sm:text-base text-gray-800">
                      {typeof experience.ageRestriction.min !== "undefined"
                        ? experience.ageRestriction.min
                        : 0}{" "}
                      –{" "}
                      {typeof experience.ageRestriction.max !== "undefined"
                        ? experience.ageRestriction.max
                        : 100}{" "}
                      years old
                    </p>
                  </section>
                )}

              {/* Host Requirements */}
              {!!experience?.hostRequirements && (
                <section className="rounded-3xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow-sm">
                  <h3 className="text-[13px] sm:text-sm font-semibold text-gray-900 tracking-wide mb-1">
                    Requirements
                  </h3>
                  <p className="text-[15px] sm:text-base text-gray-800">
                    {experience.hostRequirements}
                  </p>
                </section>
              )}

              {/* Schedule selector */}
              <section className="rounded-3xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow-sm">
                <h3 className="text-[13px] sm:text-sm font-semibold text-gray-900 tracking-wide mb-3">
                  Select Schedule
                </h3>
                {hasSchedule ? (
                  <div className="grid gap-2">
                    {schedule.map((s, idx) => {
                      const t = s?.time || s?.startTime || "";
                      const isSelected =
                        selectedSchedule?.date === s.date &&
                        (selectedSchedule?.time || selectedSchedule?.startTime || "") === t;
                      return (
                        <button
                          key={`${s.date}-${t}-${idx}`}
                          type="button"
                          onClick={() => setSelectedSchedule(s)}
                          className={`flex w-full items-start justify-between rounded-2xl border p-3 text-left transition ${
                            isSelected
                              ? "border-2 border-blue-500 bg-blue-50"
                              : "border-white/60 bg-white/80 hover:border-blue-300"
                          }`}
                        >
                          <div>
                            <p className="font-semibold text-gray-900">{fmtDate(s.date)}</p>
                            <p className="text-sm text-gray-600">{fmtTime(t)}</p>
                          </div>
                          {isSelected && (
                            <span className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">No schedules available.</p>
                )}
              </section>

              {/* Participants control */}
              <section className="rounded-3xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-[13.5px] sm:text-sm font-semibold text-gray-900">
                    Participants
                  </p>
                  {!!maxParticipants && (
                    <span className="text-[12px] sm:text-xs text-gray-600">
                      Max: {maxParticipants}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedParticipants((v) => Math.max(1, v - 1))}
                    disabled={selectedParticipants <= 1}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 shadow disabled:opacity-50 disabled:pointer-events-none"
                    aria-label="Decrease participants"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-10 text-center font-semibold text-gray-900">
                    {selectedParticipants}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedParticipants((v) =>
                        maxParticipants ? Math.min(maxParticipants, v + 1) : v + 1
                      )
                    }
                    disabled={!!maxParticipants && selectedParticipants >= maxParticipants}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow disabled:opacity-50 disabled:pointer-events-none"
                    aria-label="Increase participants"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </section>

              {/* Amenities */}
              {hasAmenities && (
                <section>
                  <h3 className="text-[13px] sm:text-sm font-semibold text-gray-900 tracking-wide">
                    Included Amenities
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    {amenities.map((a, i) => (
                      <span
                        key={`${a}-${i}`}
                        className="inline-flex items-center rounded-full border border-white/60 bg-white/80 backdrop-blur px-3 py-1.5 text-[12.5px] sm:text-xs font-medium text-gray-900 shadow-sm"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Payment Breakdown */}
              {payment && (
                <section className="rounded-3xl bg-white/85 backdrop-blur border border-white/60 p-4 sm:p-5 shadow-lg space-y-2">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">
                    Payment Breakdown
                  </h3>

                  <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                    <span>
                      <span className="font-semibold">
                        {currencySymbol}{price.toLocaleString()}
                      </span>{" "}
                      × {payment.participants}{" "}
                      {payment.participants === 1 ? "person" : "people"}
                    </span>
                    <span className="font-medium">
                      {currencySymbol}{payment.subtotal.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                    <span>Service fee ({Math.round(SERVICE_FEE_RATE * 100)}%)</span>
                    <span>
                      {currencySymbol}{payment.serviceFee.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  <div className="my-2 h-px bg-white/60" />

                  <div className="flex items-center justify-between">
                    <span className="text-base sm:text-lg font-bold text-gray-900">
                      Total
                    </span>
                    <span className="text-base sm:text-lg font-bold text-blue-700">
                      {currencySymbol}{payment.total.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </section>
              )}

              {/* Cancellation Policy */}
              {!!experience?.cancellationPolicy && (
                <section className="rounded-3xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow-sm">
                  <h3 className="text-[13px] sm:text-sm font-semibold text-gray-900 tracking-wide mb-1">
                    Cancellation Policy
                  </h3>
                  <p className="text-[14px] sm:text-[15px] text-gray-800">
                    {experience.cancellationPolicy}
                  </p>
                </section>
              )}
            </div>
          </div>

          {/* Fixed footer row */}
          <div
            className="w-full bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-t border-white/50 px-4 pt-4 pb-6 sm:pb-6"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
          >
            {showPayPal ? (
              <div className="w-full sm:max-w-md mx-auto">
                <div className="w-full rounded-2xl border border-white/60 bg-white/80 p-3 shadow-sm">
                  <PayPalButtons
                    style={{ layout: "vertical" }}
                    createOrder={(data, actions) => {
                      return actions.order.create({
                        purchase_units: [
                          { amount: { value: (payment?.total || 0).toFixed(2) } },
                        ],
                      });
                    }}
                    onApprove={async (data, actions) => {
                      const details = await actions.order.capture();
                      const user = auth.currentUser;
                      if (!user) {
                        alert("Please log in to make a reservation.");
                        return;
                      }
                      try {
                        if (!selectedSchedule || !payment) {
                          alert("Invalid schedule or payment.");
                          return;
                        }

                        const completed = details?.status === "COMPLETED";
                        const bookingStatus = completed ? "confirmed" : "pending";
                        const emailPaymentStatus = completed ? "Paid" : "Pending";
                        const storedPaymentStatus = completed ? "paid" : "pending";

                        const bookingData = {
                          uid: user.uid,
                          listingId,
                          quantity: payment.participants,
                          schedule: selectedSchedule, // {date, time}
                          checkIn: selectedSchedule?.date || null,
                          checkOut: selectedSchedule?.date || null,
                          guestEmail: user.email,
                          subtotal: payment.subtotal,
                          serviceFee: payment.serviceFee,
                          totalPrice: payment.total, // numeric
                          listingTitle: title,
                          listingCategory: category,
                          status: bookingStatus,
                          paymentStatus: storedPaymentStatus, // stored in lowercase
                          listingPhotos: photos,
                          createdAt: serverTimestamp(),
                          updatedAt: serverTimestamp(),
                        };
                        if (experience.uid) bookingData.hostId = experience.uid;
                        if (user.displayName) bookingData.guestName = user.displayName;
                        if (experience.experienceType)
                          bookingData.experienceType = experience.experienceType;
                        if (experience.duration) bookingData.duration = experience.duration;
                        if (locationStr) bookingData.listingAddress = locationStr;

                        await addDoc(collection(database, "bookings"), bookingData);

                        // === Send the confirmation email (matches your template fields) ===
                        try {
                          await sendBookingEmail({
                            user,
                            title,
                            category,
                            location: locationStr,
                            total: bookingData.totalPrice,
                            paymentStatus: emailPaymentStatus,  // "Paid" or "Pending"
                            currencySymbol,
                            brandSiteUrl: typeof window !== "undefined" ? window.location.origin : "",
                          });
                        } catch (mailErr) {
                          console.error("EmailJS send failed:", mailErr);
                          // Non-blocking by design
                        }

                        alert("Booking successful!");
                        onClose?.();
                      } catch (err) {
                        console.error("Error creating reservation:", err);
                        alert(`Failed to create reservation: ${err.message}`);
                      }
                    }}
                    onCancel={() => setShowPayPal(false)}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowPayPal(false)}
                  className="mt-3 w-full inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleBookNow}
                  disabled={!payment || !selectedSchedule}
                  className="w-full sm:w-auto flex-1 min-w-[140px] inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 active:scale-[0.99] transition disabled:opacity-50 disabled:pointer-events-none"
                >
                  Book Now
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto flex-1 min-w-[140px] inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NEW: Message Host modal (mirrors your Home modal usage) */}
      {showMessageModal &&
        createPortal(
          <div className="fixed inset-0 z-[2147483646]">
            <MessageHostModal
              open
              onClose={() => setShowMessageModal(false)}
              host={host}
              hostId={host?.uid || experience?.uid || experience?.ownerId || experience?.hostId}
            />
          </div>,
          document.body
        )}
    </div>
  );

  return createPortal(modal, document.body);
};

export default ExperienceDetailsModal;
