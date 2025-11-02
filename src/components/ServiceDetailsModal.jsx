import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PayPalButtons } from "@paypal/react-paypal-js";
import { auth, database } from "../config/firebase";
import { collection, addDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import emailjs from "@emailjs/browser";
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
  Building2,
} from "lucide-react";

/* ================= EmailJS config & helper (matches your template) ================= */
// You can switch these to env vars (REACT_APP_EMAILJS_*) if you prefer.
// They're public in the client either way.
const EMAILJS_SERVICE_ID = "service_x9dtjt6";
const EMAILJS_TEMPLATE_ID = "template_vrfey3u";
const EMAILJS_PUBLIC_KEY = "hHgssQum5iOFlnJRD";

// Initialize once (optional when passing publicKey to send; harmless if repeated)
emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

async function sendBookingEmail({
  user,                // { displayName, email }
  title,               // service title
  category,            // -> {{listing_category}}
  location,            // -> {{listing_address}}
  total,               // number -> {{total_price}}
  paymentStatus = "Paid",     // "Paid"/"Pending" -> {{payment_status}}
  currencySymbol = "₱",       // -> {{currency_symbol}}
  brandSiteUrl,               // -> {{brand_site_url}}
}) {
  const params = {
    to_name: user?.displayName || (user?.email || "").split("@")[0] || "Guest",
    to_email: String(user?.email || ""),
    listing_title: String(title || "Untitled"),
    listing_category: String(category || "Services"),
    listing_address: String(location || "—"),
    payment_status: String(paymentStatus || "Paid"),
    currency_symbol: String(currencySymbol || "₱"),
    total_price: Number(total || 0).toFixed(2),
    brand_site_url: String(brandSiteUrl || (typeof window !== "undefined" ? window.location.origin : "")),
  };

  // Helpful during dev
  console.log("[EmailJS] sending with params:", params);

  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params, EMAILJS_PUBLIC_KEY);
}

/* ================================= component ================================= */
const ServiceDetailsModal = ({ listingId, onClose }) => {
  const [service, setService] = useState(null);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [paymentBreakdown, setPaymentBreakdown] = useState(null);
  const [showPayPal, setShowPayPal] = useState(false);

  /* ===== Lock body scroll while modal is mounted ===== */
  useEffect(() => {
    if (!listingId) return;
    const prevOverflow = document.body.style.overflow;
    const prevPR = document.body.style.paddingRight;
    const sw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (sw > 0) document.body.style.paddingRight = `${sw}px`;
    return () => {
      document.body.style.overflow = prevOverflow || "";
      document.body.style.paddingRight = prevPR || "";
    };
  }, [listingId]);

  /* ===== Fetch service (keep doc id) ===== */
  useEffect(() => {
    const fetchServiceDetails = async () => {
      try {
        const docRef = doc(database, "listings", listingId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setService({ id: docSnap.id, ...data }); // keep id
          setSelectedQuantity(1);

          // Preselect soonest schedule if present
          const sched = Array.isArray(data.schedule) ? [...data.schedule] : [];
          const soonest = sched
            .filter((s) => s?.date)
            .sort((a, b) => `${a.date} ${a.time || ""}`.localeCompare(`${b.date} ${b.time || ""}`))[0];
          setSelectedSchedule(soonest || null);
        } else {
          setService(null);
        }
      } catch (error) {
        console.error("Error fetching service details:", error);
        setService(null);
      }
    };
    if (listingId) fetchServiceDetails();
    setCurrentPhoto(0);
  }, [listingId]);

  /* ===== Keep photo index valid when photos change ===== */
  useEffect(() => {
    if (!service?.photos?.length) {
      setCurrentPhoto(0);
      return;
    }
    setCurrentPhoto((idx) => {
      const len = service.photos.length;
      if (idx >= len) return 0;
      if (idx < 0) return (idx + len) % len;
      return idx;
    });
  }, [service?.photos]);

  /* ===== Recompute payment on inputs change ===== */
  useEffect(() => {
    if (selectedSchedule && service) {
      calculatePayment();
    } else {
      setPaymentBreakdown(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuantity, selectedSchedule, service]);

  const calculatePayment = () => {
    if (!service || !selectedSchedule) return;
    const basePrice = parseFloat(service.price) || 0;
    const subtotal = basePrice * selectedQuantity;
    const tax = subtotal * 0.12; // 12%
    const total = subtotal + tax;

    setPaymentBreakdown({
      quantity: selectedQuantity,
      basePrice,
      subtotal,
      tax,
      total,
    });
  };

  const handleIncrementQuantity = () => {
    const maxParticipants = service?.maxParticipants || 30;
    if (selectedQuantity < maxParticipants) {
      setSelectedQuantity((prev) => prev + 1);
    }
  };

  const handleDecrementQuantity = () => {
    if (selectedQuantity > 1) {
      setSelectedQuantity((prev) => prev - 1);
    }
  };

  const handleBookNow = () => {
    if (!selectedSchedule || !paymentBreakdown) {
      alert("Please select a schedule and ensure payment details are calculated.");
      return;
    }
    setShowPayPal(true);
  };

  const handleScheduleSelect = (schedule) => setSelectedSchedule(schedule);

  const nextPhoto = (e) => {
    e?.stopPropagation();
    const photos = Array.isArray(service?.photos) ? service.photos : [];
    if (!photos.length) return;
    setCurrentPhoto((p) => (p + 1) % photos.length);
  };

  const prevPhoto = (e) => {
    e?.stopPropagation();
    const photos = Array.isArray(service?.photos) ? service.photos : [];
    if (!photos.length) return;
    setCurrentPhoto((p) => (p - 1 + photos.length) % photos.length);
  };

  if (!listingId || !service) return null;

  const photos = Array.isArray(service.photos) ? service.photos : [];
  const hasPhotos = photos.length > 0;
  const hasSchedule = Array.isArray(service.schedule) && service.schedule.length > 0;
  const hasLanguages = Array.isArray(service.languages) && service.languages.length > 0;
  const hasAmenities = Array.isArray(service.amenities) && service.amenities.length > 0;

  const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const splitList = (text) =>
    String(text)
      .split(/•|\n|;|,/)
      .map((s) => s.trim())
      .filter(Boolean);

  const splitTags = (text) =>
    String(text)
      .split(/,|\/|·|\|/)
      .map((s) => s.trim())
      .filter(Boolean);

  // Currency symbol for UI & email
  const currencySymbol =
    service?.currencySymbol ||
    (service?.currency === "USD" ? "$" : service?.currency === "EUR" ? "€" : "₱");

  const modalUI = (
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
      aria-labelledby="service-details-title"
      aria-describedby="service-details-desc"
    >
      {/* DIALOG */}
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
        {/* CLOSE */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-[2147483646] inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/95 border border-white/70 shadow hover:shadow-md hover:bg-white transition"
        >
          <CloseIcon className="w-5 h-5 text-gray-700" />
        </button>

        {/* MOBILE photos */}
        <div className="md:hidden relative h-64 w-full bg-gray-900/90">
          {hasPhotos ? (
            <>
              <img
                src={photos[currentPhoto]}
                alt={`${service.title} - photo ${currentPhoto + 1}`}
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
                    className={`h-2.5 w-2.5 rounded-full ${i === currentPhoto ? "bg-white" : "bg-white/60"}`}
                    aria-label={`Go to photo ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* DESKTOP photos */}
        <div className="hidden md:block relative bg-gray-900/90">
          {hasPhotos ? (
            <>
              <img
                src={photos[currentPhoto]}
                alt={`${service.title} - photo ${currentPhoto + 1}`}
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
                    className={`h-2 w-2 rounded-full ${i === currentPhoto ? "bg-white" : "bg-white/60"}`}
                    aria-label={`Go to photo ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* RIGHT column */}
        <div className="relative h-full min-h-0 grid grid-rows-[1fr,auto] bg-gradient-to-br from-blue-50/35 via-white/55 to-indigo-50/35">
          <div className="min-h-0 overflow-y-auto">
            <div className="max-w-[720px] mx-auto px-5 sm:px-6 md:px-7 py-5 sm:py-6 md:py-7 space-y-6 sm:space-y-7">
              {/* Header */}
              <section className="space-y-3">
                <h2 id="service-details-title" className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                  {service.title || "Untitled"}
                </h2>

                <div className="flex flex-wrap items-center gap-2">
                  {service.category && (
                    <span className="inline-flex items-center rounded-full border border-white/60 bg-white/80 backdrop-blur px-3 py-1 text-[12px] sm:text-xs font-semibold text-blue-700 shadow-sm">
                      {service.category}
                    </span>
                  )}
                  {service.serviceType && (
                    <span className="inline-flex items-center rounded-full border border-white/60 bg-white/80 backdrop-blur px-3 py-1 text-[12px] sm:text-xs font-semibold text-indigo-700 shadow-sm">
                      {service.serviceType}
                    </span>
                  )}
                  {service.pricingType && (
                    <span className="inline-flex items-center rounded-full border border-white/60 bg-white/80 backdrop-blur px-3 py-1 text-[12px] sm:text-xs font-semibold text-purple-700 shadow-sm">
                      {service.pricingType}
                    </span>
                  )}
                  {service.recurrence && (
                    <span className="inline-flex items-center rounded-full border border-white/60 bg-white/80 backdrop-blur px-3 py-1 text-[12px] sm:text-xs font-semibold text-emerald-700 shadow-sm">
                      Repeats: {service.recurrence}
                    </span>
                  )}
                </div>

                {service.description && (
                  <p id="service-details-desc" className="text-[15px] sm:text-base leading-relaxed text-gray-800">
                    {service.description}
                  </p>
                )}
              </section>

              {/* Key Details */}
              <section className="space-y-3">
                <h3 className="text-[13px] sm:text-sm font-semibold text-gray-900 tracking-wide">Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  {/* Pricing Type */}
                  <div className="flex items-center gap-3 rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-3 shadow-sm">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-[12px] sm:text-xs text-gray-600">Pricing Type</p>
                      <p className="text-sm font-medium text-gray-900">{service.pricingType || "—"}</p>
                    </div>
                  </div>

                  {/* Max Participants */}
                  <div className="flex items-center gap-3 rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-3 shadow-sm">
                    <Users className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-[12px] sm:text-xs text-gray-600">Max Participants</p>
                      <p className="text-sm font-medium text-gray-900">{service.maxParticipants ?? "—"}</p>
                    </div>
                  </div>

                  {/* Location Type */}
                  <div className="flex items-center gap-3 rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-3 shadow-sm">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-[12px] sm:text-xs text-gray-600">Location Type</p>
                      <p className="text-sm font-medium text-gray-900">
                        {service.locationType === "in-person" ? "In-Person" : "Online"}
                      </p>
                    </div>
                  </div>

                  {/* Languages */}
                  {hasLanguages && (
                    <div className="flex items-center gap-3 rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-3 shadow-sm">
                      <Languages className="w-4 h-4 text-blue-600" />
                      <div>
                        <p className="text-[12px] sm:text-xs text-gray-600">Languages</p>
                        <p className="text-sm font-medium text-gray-900">{service.languages.join(", ")}</p>
                      </div>
                    </div>
                  )}

                  {/* Service Type */}
                  {service.serviceType && (
                    <div className="flex items-center gap-3 rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-3 shadow-sm">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <div>
                        <p className="text-[12px] sm:text-xs text-gray-600">Service Type</p>
                        <p className="text-sm font-medium text-gray-900">{service.serviceType}</p>
                      </div>
                    </div>
                  )}

                  {/* Duration */}
                  {service.duration && (
                    <div className="flex items-center gap-3 rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-3 shadow-sm">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <div>
                        <p className="text-[12px] sm:text-xs text-gray-600">Duration</p>
                        <p className="text-sm font-medium text-gray-900">{service.duration}</p>
                      </div>
                    </div>
                  )}

                  {/* Address (full width) */}
                  {service.address && (
                    <div className="flex items-center gap-3 rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-3 shadow-sm col-span-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <div className="min-w-0">
                        <p className="text-[12px] sm:text-xs text-gray-600">Address</p>
                        <p className="text-sm font-medium text-gray-900 truncate">{service.address}</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Provider */}
              {service.providerName && (
                <section>
                  <h3 className="text-[13px] sm:text-sm font-semibold text-gray-900 tracking-wide">Provider</h3>
                  <div className="mt-2 rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow-sm">
                    <p className="text-sm font-medium text-gray-900">{service.providerName}</p>
                  </div>
                </section>
              )}

              {/* Age Restriction */}
              {service.ageRestriction && (
                <section>
                  <h3 className="text-[13px] sm:text-sm font-semibold text-gray-900 tracking-wide">Age Requirements</h3>
                  <div className="mt-2 rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow-sm">
                    <p className="text-sm text-gray-900">
                      {service.ageRestriction.min} – {service.ageRestriction.max} years old
                    </p>
                  </div>
                </section>
              )}

              {/* Client Requirements */}
              {service.clientRequirements && (
                <section>
                  <h3 className="text-[13px] sm:text-sm font-semibold text-gray-900 tracking-wide">Requirements</h3>
                  <div className="mt-2 rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow-sm">
                    <p className="text-sm text-gray-800">{service.clientRequirements}</p>
                  </div>
                </section>
              )}

              {/* Amenities */}
              {hasAmenities && (
                <section>
                  <h3 className="text-[13px] sm:text-sm font-semibold text-gray-900 tracking-wide">Included Amenities</h3>
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    {service.amenities.map((a, i) => (
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

              {/* What’s Included */}
              {service.includes && (
                <section>
                  <h3 className="text-[13px] sm:text-sm font-semibold text-gray-900 tracking-wide">What’s Included</h3>
                  <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-gray-800">
                    {splitList(service.includes).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Qualifications */}
              {service.qualifications && (
                <section>
                  <h3 className="text-[13px] sm:text-sm font-semibold text-gray-900 tracking-wide">Qualifications</h3>
                  <div className="mt-2 rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow-sm">
                    <p className="text-sm text-gray-800">{service.qualifications}</p>
                  </div>
                </section>
              )}

              {/* Target Audience */}
              {service.targetAudience && (
                <section>
                  <h3 className="text-[13px] sm:text-sm font-semibold text-gray-900 tracking-wide">Best For</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {splitTags(service.targetAudience).map((tag, i) => (
                      <span
                        key={`${tag}-${i}`}
                        className="inline-flex items-center rounded-full border border-white/60 bg-white/80 backdrop-blur px-3 py-1.5 text-[12.5px] sm:text-xs font-medium text-gray-900 shadow-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Booking Card */}
              <section className="rounded-3xl bg-white/85 backdrop-blur border border-white/60 p-4 sm:p-5 shadow-sm space-y-4">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Book This Service</h3>

                {/* Quantity */}
                <div className="space-y-2">
                  <p className="text-[13.5px] sm:text-sm font-semibold text-gray-900">Number of Participants</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDecrementQuantity}
                      disabled={selectedQuantity <= 1}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 shadow active:scale-95 transition disabled:opacity-50 disabled:pointer-events-none"
                      aria-label="Decrease participants"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-semibold text-gray-900">{selectedQuantity}</span>
                    <button
                      type="button"
                      onClick={handleIncrementQuantity}
                      disabled={!!service.maxParticipants && selectedQuantity >= service.maxParticipants}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow active:scale-95 transition disabled:opacity-50 disabled:pointer-events-none"
                      aria-label="Increase participants"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    {!!service.maxParticipants && (
                      <span className="text-sm text-gray-500">Max: {service.maxParticipants}</span>
                    )}
                  </div>
                </div>

                {/* Schedule */}
                <div className="space-y-2">
                  <p className="text-[13.5px] sm:text-sm font-semibold text-gray-900">Select Schedule</p>
                  {hasSchedule ? (
                    <div className="grid gap-2">
                      {service.schedule.map((s, idx) => {
                        const isSelected = selectedSchedule?.date === s.date && selectedSchedule?.time === s.time;
                        return (
                          <button
                            key={`${s.date}-${s.time}-${idx}`}
                            type="button"
                            onClick={() => handleScheduleSelect(s)}
                            className={`flex w-full items-start justify-between rounded-xl border p-3 text-left transition ${
                              isSelected ? "border-2 border-indigo-500 bg-indigo-50" : "border-white/60 bg-white/80 hover:border-indigo-400"
                            }`}
                          >
                            <div>
                              <p className="font-semibold text-gray-900">{fmtDate(s.date)}</p>
                              <p className="text-sm text-gray-600">{s.time}</p>
                            </div>
                            {isSelected && <span className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-indigo-600" />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No schedules available.</p>
                  )}
                </div>
              </section>

              {/* Payment Summary */}
              {paymentBreakdown && (
                <section className="rounded-3xl bg-white/85 backdrop-blur border border-white/60 p-4 sm:p-5 shadow-lg space-y-2">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">Payment Summary</h3>

                  <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                    <span>
                      {currencySymbol}{(service.price || 0).toLocaleString()} × {paymentBreakdown.quantity}{" "}
                      {paymentBreakdown.quantity === 1 ? "person" : "people"}
                    </span>
                    <span>{currencySymbol}{paymentBreakdown.subtotal.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                    <span>Service Fee (12%)</span>
                    <span>
                      {currencySymbol}
                      {paymentBreakdown.tax.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  <div className="my-2 h-px bg-white/60" />

                  <div className="flex items-center justify-between">
                    <span className="text-base sm:text-lg font-bold text-gray-900">Total</span>
                    <span className="text-base sm:text-lg font-bold text-blue-700">
                      {currencySymbol}
                      {paymentBreakdown.total.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </section>
              )}

              {/* Cancellation Policy */}
              {service.cancellationPolicy && (
                <section className="rounded-3xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow-sm">
                  <p className="text-[12.5px] sm:text-xs font-semibold text-gray-900">Cancellation Policy</p>
                  <p className="text-sm text-gray-600 mt-1">{service.cancellationPolicy}</p>
                </section>
              )}
            </div>
          </div>

          {/* Footer Actions (Sticky inside the right pane) */}
          <div
            className="w-full bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-t border-white/50 px-4 pt-4 pb-6 sm:pb-6"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
          >
            <div className="flex flex-col sm:flex-row gap-3">
              {showPayPal ? (
                <div className="w-full sm:max-w-md mx-auto">
                  <div className="w-full rounded-2xl border border-white/60 bg-white/80 p-3 shadow-sm">
                    <PayPalButtons
                      style={{ layout: "vertical" }}
                      createOrder={(data, actions) => {
                        return actions.order.create({
                          purchase_units: [
                            {
                              amount: {
                                value: (paymentBreakdown?.total || 0).toFixed(2),
                              },
                            },
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
                          const quantity = selectedQuantity;
                          const schedule = selectedSchedule;

                          if (!schedule || quantity <= 0) {
                            alert("Invalid schedule or quantity selected.");
                            return;
                          }

                          const subtotal = paymentBreakdown.subtotal;
                          const serviceFee = paymentBreakdown.tax; // keep same field name
                          const totalPrice = paymentBreakdown.total;

                          // Determine statuses from PayPal capture
                          const completed = details?.status === "COMPLETED";
                          const bookingStatus = completed ? "confirmed" : "pending";
                          const storedPaymentStatus = completed ? "paid" : "pending";
                          const emailPaymentStatus = completed ? "Paid" : "Pending";

                          // Build a listing reference (for hydration later)
                          const targetId = service?.id || listingId || null;
                          const listingDocRef = targetId ? doc(database, "listings", targetId) : null;

                          const bookingData = {
                            uid: user.uid,
                            quantity,
                            schedule,
                            guestEmail: user.email,
                            subtotal,
                            serviceFee,
                            totalPrice,

                            listingTitle: service.title || "Untitled",
                            listingCategory: service.category || "Services",
                            listingAddress: service.address || "",
                            listingPhotos: Array.isArray(service.photos) ? service.photos : [],

                            status: bookingStatus,
                            paymentStatus: storedPaymentStatus,

                            // identifiers
                            listingId: targetId,
                            listingRef: listingDocRef || null,
                            listingRefPath: listingDocRef?.path || null,

                            // meta
                            paypalOrderId: details?.id || null,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                          };

                          if (service.uid || service.ownerId || service.hostId) {
                            bookingData.hostId = service.uid || service.ownerId || service.hostId;
                          }
                          if (user.displayName) bookingData.guestName = user.displayName;
                          if (service.providerName) bookingData.providerName = service.providerName;

                          const bookingsRef = collection(database, "bookings");
                          await addDoc(bookingsRef, bookingData);

                          // === Send the confirmation email (matches your template fields) ===
                          try {
                            await sendBookingEmail({
                              user,
                              title: bookingData.listingTitle,
                              category: bookingData.listingCategory,
                              location: bookingData.listingAddress,
                              total: bookingData.totalPrice,
                              paymentStatus: emailPaymentStatus, // "Paid" | "Pending"
                              currencySymbol,
                              brandSiteUrl: typeof window !== "undefined" ? window.location.origin : "",
                            });
                          } catch (mailErr) {
                            console.error("EmailJS send failed:", mailErr);
                            // Non-blocking by design
                          }

                          alert("Booking successful!");
                          onClose?.();
                        } catch (error) {
                          console.error("Error creating reservation:", error);
                          alert(`Failed to create reservation: ${error.message}`);
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
                <>
                  <button
                    type="button"
                    onClick={handleBookNow}
                    disabled={!paymentBreakdown}
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalUI, document.body);
};

export default ServiceDetailsModal;
