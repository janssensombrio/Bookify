import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import emailjs from "@emailjs/browser";

import {
  doc,
  getDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { database, auth } from "../config/firebase";
import { PayPalButtons } from "@paypal/react-paypal-js";
import DateRangePickerInline from "../pages/guest/components/DateRangeInlinePicker";
import { MessageHostModal } from "./message-host-modal";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Home,
  Tag,
  MapPin,
  Users,
  Minus,
  Plus,
  MessageSquareText,
  ShieldCheck,
  Info,
} from "lucide-react";

/* ================== EmailJS env ================== */
const EMAILJS_SERVICE_ID = "service_x9dtjt6";
const EMAILJS_TEMPLATE_ID = "template_vrfey3u";
const EMAILJS_PUBLIC_KEY = "hHgssQum5iOFlnJRD";
emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
const isEmailJsConfigured = [EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY].every(Boolean);

/* ============================ helpers ============================ */
const numberOr = (v, d = 0) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : d;
};
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const nightsBetween = (start, end) => {
  if (!start || !end) return 0;
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12);
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12);
  const msPerDay = 86400000;
  return Math.max(0, Math.ceil((e - s) / msPerDay));
};
const ymd = (d) => {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const fromYMD = (s) => (s ? new Date(`${s}T00:00:00`) : null);

/* ===== date math (day-precision) ===== */
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const addDays = (d, n) => startOfDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
const sameOrBefore = (a, b) => startOfDay(a) <= startOfDay(b);
const sameOrAfter = (a, b) => startOfDay(a) >= startOfDay(b);
const dayBetweenInclusive = (d, s, e) => sameOrAfter(d, s) && sameOrBefore(d, e);

/* Timestamps/strings -> local date at 00:00 */
const toJSDate = (v) => {
  if (!v) return null;
  if (typeof v?.toDate === "function") return startOfDay(v.toDate()); // Firestore Timestamp
  if (v instanceof Date) return startOfDay(v);
  if (typeof v === "string") return startOfDay(new Date(`${v}T00:00:00`));
  return null;
};

/* Merge touching/overlapping intervals at day precision */
const mergeIntervals = (arr = []) => {
  const a = [...arr].sort((x, y) => x.start - y.start);
  const out = [];
  for (const iv of a) {
    if (!out.length || startOfDay(iv.start) > addDays(startOfDay(out[out.length - 1].end), 1)) {
      out.push({ start: startOfDay(iv.start), end: startOfDay(iv.end) });
    } else {
      if (startOfDay(iv.end) > startOfDay(out[out.length - 1].end)) {
        out[out.length - 1].end = startOfDay(iv.end);
      }
    }
  }
  return out;
};

const rangesOverlap = (aStart, aEnd, bStart, bEnd) =>
  sameOrBefore(aStart, bEnd) && sameOrBefore(bStart, aEnd);

/* ============================ email util ============================ */
async function sendBookingConfirmationEmail({ user, listing, totalAmount, paymentStatus = "paid" }) {
  if (!isEmailJsConfigured) {
    console.warn("[EmailJS] Skipped sending email — missing EmailJS env vars.");
    return;
  }
  const currencySymbol =
    listing?.currencySymbol ||
    (listing?.currency === "USD" ? "$" : listing?.currency === "EUR" ? "€" : "₱");

  const params = {
    to_name: user?.displayName || (user?.email || "").split("@")[0] || "Guest",
    to_email: user?.email,
    listing_title: listing?.title || "Untitled",
    listing_category: listing?.category || "Homes",
    listing_address: listing?.location || "—",
    payment_status: String(paymentStatus).charAt(0).toUpperCase() + String(paymentStatus).slice(1),
    currency_symbol: currencySymbol,
    total_price: (Number(totalAmount) || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  };

  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params);
}

/* ============================ component ============================ */
export default function HomeDetailsModal({ listingId, onClose }) {
  const [listing, setListing] = useState(null);
  const [host, setHost] = useState(null);

  const [currentPhoto, setCurrentPhoto] = useState(0);

  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);

  const [selectedDates, setSelectedDates] = useState({ start: null, end: null });
  const [includeCleaningFee, setIncludeCleaningFee] = useState(true);

  const [payment, setPayment] = useState(null);
  const [showPayPal, setShowPayPal] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);

  const [showMessageModal, setShowMessageModal] = useState(false);

  const [bookedIntervals, setBookedIntervals] = useState([]); // [{start: Date, end: Date}] (inclusive, day-precision)

  /* lock scroll */
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevPR = document.body.style.paddingRight;
    const sw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (sw > 0) document.body.style.paddingRight = `${sw}px`;
    return () => {
      document.body.style.overflow = prevOverflow || "";
      document.body.style.paddingRight = prevPR || "";
    };
  }, []);

  /* Load listing */
  useEffect(() => {
    const run = async () => {
      if (!listingId) return;
      try {
        const ref = doc(database, "listings", listingId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return setListing(null);
        const data = snap.data();

        const normalized = {
          id: snap.id,
          ...data,
          price: numberOr(data.price),
          cleaningFee: numberOr(data.cleaningFee),
          discountValue: numberOr(data.discountValue),
          category: data?.category || "Homes",
        };

        setListing(normalized);
        const g = normalized?.guests || {};
        setAdults(Math.max(1, numberOr(g.adults, 1)));
        setChildren(Math.max(0, numberOr(g.children, 0)));
        setInfants(Math.max(0, numberOr(g.infants, 0)));
      } catch (e) {
        console.error("Failed to fetch listing:", e);
        setListing(null);
      }
    };
    run();
    setCurrentPhoto(0);
  }, [listingId]);

  /* Load booked intervals (confirmed + pending) */
  useEffect(() => {
    let cancel = false;
    const loadBooked = async () => {
      if (!listingId) {
        if (!cancel) setBookedIntervals([]);
        return;
      }
      try {
        const bookingsRef = collection(database, "bookings");
        let qRef;
        try {
          qRef = query(
            bookingsRef,
            where("listingId", "==", listingId),
            where("status", "in", ["confirmed", "pending"])
          );
        } catch {
          qRef = query(bookingsRef, where("listingId", "==", listingId));
        }

        const snap = await getDocs(qRef);
        const intervals = [];
        snap.forEach((d) => {
          const b = d.data();
          const statusOK = ["confirmed", "pending"].includes(b?.status) || !b?.status;
          if (!statusOK) return;

          const ci = toJSDate(b.checkIn);
          const co = toJSDate(b.checkOut);
          if (!ci || !co) return;

          // Disable the nights: [checkIn, checkOut - 1]
          const start = startOfDay(ci);
          const end = addDays(startOfDay(co), -1);
          if (end >= start) intervals.push({ start, end });
        });

        if (!cancel) setBookedIntervals(mergeIntervals(intervals));
      } catch (err) {
        console.error("Failed to load booked intervals:", err);
        if (!cancel) setBookedIntervals([]);
      }
    };

    loadBooked();
    return () => { cancel = true; };
  }, [listingId]);

  /* Load host (unchanged except noise trimmed) */
  useEffect(() => {
    let cancelled = false;

    const normalizeHost = (docSnap, fallbackUid) => {
      const d = docSnap.data() || {};
      const first = d.firstName || d.givenName || d.first_name || "";
      const last = d.lastName || d.familyName || d.last_name || "";
      const displayName = d.displayName || d.name || [first, last].filter(Boolean).join(" ");
      const photoURL = d.photoURL || d.photoUrl || d.avatarURL || d.photo || d.avatar || d.profileImageUrl || null;
      return { id: docSnap.id, uid: d.uid || fallbackUid, email: d.email || "", firstName: first, lastName: last, displayName, photoURL };
    };

    const tryMergePhoto = async (uid, current) => {
      if (current?.photoURL) return current;
      const candidates = [];
      try { const usersDoc = await getDoc(doc(database, "users", uid)); if (usersDoc.exists()) candidates.push(normalizeHost(usersDoc, uid)); } catch {}
      try { const hostsDoc = await getDoc(doc(database, "hosts", uid)); if (hostsDoc.exists()) candidates.push(normalizeHost(hostsDoc, uid)); } catch {}
      try { const usersQ = await getDocs(query(collection(database, "users"), where("uid", "==", uid))); if (!usersQ.empty) candidates.push(normalizeHost(usersQ.docs[0], uid)); } catch {}
      try { const hostsQ = await getDocs(query(collection(database, "hosts"), where("uid", "==", uid))); if (!hostsQ.empty) candidates.push(normalizeHost(hostsQ.docs[0], uid)); } catch {}
      const photoFromAny = candidates.find((c) => c?.photoURL)?.photoURL || null;
      return { ...current, photoURL: current.photoURL || photoFromAny };
    };

    const run = async () => {
      const uid = listing?.uid || listing?.ownerId || listing?.hostId;
      if (!uid) return setHost(null);
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
  }, [listing?.uid, listing?.ownerId, listing?.hostId]);

  /* Prefill availability */
  useEffect(() => {
    if (!listing?.availability?.start || !listing?.availability?.end) return;
    const s = new Date(listing.availability.start + "T00:00:00");
    const e = new Date(listing.availability.end + "T00:00:00");
    setSelectedDates({ start: s, end: e });
  }, [listing]);

  /* Payment recompute */
  useEffect(() => {
    if (!listing) return setPayment(null);
    const { start, end } = selectedDates || {};
    const nights = nightsBetween(start, end);
    if (!nights) return setPayment(null);

    const price = numberOr(listing.price);
    const clean = includeCleaningFee ? numberOr(listing.cleaningFee) : 0;

    const type = listing.discountType || "none";
    const dVal = numberOr(listing.discountValue);

    const cappedPercent = Math.min(100, Math.max(0, dVal));
    const perNightDiscount = type === "percentage" ? (price * cappedPercent) / 100 : 0;
    const nightlyAfter = Math.max(0, price - perNightDiscount);

    const staySubtotal = nightlyAfter * nights;
    const fixedDiscount = type === "fixed" ? Math.max(0, dVal) : 0;

    const subtotal = Math.max(0, staySubtotal + clean - fixedDiscount);
    const serviceRate = 0.1;
    const serviceFee = subtotal * serviceRate;
    const total = subtotal + serviceFee;

    setPayment({
      nights, price, perNightDiscount, nightlyAfter,
      cleaningFee: clean, fixedDiscount, subtotal, serviceFee, serviceRate, total,
      type, dVal: type === "percentage" ? cappedPercent : dVal,
    });
  }, [selectedDates, includeCleaningFee, listing]);

  if (!listing) return null;

  const photos = Array.isArray(listing?.photos) ? listing.photos : [];
  const hasPhotos = photos.length > 0;

  const nextPhoto = (e) => { e?.stopPropagation(); if (!hasPhotos) return; setCurrentPhoto((p) => (p + 1) % photos.length); };
  const prevPhoto = (e) => { e?.stopPropagation(); if (!hasPhotos) return; setCurrentPhoto((p) => (p - 1 + photos.length) % photos.length); };

  /* ---- selection with validation against booked intervals ---- */
  const handleDateChange = ({ start, end }) => {
    const s = fromYMD(start);
    const e = fromYMD(end);

    // If picking only a start, accept.
    if (s && !e) return setSelectedDates({ start: s, end: null });

    if (s && e) {
      // Normalize to day-precision for overlap check.
      const s0 = startOfDay(s);
      const e0 = startOfDay(e);

      const overlaps = bookedIntervals.some(({ start: bs, end: be }) =>
        rangesOverlap(s0, addDays(e0, -1), bs, be) // selected nights: [start, end - 1]
      );

      if (overlaps) {
        alert("Those dates include already-booked nights. Please pick a different range.");
        // Keep the start, clear the end so the user can try again
        return setSelectedDates({ start: s0, end: null });
      }

      return setSelectedDates({ start: s0, end: e0 });
    }

    setSelectedDates({ start: null, end: null });
  };

  /* Final button gate */
  const handleBookNow = () => {
    const { start, end } = selectedDates || {};
    if (!start || !end) return alert("Please select valid dates.");

    // extra safety: re-check overlap before proceeding
    const overlaps = bookedIntervals.some(({ start: bs, end: be }) =>
      rangesOverlap(startOfDay(start), addDays(startOfDay(end), -1), bs, be)
    );
    if (overlaps) {
      alert("Selected dates overlap with an existing booking. Please adjust your dates.");
      return;
    }

    setTotalAmount(payment.total);
    setShowPayPal(true);
  };

  /* Helper for the datepicker's filterDate */
  const isDisabledDay = (date) =>
    bookedIntervals.some(({ start, end }) => dayBetweenInclusive(startOfDay(date), start, end));

  /* ==================== UI ==================== */
  const modalUI = (
    <div
      className={[
        "fixed inset-0 z-[2147483000] flex items-center justify-center p-0 sm:p-5",
        "bg-black/40",
        "bg-[radial-gradient(1000px_600px_at_20%_0%,rgba(59,130,246,0.15),transparent_70%),radial-gradient(900px_600px_at_80%_100%,rgba(99,102,241,0.15),transparent_70%)]",
        "backdrop-blur-md sm:backdrop-blur-lg supports-[backdrop-filter]:backdrop-blur-xl",
      ].join(" ")}
      onClick={(e) => { if (e.currentTarget === e.target) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-details-title"
      aria-describedby="home-details-desc"
    >
      <div
        className={[
          "relative w-full h-[100svh] sm:h-[90vh] sm:max-w-[1220px]",
          "grid grid-rows-[auto,1fr] md:grid-rows-1 md:grid-cols-2",
          "min-h-0 rounded-none sm:rounded-[28px] overflow-hidden",
          "bg-gradient-to-br from-blue-50/60 via-white/75 to-indigo-50/60",
          "border border-white/60 ring-1 ring-black/5",
          // layered soft 3D shadow
          "shadow-[0_12px_24px_rgba(2,6,23,.06),0_40px_80px_rgba(2,6,23,.10)]",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-[2147483646] inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/95 border border-white/70 shadow hover:shadow-md hover:bg-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          <X className="w-5 h-5 text-gray-700" />
        </button>

        {/* MOBILE photos */}
        <div className="md:hidden relative h-64 w-full bg-gray-950">
          {hasPhotos ? (
            <div className="group h-full w-full overflow-hidden">
              <img
                src={photos[currentPhoto]}
                alt={`listing-photo-${currentPhoto + 1}`}
                className="w-full h-full object-cover object-center transform-gpu transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
            </div>
          ) : (
            <div className="w-full h-full grid place-items-center text-white/80 p-6">No photos available</div>
          )}

          {hasPhotos && photos.length > 1 && (
            <>
              <button onClick={prevPhoto} aria-label="Previous photo" className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-gray-800 grid place-items-center shadow">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={nextPhoto} aria-label="Next photo" className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-gray-800 grid place-items-center shadow">
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {photos.map((_, i) => (
                  <button key={i} onClick={(e) => { e.stopPropagation(); setCurrentPhoto(i); }}
                    className={`h-2.5 w-2.5 rounded-full ${i === currentPhoto ? "bg-white" : "bg-white/60"}`} aria-label={`Go to photo ${i + 1}`} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* DESKTOP photos */}
        <div className="hidden md:block relative bg-gray-950">
          {!!(listing.discountType && numberOr(listing.discountValue) > 0) && (
            <div className="absolute left-4 top-4 z-10 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold shadow-lg ring-4 ring-white/20">
              {listing.discountType === "percentage"
                ? `${numberOr(listing.discountValue)}% off`
                : `₱${numberOr(listing.discountValue).toLocaleString()} off`}
            </div>
          )}
          {hasPhotos ? (
            <div className="group h-full w-full overflow-hidden">
              <img
                src={photos[currentPhoto]}
                alt={`listing-photo-${currentPhoto + 1}`}
                className="w-full h-full object-cover object-center transform-gpu transition-transform duration-700 ease-out group-hover:scale-[1.03]"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            </div>
          ) : (
            <div className="w-full h-full grid place-items-center text-white/80 p-6">No photos available</div>
          )}
          {hasPhotos && photos.length > 1 && (
            <>
              <button onClick={prevPhoto} aria-label="Previous photo" className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-gray-800 grid place-items-center shadow">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={nextPhoto} aria-label="Next photo" className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-gray-800 grid place-items-center shadow">
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {photos.map((_, i) => (
                  <button key={i} onClick={(e) => { e.stopPropagation(); setCurrentPhoto(i); }}
                    className={`h-2 w-2 rounded-full ${i === currentPhoto ? "bg-white" : "bg-white/60"}`} aria-label={`Go to photo ${i + 1}`} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* RIGHT column */}
        <RightPane
          listing={listing}
          host={host}
          adults={adults}
          children={children}
          infants={infants}
          setAdults={setAdults}
          setChildren={setChildren}
          setInfants={setInfants}
          selectedDates={selectedDates}
          includeCleaningFee={includeCleaningFee}
          setIncludeCleaningFee={setIncludeCleaningFee}
          payment={payment}
          handleDateChange={handleDateChange}
          handleBookNow={handleBookNow}
          showPayPal={showPayPal}
          setShowPayPal={setShowPayPal}
          totalAmount={totalAmount}
          setTotalAmount={setTotalAmount}
          onClose={onClose}
          setShowMessageModal={setShowMessageModal}
          bookedIntervals={bookedIntervals}
          setBookedIntervals={setBookedIntervals}
          filterDate={(date) => !isDisabledDay(date)}
        />
      </div>

      {/* Message Host */}
      {showMessageModal &&
        createPortal(
          <div className="fixed inset-0 z-[2147483646]">
            <MessageHostModal
              open
              onClose={() => setShowMessageModal(false)}
              host={host}
              hostId={host?.uid || listing?.uid || listing?.ownerId || listing?.hostId}
            />
          </div>,
          document.body
        )}
    </div>
  );

  return createPortal(modalUI, document.body);
}

/* ============================ Right pane ============================ */
function RightPane(props) {
  const {
    listing,
    host,
    adults,
    children,
    infants,
    setAdults,
    setChildren,
    setInfants,
    selectedDates,
    includeCleaningFee,
    setIncludeCleaningFee,
    payment,
    handleDateChange,
    handleBookNow,
    showPayPal,
    setShowPayPal,
    totalAmount,
    setTotalAmount,
    onClose,
    setShowMessageModal,
    bookedIntervals,
    setBookedIntervals,
    filterDate,
  } = props;

  const [showFullPolicy, setShowFullPolicy] = useState(false);

  const nAdultsCap = numberOr(listing?.guests?.adults, NaN);
  const nChildrenCap = numberOr(listing?.guests?.children, NaN);
  const nInfantsCap = numberOr(listing?.guests?.infants, NaN);

  const adultsCap = Number.isFinite(nAdultsCap) ? nAdultsCap : Infinity;
  const childrenCap = Number.isFinite(nChildrenCap) ? nChildrenCap : Infinity;
  const infantsCap = Number.isFinite(nInfantsCap) ? nInfantsCap : Infinity;

  const partsSum =
    numberOr(listing?.guests?.adults, 0) +
    numberOr(listing?.guests?.children, 0) +
    numberOr(listing?.guests?.infants, 0);

  const totalCapRaw =
    typeof listing?.guests === "object"
      ? numberOr(listing?.guests?.total, partsSum)
      : numberOr(listing?.guests, NaN);

  const totalCap =
    Number.isFinite(totalCapRaw) && totalCapRaw > 0
      ? totalCapRaw
      : numberOr(listing?.maxGuests, Infinity);

  const maxGuests =
    Number.isFinite(totalCap) && totalCap !== Infinity
      ? totalCap
      : numberOr(listing?.maxGuests, 1);

  const totalGuests = adults + children + infants;

  const policyText = String(listing?.cancellationPolicy ?? "").trim();

  return (
    <div className="relative h-full min-h-0 grid grid-rows-[1fr,auto] bg-gradient-to-br from-blue-50/40 via-white/70 to-indigo-50/40">
      <div className="min-h-0 overflow-y-auto overscroll-contain">
        <div className="max-w-[720px] mx-auto px-5 sm:px-6 md:px-7 py-5 sm:py-6 md:py-7 space-y-5 sm:space-y-6">
          {/* Title & Meta */}
          <section className="space-y-2.5">
            <h2 id="home-details-title" className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {listing.title || "Untitled"}
            </h2>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13.5px] sm:text-sm text-slate-700">
              {listing.listingType ? (
                <span className="inline-flex items-center rounded-full border border-white/60 bg-white/90 px-3 py-1 text-[12px] sm:text-xs font-semibold text-blue-700 shadow-sm ring-1 ring-black/5">
                  {listing.listingType}
                </span>
              ) : null}

              <span className="inline-flex items-center gap-1.5">
                <Home className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-slate-900">
                  {listing.propertyType || "N/A"}
                </span>
              </span>

              <span className="inline-flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-slate-900">
                  ₱{numberOr(listing.price).toLocaleString()}
                </span>
                <span className="text-slate-500">/ night</span>
              </span>
            </div>

            <p className="inline-flex items-center gap-2 text-sm sm:text-[15px] text-slate-700">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-slate-900">
                {listing.location || "Location not set"}
              </span>
            </p>
          </section>

          {/* Description */}
          <section className="space-y-2">
            <p id="home-details-desc" className="text-[15px] sm:text-base leading-relaxed text-slate-800">
              {listing.description || "No description provided."}
            </p>
            {!!listing.uniqueDescription && (
              <p className="text-[15px] sm:text-base leading-relaxed text-slate-800">
                {listing.uniqueDescription}
              </p>
            )}
          </section>

          {/* Cancellation Policy */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <h3 className="text-[13px] sm:text-sm font-semibold text-slate-900 tracking-wide">
                Cancellation Policy
              </h3>
            </div>

            <div className="rounded-[18px] bg-white/90 border border-white/70 p-4 shadow-sm ring-1 ring-black/5">
              {policyText ? (
                <>
                  <p
                    className={[
                      "text-[14px] sm:text-[15px] leading-relaxed text-slate-800 whitespace-pre-line transition-all",
                      showFullPolicy ? "" : "max-h-24 overflow-hidden",
                    ].join(" ")}
                  >
                    {policyText}
                  </p>

                  {policyText.length > 200 && (
                    <button
                      type="button"
                      onClick={() => setShowFullPolicy((v) => !v)}
                      className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      {showFullPolicy ? "Show less" : "Show more"}
                    </button>
                  )}

                  <div className="mt-3 flex items-start gap-2 text-[12.5px] sm:text-xs text-slate-600">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-[1px]" />
                    <span>By booking, you agree to this host’s cancellation terms.</span>
                  </div>
                </>
              ) : (
                <p className="text-[14px] sm:text-[15px] text-slate-600">
                  No cancellation policy provided by the host.
                </p>
              )}
            </div>
          </section>

          {/* Amenities */}
          <section>
            <h3 className="text-[13px] sm:text-sm font-semibold text-slate-900 tracking-wide">Amenities</h3>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {Array.isArray(listing.amenities) && listing.amenities.length ? (
                listing.amenities.map((a, i) => (
                  <span key={`${a}-${i}`} className="inline-flex items-center rounded-full border border-white/70 bg-white/90 px-3 py-1.5 text-[12.5px] sm:text-xs font-medium text-slate-900 shadow-sm ring-1 ring-black/5">
                    {a}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-600">N/A</span>
              )}
            </div>
          </section>

          {/* Rooms summary */}
          <section className="space-y-3">
            <h3 className="text-[13px] sm:text-sm font-semibold text-slate-900 tracking-wide">Space Overview</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Bedrooms", value: listing.bedrooms ?? "N/A" },
                { label: "Beds", value: listing.beds ?? "N/A" },
                { label: "Bathrooms", value: listing.bathrooms ?? "N/A" },
              ].map((r) => (
                <div key={r.label} className="rounded-[16px] bg-white/90 border border-white/70 p-4 shadow-sm ring-1 ring-black/5">
                  <p className="text-[12px] sm:text-xs text-slate-600">{r.label}</p>
                  <p className="mt-1 text-lg sm:text-xl font-semibold text-slate-900">{r.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Guests controls */}
          <section className="rounded-[18px] bg-white/90 border border-white/70 p-4 sm:p-5 shadow-sm ring-1 ring-black/5 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <p className="text-[13.5px] sm:text-sm font-semibold text-slate-900">Guests</p>
              <span className="ml-auto text-[12px] sm:text-xs text-slate-600">
                Total: {totalGuests} of {maxGuests || 1}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <RowCounter
                label="Adults (13+)"
                value={adults}
                min={1}
                onDec={() => setAdults((v) => clamp(v - 1, 1, 999))}
                onInc={() => {
                  const nextTotal = adults + children + infants + 1;
                  if (nextTotal <= maxGuests && (Number.isFinite(adultsCap) ? adults + 1 <= adultsCap : true)) setAdults((v) => v + 1);
                }}
              />
              <RowCounter
                label="Children (2–12)"
                value={children}
                min={0}
                onDec={() => setChildren((v) => clamp(v - 1, 0, 999))}
                onInc={() => {
                  const nextTotal = adults + children + infants + 1;
                  if (nextTotal <= maxGuests && (Number.isFinite(childrenCap) ? children + 1 <= childrenCap : true)) setChildren((v) => v + 1);
                }}
              />
              <RowCounter
                label="Infants (under 2)"
                value={infants}
                min={0}
                onDec={() => setInfants((v) => clamp(v - 1, 0, 999))}
                onInc={() => {
                  const nextTotal = adults + children + infants + 1;
                  if (nextTotal <= maxGuests && (Number.isFinite(infantsCap) ? infants + 1 <= infantsCap : true)) setInfants((v) => v + 1);
                }}
              />
            </div>
          </section>

          {/* Cleaning Fee toggle */}
          {!!numberOr(listing.cleaningFee) && (
            <section className="flex items-center justify-between rounded-[16px] bg-white/90 border border-white/70 p-3.5 sm:p-4 shadow-sm ring-1 ring-black/5">
              <p className="text-[13.5px] sm:text-sm font-semibold text-slate-900">
                Cleaning Fee: <span className="font-bold">₱{numberOr(listing.cleaningFee).toLocaleString()}</span>
              </p>
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={includeCleaningFee} onChange={(e) => setIncludeCleaningFee(e.target.checked)} className="peer sr-only" />
                <span className="w-11 h-6 rounded-full bg-slate-300 relative transition after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-5 after:h-5 after:bg-white after:rounded-full after:transition peer-checked:bg-blue-600 peer-checked:after:translate-x-5" />
                <span className="text-[13.5px] sm:text-sm text-slate-900">{includeCleaningFee ? "Included" : "Excluded"}</span>
              </label>
            </section>
          )}

          {/* Host */}
          {host && (
            <section className="rounded-[18px] bg-white/90 border border-white/70 p-4 sm:p-5 flex items-center gap-4 shadow-sm ring-1 ring-black/5">
              <HostAvatar host={host} />
              <div className="flex-1">
                <p className="text-[15px] sm:text-base font-semibold text-slate-900">
                  {([host.firstName, host.lastName].filter(Boolean).join(" ")) || host.displayName || host.email || "Host"}
                </p>
                <p className="text-[13px] sm:text-sm text-slate-600">Host of this listing</p>
              </div>
              <button onClick={() => setShowMessageModal(true)} className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-2 text-[13px] sm:text-sm font-semibold text-slate-900 hover:bg-white shadow-sm ring-1 ring-black/5 active:scale-[0.98] transition">
                <MessageSquareText className="w-4 h-4" /> Message Host
              </button>
            </section>
          )}

          {/* Dates */}
          <section className="space-y-3">
            <h3 className="text-[13px] sm:text-sm font-semibold text-slate-900 tracking-wide">Select Dates</h3>
            <div className="rounded-[18px] bg-white/90 border border-white/70 p-3.5 sm:p-4 shadow-sm ring-1 ring-black/5">
              <DateRangePickerInline
                value={{
                  start: selectedDates.start ? ymd(selectedDates.start) : "",
                  end: selectedDates.end ? ymd(selectedDates.end) : "",
                }}
                onChange={handleDateChange}
                minDate={new Date()}
                monthsShown={2}
                includeDateIntervals={
                  listing?.availability?.start && listing?.availability?.end
                    ? [{ start: new Date(listing.availability.start + "T00:00:00"), end: new Date(listing.availability.end + "T00:00:00") }]
                    : undefined
                }
                excludeDateIntervals={bookedIntervals}
                selectsDisabledDaysInRange={false}
                filterDate={filterDate}
              />
            </div>
          </section>

          {/* Payment */}
          {payment && (
            <section className="rounded-[18px] bg-white/95 border border-white/70 p-4 sm:p-5 shadow-lg ring-1 ring-black/5 space-y-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">Payment Breakdown</h3>

              <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                <span><span className="font-semibold">₱{payment.price.toLocaleString()}</span> × {payment.nights} night{payment.nights > 1 ? "s" : ""}</span>
                <span className="font-medium">₱{(payment.price * payment.nights).toLocaleString()}</span>
              </div>

              {payment.type === "percentage" && payment.dVal > 0 && (
                <div className="flex items-center justify-between text-[13.5px] sm:text-sm text-green-700">
                  <span>Discount ({payment.dVal}%)</span>
                  <span>− ₱{(payment.perNightDiscount * payment.nights).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
              )}

              {payment.type === "percentage" && (
                <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                  <span>Nightly after discount</span>
                  <span className="font-medium">₱{payment.nightlyAfter.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
              )}

              {!!numberOr(listing.cleaningFee) && (
                <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                  <span className={includeCleaningFee ? "" : "text-slate-400 line-through"}>Cleaning Fee</span>
                  <span className={includeCleaningFee ? "" : "text-slate-400 line-through"}>₱{numberOr(listing.cleaningFee).toLocaleString()}</span>
                </div>
              )}

              {payment.type === "fixed" && payment.dVal > 0 && (
                <div className="flex items-center justify-between text-[13.5px] sm:text-sm text-green-700">
                  <span>Discount (fixed)</span>
                  <span>− ₱{payment.fixedDiscount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                <span>Subtotal</span>
                <span className="font-medium">₱{payment.subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>

              <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                <span>Service fee (10%)</span>
                <span>₱{payment.serviceFee.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>

              <div className="my-2 h-px bg-slate-200/70" />

              <div className="flex items-center justify-between">
                <span className="text-base sm:text-lg font-bold text-slate-900">Total</span>
                <span className="text-base sm:text-lg font-bold text-blue-700">₱{payment.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>

              {!includeCleaningFee && !!numberOr(listing.cleaningFee) && (
                <p className="text-[12.5px] sm:text-xs text-slate-600">*Cleaning fee excluded from total</p>
              )}
            </section>
          )}
        </div>
      </div>

      {/* Footer / booking */}
      <FooterActions
        showPayPal={showPayPal}
        setShowPayPal={setShowPayPal}
        payment={payment}
        totalAmount={totalAmount}
        setTotalAmount={setTotalAmount}
        handleBookNow={handleBookNow}
        includeCleaningFee={includeCleaningFee}
        listing={listing}
        selectedDates={selectedDates}
        adults={adults}
        children={children}
        infants={infants}
        onClose={onClose}
        setBookedIntervals={setBookedIntervals}
      />
    </div>
  );
}

/* --- Host avatar --- */
function HostAvatar({ host }) {
  const [imgOk, setImgOk] = useState(true);
  const initial = (([host.firstName, host.lastName].filter(Boolean).join(" ")) || host.displayName || host.email || "H")[0].toUpperCase();

  return (
    <div className="relative w-12 h-12 rounded-full bg-white/90 border border-white/70 overflow-hidden shrink-0 grid place-items-center text-slate-900 font-semibold ring-1 ring-black/5 shadow-sm">
      {host.photoURL && imgOk ? (
        <img
          src={host.photoURL}
          alt="Host avatar"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          loading="lazy"
          onError={() => setImgOk(false)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

/* --- Footer / PayPal & booking flow --- */
function FooterActions({
  showPayPal,
  setShowPayPal,
  payment,
  totalAmount,
  setTotalAmount,
  handleBookNow,
  includeCleaningFee,
  listing,
  selectedDates,
  adults,
  children,
  infants,
  onClose,
  setBookedIntervals,
}) {
  return (
    <div
      className="w-full bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-t border-white/60 ring-1 ring-black/5 px-4 pt-4 pb-6 sm:pb-6"
      style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex flex-col sm:flex-row gap-3">
        {showPayPal ? (
          <div className="w-full sm:max-w-md mx-auto">
            <div className="w-full rounded-2xl border border-white/70 bg-white/95 p-3 shadow-sm ring-1 ring-black/5">
              <PayPalButtons
                style={{ layout: "vertical" }}
                createOrder={(data, actions) => {
                  const value = Number((payment?.total ?? totalAmount ?? 0).toFixed(2)).toFixed(2);
                  return actions.order.create({ purchase_units: [{ amount: { value } }] });
                }}
                onApprove={async (data, actions) => {
                  const details = await actions.order.capture();
                  const user = auth.currentUser;
                  if (!user) {
                    alert("Please log in to make a reservation.");
                    return;
                  }
                  try {
                    const nights = payment?.nights || 0;
                    if (!selectedDates.start || !selectedDates.end || nights <= 0) {
                      alert("Invalid dates selected.");
                      return;
                    }

                    // (Optional-but-recommended) final overlap check right before commit
                    const selStart = startOfDay(selectedDates.start);
                    const selEnd = addDays(startOfDay(selectedDates.end), -1); // nights
                    const overlaps = (prev => prev.some(({ start, end }) =>
                      rangesOverlap(selStart, selEnd, start, end)))([]); // placeholder if you re-fetch fresh intervals

                    const completed = details?.status === "COMPLETED";
                    const bookingStatus = completed ? "confirmed" : "pending";
                    const paymentStatus = completed ? "paid" : "pending";

                    const listingDocRef = listing?.id ? doc(database, "listings", listing.id) : null;

                    const bookingData = {
                      uid: user.uid,
                      guestEmail: user.email,
                      guestName: user.displayName || "",
                      checkIn: selectedDates.start,
                      checkOut: selectedDates.end,
                      nights,
                      adults,
                      children,
                      infants,
                      pricePerNight: numberOr(listing.price),
                      cleaningFee: includeCleaningFee ? numberOr(listing.cleaningFee) : 0,
                      discountType: listing.discountType || "none",
                      discountValue: numberOr(listing.discountValue),
                      totalPrice: payment?.total ?? totalAmount ?? 0,
                      listingTitle: listing.title || "Untitled",
                      listingCategory: listing.category || "Homes",
                      listingAddress: listing.location || "",
                      listingPhotos: Array.isArray(listing.photos) ? listing.photos : [],
                      hostId: listing.uid || listing.ownerId || listing.hostId || "",
                      listingId: listing?.id || null,
                      listingRef: listingDocRef || null,
                      listingRefPath: listingDocRef?.path || null,
                      status: bookingStatus,
                      paymentStatus,
                      createdAt: serverTimestamp(),
                      updatedAt: serverTimestamp(),
                      paypalOrderId: details?.id || null,
                    };

                    const bookingsRef = collection(database, "bookings");
                    await addDoc(bookingsRef, bookingData);

                    // Optimistically disable newly booked range
                    const s = startOfDay(bookingData.checkIn);
                    const e = addDays(startOfDay(bookingData.checkOut), -1);
                    if (s && e && e >= s) {
                      setBookedIntervals(prev => mergeIntervals([...prev, { start: s, end: e }]));
                    }

                    try {
                      await sendBookingConfirmationEmail({
                        user,
                        listing,
                        totalAmount: bookingData.totalPrice,
                        paymentStatus,
                      });
                    } catch (mailErr) {
                      console.error("EmailJS send failed:", mailErr);
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
              className="mt-3 w-full inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              disabled={!payment}
              onClick={handleBookNow}
              className="w-full sm:w-auto flex-1 min-w-[140px] inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-indigo-700 active:scale-[0.99] transition disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Book Now
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto flex-1 min-w-[140px] inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Small counter row */
function RowCounter({ label, value, min = 0, onInc, onDec }) {
  return (
    <div className="flex items-center justify-between rounded-[16px] bg-white/90 border border-white/70 px-3 py-2 shadow-sm ring-1 ring-black/5">
      <span className="text-sm font-semibold text-slate-900">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDec}
          disabled={value <= min}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 shadow active:scale-95 transition disabled:opacity-50 disabled:pointer-events-none"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-8 text-center font-semibold text-slate-900">{value}</span>
        <button
          type="button"
          onClick={onInc}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow active:scale-95 transition"
          aria-label={`Increase ${label}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
