// src/pages/BookingsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDoc,
  doc,
  updateDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getApp } from "firebase/app";
import { database, auth } from "../../config/firebase";

import Sidebar from "./components/sidebar.jsx";
import { useSidebar } from "../../context/SidebarContext";
import BookifyLogo from "../../components/bookify-logo.jsx";

import HostCategModal from "../../components/host-categ-modal.jsx";
import HostPoliciesModal from "./components/HostPoliciesModal.jsx";
import { MessageHostModal } from "../../components/message-host-modal.jsx";

import {
  Menu,
  Compass,
  MapPin,
  Calendar as CalIcon,
  CreditCard,
  BedDouble,
  Users,
  Clock,
  TicketPercent,
  Wrench,
  X,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Hash,
  Star,
  Home,
  MessageCircle,
} from "lucide-react";

/* ---------------- EmailJS config ---------------- */
import emailjs from "@emailjs/browser";

const EMAILJS = {
  SERVICE_ID: "service_7y9jqhs",
  TEMPLATE_ID: "template_6ak94mi",
  PUBLIC_KEY: "0QgVGXmPL9kGSq53X",
};

// Initialize once at module load (idempotent)
if (!emailjs.__BOOKIFY_INIT__) {
  try {
    emailjs.init(EMAILJS.PUBLIC_KEY); // ✅ pass string, not object
    emailjs.__BOOKIFY_INIT__ = true;
    console.info("[EmailJS] init OK");
  } catch (e) {
    console.error("[EmailJS] init failed:", e);
  }
}

/* ---------------- small utils ---------------- */
const fmtRange = (start, end) => {
  if (!start || !end) return "";
  const s = start?.toDate ? start.toDate() : new Date(start);
  const e = end?.toDate ? end.toDate() : new Date(end);

  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const optsM = { month: "short" };
  const optsD = { day: "numeric" };
  const sStr = `${s.toLocaleDateString(undefined, optsM)} ${s.toLocaleDateString(undefined, optsD)}`;
  const eStr = sameMonth
    ? e.toLocaleDateString(undefined, optsD)
    : `${e.toLocaleDateString(undefined, optsM)} ${e.toLocaleDateString(undefined, optsD)}`;
  const yStr = s.getFullYear() === e.getFullYear() ? s.getFullYear() : `${s.getFullYear()}–${e.getFullYear()}`;
  return `${sStr} – ${eStr}, ${yStr}`;
};

const extractListingIdFromPath = (path) => {
  if (!path) return null;
  const parts = String(path).split("/").filter(Boolean);
  const idx = parts.indexOf("listings");
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null;
};

const __listingCache = new Map();

const fallbackFromBooking = (b) => ({
  title: b?.listing?.title || b?.listingTitle || "Untitled",
  photos: Array.isArray(b?.listing?.photos) ? b.listing.photos : b?.listingPhotos || [],
  location: b?.listing?.location || b?.listingAddress || "",
  category: b?.listing?.category || b?.listingCategory || "Homes",
});

// ---------- Normalizers ----------
const pick = (...vals) => {
  for (const v of vals) {
    if (v == null) continue;
    if (typeof v === "string") {
      const t = v.trim();
      if (t) return t;
      continue;
    }
    if (v !== undefined) return v;
  }
  return undefined;
};

const normalizeCategory = (rawCat) => {
  const c = (rawCat || "").toString().toLowerCase();
  if (c.startsWith("home")) return "homes";
  if (c.startsWith("service")) return "services";
  if (c.startsWith("experience")) return "experiences";
  return c;
};

const numberOr = (v, d = 0) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : d;
};

const normalizeListing = (docData = {}, booking = {}) => {
  const cat = normalizeCategory(
    pick(docData.category, booking?.listing?.category, booking?.listingCategory, "homes")
  );

  const guestsTotal = pick(
    docData?.guests?.total,
    docData?.maxGuests,
    docData?.capacity,
    docData?.guestsTotal
  );

  const scheduleArr = Array.isArray(docData.schedule) ? docData.schedule : [];
  const schedule = scheduleArr
    .map((s) => ({
      date: pick(s.date, s.startDate, s.day),
      time: pick(s.time, s.startTime),
    }))
    .filter((s) => s.date || s.time);

  const amenities =
    pick(
      Array.isArray(docData.amenities) ? docData.amenities : undefined,
      Array.isArray(docData?.features?.amenities) ? docData.features.amenities : undefined,
      Array.isArray(docData.amenitiesList) ? docData.amenitiesList : undefined
    ) || [];

  const normalized = {
    id: docData.id,
    title: pick(docData.title, booking?.listingTitle),
    photos: pick(docData.photos, booking?.listingPhotos, []),
    location: pick(docData.location, docData.address?.formatted, booking?.listingAddress, ""),
    category: cat,
    description: pick(docData.description, docData.longDescription, docData.uniqueDescription),
    uniqueDescription: pick(docData.uniqueDescription),
    price: numberOr(pick(docData.price, docData.pricePerNight, docData.basePrice, docData?.pricing?.base), undefined),
    cleaningFee: numberOr(pick(docData.cleaningFee, docData?.fees?.cleaning, docData?.fees?.cleaningFee), undefined),
    discountType: pick(docData.discountType, docData?.discount?.type),
    discountValue: numberOr(pick(docData.discountValue, docData?.discount?.value), 0),
    uid: pick(docData.uid, docData.ownerId, docData.hostId),
    amenities,
    cancellationPolicy: pick(docData.cancellationPolicy, docData?.policy?.cancellation, docData.cancellation_policy),
  };

  if (cat === "homes") {
    Object.assign(normalized, {
      propertyType: pick(docData.propertyType, docData?.home?.propertyType, docData?.details?.propertyType),
      bedrooms: numberOr(pick(docData.bedrooms, docData?.rooms?.bedrooms), undefined),
      beds: numberOr(pick(docData.beds, docData?.rooms?.beds), undefined),
      bathrooms: numberOr(pick(docData.bathrooms, docData?.rooms?.bathrooms), undefined),
      guests: {
        total: numberOr(guestsTotal, undefined),
        adults: numberOr(pick(docData?.guests?.adults), undefined),
        children: numberOr(pick(docData?.guests?.children), undefined),
        infants: numberOr(pick(docData?.guests?.infants), undefined),
      },
      maxGuests: numberOr(pick(docData.maxGuests, docData.capacity), undefined),
      availability: {
        start: pick(docData?.availability?.start, docData.availabilityStart),
        end: pick(docData?.availability?.end, docData.availabilityEnd),
      },
    });
  } else if (cat === "services") {
    Object.assign(normalized, {
      serviceType: pick(docData.serviceType, docData.type),
      pricingType: pick(docData.pricingType, docData?.pricing?.type),
      recurrence: pick(docData.recurrence, docData?.schedule?.recurrence),
      duration: pick(docData.duration, docData?.service?.duration),
      providerName: pick(docData.providerName, docData?.provider?.name),
      languages: Array.isArray(docData.languages) ? docData.languages : [],
      schedule,
      address: pick(docData.address, docData?.location?.address, docData?.addressLine),
    });
  } else if (cat === "experiences") {
    Object.assign(normalized, {
      experienceType: pick(docData.experienceType, docData.type),
      duration: pick(docData.duration),
      languages: Array.isArray(docData.languages) ? docData.languages : [],
      schedule,
      hostRequirements: pick(docData.hostRequirements, docData.requirements),
      ageRestriction: docData.ageRestriction,
    });
  }

  return normalized;
};

const hydrateListingForBooking = async (booking) => {
  const fallback = fallbackFromBooking(booking);
  const id = booking?.listingId || extractListingIdFromPath(booking?.listingRefPath);
  if (!id) return fallback;

  if (__listingCache.has(id)) {
    const cached = __listingCache.get(id);
    return { ...fallback, ...cached };
  }
  try {
    const snap = await getDoc(doc(database, "listings", id));
    if (snap.exists()) {
      const raw = { id: snap.id, ...snap.data() };
      const normalized = normalizeListing(raw, booking);
      __listingCache.set(id, normalized);
      return { ...fallback, ...normalized };
    }
  } catch (e) {
    console.error("hydrateListingForBooking error:", e);
  }
  return fallback;
};

const peso = (n) =>
  typeof n === "number"
    ? n.toLocaleString(undefined, { style: "currency", currency: "PHP", maximumFractionDigits: 0 })
    : "₱—";

const statusBadge = (status = "pending") => {
  const s = (status || "").toLowerCase();
  if (s === "confirmed" || s === "approved")
    return { text: "Confirmed", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  if (s === "canceled" || s === "cancelled")
    return { text: "Canceled", cls: "bg-rose-100 text-rose-700 border-rose-200" };
  if (s === "completed")
    return { text: "Completed", cls: "bg-slate-100 text-slate-700 border-slate-200" };
  return { text: "Pending", cls: "bg-amber-100 text-amber-800 border-amber-200" };
};

const payBadge = (ps = "unpaid") => {
  const s = (ps || "").toLowerCase();
  if (s === "paid") return { text: "Paid", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (s === "refunded") return { text: "Refunded", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" };
  return { text: "Unpaid", cls: "bg-amber-50 text-amber-700 border-amber-200" };
};

const fmtDateStr = (isoLike) => {
  try {
    const d = new Date(`${isoLike}T00:00:00`);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoLike;
  }
};

const fmtTimeStr = (hhmm) => {
  try {
    const [h, m] = (hhmm || "").split(":").map(Number);
    if (Number.isNaN(h)) return hhmm;
    const d = new Date();
    d.setHours(h ?? 0, m ?? 0, 0, 0);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return hhmm;
  }
};

const daysBetween = (a, b) => {
  if (!a || !b) return 0;
  const s = a?.toDate ? a.toDate() : new Date(a);
  const e = b?.toDate ? b.toDate() : new Date(b);
  const ms = 1000 * 60 * 60 * 24;
  const sNoon = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 12);
  const eNoon = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 12);
  return Math.max(0, Math.ceil((eNoon - sNoon) / ms));
};

/* Determine if a booking is cancelable (upcoming + not already canceled/completed) */
const isCancelable = (b) => {
  const s = (b.status || "").toLowerCase();
  if (s === "canceled" || s === "cancelled" || s === "completed") return false;

  const cat = normalizeCategory(b.listing?.category || b.listingCategory || "");
  const now = new Date();

  if (cat.startsWith("home")) {
    const ci = b.checkIn?.toDate?.() ?? null;
    return !ci || ci > now;
  }

  if (b?.schedule?.date) {
    const dt = new Date(`${b.schedule.date}T${b.schedule.time || "00:00"}`);
    return dt > now;
  }

  return true;
};

/* ---------------- NEW: review helpers ---------------- */
const getListingId = (b) =>
  b?.listingId ||
  extractListingIdFromPath(b?.listingRefPath) ||
  b?.listing?.id ||
  null;

const isPastBooking = (b) => {
  const now = new Date();
  const cat = normalizeCategory(b?.listing?.category || b?.listingCategory || "");
  const status = (b?.status || "").toLowerCase();
  if (status === "completed") return true;

  if (cat.startsWith("home")) {
    const co = b?.checkOut?.toDate?.() ?? null;
    return co ? co < now : false;
  }

  if (b?.schedule?.date) {
    const dt = new Date(`${b.schedule.date}T${b.schedule.time || "00:00"}`);
    return dt < now;
  }

  return false;
};

const canReview = (b) => {
  const s = (b?.status || "").toLowerCase();
  return isPastBooking(b) && s !== "canceled" && s !== "cancelled";
};

/* ---------- NEW: day helpers for Today/Upcoming bucketing ---------- */
const startOfDay = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const isSameDay = (a, b) => {
  if (!a || !b) return false;
  const ad = a?.toDate ? a.toDate() : new Date(a);
  const bd = b?.toDate ? b.toDate() : new Date(b);
  return (
    ad.getFullYear() === bd.getFullYear() &&
    ad.getMonth() === bd.getMonth() &&
    ad.getDate() === bd.getDate()
  );
};

/* ---------------- skeletons ---------------- */
const CardSkeleton = () => (
  <div className="rounded-3xl bg-white/80 border border-white/50 shadow-[0_10px_30px_rgba(2,6,23,0.08)] overflow-hidden animate-pulse">
    <div className="h-40 bg-slate-200/80" />
    <div className="p-5 space-y-3">
      <div className="h-5 bg-slate-200 rounded w-2/3" />
      <div className="h-4 bg-slate-200/90 rounded w-1/2" />
      <div className="h-4 bg-slate-200/90 rounded w-3/4" />
      <div className="flex gap-2 pt-2">
        <div className="h-6 bg-slate-200/90 rounded w-20" />
        <div className="h-6 bg-slate-200/90 rounded w-16" />
      </div>
    </div>
  </div>
);

/* ---------------- shared card shell (tweaked for consistent footers) ---------------- */
const CardShell = ({ cover, chip, children, onClick }) => (
  <div
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={(e) => {
      if (!onClick) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    }}
    className="
      group rounded-3xl overflow-hidden cursor-pointer
      bg-gradient-to-b from-white to-slate-50
      border border-slate-200/70
      shadow-[0_15px_40px_rgba(2,6,23,0.08)]
      hover:shadow-[0_30px_80px_rgba(2,6,23,0.15)]
      transition-all duration-300
      flex flex-col h-full
    "
  >
    <div className="relative h-40">
      <img
        src={
          cover ||
          'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=1200&auto=format&fit=crop'
        }
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-black/5 to-transparent mix-blend-overlay" />
      {chip && (
        <span className="absolute top-3 left-3 text-xs px-2 py-1 rounded-full bg-black/65 text-white shadow">
          {chip}
        </span>
      )}
    </div>
    {/* content */}
    <div className="p-5 flex-1 min-h-[1px]">{children}</div>
  </div>
);

/* ---------------- rating UI ---------------- */
function StarRating({ value = 0, onChange, readOnly = false, size = 20, id }) {
  const [hover, setHover] = useState(0);
  const current = hover || value;

  const StarBtn = ({ i }) => {
    const active = i <= current;
    return (
      <button
        type="button"
        aria-label={`${i} ${i === 1 ? "star" : "stars"}`}
        disabled={readOnly}
        onMouseEnter={() => !readOnly && setHover(i)}
        onMouseLeave={() => !readOnly && setHover(0)}
        onClick={() => !readOnly && onChange?.(i)}
        className={`p-0.5 ${readOnly ? "cursor-default" : "cursor-pointer"} focus:outline-none`}
      >
        <Star
          width={size}
          height={size}
          className={active ? "text-amber-500" : "text-slate-300"}
          stroke="currentColor"
          fill={active ? "currentColor" : "none"}
        />
      </button>
    );
  };

  return (
    <div role={readOnly ? "img" : "radiogroup"} aria-label={id ? `${id}-rating` : "rating"} className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <StarBtn key={i} i={i} />
      ))}
    </div>
  );
}

function ReviewBadge({ rating, label }) {
  if (!rating) return null;
  return (
    <div className="inline-flex items-center gap-1.5">
      <StarRating value={rating} readOnly size={16} />
      <span className="text-xs text-slate-600">{label || `${rating}/5`}</span>
    </div>
  );
}

/* ---------------- Toast ---------------- */
function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => onClose?.(), 2800);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;
  return createPortal(
    <div className="fixed inset-x-0 bottom-4 z-[2147483600] grid place-items-center px-4">
      <div
        className={`rounded-xl px-4 py-2 shadow-lg border ${
          toast.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : toast.type === "error"
            ? "bg-rose-50 border-rose-200 text-rose-800"
            : "bg-white border-slate-200 text-slate-800"
        }`}
      >
        <span className="text-sm">{toast.text}</span>
      </div>
    </div>,
    document.body
  );
}

/* ---------------- NEW: Result Modal (used for success) ---------------- */
const ResultModal = ({ open, title, message, onClose, primaryLabel = "OK" }) => {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full sm:w-[520px]">
        <div className="mx-3 sm:mx-0 rounded-2xl bg-white border border-slate-200 shadow-xl p-6">
          <div className="flex items-start gap-3">
            <div className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-emerald-600 text-white shadow">
              ✓
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
              {message && <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{message}</p>}
            </div>
          </div>
          <div className="mt-6 flex items-center justify-end">
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl px-4 h-10 text-sm font-semibold bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow hover:from-blue-500 hover:to-blue-700"
            >
              {primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ---------------- NEW: Review Modal ---------------- */
const ReviewModal = ({ open, booking, existingReview, onClose, onSubmit, submitting }) => {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [text, setText] = useState(existingReview?.text || "");

  useEffect(() => {
    if (!open) return;
    setRating(existingReview?.rating || 0);
    setText(existingReview?.text || "");
  }, [open, existingReview?.rating, existingReview?.text]);

  if (!open || !booking) return null;

  const title = booking?.listing?.title || booking?.listingTitle || "This booking";
  const valid = rating > 0 && text.trim().length >= 10;

  return createPortal(
    <div className="fixed inset-0 z-[2147483200] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full sm:w-[560px]">
        <div className="mx-3 sm:mx-0 rounded-2xl bg-gradient-to-b from-white to-slate-50 border border-slate-200/70 shadow-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Rate & review</h3>
              <p className="text-sm text-slate-600 mt-1">How was <span className="font-medium">{title}</span>?</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-700">Your rating:</span>
              <StarRating value={rating} onChange={setRating} />
              {!!rating && <span className="text-xs text-slate-500">{rating}/5</span>}
            </div>

            <div>
              <textarea
                rows={5}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Share details that would help other guests (min 10 chars)…"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              />
              <div className="mt-1 text-xs text-slate-500 text-right">{text.trim().length} / 1000</div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 shadow hover:bg-slate-50 transition"
              disabled={submitting}
            >
              Cancel Booking
            </button>
            <button
              onClick={() => onSubmit?.({ rating, text })}
              disabled={!valid || submitting}
              className="h-10 px-4 rounded-xl text-white bg-gradient-to-b from-blue-600 to-blue-800 shadow hover:from-blue-500 hover:to-blue-700 transition disabled:opacity-60"
            >
              {submitting ? "Saving…" : existingReview ? "Update review" : "Publish review"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ----------- Local button styles for cards (consistent & prominent) ----------- */
const btn = {
  base: "inline-flex items-center justify-center rounded-xl px-4 h-10 text-sm font-semibold transition active:translate-y-[1px] focus:outline-none focus-visible:ring-2",
  primary:
    "text-white bg-gradient-to-b from-blue-600 to-blue-700 shadow-[0_8px_20px_rgba(37,99,235,0.35)] hover:from-blue-500 hover:to-blue-700 focus-visible:ring-blue-400/60",
  danger:
    "text-white bg-gradient-to-b from-rose-600 to-rose-700 shadow-[0_8px_20px_rgba(225,29,72,0.35)] hover:from-rose-500 hover:to-rose-700 focus-visible:ring-rose-400/60",
  outline:
    "text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 shadow focus-visible:ring-slate-300/60",
};

/* ----------- Card footers: identical structure in all cards ----------- */
const CardFooter = ({ total, onCancel, onView, showCancel }) => (
  <div className="mt-6">
    <div className="flex items-center justify-between">
      <div className="text-sm text-slate-600">Total</div>
      <div className="text-lg font-bold text-blue-600">{total}</div>
    </div>

    <div className="mt-4 flex items-center gap-2">
      {/* left spacer ensures two buttons align to the right across cards */}
      <div className="flex-1" />
      {showCancel && (
        <button
          onClick={(e) => { e.stopPropagation(); onCancel?.(); }}
          className={`${btn.base} ${btn.danger}`}
        >
          Cancel Booking
        </button>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onView?.(); }}
        className={`${btn.base} ${btn.outline}`}
      >
        View Details
      </button>
    </div>
  </div>
);

/* ---------------- category cards ---------------- */
const HomesCard = ({ b, onRequestCancel, onRequestDetails, onRequestReview, review, showTodayActions = false }) => {
  const title = b.listing?.title || b.listingTitle || "Untitled listing";
  const loc = b.listing?.location || b.listingAddress || "";
  const dates = fmtRange(b.checkIn, b.checkOut);
  const nights = typeof b.nights === "number" ? b.nights : undefined;
  const guests = (b.adults || 0) + (b.children || 0) + (b.infants || 0);
  const sBadge = statusBadge(b.status);
  const pBadge = payBadge(b.paymentStatus);

  return (
    <CardShell cover={b.listing?.photos?.[0] || b.listingPhotos?.[0]} chip="Homes" onClick={() => onRequestDetails(b)}>
      <h3 className="text-lg font-semibold text-slate-900 line-clamp-1">{title}</h3>

      {loc && (
        <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
          <MapPin size={16} />
          <span className="line-clamp-1">{loc}</span>
        </div>
      )}

      {dates && (
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-700">
          <CalIcon size={16} />
          <span>{dates}</span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-700">
        {typeof nights === "number" && (
          <span className="inline-flex items-center gap-1">
            <BedDouble size={16} />
            {nights} night{nights === 1 ? "" : "s"}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Users size={16} />
          {guests} guest{guests === 1 ? "" : "s"}
        </span>
        {typeof b.cleaningFee === "number" && (
          <span className="inline-flex items-center gap-1">
            <Wrench size={16} />
            Cleaning {peso(b.cleaningFee)}
          </span>
        )}
        {b.discountType && b.discountType !== "none" && typeof b.discountValue === "number" && (
          <span className="inline-flex items-center gap-1">
            <TicketPercent size={16} />
            {b.discountType === "percentage" ? `${b.discountValue}% off` : `₱${b.discountValue} off`}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${sBadge.cls}`}>
          {sBadge.text}
        </span>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${pBadge.cls}`}>
          <CreditCard size={14} className="mr-1 opacity-80" />
          {pBadge.text}
        </span>
      </div>

      {/* ACTIONS: Today -> show Cancel; otherwise keep Rate & review (only for past) */}
      {showTodayActions ? (
        <div className="mt-4 flex items-center justify-end">
          {isCancelable(b) && (
            <button
              onClick={(e) => { e.stopPropagation(); onRequestCancel?.(b); }}
              className={`${btn.base} ${btn.danger}`}
            >
              Cancel Booking
            </button>
          )}
        </div>
      ) : (
        canReview(b) && (
          <div className="mt-4 flex items-center justify-between">
            <div>
              {review?.rating ? (
                <ReviewBadge rating={review.rating} label="You rated this" />
              ) : (
                <span className="text-sm text-slate-600">How was your booking?</span>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onRequestReview?.(b); }}
              className={`${btn.base} ${btn.primary}`}
            >
              {review?.rating ? "Edit review" : "Rate & review"}
            </button>
          </div>
        )
      )}

      {/* spacer + consistent footer */}
      <CardFooter
        total={peso(b.totalPrice)}
        showCancel={isCancelable(b)}
        onCancel={() => onRequestCancel(b)}
        onView={() => onRequestDetails(b)}
      />
    </CardShell>
  );
};

const ExperienceCard = ({ b, onRequestCancel, onRequestDetails, onRequestReview, review, showTodayActions = false }) => {
  const title = b.listing?.title || b.listingTitle || "Untitled experience";
  const cover = b.listing?.photos?.[0] || b.listingPhotos?.[0];
  const sBadge = statusBadge(b.status);
  const pBadge = payBadge(b.paymentStatus);

  const dateStr = b?.schedule?.date ? fmtDateStr(b.schedule.date) : "";
  const timeStr = b?.schedule?.time ? fmtTimeStr(b.schedule.time) : "";
  const type = b.experienceType ? b.experienceType[0].toUpperCase() + b.experienceType.slice(1) : null;

  return (
    <CardShell cover={cover} chip="Experiences" onClick={() => onRequestDetails(b)}>
      <h3 className="text-lg font-semibold text-slate-900 line-clamp-1">{title}</h3>

      <div className="mt-2 flex items-center gap-2 text-sm text-slate-700">
        <CalIcon size={16} />
        <span>{[dateStr, timeStr].filter(Boolean).join(" • ")}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-700">
        {b.duration && (
          <span className="inline-flex items-center gap-1">
            <Clock size={16} />
            {b.duration}
          </span>
        )}
        {type && (
          <span className="inline-flex items-center gap-1">
            <Users size={16} />
            {type}
          </span>
        )}
        {typeof b.quantity === "number" && (
          <span className="inline-flex items-center gap-1">
            <Users size={16} />
            Qty {b.quantity}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${sBadge.cls}`}>
          {sBadge.text}
        </span>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${pBadge.cls}`}>
          <CreditCard size={14} className="mr-1 opacity-80" />
          {pBadge.text}
        </span>
      </div>

      {showTodayActions ? (
        <div className="mt-4 flex items-center justify-end">
          {isCancelable(b) && (
            <button
              onClick={(e) => { e.stopPropagation(); onRequestCancel?.(b); }}
              className={`${btn.base} ${btn.danger}`}
            >
              Cancel Booking
            </button>
          )}
        </div>
      ) : (
        canReview(b) && (
          <div className="mt-4 flex items-center justify-between">
            <div>
              {review?.rating ? (
                <ReviewBadge rating={review.rating} label="You rated this" />
              ) : (
                <span className="text-sm text-slate-600">How was your booking?</span>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onRequestReview?.(b); }}
              className={`${btn.base} ${btn.primary}`}
            >
              {review?.rating ? "Edit review" : "Rate & review"}
            </button>
          </div>
        )
      )}

      <CardFooter
        total={peso(b.totalPrice)}
        showCancel={isCancelable(b)}
        onCancel={() => onRequestCancel(b)}
        onView={() => onRequestDetails(b)}
      />
    </CardShell>
  );
};

const ServiceCard = ({ b, onRequestCancel, onRequestDetails, onRequestReview, review, showTodayActions = false }) => {
  const title = b.listing?.title || b.listingTitle || "Untitled service";
  const cover = b.listing?.photos?.[0] || b.listingPhotos?.[0];
  const sBadge = statusBadge(b.status);
  const pBadge = payBadge(b.paymentStatus);

  const dateStr = b?.schedule?.date ? fmtDateStr(b.schedule.date) : "";
  const timeStr = b?.schedule?.time ? fmtTimeStr(b.schedule.time) : "";

  return (
    <CardShell cover={cover} chip="Services" onClick={() => onRequestDetails(b)}>
      <h3 className="text-lg font-semibold text-slate-900 line-clamp-1">{title}</h3>

      <div className="mt-2 flex items-center gap-2 text-sm text-slate-700">
        <CalIcon size={16} />
        <span>{[dateStr, timeStr].filter(Boolean).join(" • ")}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-700">
        {typeof b.quantity === "number" && (
          <span className="inline-flex items-center gap-1">
            <Users size={16} />
            Qty {b.quantity}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${sBadge.cls}`}>
          {sBadge.text}
        </span>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${pBadge.cls}`}>
          <CreditCard size={14} className="mr-1 opacity-80" />
          {pBadge.text}
        </span>
      </div>

      {showTodayActions ? (
        <div className="mt-4 flex items-center justify-end">
          {isCancelable(b) && (
            <button
              onClick={(e) => { e.stopPropagation(); onRequestCancel?.(b); }}
              className={`${btn.base} ${btn.danger}`}
            >
              Cancel Booking
            </button>
          )}
        </div>
      ) : (
        canReview(b) && (
          <div className="mt-4 flex items-center justify-between">
            <div>
              {review?.rating ? (
                <ReviewBadge rating={review.rating} label="You rated this" />
              ) : (
                <span className="text-sm text-slate-600">How was your booking?</span>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onRequestReview?.(b); }}
              className={`${btn.base} ${btn.primary}`}
            >
              {review?.rating ? "Edit review" : "Rate & review"}
            </button>
          </div>
        )
      )}

      <CardFooter
        total={peso(b.totalPrice)}
        showCancel={isCancelable(b)}
        onCancel={() => onRequestCancel(b)}
        onView={() => onRequestDetails(b)}
      />
    </CardShell>
  );
};

/* ---------------- Cancel Flow Modals ---------------- */
const CancelReasonModal = ({ open, onClose, onNext }) => {
  const [selected, setSelected] = useState("");
  const [other, setOther] = useState("");

  useEffect(() => {
    if (!open) {
      setSelected("");
      setOther("");
    }
  }, [open]);

  if (!open) return null;

  const reasons = [
    "Change of plans",
    "Dates no longer work",
    "Illness or emergency",
    "Found a better option",
    "Booked by mistake",
    "Other",
  ];

  const canContinue =
    selected && (selected !== "Other" || (selected === "Other" && other.trim().length >= 4));

  const submit = () => {
    const reasonText = selected === "Other" ? other.trim() : selected;
    if (!canContinue) return;
    onNext(reasonText);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full sm:w-[560px]">
        <div className="mx-3 sm:mx-0 rounded-2xl bg-gradient-to-b from-white to-slate-50 border border-slate-200/70 shadow-[0_10px_30px_rgba(2,6,23,0.12),inset_0_1px_0_rgba(255,255,255,0.6)] p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-slate-900">Cancel booking</h3>
              <p className="text-sm text-slate-600 mt-1">Please tell us why you’re canceling.</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {reasons.map((r) => (
              <label
                key={r}
                className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition
                ${selected === r ? "border-blue-300 bg-blue-50/60" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <input
                  type="radio"
                  name="cancel-reason"
                  value={r}
                  checked={selected === r}
                  onChange={() => setSelected(r)}
                  className="accent-blue-600"
                />
                <span className="text-sm text-slate-800">{r}</span>
              </label>
            ))}

            {selected === "Other" && (
              <div className="mt-2">
                <textarea
                  rows={3}
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                  placeholder="Briefly describe your reason…"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                />
                <p className="text-xs text-slate-500 mt-1">Minimum 4 characters.</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className={`${btn.base} ${btn.outline}`}
            >
              Back
            </button>
            <button
              onClick={submit}
              disabled={!canContinue}
              className={`${btn.base} ${btn.primary} disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CancelConfirmModal = ({
  open,
  onBack,
  onConfirm,
  listingTitle,
  policyText,
  submitting,
}) => {
  if (!open) return null;

  const title = listingTitle || "this booking";
  const policy = policyText?.trim() || "No specific cancellation policy was provided by the host.";

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onBack} />
      <div className="relative z-10 w-full sm:w-[560px]">
        <div className="mx-3 sm:mx-0 rounded-2xl bg-gradient-to-b from-white to-slate-50 border border-slate-200/70 shadow-[0_10px_30px_rgba(2,6,23,0.12),inset_0_1px_0_rgba(255,255,255,0.6)] p-6">
          <div className="flex items-start gap-3">
            <div className="shrink-0 grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-b from-rose-600 to-rose-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_20px_rgba(225,29,72,0.35)] ring-1 ring-white/10">
              <AlertTriangle size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold tracking-tight text-slate-900">
                Cancel {title}?
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Before you proceed, review the host’s cancellation policy:
              </p>
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 max-h-44 overflow-auto text-sm text-slate-800">
                {policy}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                By confirming, you agree to any applicable fees or refund rules described above.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              onClick={onBack}
              className={`${btn.base} ${btn.outline}`}
              disabled={submitting}
            >
              Back
            </button>
            <button
              onClick={onConfirm}
              disabled={submitting}
              className={`${btn.base} ${btn.danger} disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {submitting ? "Cancelling…" : "Cancel booking"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* --- Host avatar --- */
function HostAvatar({ host }) {
  const [imgOk, setImgOk] = useState(true);
  const initial = (([host.firstName, host.lastName].filter(Boolean).join(" ")) || host.displayName || host.email || "H")[0].toUpperCase();

  return (
    <div className="relative w-12 h-12 rounded-full bg-white/70 border border-white/60 overflow-hidden shrink-0 grid place-items-center text-gray-900 font-semibold ring-4 ring-white/60">
      {host.photoURL && imgOk ? (
        <img
          src={host.photoURL}
          alt="Host avatar"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setImgOk(false)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

/* ---------------- Booking Details Modal ---------------- */
const BookingDetailsModal = ({ open, booking, onClose, onRequestCancel, myReview, onRequestReview }) => {
  const [listing, setListing] = useState(null);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [host, setHost] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevPR = document.body.style.paddingRight;
    const sw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (sw > 0) document.body.style.paddingRight = `${sw}px`;
    return () => {
      document.body.style.overflow = prevOverflow || "";
      document.body.style.paddingRight = prevPR || "";
    };
  }, [open]);

  useEffect(() => {
    if (!open || !booking) return;
    let alive = true;
    (async () => {
      const fresh = await hydrateListingForBooking(booking);
      if (!alive) return;
      setListing(fresh);
      setCurrentPhoto(0);
    })();
    return () => {
      alive = false;
    };
  }, [open, booking?.id]);

  useEffect(() => {
    if (!listing) return;
    let cancelled = false;

    const _pick = (...vals) => pick(...vals);

    const normalizeHost = (docSnap, fallbackUid) => {
      const d = docSnap.data() || {};
      const first = _pick(d.firstName, d.givenName, d.first_name);
      const last = _pick(d.lastName, d.familyName, d.last_name);
      const nameFromParts = _pick([first, last].filter(Boolean).join(" "));
      const displayName = _pick(d.displayName, d.name, nameFromParts);
      const photoURL = _pick(d.photoURL, d.photoUrl, d.avatarURL, d.photo, d.avatar, d.profileImageUrl);
      return {
        id: docSnap.id,
        uid: _pick(d.uid, fallbackUid),
        email: _pick(d.email),
        firstName: first,
        lastName: last,
        displayName,
        photoURL,
      };
    };

    (async () => {
      try {
        const uid = listing?.uid || listing?.ownerId || listing?.hostId;
        if (!uid) { if (!cancelled) setHost(null); return; }
        try {
          const h1 = await getDoc(doc(database, "hosts", uid));
          if (h1.exists()) { if (!cancelled) setHost(normalizeHost(h1, uid)); return; }
        } catch {}
        try {
          const u1 = await getDoc(doc(database, "users", uid));
          if (u1.exists()) { if (!cancelled) setHost(normalizeHost(u1, uid)); return; }
        } catch {}
        if (!cancelled) setHost(null);
      } catch (e) {
        if (!cancelled) setHost(null);
      }
    })();

    return () => { cancelled = true; };
  }, [listing]);

  if (!open || !booking) {
    // Still render message modal even if booking modal is closed (for smooth transitions)
    if (showMessageModal && host) {
      return createPortal(
        <MessageHostModal
          open={showMessageModal}
          onClose={() => setShowMessageModal(false)}
          host={host}
          hostId={host?.uid || listing?.uid || listing?.ownerId || listing?.hostId}
        />,
        document.body
      );
    }
    return null;
  }

  const cat = normalizeCategory(listing?.category || booking?.listingCategory || "");
  const title = listing?.title || booking?.listingTitle || "Untitled";
  const location = listing?.location || booking?.listingAddress || "—";
  const photos = Array.isArray(listing?.photos) ? listing.photos : booking?.listingPhotos || [];
  const hasPhotos = photos.length > 0;

  const nextPhoto = (e) => { e?.stopPropagation(); if (!hasPhotos) return; setCurrentPhoto((p) => (p + 1) % photos.length); };
  const prevPhoto = (e) => { e?.stopPropagation(); if (!hasPhotos) return; setCurrentPhoto((p) => (p - 1 + photos.length) % photos.length); };

  const nights = typeof booking.nights === "number" ? booking.nights : daysBetween(booking.checkIn, booking.checkOut);
  const guests = (booking.adults || 0) + (booking.children || 0) + (booking.infants || 0);
  const sBadge = statusBadge(booking.status);
  const pBadge = payBadge(booking.paymentStatus);

  const createdAt =
    booking?.createdAt?.toDate?.() ? booking.createdAt.toDate() :
    (booking?.createdAt instanceof Date ? booking.createdAt : null);

  const scheduleStr = booking?.schedule?.date
    ? `${fmtDateStr(booking.schedule.date)}${booking?.schedule?.time ? " • " + fmtTimeStr(booking.schedule.time) : ""}`
    : "—";

  // Payment breakdown fields
  const basePrice = numberOr(booking.basePrice, NaN);
  const priceBeforeDiscount = numberOr(booking.priceBeforeDiscount || booking.rawSubtotal, NaN);
  const subtotal = numberOr(booking.subtotal, NaN);
  const serviceFee = numberOr(booking.serviceFee, NaN);
  const cleaningFee = numberOr(booking.cleaningFee, NaN);
  const discountType = booking.discountType || "none";
  const discountValue = numberOr(booking.discountValue, 0);
  const discountAmount = numberOr(booking.discountAmount, 0);
  const promoDiscountAmount = numberOr(booking.promoDiscountAmount, 0);
  const couponDiscountAmount = numberOr(booking.couponDiscountAmount, 0);
  const rewardDiscountAmount = numberOr(booking.rewardDiscountAmount, 0);
  const promoTitle = booking.promoTitle || null;
  const couponCode = booking.couponCode || null;
  const totalPrice = numberOr(booking.totalPrice, NaN);

  const policyText = listing?.cancellationPolicy || "";

  // Removed unused components: chips, Field, PillList, FullDetails
  // Only booking-specific information is displayed in the modal

  const leftCol = (
    <>
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
          <div className="w-full h-full grid place-items-center text-white/80 p-6">No photos available</div>
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
                  onClick={(e) => { e.stopPropagation(); setCurrentPhoto(i); }}
                  className={`h-2 w-2 rounded-full ${i === currentPhoto ? "bg-white" : "bg-white/60"}`}
                  aria-label={`Go to photo ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="md:hidden relative h-64 w-full bg-gray-900/90">
        {hasPhotos ? (
          <>
            <img src={photos[currentPhoto]} alt={`${title} - photo ${currentPhoto + 1}`} className="w-full h-full object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
          </>
        ) : (
          <div className="w-full h-full grid place-items-center text-white/80 p-6">No photos available</div>
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
                  onClick={(e) => { e.stopPropagation(); setCurrentPhoto(i); }}
                  className={`h-2.5 w-2.5 rounded-full ${i === currentPhoto ? "bg-white" : "bg-white/60"}`}
                  aria-label={`Go to photo ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );

  const bookingMeta = (
    <section className="rounded-3xl bg-white/80 backdrop-blur border border-white/60 p-4 sm:p-5 shadow-sm space-y-4">
      <h3 className="text-[13px] sm:text-sm font-semibold text-gray-900 tracking-wide">Booking Information</h3>

      <div className="grid gap-3 text-sm">
        {cat.startsWith("home") ? (
          <>
            <div className="flex items-center gap-2">
              <CalIcon size={16} />
              <span>{fmtRange(booking.checkIn, booking.checkOut) || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <BedDouble size={16} />
              <span>{nights || 0} night{(nights || 0) === 1 ? "" : "s"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users size={16} />
              <span>
                {guests} guest{guests === 1 ? "" : "s"} — {booking.adults || 0} adults
                {typeof booking.children === "number" ? `, ${booking.children} children` : ""}
                {typeof booking.infants === "number" ? `, ${booking.infants} infants` : ""}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <CalIcon size={16} />
              <span>{scheduleStr}</span>
            </div>
            {typeof booking.quantity === "number" && (
              <div className="flex items-center gap-2">
                <Users size={16} />
                <span>Qty {booking.quantity}</span>
              </div>
            )}
            {booking.duration && (
              <div className="flex items-center gap-2">
                <Clock size={16} />
                <span>{booking.duration}</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="pt-2 border-t border-white/60">
        <h4 className="text-xs font-semibold text-gray-700 mb-2">Payment Breakdown</h4>
        <div className="space-y-1.5 text-[13.5px]">
          {/* Base Price / Price Before Discount */}
          {!Number.isNaN(priceBeforeDiscount) && priceBeforeDiscount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-600">
                {cat.startsWith("home") 
                  ? `₱${!Number.isNaN(basePrice) ? basePrice.toLocaleString() : "—"} × ${nights || 0} night${(nights || 0) === 1 ? "" : "s"}`
                  : `Base price${typeof booking.quantity === "number" ? ` × ${booking.quantity}` : ""}`
                }
              </span>
              <span className="font-medium text-slate-900">₱{priceBeforeDiscount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          )}
          
          {/* Listing Discount */}
          {discountAmount > 0 && (
            <div className="flex items-center justify-between text-emerald-700">
              <span>
                Listing discount{discountType !== "none" ? ` (${discountType})` : ""}
                {discountValue > 0 && discountType === "percentage" ? ` ${discountValue}%` : ""}
              </span>
              <span className="font-medium">− ₱{discountAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          )}
          
          {/* Promo Discount */}
          {promoDiscountAmount > 0 && (
            <div className="flex items-center justify-between text-emerald-700">
              <span>
                Promo discount{promoTitle ? `: ${promoTitle}` : ""}
              </span>
              <span className="font-medium">− ₱{promoDiscountAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          )}
          
          {/* Coupon Discount */}
          {couponDiscountAmount > 0 && (
            <div className="flex items-center justify-between text-emerald-700">
              <span>
                Coupon discount{couponCode ? `: ${couponCode}` : ""}
              </span>
              <span className="font-medium">− ₱{couponDiscountAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          )}
          
          {/* Reward Discount */}
          {rewardDiscountAmount > 0 && (
            <div className="flex items-center justify-between text-emerald-700">
              <span>Reward discount</span>
              <span className="font-medium">− ₱{rewardDiscountAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          )}
          
          {/* Legacy discount field (if other discounts not available) */}
          {discountType !== "none" && discountValue > 0 && discountAmount === 0 && promoDiscountAmount === 0 && couponDiscountAmount === 0 && rewardDiscountAmount === 0 && (
            <div className="flex items-center justify-between text-emerald-700">
              <span>Discount ({discountType})</span>
              <span className="font-medium">− ₱{discountValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          )}

          {/* Subtotal (after discounts) */}
          {!Number.isNaN(subtotal) && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-700 font-medium">Subtotal</span>
              <span className="font-medium text-slate-900">₱{subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          )}
          
          {/* Cleaning Fee */}
          {!Number.isNaN(cleaningFee) && cleaningFee > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Cleaning fee</span>
              <span className="text-slate-900">₱{cleaningFee.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          )}
          
          {/* Service Fee */}
          {!Number.isNaN(serviceFee) && serviceFee > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Service fee</span>
              <span className="text-slate-900">₱{serviceFee.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          )}

          <div className="my-2 h-px bg-slate-200" />

          {/* Total */}
          {!Number.isNaN(totalPrice) ? (
            <div className="flex items-center justify-between pt-1">
              <span className="text-base font-bold text-slate-900">Total</span>
              <span className="text-base font-bold text-blue-700">₱{totalPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          ) : (
            <div className="text-sm text-slate-500">Total unavailable.</div>
          )}
        </div>
      </div>
    </section>
  );

  const rightContent = (
    <div className="relative h-full min-h-0 grid grid-rows-[1fr,auto] bg-gradient-to-br from-blue-50/35 via-white/55 to-indigo-50/35">
      <div className="min-h-0 overflow-y-auto">
        <div className="max-w-[720px] mx-auto px-5 sm:px-6 md:px-7 py-5 sm:py-6 md:py-7 space-y-6 sm:space-y-7">

          <section className="space-y-3">
            <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{title}</h2>
              <p className="inline-flex items-center gap-2 text-sm sm:text-[15px] text-gray-700 mt-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-gray-900">{location}</span>
            </p>
            </div>

            {/* Booking Status & ID */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${sBadge.cls}`}>
                {sBadge.text}
              </span>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${pBadge.cls}`}>
                <CreditCard size={14} className="mr-1 opacity-80" />
                {pBadge.text}
              </span>
              <div className="flex items-center gap-1.5 text-[12px] text-slate-600 ml-auto">
                <Hash size={12} />
                <span className="font-mono text-xs">{booking.id.slice(0, 8)}...</span>
                {createdAt && (
                  <span className="text-[11px] text-slate-500">
                    • {createdAt.toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </section>

          {host && (
            <section className="rounded-3xl bg-white/80 backdrop-blur border border-white/60 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
              <HostAvatar host={host} />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] sm:text-base font-semibold text-gray-900 truncate">
                  {([host.firstName, host.lastName].filter(Boolean).join(" ")) ||
                    host.displayName || host.email || "Host"}
                </p>
                <p className="text-[13px] sm:text-sm text-gray-600">Listing Host</p>
              </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMessageModal(true)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 active:scale-[0.99] transition"
              >
                <MessageCircle size={16} />
                Message Host
              </button>
            </section>
          )}

          {(listing?.description || listing?.uniqueDescription) && (
            <section className="space-y-2">
              {listing?.description && (
                <p className="text-[15px] sm:text-base leading-relaxed text-gray-800">{listing.description}</p>
              )}
              {listing?.uniqueDescription && (
                <p className="text-[15px] sm:text-base leading-relaxed text-gray-800">{listing.uniqueDescription}</p>
              )}
            </section>
          )}

          {canReview(booking) && (
            <section className="rounded-3xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow-sm">
              <h3 className="text-[13px] sm:text-sm font-semibold text-gray-900 tracking-wide mb-2">
                Your review
              </h3>
              {myReview?.rating ? (
                <div className="space-y-2">
                  <ReviewBadge rating={myReview.rating} />
                  {myReview.text && (
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{myReview.text}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => onRequestReview?.(booking)}
                    className={`${btn.base} ${btn.outline}`}
                  >
                    Edit review
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">How was your stay/experience?</span>
                  <button
                    type="button"
                    onClick={() => onRequestReview?.(booking)}
                    className={`${btn.base} ${btn.primary}`}
                  >
                    Rate & review
                  </button>
                </div>
              )}
            </section>
          )}

          {bookingMeta}

          {policyText && (
            <section className="rounded-3xl bg-white/80 backdrop-blur border border-white/60 p-4 sm:p-5 shadow-sm">
              <h3 className="text-[13px] sm:text-sm font-semibold text-gray-900 tracking-wide mb-2">
              Cancellation Policy
            </h3>
              <p className="text-[14px] sm:text-[15px] leading-relaxed text-gray-800">
                {policyText}
            </p>
          </section>
          )}
        </div>
      </div>

      <div
        className="w-full bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-t border-white/50 px-4 pt-4 pb-6 sm:pb-6"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex flex-col sm:flex-row gap-3">
          {isCancelable(booking) && (
            <button
              type="button"
              onClick={() => onRequestCancel(booking)}
              className={`${btn.base} ${btn.danger} w-full sm:w-auto flex-1 min-w-[140px]`}
            >
              Cancel Booking
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`${btn.base} ${btn.outline} w-full sm:w-auto flex-1 min-w-[140px]`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  const mainModal = createPortal(
    <div
      className={[
        "fixed inset-0 z-[2147483000] flex items-center justify-center p-0 sm:p-4",
        "bg-black/30",
        "bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.12),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(99,102,241,0.12),transparent_55%)]",
        "backdrop-blur-md sm:backdrop-blur-lg supports-[backdrop-filter]:backdrop-blur-xl",
      ].join(" ")}
      onClick={(e) => { if (e.currentTarget === e.target) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-details-title"
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
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-[2147483646] inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/95 border border-white/70 shadow hover:shadow-md hover:bg-white transition"
        >
          <X className="w-5 h-5 text-gray-700" />
        </button>

        {leftCol}
        {rightContent}
      </div>
    </div>,
    document.body
  );

  // Render MessageHostModal in a separate portal
  return (
    <>
      {mainModal}
      {showMessageModal &&
        createPortal(
          <MessageHostModal
            open={showMessageModal}
            onClose={() => setShowMessageModal(false)}
            host={host}
            hostId={host?.uid || listing?.uid || listing?.ownerId || listing?.hostId}
          />,
          document.body
        )}
    </>
  );
};

/* ---------------- Pagination ---------------- */
function usePagination(list, pageSize) {
  const [page, setPage] = useState(1);
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  const start = (current - 1) * pageSize;
  const end = start + pageSize;
  const slice = list.slice(start, end);

  // helpers
  const next = () => setPage((p) => Math.min(p + 1, pages));
  const prev = () => setPage((p) => Math.max(p - 1, 1));
  const goto = (n) => setPage(() => Math.min(Math.max(1, n), pages));

  return { page: current, pages, total, slice, next, prev, goto, setPage };
}

// Replace your Pager with this version
const Pager = ({ page, pages, onPrev, onNext, onGoto }) => {
  if (pages <= 1) return null;

  const chips =
    "inline-flex items-center justify-center min-w=[40px] min-w-[40px] h-10 px-3 rounded-xl text-sm font-semibold transition border";

  // Neighbors clamped to (2 .. pages-1)
  const start = Math.max(2, page - 1);
  const end   = Math.min(pages - 1, page + 1);

  const parts = [1];

  // Left ellipsis if there's a gap between 1 and start
  if (start > 2) parts.push("…");

  // Middle neighbors
  for (let n = start; n <= end; n++) {
    if (n > 1 && n < pages) parts.push(n);
  }

  // Right ellipsis if there's a gap between end and pages
  if (end < pages - 1) parts.push("…");

  if (pages > 1) parts.push(pages);

  return (
    <div className="mt-8 flex items-center justify-center gap-2 select-none">
      <button
        onClick={onPrev}
        className={`${chips} bg-white border-slate-200 text-slate-800 hover:bg-slate-50`}
        aria-label="Previous page"
        disabled={page === 1}
      >
        <ChevronLeft size={16} />
      </button>

      {parts.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-slate-400">…</span>
        ) : (
          <button
            key={`pg-${p}`}
            onClick={() => onGoto(p)}
            className={
              p === page
                ? `${chips} text-white bg-gradient-to-b from-blue-600 to-blue-700 border-blue-600 shadow-[0_10px_24px_rgba(37,99,235,0.35)]`
                : `${chips} bg-white border-slate-200 text-slate-800 hover:bg-slate-50`
            }
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={onNext}
        className={`${chips} bg-white border-slate-200 text-slate-800 hover:bg-slate-50`}
        aria-label="Next page"
        disabled={page === pages}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
};

/* ---------------- EmailJS: send cancellation email (patched) ---------------- */
async function sendCancellationEmail({ booking, reasonText, refundAmount, authUser }) {
  try {
    // Resolve recipient
    const to_email =
      authUser?.email ||
      booking?.guestEmail ||
      booking?.email ||
      booking?.userEmail ||
      (typeof booking?.user === "object" ? booking.user?.email : null) ||
      null;

    if (!to_email) {
      console.warn("[EmailJS] Recipient email missing; skipping send.");
      return { ok: false, status: 422, text: "Recipient email missing" };
    }

    // Derive fields
    const cat = (booking?.listing?.category || booking?.listingCategory || "").toLowerCase();
    const listingTitle = booking?.listing?.title || booking?.listingTitle || "Your booking";

    const guestsLabelHomes =
      `${(booking.adults || 0) + (booking.children || 0) + (booking.infants || 0)} guest(s)`;
    const guestsLabelOther =
      typeof booking.quantity === "number" ? `Qty ${booking.quantity}` : guestsLabelHomes;

    const amountPaid = typeof booking?.totalPrice === "number"
      ? `₱${Number(booking.totalPrice).toLocaleString()}`
      : "—";

    const refund = typeof refundAmount === "number"
      ? `₱${Number(refundAmount).toLocaleString()}`
      : (typeof booking?.refundAmount === "number"
          ? `₱${Number(booking.refundAmount).toLocaleString()}`
          : "—");

    const dateRange = cat.startsWith("home")
      ? fmtRange(booking?.checkIn, booking?.checkOut)
      : (booking?.schedule?.date
          ? `${fmtDateStr(booking.schedule.date)}${booking?.schedule?.time ? " • " + fmtTimeStr(booking.schedule.time) : ""}`
          : "");

    const origin =
      (typeof window !== "undefined" && window.location?.origin) || "https://bookify.example.com";

    // ⚠️ Make sure these names match your EmailJS template variables exactly
    const templateParams = {
      to_email: to_email,                               // <-- common variable name
      to_name: authUser?.displayName || to_email,       // <-- used in template greeting
      reply_to: "noreply@bookify",                      // <-- optional, set what you want
      website_link: origin,
      support_link: `${origin}/support`,
      booking_id: booking?.id || booking?.bookingId || "",
      listing_title: listingTitle,
      date_range: dateRange || "—",
      guests_label: (cat.startsWith("service") || cat.startsWith("experience"))
        ? guestsLabelOther
        : guestsLabelHomes,
      amount_paid: amountPaid,
      refund_amount: refund,
      cancel_reason: reasonText || booking?.cancelReason || "—",
    };

    // If you’ve called emailjs.init already, you can omit the 4th arg entirely.
    const res = await emailjs.send(
      EMAILJS.SERVICE_ID,
      EMAILJS.TEMPLATE_ID,
      templateParams,
      EMAILJS.PUBLIC_KEY // ✅ pass string or remove (since we init() above)
    );

    // Typical EmailJS success returns { status: 200, text: "OK" }
    console.info("[EmailJS] send result:", res);
    const ok = (res?.status >= 200 && res?.status < 300);
    return { ok, status: res?.status ?? 0, text: res?.text ?? "" };
  } catch (err) {
    // Inspect the real cause in DevTools → Console/Network
    console.error("[EmailJS] send failed:", err);
    return { ok: false, status: err?.status ?? 500, text: err?.text ?? String(err?.message || "Failed to send email") };
  }
}

/* ---------------- page ---------------- */
export default function BookingsPage() {
  const navigate = useNavigate();
  const { sidebarOpen, setSidebarOpen } = useSidebar();

  // Auth
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u || null);
      setAuthLoading(false);
    });
    return unsub;
  }, []);
  const uid = authUser?.uid || null;

  // Host gating
  const [isHost, setIsHost] = useState(
    typeof window !== "undefined" && localStorage.getItem("isHost") === "true"
  );
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);
  const [showHostModal, setShowHostModal] = useState(false);

  // Bookings
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cancel flow state
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [reasonOpen, setReasonOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [policyText, setPolicyText] = useState("");
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Details modal
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState(null);

  // Reviews
  const [reviewsMap, setReviewsMap] = useState({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [savingReview, setSavingReview] = useState(false);

  // Toast (still used for errors/other notices)
  const [toast, setToast] = useState(null);

  // NEW: success modal for cancellation
  const [cancelSuccessOpen, setCancelSuccessOpen] = useState(false);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState("");

  // read host flag from localStorage after login
  useEffect(() => {
    if (!uid) return;
    setIsHost(localStorage.getItem("isHost") === "true");
  }, [uid]);

  // Subscribe bookings for this user
  useEffect(() => {
    if (!uid) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const qRef = query(collection(database, "bookings"), where("uid", "==", uid));
    const unsub = onSnapshot(
      qRef,
      async (snap) => {
        const base = snap.docs.map((d) => ({ id: d.id, ...d.data() })) || [];

        const hydrated = await Promise.all(
          base.map(async (b) => ({
            ...b,
            listing: await hydrateListingForBooking(b),
          }))
        );

        hydrated.sort((a, b) => {
          const as = a?.createdAt?.seconds || 0;
          const bs = b?.createdAt?.seconds || 0;
          const an = a?.createdAt?.nanoseconds || 0;
          const bn = b?.createdAt?.nanoseconds || 0;
          return bs === as ? bn - an : bs - as;
        });

        setRows(hydrated);
        setLoading(false);
      },
      (err) => {
        console.error("Bookings snapshot error:", err);
        setRows([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  // Load user's review for each booking when rows change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!uid || rows.length === 0) { setReviewsMap({}); return; }
      const pairs = await Promise.all(
        rows.map(async (b) => {
          const listingId = getListingId(b);
          if (!listingId) return [b.id, null];
          try {
            const rSnap = await getDoc(doc(database, "listings", listingId, "reviews", b.id));
            return [b.id, rSnap.exists() ? { id: rSnap.id, ...rSnap.data() } : null];
          } catch {
            return [b.id, null];
          }
        })
      );
      if (!cancelled) setReviewsMap(Object.fromEntries(pairs));
    })();
    return () => { cancelled = true; };
  }, [uid, rows]);

  /* ---------- BUCKETS: Today / Upcoming / To Review / Cancelled ---------- */
  const todayList = useMemo(() => {
    const now = new Date();
    const sOD = startOfDay(now), eOD = endOfDay(now);

    return rows.filter((r) => {
      const status = (r.status || "").toLowerCase();
      if (status === "canceled" || status === "cancelled" || status === "completed") return false;

      const cat = normalizeCategory(r.listing?.category || r.listingCategory || "");

      if (cat.startsWith("home")) {
        const ci = r.checkIn?.toDate?.() ?? null;
        const co = r.checkOut?.toDate?.() ?? null;
        if (!ci || !co) return false;
        // overlap today
        return ci <= eOD && co >= sOD;
      }

      if (r?.schedule?.date) {
        const sd = new Date(`${r.schedule.date}T00:00:00`);
        return isSameDay(sd, now);
      }
      return false;
    });
  }, [rows]);

  const upcoming = useMemo(() => {
    const afterToday = endOfDay(new Date()).getTime();

    return rows.filter((r) => {
      const status = (r.status || "").toLowerCase();
      if (status === "canceled" || status === "cancelled" || status === "completed") return false;

      const cat = normalizeCategory(r.listing?.category || r.listingCategory || "");

      if (cat.startsWith("home")) {
        const ci = r.checkIn?.toDate?.() ?? null;
        return ci ? ci.getTime() > afterToday : false;
      }

      if (r?.schedule?.date) {
        const sd = new Date(`${r.schedule.date}T00:00:00`).getTime();
        return sd > afterToday;
      }
      return false;
    });
  }, [rows]);

  const toReview = useMemo(() => rows.filter((r) => canReview(r)), [rows]);

  const cancelled = useMemo(() => {
    return rows.filter((r) => {
      const s = (r.status || "").toLowerCase();
      return s === "canceled" || s === "cancelled";
    });
  }, [rows]);

  // Tabs & visible list
  const [tab, setTab] = useState("today"); // today | upcoming | review | cancelled
  const visible = useMemo(() => {
    switch (tab) {
      case "today": return todayList;
      case "upcoming": return upcoming;
      case "review": return toReview;
      case "cancelled": return cancelled;
      default: return todayList;
    }
  }, [tab, todayList, upcoming, toReview, cancelled]);

  /* ---------- NEW: client-side pagination (no scrollbar for card grid) ---------- */
  const PAGE_SIZE = 3; // 3 cards per page
  const { page, pages, slice: paged, next, prev, goto, setPage } = usePagination(visible, PAGE_SIZE);

  // reset page when tab or visible list changes
  useEffect(() => { setPage(1); }, [tab, visible.length, setPage]);

  /* ---------- host CTA ---------- */
  const handleHostClick = () => {
    if (isHost) {
      navigate("/hostpage");
    } else {
      setShowPoliciesModal(true);
    }
  };
  const handleAgreePolicies = () => {
    setShowPoliciesModal(false);
    setShowHostModal(true);
  };

  /* ---------- cancel flow helpers ---------- */
  const startCancel = (booking) => {
    setCancelTarget(booking);
    setCancelReason("");
    setPolicyText("");
    setReasonOpen(true);
    setConfirmOpen(false);
  };

  const loadPolicyForBooking = async (booking) => {
    const fromHydrated =
      booking?.listing?.cancellationPolicy ||
      booking?.listing?.policy?.cancellation ||
      booking?.listing?.cancellation_policy;
    if (fromHydrated) return String(fromHydrated);

    if (booking?.listingId) {
      try {
        const ld = await getDoc(doc(database, "listings", booking.listingId));
        if (ld.exists()) {
          const d = ld.data();
          return (
            d?.cancellationPolicy ||
            d?.policy?.cancellation ||
            d?.cancellation_policy ||
            ""
          );
        }
      } catch (e) {
        console.error("Fetch policy failed:", e);
      }
    }
    return "";
  };

  const handleReasonNext = async (reasonText) => {
    setCancelReason(reasonText);
    setReasonOpen(false);
    const policy = await loadPolicyForBooking(cancelTarget);
    setPolicyText(policy || "");
    setConfirmOpen(true);
  };

  /* ---------- cancel confirm: Firestore + EmailJS + modal ---------- */
  const handleConfirmCancel = async () => {
    if (!cancelTarget || !cancelTarget.id) return;
    setSubmittingCancel(true);
    try {
      // 1) Mark booking cancelled in Firestore
      await updateDoc(doc(database, "bookings", cancelTarget.id), {
        status: "cancelled",
        cancelReason: cancelReason,
        cancelledAt: serverTimestamp(),
        uid, // include uid to satisfy rules on update
      });

      // 2) Send EmailJS to the canceller (authUser first)
      const res = await sendCancellationEmail({
        booking: cancelTarget,
        reasonText: cancelReason,
        refundAmount: cancelTarget?.refundAmount,
        authUser,
      });

      // 3) Success modal
      const base =
        `Your booking ${cancelTarget?.id ? `(#${cancelTarget.id}) ` : ""}was cancelled successfully.` +
        (typeof cancelTarget?.totalPrice === "number"
          ? `\nTotal: ₱${Number(cancelTarget.totalPrice).toLocaleString()}`
          : "");

      const emailNote = res.ok
        ? "\n\nA confirmation email has been sent to your inbox."
        : "\n\nWe couldn't send the confirmation email right now, but your booking is cancelled.";

      setCancelSuccessMsg(base + emailNote);
      setCancelSuccessOpen(true);

      // 4) Reset flow UI
      setConfirmOpen(false);
      setCancelTarget(null);
      setCancelReason("");
      setPolicyText("");
    } catch (e) {
      console.error("Cancel booking failed:", e);
      setToast({ type: "error", text: "Failed to cancel booking. Please try again." });
    } finally {
      setSubmittingCancel(false);
    }
  };

  /* ---------- details modal handlers ---------- */
  const startDetails = (booking) => {
    setDetailsTarget(booking);
    setDetailsOpen(true);
  };
  const closeDetails = () => {
    setDetailsOpen(false);
  };

  /* ---------- review handlers (rules-compliant) ---------- */
  const startReview = (booking) => {
    setReviewTarget(booking);
    setReviewOpen(true);
  };

  const closeReview = () => {
    setReviewOpen(false);
    setReviewTarget(null);
  };

  const saveReview = async ({ rating, text }) => {
    if (!uid) { alert("Please sign in again."); return; }
    if (!reviewTarget) return;

    const listingId = getListingId(reviewTarget);
    if (!listingId) {
      alert("Listing ID missing for this booking. Please contact support.");
      return;
    }

    setSavingReview(true);
    try {
      const existed = !!reviewsMap[reviewTarget.id];

      const base = {
        uid, // REQUIRED
        rating: Number(rating),
        text: String(text || "").trim().slice(0, 1000),
        updatedAt: serverTimestamp(),
        ...(existed ? {} : { createdAt: serverTimestamp() }),
        bookingId: reviewTarget.id,
        listingId,
        guestUid: uid,
        guestName: authUser?.displayName || authUser?.email || "",
        category: normalizeCategory(
          reviewTarget?.listing?.category || reviewTarget?.listingCategory || ""
        ),
      };

      const reviewRef = doc(database, "listings", listingId, "reviews", reviewTarget.id);
      const globalRef = doc(database, "reviews", `${listingId}_${reviewTarget.id}_${uid}`);
      const userRef   = doc(database, "users", uid, "reviews", reviewTarget.id);

      const batch = writeBatch(database);
      batch.set(reviewRef, base, { merge: true });
      batch.set(globalRef, { ...base, id: globalRef.id }, { merge: true });
      batch.set(userRef, base, { merge: true });
      await batch.commit();

      setReviewsMap((m) => ({
        ...m,
        [reviewTarget.id]: {
          ...(m[reviewTarget.id] || {}),
          uid,
          rating: Number(rating),
          text: String(text || "").trim().slice(0, 1000),
          bookingId: reviewTarget.id,
          listingId,
          guestUid: uid,
          guestName: authUser?.displayName || authUser?.email || "",
        },
      }));

      setToast({ type: "success", text: "Review published ✅" });
      closeReview();
    } catch (e) {
      console.error("Save review failed:", e);
      alert("Failed to save review. Please try again.");
    } finally {
      setSavingReview(false);
    }
  };

  /* ---------- auth gates ---------- */
  if (authLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-gray-600">Loading your session…</div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">Please sign in to view your bookings</h2>
          <button
            onClick={() => navigate("/login")}
            className={`${btn.base} ${btn.primary} px-5`}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  /* ---------- main ---------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar onHostClick={handleHostClick} isHost={isHost} />

      {/* Top Navbar */}
      <header
        className={`
          fixed top-0 right-0 z-30
          bg-white/90 backdrop-blur border-b border-gray-200 shadow-[0_4px_20px_rgba(2,6,23,0.06)]
          transition-all duration-300
          left-0 ${sidebarOpen ? "md:left-72" : "md:left-20"}
        `}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open menu"
              aria-controls="app-sidebar"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
              className={`md:hidden rounded-lg bg-white border border-gray-200 p-2 shadow-sm ${sidebarOpen ? "hidden" : ""}`}
            >
              <Menu size={20} />
            </button>

            <div
              className="flex items-center gap-2 cursor-pointer select-none"
              onClick={() => navigate("/dashboard")}
            >
              <BookifyLogo />
              <span className="hidden sm:inline font-semibold text-gray-800">Bookings</span>
            </div>
          </div>

          <button
            onClick={handleHostClick}
            className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-700 shadow-md transition-all"
          >
            <Home size={18} />
            {isHost ? "Switch to Hosting" : "Become a Host"}
          </button>
        </div>
      </header>

      {/* Spacer */}
      <div className="h-[56px] md:h-[56px]" />

      {/* Content */}
      <main
        className={`
          transition-[margin] duration-300 ml-0
          ${sidebarOpen ? "md:ml-72" : "md:ml-20"}
          px-4 sm:px-6 lg:px-12 py-6
        `}
      >
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground">Your Bookings</h1>
            <p className="text-muted-foreground">All reservations associated with your account.</p>
          </div>

          <div className="mb-5">
            <div className="inline-flex rounded-2xl border border-gray-200 bg-white/90 backdrop-blur p-1 shadow-sm">
              {[
                { key: "today",     label: "Today" },
                { key: "upcoming",  label: "Upcoming" },
                { key: "review",    label: "To Review" },
                { key: "cancelled", label: "Cancelled" },
              ].map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                      active
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            {/* Small helper: count */}
            {!loading && (
              <div className="mt-2 text-sm text-slate-500">
                Showing {visible.length === 0 ? 0 : Math.min(visible.length, page * PAGE_SIZE) - ((page - 1) * PAGE_SIZE)} of {visible.length} — page {page} / {Math.max(1, Math.ceil(visible.length / PAGE_SIZE))}
              </div>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="glass rounded-3xl p-8 bg-white/70 border border-white/40 shadow text-center">
              <p className="text-muted-foreground">No bookings found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {paged.map((b) => {
                  const cat = normalizeCategory(b.listing?.category || b.listingCategory || "");
                  const commonProps = {
                    b,
                    onRequestCancel: startCancel,
                    onRequestDetails: startDetails,
                    onRequestReview: startReview,
                    review: reviewsMap[b.id],
                    showTodayActions: tab === "today", // <-- key change
                  };
                  if (cat.startsWith("experience")) {
                    return <ExperienceCard key={b.id} {...commonProps} />;
                  }
                  if (cat.startsWith("service")) {
                    return <ServiceCard key={b.id} {...commonProps} />;
                  }
                  return <HomesCard key={b.id} {...commonProps} />;
                })}
              </div>

              <Pager
                page={page}
                pages={Math.max(1, Math.ceil(visible.length / PAGE_SIZE))}
                onPrev={prev}
                onNext={next}
                onGoto={goto}
              />
            </>
          )}
        </div>
      </main>

      {/* Host policies → category flow */}
      {showPoliciesModal && (
        <HostPoliciesModal
          onClose={() => setShowPoliciesModal(false)}
          onAgree={handleAgreePolicies}
        />
      )}
      {showHostModal && (
        <HostCategModal
          onClose={() => setShowHostModal(false)}
          onSelectCategory={(category) => {
            setShowHostModal(false);
            if (category === "Homes") navigate("/host-set-up", { state: { category } });
            else if (category === "Experiences") navigate("/host-set-up-2", { state: { category } });
            else if (category === "Services") navigate("/host-set-up-3", { state: { category } });
          }}
        />
      )}

      {/* Cancel flow modals */}
      <CancelReasonModal
        open={reasonOpen}
        onClose={() => setReasonOpen(false)}
        onNext={handleReasonNext}
      />
      <CancelConfirmModal
        open={confirmOpen}
        onBack={() => {
          setConfirmOpen(false);
          setReasonOpen(true);
        }}
        onConfirm={handleConfirmCancel}
        listingTitle={cancelTarget?.listing?.title || cancelTarget?.listingTitle}
        policyText={policyText}
        submitting={submittingCancel}
      />

      {/* Booking Details modal */}
      <BookingDetailsModal
        open={detailsOpen}
        booking={detailsTarget}
        onClose={closeDetails}
        onRequestCancel={(b) => {
          closeDetails();
          startCancel(b);
        }}
        myReview={detailsTarget ? reviewsMap[detailsTarget.id] : null}
        onRequestReview={(b) => {
          setDetailsOpen(false);
          startReview(b);
        }}
      />

      {/* Review Modal */}
      <ReviewModal
        open={reviewOpen}
        booking={reviewTarget}
        existingReview={reviewTarget ? reviewsMap[reviewTarget.id] : null}
        onClose={closeReview}
        onSubmit={saveReview}
        submitting={savingReview}
      />

      {/* Success modal for cancellation */}
      <ResultModal
        open={cancelSuccessOpen}
        title="Booking cancelled"
        message={cancelSuccessMsg}
        onClose={() => setCancelSuccessOpen(false)}
      />

      {/* Toast (still used for other notices / errors) */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
