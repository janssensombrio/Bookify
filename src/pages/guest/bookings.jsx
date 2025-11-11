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
  setDoc,
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
} from "lucide-react";

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

/* ---------------- shared card shell ---------------- */
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
      hover:shadow-[0_20px_60px_rgba(2,6,23,0.12)]
      transition-all duration-300
    "
  >
    <div className="relative h-40">
      <img
        src={
          cover ||
          "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=1200&auto=format&fit=crop"
        }
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/10 mix-blend-overlay" />
      {chip && (
        <span className="absolute top-3 left-3 text-xs px-2 py-1 rounded-full bg-black/60 text-white">
          {chip}
        </span>
      )}
    </div>
    <div className="p-5">{children}</div>
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
              Cancel
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

/* ---------------- category cards ---------------- */
const HomesCard = ({ b, onRequestCancel, onRequestDetails, onRequestReview, review }) => {
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

      {canReview(b) && (
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
            className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 shadow hover:bg-slate-50 active:translate-y-px transition"
          >
            {review?.rating ? "Edit review" : "Rate & review"}
          </button>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-600">Total</div>
        <div className="text-lg font-bold text-blue-600">{peso(b.totalPrice)}</div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        {isCancelable(b) && (
          <button
            onClick={(e) => { e.stopPropagation(); onRequestCancel(b); }}
            className="h-9 px-4 rounded-xl text-rose-700 bg-gradient-to-b from-rose-50 to-rose-100 border border-rose-200 shadow hover:from-rose-100 hover:to-rose-200 active:translate-y-px transition"
          >
            Cancel
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onRequestDetails(b); }}
          className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 shadow hover:bg-slate-50 active:translate-y-px transition"
        >
          View
        </button>
      </div>
    </CardShell>
  );
};

const ExperienceCard = ({ b, onRequestCancel, onRequestDetails, onRequestReview, review }) => {
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

      {canReview(b) && (
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
            className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 shadow hover:bg-slate-50 active:translate-y-px transition"
          >
            {review?.rating ? "Edit review" : "Rate & review"}
          </button>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-600">Total</div>
        <div className="text-lg font-bold text-blue-600">{peso(b.totalPrice)}</div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        {isCancelable(b) && (
          <button
            onClick={(e) => { e.stopPropagation(); onRequestCancel(b); }}
            className="h-9 px-4 rounded-xl text-rose-700 bg-gradient-to-b from-rose-50 to-rose-100 border border-rose-200 shadow hover:from-rose-100 hover:to-rose-200 active:translate-y-px transition"
          >
            Cancel
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onRequestDetails(b); }}
          className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 shadow hover:bg-slate-50 active:translate-y-px transition"
        >
          View
        </button>
      </div>
    </CardShell>
  );
};

const ServiceCard = ({ b, onRequestCancel, onRequestDetails, onRequestReview, review }) => {
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

      {canReview(b) && (
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
            className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 shadow hover:bg-slate-50 active:translate-y-px transition"
          >
            {review?.rating ? "Edit review" : "Rate & review"}
          </button>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-600">Total</div>
        <div className="text-lg font-bold text-blue-600">{peso(b.totalPrice)}</div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        {isCancelable(b) && (
          <button
            onClick={(e) => { e.stopPropagation(); onRequestCancel(b); }}
            className="h-9 px-4 rounded-xl text-rose-700 bg-gradient-to-b from-rose-50 to-rose-100 border border-rose-200 shadow hover:from-rose-100 hover:to-rose-200 active:translate-y-px transition"
          >
            Cancel
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onRequestDetails(b); }}
          className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 shadow hover:bg-slate-50 active:translate-y-px transition"
        >
          View
        </button>
      </div>
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
              className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 shadow hover:bg-slate-50 active:translate-y-px transition"
            >
              Back
            </button>
            <button
              onClick={submit}
              disabled={!canContinue}
              className="h-10 px-4 rounded-xl text-white bg-gradient-to-b from-blue-600 to-blue-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_16px_rgba(37,99,235,0.35)] hover:from-blue-500 hover:to-blue-700 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 transition disabled:opacity-60 disabled:cursor-not-allowed"
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
              className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 shadow hover:bg-slate-50 active:translate-y-px transition"
              disabled={submitting}
            >
              Back
            </button>
            <button
              onClick={onConfirm}
              disabled={submitting}
              className="h-10 px-4 rounded-xl text-white bg-gradient-to-b from-rose-600 to-rose-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_16px_rgba(225,29,72,0.35)] hover:from-rose-500 hover:to-rose-700 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 transition disabled:opacity-60 disabled:cursor-not-allowed"
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

/* ---------------- Booking Details Modal ---------------- */
const BookingDetailsModal = ({ open, booking, onClose, onRequestCancel, myReview, onRequestReview }) => {
  const [listing, setListing] = useState(null);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [host, setHost] = useState(null);

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

  if (!open || !booking) return null;

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

  const subtotal = numberOr(booking.subtotal, NaN);
  const serviceFee = numberOr(booking.serviceFee, NaN);
  const cleaningFee = numberOr(booking.cleaningFee, NaN);
  const discountType = booking.discountType || "none";
  const discountValue = numberOr(booking.discountValue, 0);
  const totalPrice = numberOr(booking.totalPrice, NaN);

  const policyText =
    listing?.cancellationPolicy ||
    listing?.policy?.cancellation ||
    listing?.cancellation_policy ||
    "";

  const chips = [];
  if (listing?.listingType) chips.push(listing.listingType);
  if (cat) chips.push((cat[0]?.toUpperCase() || "") + cat.slice(1));
  if (booking?.experienceType) chips.push((booking.experienceType[0]?.toUpperCase() || "") + booking.experienceType.slice(1));
  if (listing?.serviceType) chips.push(listing.serviceType);
  if (listing?.pricingType) chips.push(listing.pricingType);

  const Field = ({ label, children }) => (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-[12px] sm:text-xs text-gray-600 shrink-0">{label}</span>
      <span className="text-sm sm:text-[15px] text-gray-900 text-right break-words">{children || "—"}</span>
    </div>
  );

  const PillList = ({ items }) => (
    <div className="mt-2 flex flex-wrap gap-2.5">
      {items.map((a, i) => (
        <span key={`${a}-${i}`} className="inline-flex items-center rounded-full border border-white/60 bg-white/80 backdrop-blur px-3 py-1.5 text-[12.5px] sm:text-xs font-medium text-gray-900 shadow-sm">
          {a}
        </span>
      ))}
    </div>
  );

  const FullDetails = () => (
    <section className="rounded-3xl bg-white/80 backdrop-blur border border-white/60 p-4 sm:p-5 shadow-sm space-y-2">
      <h3 className="text-[13px] sm:text-sm font-semibold text-gray-900 tracking-wide">Full Listing Details</h3>

      {listing?.propertyType && <Field label="Property Type">{listing.propertyType}</Field>}
      {typeof listing?.price !== "undefined" && (
        <Field label={cat.startsWith("experience") ? "Price / person" : cat.startsWith("service") ? "Base Price" : "Price / night"}>
          ₱{numberOr(listing.price).toLocaleString()}
        </Field>
      )}
      {typeof listing?.cleaningFee !== "undefined" && numberOr(listing.cleaningFee) > 0 && (
        <Field label="Cleaning Fee">₱{numberOr(listing.cleaningFee).toLocaleString()}</Field>
      )}
      {listing?.discountType && numberOr(listing.discountValue) > 0 && (
        <Field label="Discount">
          {listing.discountType === "percentage"
            ? `${numberOr(listing.discountValue)}%`
            : `₱${numberOr(listing.discountValue).toLocaleString()}`}
        </Field>
      )}

      {cat.startsWith("home") && (
        <>
          {(typeof listing?.bedrooms !== "undefined" || typeof listing?.beds !== "undefined" || typeof listing?.bathrooms !== "undefined") && (
            <div className="grid grid-cols-3 gap-3 pt-2">
              {[{ label: "Bedrooms", value: listing?.bedrooms ?? "—" },
                { label: "Beds", value: listing?.beds ?? "—" },
                { label: "Bathrooms", value: listing?.bathrooms ?? "—" }].map((r) => (
                <div key={r.label} className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow-sm">
                  <p className="text-[12px] sm:text-xs text-gray-600">{r.label}</p>
                  <p className="mt-1 text-lg sm:text-xl font-semibold text-gray-900">{r.value}</p>
                </div>
              ))}
            </div>
          )}

          {(listing?.guests || listing?.maxGuests) && (
            <div className="pt-1">
              <Field label="Max Guests">{numberOr(listing?.guests?.total, listing?.maxGuests)}</Field>
              {typeof listing?.guests?.adults !== "undefined" && (
                <Field label="Adults Cap">{numberOr(listing.guests.adults)}</Field>
              )}
              {typeof listing?.guests?.children !== "undefined" && (
                <Field label="Children Cap">{numberOr(listing.guests.children)}</Field>
              )}
              {typeof listing?.guests?.infants !== "undefined" && (
                <Field label="Infants Cap">{numberOr(listing.guests.infants)}</Field>
              )}
            </div>
          )}

          {listing?.availability?.start && listing?.availability?.end && (
            <Field label="Availability">{fmtDateStr(listing.availability.start)} – {fmtDateStr(listing.availability.end)}</Field>
          )}
        </>
      )}

      {cat.startsWith("experience") && (
        <>
          {listing?.experienceType && <Field label="Experience Type">{listing.experienceType === "online" ? "Online" : "In-Person"}</Field>}
          {listing?.duration && <Field label="Duration">{listing.duration}</Field>}
          {Array.isArray(listing?.languages) && listing.languages.length > 0 && (
            <div className="pt-1">
              <span className="text-[12px] sm:text-xs text-gray-600">Languages</span>
              <PillList items={listing.languages} />
            </div>
          )}
          {Array.isArray(listing?.schedule) && listing.schedule.length > 0 && (
            <div className="pt-1">
              <span className="text-[12px] sm:text-xs text-gray-600">Upcoming Schedules</span>
              <div className="mt-2 grid gap-2">
                {listing.schedule.map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-white/60 bg-white/80 p-3">
                    <span className="text-sm text-gray-900">{fmtDateStr(s?.date)}</span>
                    <span className="text-sm text-gray-600">{fmtTimeStr(s?.time || s?.startTime)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {listing?.hostRequirements && (
            <div className="pt-1">
              <span className="text-[12px] sm:text-xs text-gray-600">Requirements</span>
              <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{listing.hostRequirements}</p>
            </div>
          )}
          {listing?.ageRestriction && (
            <Field label="Age Requirements">{`${listing.ageRestriction?.min ?? 0} – ${listing.ageRestriction?.max ?? 100} years`}</Field>
          )}
        </>
      )}

      {cat.startsWith("service") && (
        <>
          {listing?.serviceType && <Field label="Service Type">{listing.serviceType}</Field>}
          {listing?.pricingType && <Field label="Pricing Type">{listing.pricingType}</Field>}
          {listing?.recurrence && <Field label="Repeats">{listing.recurrence}</Field>}
          {listing?.duration && <Field label="Duration">{listing.duration}</Field>}
          {listing?.providerName && <Field label="Provider">{listing.providerName}</Field>}
          {Array.isArray(listing?.languages) && listing.languages.length > 0 && (
            <div className="pt-1">
              <span className="text-[12px] sm:text-xs text-gray-600">Languages</span>
              <PillList items={listing.languages} />
            </div>
          )}
          {Array.isArray(listing?.schedule) && listing.schedule.length > 0 && (
            <div className="pt-1">
              <span className="text-[12px] sm:text-xs text-gray-600">Available Schedules</span>
              <div className="mt-2 grid gap-2">
                {listing.schedule.map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-white/60 bg-white/80 p-3">
                    <span className="text-sm text-gray-900">{fmtDateStr(s?.date)}</span>
                    <span className="text-sm text-gray-600">{s?.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {listing?.address && <Field label="Address">{listing.address}</Field>}
        </>
      )}

      {Array.isArray(listing?.amenities) && listing.amenities.length > 0 && (
        <div className="pt-1">
          <span className="text-[12px] sm:text-xs text-gray-600">Amenities</span>
          <PillList items={listing.amenities} />
        </div>
      )}

      {listing?.includes && (
        <div className="pt-1">
          <span className="text-[12px] sm:text-xs text-gray-600">What’s Included</span>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-gray-800">
            {String(listing.includes)
              .split(/•|\n|;|,/)
              .map((s) => s.trim())
              .filter(Boolean)
              .map((item, i) => (
                <li key={i}>{item}</li>
              ))}
          </ul>
        </div>
      )}

      {listing?.qualifications && (
        <div className="pt-1">
          <span className="text-[12px] sm:text-xs text-gray-600">Qualifications</span>
          <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{listing.qualifications}</p>
        </div>
      )}

      {listing?.targetAudience && (
        <div className="pt-1">
          <span className="text-[12px] sm:text-xs text-gray-600">Best For</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {String(listing.targetAudience)
              .split(/,|\/|·|\|/)
              .map((s) => s.trim())
              .filter(Boolean)
              .map((tag, i) => (
                <span key={`${tag}-${i}`} className="inline-flex items-center rounded-full border border-white/60 bg-white/80 backdrop-blur px-3 py-1.5 text-[12.5px] sm:text-xs font-medium text-gray-900 shadow-sm">
                  {tag}
                </span>
              ))}
          </div>
        </div>
      )}
    </section>
  );

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
    <section className="rounded-3xl bg-white/85 backdrop-blur border border-white/60 p-4 sm:p-5 shadow-lg space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${sBadge.cls}`}>
          {sBadge.text}
        </span>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${pBadge.cls}`}>
          <CreditCard size={14} className="mr-1 opacity-80" />
          {pBadge.text}
        </span>
      </div>

      <div className="flex items-center gap-2 text-[12.5px] text-slate-600">
        <Hash size={14} />
        <span className="truncate">Booking ID: <span className="font-mono">{booking.id}</span></span>
        {createdAt && <span className="ml-auto">Created {createdAt.toLocaleString()}</span>}
      </div>

      <div className="grid gap-2 text-sm">
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

      <div className="mt-2 space-y-1 text-[13.5px]">
        {!Number.isNaN(subtotal) && (
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span className="font-medium">₱{subtotal.toLocaleString()}</span>
          </div>
        )}
        {!Number.isNaN(cleaningFee) && cleaningFee > 0 && (
          <div className="flex items-center justify-between">
            <span>Cleaning fee</span>
            <span>₱{cleaningFee.toLocaleString()}</span>
          </div>
        )}
        {!Number.isNaN(serviceFee) && (
          <div className="flex items-center justify-between">
            <span>Service fee</span>
            <span>₱{serviceFee.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        )}
        {discountType !== "none" && discountValue > 0 && (
          <div className="flex items-center justify-between text-emerald-700">
            <span>Discount ({discountType})</span>
            <span>− ₱{discountValue.toLocaleString()}</span>
          </div>
        )}

        <div className="my-2 h-px bg-white/60" />

        {!Number.isNaN(totalPrice) ? (
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-slate-900">Total</span>
            <span className="text-base font-bold text-blue-700">₱{totalPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        ) : (
          <div className="text-sm text-slate-500">Total unavailable.</div>
        )}
      </div>
    </section>
  );

  const rightContent = (
    <div className="relative h-full min-h-0 grid grid-rows-[1fr,auto] bg-gradient-to-br from-blue-50/35 via-white/55 to-indigo-50/35">
      <div className="min-h-0 overflow-y-auto">
        <div className="max-w-[720px] mx-auto px-5 sm:px-6 md:px-7 py-5 sm:py-6 md:py-7 space-y-6 sm:space-y-7">

          <section className="space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{title}</h2>

            <div className="flex flex-wrap items-center gap-2">
              {chips.map((c, i) => (
                <span
                  key={`${c}-${i}`}
                  className="inline-flex items-center rounded-full border border-white/60 bg-white/80 backdrop-blur px-3 py-1 text-[12px] sm:text-xs font-semibold text-blue-700 shadow-sm"
                >
                  {c}
                </span>
              ))}
            </div>

            <p className="inline-flex items-center gap-2 text-sm sm:text-[15px] text-gray-700">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-gray-900">{location}</span>
            </p>
          </section>

          {host && (
            <section className="rounded-3xl bg-white/80 backdrop-blur border border-white/60 p-4 sm:p-5 flex items-center gap-4 shadow-sm">
              <HostAvatar host={host} />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] sm:text-base font-semibold text-gray-900 truncate">
                  {([host.firstName, host.lastName].filter(Boolean).join(" ")) ||
                    host.displayName || host.email || "Host"}
                </p>
                <p className="text-[13px] sm:text-sm text-gray-600">Listing Host</p>
              </div>
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
                    className="mt-1 inline-flex items-center rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
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
                    className="inline-flex items-center rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
                  >
                    Rate & review
                  </button>
                </div>
              )}
            </section>
          )}

          <FullDetails />
          {bookingMeta}

          <section className="rounded-3xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow-sm">
            <h3 className="text-[13px] sm:text-sm font-semibold text-gray-900 tracking-wide mb-1">
              Cancellation Policy
            </h3>
            <p className="text-[14px] sm:text[15px] text-gray-800">
              {policyText || "No specific cancellation policy was provided by the host."}
            </p>
          </section>
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
              className="w-full sm:w-auto flex-1 min-w-[140px] inline-flex items-center justify-center rounded-full bg-gradient-to-r from-rose-600 to-rose-700 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-rose-500 hover:to-rose-700 active:scale-[0.99] transition"
            >
              Cancel Booking
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto flex-1 min-w-[140px] inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(
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
};

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

  // Toast
  const [toast, setToast] = useState(null);

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

  const upcoming = useMemo(() => {
    const now = Date.now();
    return rows.filter((r) => {
      const ci =
        r.checkIn?.toDate?.() ?? (r.schedule?.date ? new Date(`${r.schedule.date}T00:00:00`) : null);
      return (ci ? ci.getTime() : 0) >= now;
    });
  }, [rows]);

  const past = useMemo(() => {
    const now = Date.now();
    return rows.filter((r) => {
      const co =
        r.checkOut?.toDate?.() ?? (r.schedule?.date ? new Date(`${r.schedule.date}T00:00:00`) : null);
      return (co ? co.getTime() : 0) < now;
    });
  }, [rows]);

  const [tab, setTab] = useState("all"); // all | upcoming | past
  const visible = useMemo(() => {
    if (tab === "upcoming") return upcoming;
    if (tab === "past") return past;
    return rows;
  }, [tab, rows, upcoming, past]);

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

  /* ---------- cancel flow handlers ---------- */
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

  const handleConfirmCancel = async () => {
    if (!cancelTarget || !cancelTarget.id) return;
    setSubmittingCancel(true);
    try {
      await updateDoc(doc(database, "bookings", cancelTarget.id), {
        status: "cancelled",
        cancelReason: cancelReason,
        cancelledAt: serverTimestamp(),
        uid, // include uid to satisfy rules on update
      });
      setToast({ type: "success", text: "Booking cancelled ✅" });
      setConfirmOpen(false);
      setCancelTarget(null);
      setCancelReason("");
      setPolicyText("");
    } catch (e) {
      console.error("Cancel booking failed:", e);
      alert("Failed to cancel booking. Please try again.");
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
        uid, // REQUIRED by your rules: request.resource.data.uid == request.auth.uid
        rating: Number(rating),
        text: String(text || "").trim().slice(0, 1000),
        updatedAt: serverTimestamp(),
        ...(existed ? {} : { createdAt: serverTimestamp() }),

        // helpful metadata
        bookingId: reviewTarget.id,
        listingId,
        guestUid: uid,
        guestName: authUser?.displayName || authUser?.email || "",
        category: normalizeCategory(
          reviewTarget?.listing?.category || reviewTarget?.listingCategory || ""
        ),
      };

      // 3 targets
      const reviewRef = doc(database, "listings", listingId, "reviews", reviewTarget.id);
      const globalRef = doc(database, "reviews", `${listingId}_${reviewTarget.id}_${uid}`);
      const userRef   = doc(database, "users", uid, "reviews", reviewTarget.id);

      // Atomic commit
      const batch = writeBatch(database);
      batch.set(reviewRef, base, { merge: true });
      batch.set(globalRef, { ...base, id: globalRef.id }, { merge: true });
      batch.set(userRef, base, { merge: true });
      await batch.commit();

      // Verify (read back) + console breadcrumbs
      const [s1, s2, s3] = await Promise.all([reviewRef, globalRef, userRef].map(getDoc));
      const exists1 = s1.exists(), exists2 = s2.exists(), exists3 = s3.exists();
      const projectId = getApp()?.options?.projectId;

      console.info(
        "[reviews] written",
        { projectId, reviewRef: reviewRef.path, exists1, globalRef: globalRef.path, exists2, userRef: userRef.path, exists3 }
      );

      // Optimistic UI map (drives “Edit review” UI)
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
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-white font-semibold hover:bg-blue-700"
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
          bg-white text-gray-800 border-b border-gray-200 shadow-sm
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
              className={`md:hidden rounded-lg bg-white border border-gray-200 p-2 shadow-sm ${
                sidebarOpen ? "hidden" : ""
              }`}
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
            className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all"
          >
            <Compass size={18} />
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
            <div className="inline-flex rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
              {[
                { key: "all", label: "All" },
                { key: "upcoming", label: "Upcoming" },
                { key: "past", label: "Past" },
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {visible.map((b) => {
                const cat = normalizeCategory(b.listing?.category || b.listingCategory || "");
                const commonProps = {
                  b,
                  onRequestCancel: startCancel,
                  onRequestDetails: startDetails,
                  onRequestReview: startReview,
                  review: reviewsMap[b.id],
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

      {/* Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
