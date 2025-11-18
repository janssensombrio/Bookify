// src/pages/host/today.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  addDoc,
  deleteDoc,
  getDocs,
  runTransaction,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { database, auth } from "../../config/firebase";
import emailjs from "@emailjs/browser";
import ClaimRewardModal from "./components/ClaimRewardModal.jsx";
import {
  MapPin,
  Calendar as CalIcon,
  CreditCard,
  BedDouble,
  Users,
  Wrench,
  TicketPercent,
  X,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Send,
  BookOpen,
  TrendingUp,
  DollarSign,
  XCircle,
  Clock,
  Package,
  Hash,
  User,
  Heart,
  Building2,
  Sparkles,
  Handshake,
  Loader2,
  Shield,
  Sun,
  Wifi,
  Tag,
  Volume2,
  CheckCircle2,
  Gift,
} from "lucide-react";

/* ---------------- EmailJS config ---------------- */
const EMAILJS_SERVICE_ID = "service_x9dtjt6";
const EMAILJS_TEMPLATE_ID = "template_vrfey3u";
const EMAILJS_PUBLIC_KEY = "hHgssQum5iOFlnJRD";

const isEmailJsConfigured = !!(EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY);

// Initialize once at module load (idempotent)
if (isEmailJsConfigured && !emailjs.__BOOKIFY_INIT__) {
  try {
    emailjs.init(EMAILJS_PUBLIC_KEY);
    emailjs.__BOOKIFY_INIT__ = true;
    console.info("[EmailJS] init OK");
  } catch (e) {
    console.error("[EmailJS] init failed:", e);
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const numberOr = (v, d = 0) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : d;
};

const normalizeCategory = (rawCat) => {
  const c = (rawCat || "").toString().toLowerCase();
  if (c.startsWith("home")) return "homes";
  if (c.startsWith("service")) return "services";
  if (c.startsWith("experience")) return "experiences";
  return c;
};

const peso = (n) =>
  typeof n === "number"
    ? n.toLocaleString(undefined, { 
        style: "currency", 
        currency: "PHP", 
        maximumFractionDigits: 0 
      })
    : "₱—";

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
  if (!hhmm) return "";
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

/* ---------------- EmailJS: send cancellation email ---------------- */
async function sendCancellationEmail({ booking, reasonText, refundAmount, guestEmail, guestName }) {
  try {
    // Resolve recipient (guest email from booking)
    const to_email =
      guestEmail ||
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
      to_email: to_email,
      to_name: guestName || booking?.guestName || to_email,
      reply_to: "noreply@bookify",
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

    const res = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    console.info("[EmailJS] send result:", res);
    const ok = (res?.status >= 200 && res?.status < 300);
    return { ok, status: res?.status ?? 0, text: res?.text ?? "" };
  } catch (err) {
    console.error("[EmailJS] send failed:", err);
    return { ok: false, status: err?.status ?? 500, text: err?.text ?? String(err?.message || "Failed to send email") };
  }
}

async function sendBookingConfirmationEmail({ user, listing, totalAmount, paymentStatus = "paid" }) {
  if (!isEmailJsConfigured) {
    console.warn("[EmailJS] Skipped sending email — missing EmailJS env vars.");
    return;
  }
  const currencySymbol =
    listing?.currencySymbol ||
    (listing?.currency === "USD" ? "$" : listing?.currency === "EUR" ? "€" : "₱");

  const params = {
    to_name: String(user?.displayName || (user?.email || "").split("@")[0] || "Guest"),
    to_email: String(user?.email || ""),
    listing_title: String(listing?.title || "Untitled"),
    listing_category: String(listing?.category || "Homes"),
    listing_address: String(listing?.location || "—"),
    payment_status: String(paymentStatus).charAt(0).toUpperCase() + String(paymentStatus).slice(1),
    currency_symbol: String(currencySymbol || "₱"),
    total_price: Number(totalAmount || 0).toFixed(2),
    brand_site_url: String(typeof window !== "undefined" ? window.location.origin : ""),
  };

  // Log for debugging
  console.log("[EmailJS] Attempting to send confirmation email:", { 
    to: user?.email, 
    listing: listing?.title,
    hostname: typeof window !== "undefined" ? window.location.hostname : "unknown",
    params
  });

  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params, EMAILJS_PUBLIC_KEY);
}

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
  if (s === "failed") return { text: "Failed", cls: "bg-rose-50 text-rose-700 border-rose-200" };
  return { text: "Unpaid", cls: "bg-amber-50 text-amber-700 border-amber-200" };
};

// =============================================================================
// DATA HELPERS
// =============================================================================

const __userCache = new Map();
const __listingCache = new Map();

async function fetchGuestProfile(uid) {
  if (!uid) return null;
  if (__userCache.has(uid)) return __userCache.get(uid);
  
  try {
    const snap = await getDoc(doc(database, "users", uid));
    if (snap.exists()) {
      const d = snap.data();
      const profile = {
        firstName: d.firstName || "",
        lastName: d.lastName || "",
        displayName: d.displayName || [d.firstName, d.lastName].filter(Boolean).join(" ").trim(),
        photoURL: d.photoURL || d.photoUrl || d.avatarURL || d.avatar || d.profileImageUrl || null,
        email: d.email || null,
        uid,
      };
      __userCache.set(uid, profile);
      return profile;
    }
  } catch (error) {
    console.error("Error fetching guest profile:", error);
  }
  return null;
}

const extractListingIdFromPath = (path) => {
  if (!path) return null;
  const parts = String(path).split("/").filter(Boolean);
  const idx = parts.indexOf("listings");
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null;
};

const fallbackFromBooking = (b) => ({
  title: b?.listing?.title || b?.listingTitle || "Untitled",
  photos: Array.isArray(b?.listing?.photos) ? b.listing.photos : b?.listingPhotos || [],
  location: b?.listing?.location || b?.listingAddress || "",
  category: (b?.listing?.category || b?.listingCategory || "Homes"),
});

const normalizeListing = (raw = {}, booking = {}) => {
  const number = (v, d) => numberOr(v, d);
  
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

  const cat = normalizeCategory(pick(raw.category, booking?.listingCategory, "homes"));
  const scheduleArr = Array.isArray(raw.schedule) ? raw.schedule : [];
  const schedule = scheduleArr
    .map((s) => ({ date: pick(s.date, s.startDate, s.day), time: pick(s.time, s.startTime) }))
    .filter((s) => s.date || s.time);

  const baseListing = {
    id: raw.id,
    title: pick(raw.title, booking?.listingTitle),
    photos: pick(raw.photos, booking?.listingPhotos, []),
    location: pick(raw.location, raw?.address?.formatted, booking?.listingAddress, ""),
    category: cat,
    price: number(pick(raw.price, raw.pricePerNight, raw.basePrice, raw?.pricing?.base), undefined),
    cleaningFee: number(pick(raw.cleaningFee, raw?.fees?.cleaning, raw?.fees?.cleaningFee), undefined),
    discountType: pick(raw.discountType, raw?.discount?.type),
    discountValue: number(pick(raw.discountValue, raw?.discount?.value), 0),
    uid: pick(raw.uid, raw.ownerId, raw.hostId),
    schedule,
    cancellationPolicy: pick(raw.cancellationPolicy, raw?.policy?.cancellation, raw.cancellation_policy),
  };

  // Category-specific fields
  if (cat.startsWith("service")) {
    baseListing.serviceType = raw.serviceType || raw.type;
    baseListing.pricingType = raw.pricingType || raw?.pricing?.type;
    baseListing.duration = raw.duration || raw?.service?.duration;
    baseListing.address = pick(raw.address, raw?.location?.address, raw?.addressLine);
  }

  if (cat.startsWith("experience")) {
    baseListing.experienceType = raw.experienceType || raw.type;
    baseListing.duration = raw.duration;
    baseListing.languages = Array.isArray(raw.languages) ? raw.languages : [];
    baseListing.hostRequirements = raw.hostRequirements || raw.requirements;
  }

  if (cat.startsWith("home")) {
    baseListing.propertyType = raw.propertyType || raw?.home?.propertyType || raw?.details?.propertyType;
    baseListing.bedrooms = number(raw.bedrooms ?? raw?.rooms?.bedrooms, undefined);
    baseListing.beds = number(raw.beds ?? raw?.rooms?.beds, undefined);
    baseListing.bathrooms = number(raw.bathrooms ?? raw?.rooms?.bathrooms, undefined);
    baseListing.maxGuests = number(raw.maxGuests ?? raw.capacity, undefined);
  }

  return baseListing;
};

async function hydrateListingForBooking(booking) {
  const fallback = fallbackFromBooking(booking);
  const id = booking?.listingId || extractListingIdFromPath(booking?.listingRefPath);
  
  if (!id) return fallback;
  if (__listingCache.has(id)) return { ...fallback, ...__listingCache.get(id) };
  
  try {
    const snap = await getDoc(doc(database, "listings", id));
    if (snap.exists()) {
      const raw = { id: snap.id, ...snap.data() };
      const normalized = normalizeListing(raw, booking);
      __listingCache.set(id, normalized);
      return { ...fallback, ...normalized };
    }
  } catch (error) {
    console.error("Error hydrating listing:", error);
  }
  
  return fallback;
}

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

// =============================================================================
// UI COMPONENTS
// =============================================================================

const CardSkeleton = () => (
  <div className="rounded-2xl bg-white/60 border-2 border-white/60 backdrop-blur-sm shadow-md overflow-hidden animate-pulse">
    <div className="h-40 bg-slate-200/80" />
    <div className="p-5 space-y-3">
      <div className="h-5 bg-slate-200 rounded w-2/3" />
      <div className="h-4 bg-slate-200/90 rounded w-1/2" />
      <div className="h-4 bg-slate-200/90 rounded w-3/4" />
    </div>
  </div>
);

const CardShell = ({ cover, chip, header, children, onClick }) => {
  const handleKeyDown = (e) => {
    if (!onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault(); 
      onClick();
    }
  };

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={handleKeyDown}
      className="
        group rounded-2xl overflow-hidden cursor-pointer
        bg-white/60 border-2 border-white/60
        backdrop-blur-sm
        shadow-md hover:shadow-lg
        transition-all duration-300 transform-gpu
        hover:-translate-y-1 hover:scale-[1.02]
        flex flex-col h-full
      "
    >
      <div className="relative h-40 shrink-0">
        <img
          src={cover || "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=1200&auto=format&fit=crop"}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-white/10 mix-blend-overlay" />
        {chip && (
          <span className="absolute top-3 left-3 text-xs px-2 py-1 rounded-full bg-black/60 text-white">
            {chip}
          </span>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1 min-h-0">
        {header}
        <div className="flex-1 flex flex-col min-h-0">
        {children}
        </div>
      </div>
    </div>
  );
};

const GuestPill = ({ booking }) => {
  const [guest, setGuest] = useState(null);

  useEffect(() => {
    let isActive = true;
    
    const loadGuest = async () => {
      const profile = await fetchGuestProfile(booking?.uid);
      if (isActive) setGuest(profile);
    };

    loadGuest();
    
    return () => { isActive = false; };
  }, [booking?.uid]);

  const name = booking?.guestName ||
    guest?.displayName ||
    [guest?.firstName, guest?.lastName].filter(Boolean).join(" ").trim() ||
    booking?.guestEmail ||
    "Guest";
    
  const initial = name?.trim()?.[0]?.toUpperCase() || "G";
  const photo = guest?.photoURL;

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="relative w-8 h-8 rounded-full bg-white/80 border border-white/60 overflow-hidden grid place-items-center text-gray-900 font-semibold ring-2 ring-white/60 shrink-0">
        {photo ? (
          <img src={photo} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="text-sm">{initial}</span>
        )}
      </div>
      <span className="text-sm font-medium text-slate-900 truncate" title={name}>
        {name}
      </span>
    </div>
  );
};

// =============================================================================
// BOOKING CARDS BY CATEGORY
// =============================================================================

const HomesCard = ({ b, onRequestCancel, onRequestDetails, onRequestRefund, showRefundButton }) => {
  const title = b.listing?.title || b.listingTitle || "Untitled listing";
  const loc = b.listing?.location || b.listingAddress || "";
  const dates = fmtRange(b.checkIn, b.checkOut);
  const nights = typeof b.nights === "number" ? b.nights : undefined;
  const guests = (b.adults || 0) + (b.children || 0) + (b.infants || 0);
  const sBadge = statusBadge(b.status);
  const pBadge = payBadge(b.paymentStatus);

  const handleCancelClick = (e) => {
    e.stopPropagation();
    onRequestCancel(b);
  };

  return (
    <CardShell
      cover={b.listing?.photos?.[0] || b.listingPhotos?.[0]}
      chip="Homes"
      header={
        <div className="flex items-center justify-between mb-3 gap-3">
          <GuestPill booking={b} />
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${sBadge.cls}`}>
            {sBadge.text}
          </span>
        </div>
      }
      onClick={() => onRequestDetails(b)}
    >
      <h3 className="text-lg font-semibold text-slate-900 line-clamp-1">{title}</h3>

      <div className="mt-1 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-sm text-slate-700">
          <Package size={16} />
          <span>Home</span>
        </span>
      </div>

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
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${pBadge.cls}`}>
          <CreditCard size={14} className="mr-1 opacity-80" />
          {pBadge.text}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-600">Total</div>
        <div className="text-lg font-bold text-blue-600">{peso(b.totalPrice)}</div>
      </div>

      <div className="mt-auto pt-4">
        {showRefundButton && onRequestRefund && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRequestRefund(b);
            }}
            className="w-full h-10 px-4 rounded-xl text-white bg-gradient-to-b from-emerald-600 to-emerald-700 border border-emerald-700/50 shadow hover:from-emerald-500 hover:to-emerald-700 active:translate-y-px transition mb-2"
          >
            Process Refund
          </button>
        )}
        {isCancelable(b) && (
          <button
            onClick={handleCancelClick}
            className="w-full h-10 px-4 rounded-xl text-white bg-gradient-to-b from-rose-600 to-rose-700 border border-rose-700/50 shadow hover:from-rose-500 hover:to-rose-700 active:translate-y-px transition"
          >
            Cancel Booking
          </button>
        )}
      </div>
    </CardShell>
  );
};

const ExperienceCard = ({ b, onRequestCancel, onRequestDetails, onRequestRefund, showRefundButton }) => {
  const title = b.listing?.title || b.listingTitle || "Untitled experience";
  const cover = b.listing?.photos?.[0] || b.listingPhotos?.[0];
  const sBadge = statusBadge(b.status);
  const pBadge = payBadge(b.paymentStatus);
  const dateStr = b?.schedule?.date ? fmtDateStr(b.schedule.date) : "";
  const timeStr = b?.schedule?.time ? fmtTimeStr(b.schedule.time) : "";
  
  // Additional experience details
  const location = b.listing?.location || b.listingAddress || "";
  const duration = b.listing?.duration || b.duration || "";
  const experienceType = b.listing?.experienceType || b.experienceType || "";
  const type = experienceType ? experienceType[0].toUpperCase() + experienceType.slice(1) : null;
  const quantity = typeof b.quantity === "number" ? b.quantity : null;
  const participants = typeof b.participants === "number" ? b.participants : quantity;
  const maxParticipants = typeof b.listing?.maxParticipants === "number" ? b.listing.maxParticipants : null;
  const languages = Array.isArray(b.listing?.languages) && b.listing.languages.length > 0 ? b.listing.languages : [];
  const ageRestriction = b.listing?.ageRestriction || null;

  const handleCancelClick = (e) => {
    e.stopPropagation();
    onRequestCancel(b);
  };

  return (
    <CardShell
      cover={cover}
      chip="Experiences"
      header={
        <div className="flex items-center justify-between mb-3 gap-3">
          <GuestPill booking={b} />
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${sBadge.cls}`}>
            {sBadge.text}
          </span>
        </div>
      }
      onClick={() => onRequestDetails(b)}
    >
      <h3 className="text-lg font-semibold text-slate-900 line-clamp-1">{title}</h3>

      <div className="mt-1 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-sm text-slate-700">
          <Package size={16} />
          <span>Experience</span>
        </span>
      </div>

      {location && (
        <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
          <MapPin size={16} />
          <span className="line-clamp-1">{location}</span>
        </div>
      )}

      <div className="mt-2 flex items-center gap-2 text-sm text-slate-700">
        <CalIcon size={16} />
        <span>{[dateStr, timeStr].filter(Boolean).join(" • ")}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-700">
        {duration && (
          <span className="inline-flex items-center gap-1">
            <Clock size={16} />
            {duration}
          </span>
        )}
        {participants !== null && (
          <span className="inline-flex items-center gap-1">
            <Users size={16} />
            {participants} {participants === 1 ? "participant" : "participants"}
            {maxParticipants !== null && ` / ${maxParticipants} max`}
          </span>
        )}
        {type && (
          <span className="inline-flex items-center gap-1">
            <Package size={16} />
            {type}
          </span>
        )}
      </div>

      {languages.length > 0 && (
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <span className="font-medium">Languages:</span>
          <span className="line-clamp-1">{languages.join(", ")}</span>
        </div>
      )}

      {ageRestriction && typeof ageRestriction.min === "number" && typeof ageRestriction.max === "number" && (
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <span className="font-medium">Age:</span>
          <span>{ageRestriction.min}–{ageRestriction.max} years</span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${pBadge.cls}`}>
          <CreditCard size={14} className="mr-1 opacity-80" />
          {pBadge.text}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-600">Total</div>
        <div className="text-lg font-bold text-blue-600">{peso(b.totalPrice)}</div>
      </div>

      <div className="mt-auto pt-4">
        {showRefundButton && onRequestRefund && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRequestRefund(b);
            }}
            className="w-full h-10 px-4 rounded-xl text-white bg-gradient-to-b from-emerald-600 to-emerald-700 border border-emerald-700/50 shadow hover:from-emerald-500 hover:to-emerald-700 active:translate-y-px transition mb-2"
          >
            Process Refund
          </button>
        )}
        {isCancelable(b) && (
          <button
            onClick={handleCancelClick}
            className="w-full h-10 px-4 rounded-xl text-white bg-gradient-to-b from-rose-600 to-rose-700 border border-rose-700/50 shadow hover:from-rose-500 hover:to-rose-700 active:translate-y-px transition"
          >
            Cancel Booking
          </button>
        )}
      </div>
    </CardShell>
  );
};

const ServiceCard = ({ b, onRequestCancel, onRequestDetails, onRequestRefund, showRefundButton }) => {
  const title = b.listing?.title || b.listingTitle || "Untitled service";
  const cover = b.listing?.photos?.[0] || b.listingPhotos?.[0];
  const sBadge = statusBadge(b.status);
  const pBadge = payBadge(b.paymentStatus);
  const dateStr = b?.schedule?.date ? fmtDateStr(b.schedule.date) : "";
  const timeStr = b?.schedule?.time ? fmtTimeStr(b.schedule.time) : "";
  
  // Additional service details
  const location = b.listing?.location || b.listingAddress || b.listing?.address || "";
  const duration = b.listing?.duration || b.duration || "";
  const serviceType = b.listing?.serviceType || b.serviceType || "";
  const quantity = typeof b.quantity === "number" ? b.quantity : null;
  const providerName = b.listing?.providerName || b.providerName || "";
  const pricingType = b.listing?.pricingType || b.pricingType || "";

  const handleCancelClick = (e) => {
    e.stopPropagation();
    onRequestCancel(b);
  };

  return (
    <CardShell
      cover={cover}
      chip="Services"
      header={
        <div className="flex items-center justify-between mb-3 gap-3">
          <GuestPill booking={b} />
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${sBadge.cls}`}>
            {sBadge.text}
          </span>
        </div>
      }
      onClick={() => onRequestDetails(b)}
    >
      <h3 className="text-lg font-semibold text-slate-900 line-clamp-1">{title}</h3>

      <div className="mt-1 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-sm text-slate-700">
          <Package size={16} />
          <span>Service</span>
        </span>
      </div>

      {location && (
        <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
          <MapPin size={16} />
          <span className="line-clamp-1">{location}</span>
        </div>
      )}

      <div className="mt-2 flex items-center gap-2 text-sm text-slate-700">
        <CalIcon size={16} />
        <span>{[dateStr, timeStr].filter(Boolean).join(" • ")}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-700">
        {duration && (
          <span className="inline-flex items-center gap-1">
            <Clock size={16} />
            {duration}
          </span>
        )}
        {quantity !== null && (
          <span className="inline-flex items-center gap-1">
            <Users size={16} />
            Qty {quantity}
          </span>
        )}
        {serviceType && (
          <span className="inline-flex items-center gap-1">
            <Package size={16} />
            {serviceType}
          </span>
        )}
        {providerName && (
          <span className="inline-flex items-center gap-1">
            <CircleUserRound size={16} />
            {providerName}
          </span>
        )}
      </div>

      {pricingType && (
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <span className="font-medium">Pricing:</span>
          <span>{pricingType}</span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${pBadge.cls}`}>
          <CreditCard size={14} className="mr-1 opacity-80" />
          {pBadge.text}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-600">Total</div>
        <div className="text-lg font-bold text-blue-600">{peso(b.totalPrice)}</div>
      </div>

      <div className="mt-auto pt-4">
        {showRefundButton && onRequestRefund && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRequestRefund(b);
            }}
            className="w-full h-10 px-4 rounded-xl text-white bg-gradient-to-b from-emerald-600 to-emerald-700 border border-emerald-700/50 shadow hover:from-emerald-500 hover:to-emerald-700 active:translate-y-px transition mb-2"
          >
            Process Refund
          </button>
        )}
        {isCancelable(b) && (
          <button
            onClick={handleCancelClick}
            className="w-full h-10 px-4 rounded-xl text-white bg-gradient-to-b from-rose-600 to-rose-700 border border-rose-700/50 shadow hover:from-rose-500 hover:to-rose-700 active:translate-y-px transition"
          >
            Cancel Booking
          </button>
        )}
      </div>
    </CardShell>
  );
};

// =============================================================================
// MODAL COMPONENTS
// =============================================================================

const Overlay = ({ children, onBackdropClick }) => {
  const content = (
    <div
      className="fixed inset-0 z-[2147483000] flex items-center justify-center p-0 sm:p-4
                 bg-black/30
                 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.12),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(99,102,241,0.12),transparent_55%)]
                 backdrop-blur-md sm:backdrop-blur-lg supports-[backdrop-filter]:backdrop-blur-xl"
      onClick={(e) => { if (e.currentTarget === e.target) onBackdropClick?.(); }}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  );
  
  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
};

const CancelReasonModal = ({ open, onClose, onNext }) => {
  const [selected, setSelected] = useState("");
  const [other, setOther] = useState("");

  useEffect(() => {
    if (!open) {
      setSelected("");
      setOther("");
    }
  }, [open]);

  const reasons = [
    "Calendar conflict / double-booked",
    "Urgent maintenance or repairs required",
    "Safety or cleanliness issue at the property",
    "Host illness or emergency",
    "Severe weather / local restrictions",
    "Other",
  ];

  const canContinue = selected && (selected !== "Other" || (selected === "Other" && other.trim().length >= 4));

  const handleSubmit = () => {
    const reasonText = selected === "Other" ? other.trim() : selected;
    if (!canContinue) return;
    onNext(reasonText);
  };

  if (!open) return null;

  return (
    <Overlay onBackdropClick={onClose}>
      <div className="relative z-10 w-full sm:w-[560px]">
        <div className="mx-3 sm:mx-0 rounded-2xl bg-white/60 border-2 border-white/60 backdrop-blur-sm shadow-md p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-slate-900">Cancel booking</h3>
              <p className="text-sm text-slate-600 mt-1">
                Please tell the guest why you're canceling as the host.
              </p>
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
            {reasons.map((reason) => (
              <label
                key={reason}
                className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition
                  ${selected === reason ? "border-blue-300 bg-blue-50/60" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <input
                  type="radio"
                  name="cancel-reason"
                  value={reason}
                  checked={selected === reason}
                  onChange={() => setSelected(reason)}
                  className="accent-blue-600"
                />
                <span className="text-sm text-slate-800">{reason}</span>
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
              onClick={handleSubmit}
              disabled={!canContinue}
              className="h-10 px-4 rounded-xl text-white bg-gradient-to-b from-blue-600 to-blue-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_16px_rgba(37,99,235,0.35)] hover:from-blue-500 hover:to-blue-700 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
};

const CancelConfirmModal = ({ 
  open, 
  onBack, 
  onConfirm, 
  listingTitle, 
  policyText, 
  submitting,
  bookingTotal,
  refundPercentage,
  onRefundPercentageChange,
  refundAmount,
}) => {
  if (!open) return null;
  
  const title = listingTitle || "this booking";
  const policy = policyText?.trim() || "No specific cancellation policy was provided by the host.";

  return (
    <Overlay onBackdropClick={onBack}>
      <div className="relative z-10 w-full sm:w-[560px]">
        <div className="mx-3 sm:mx-0 rounded-2xl bg-white/60 border-2 border-white/60 backdrop-blur-sm shadow-md p-6">
          <div className="flex items-start gap-3">
            <div className="shrink-0 grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-b from-rose-600 to-rose-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_20px_rgba(225,29,72,0.35)] ring-1 ring-white/10">
              <AlertTriangle size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold tracking-tight text-slate-900">Cancel {title}?</h3>
              <p className="text-sm text-slate-600 mt-1">Before you proceed, review the cancellation policy:</p>
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 max-h-44 overflow-auto text-sm text-slate-800">
                {policy}
              </div>
              
              {/* Refund Percentage Input */}
              <div className="mt-4 space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Refund Percentage (%)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={refundPercentage}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      onRefundPercentageChange(val);
                    }}
                    className="flex-1 h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0-100"
                    disabled={submitting}
                  />
                  <span className="text-sm font-medium text-slate-600">%</span>
                </div>
                
                {/* Real-time Refund Amount Display */}
                {typeof bookingTotal === "number" && bookingTotal > 0 && (
                  <div className="mt-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-emerald-900">Refund Amount:</span>
                      <span className="text-lg font-bold text-emerald-700">
                        ₱{refundAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-700 mt-1">
                      This amount will be refunded to the guest's E-Wallet
                    </p>
                  </div>
                )}
              </div>
              
              <p className="text-xs text-slate-500 mt-3">
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
    </Overlay>
  );
};

const RefundModal = ({ 
  open, 
  onClose, 
  onConfirm, 
  listingTitle, 
  policyText, 
  submitting,
  bookingTotal,
  refundPercentage,
  onRefundPercentageChange,
  refundAmount,
}) => {
  if (!open) return null;
  
  const title = listingTitle || "this booking";
  const policy = policyText?.trim() || "No specific cancellation policy was provided by the host.";

  return (
    <Overlay onBackdropClick={onClose}>
      <div className="relative z-10 w-full sm:w-[560px]">
        <div className="mx-3 sm:mx-0 rounded-2xl bg-white/60 border-2 border-white/60 backdrop-blur-sm shadow-md p-6">
          <div className="flex items-start gap-3">
            <div className="shrink-0 grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-b from-emerald-600 to-emerald-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_20px_rgba(16,185,129,0.35)] ring-1 ring-white/10">
              <DollarSign size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold tracking-tight text-slate-900">Process Refund for {title}</h3>
              <p className="text-sm text-slate-600 mt-1">Review the cancellation policy before processing the refund:</p>
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 max-h-44 overflow-auto text-sm text-slate-800">
                {policy}
              </div>
              
              {/* Refund Percentage Input */}
              <div className="mt-4 space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Refund Percentage (%)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={refundPercentage}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      onRefundPercentageChange(val);
                    }}
                    className="flex-1 h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0-100"
                    disabled={submitting}
                  />
                  <span className="text-sm font-medium text-slate-600">%</span>
                </div>
                
                {/* Real-time Refund Amount Display */}
                {typeof bookingTotal === "number" && bookingTotal > 0 && (
                  <div className="mt-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-emerald-900">Refund Amount:</span>
                      <span className="text-lg font-bold text-emerald-700">
                        ₱{refundAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-700 mt-1">
                      This amount will be refunded to the guest's E-Wallet
                    </p>
                  </div>
                )}
              </div>
              
              <p className="text-xs text-slate-500 mt-3">
                By confirming, you agree to process the refund according to the policy above.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 shadow hover:bg-slate-50 active:translate-y-px transition"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={submitting}
              className="h-10 px-4 rounded-xl text-white bg-gradient-to-b from-emerald-600 to-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_16px_rgba(16,185,129,0.35)] hover:from-emerald-500 hover:to-emerald-700 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Processing…" : "Process Refund"}
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
};

const RefundSuccessModal = ({ 
  open, 
  onClose, 
  bookingId,
  refundAmount,
  refundPercentage,
  emailSent,
}) => {
  if (!open) return null;
  
  return (
    <Overlay onBackdropClick={onClose}>
      <div className="relative z-10 w-full sm:w-[560px]">
        <div className="mx-3 sm:mx-0 rounded-2xl bg-white/60 border-2 border-white/60 backdrop-blur-sm shadow-md p-6">
          <div className="flex items-start gap-3">
            <div className="shrink-0 grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-b from-emerald-600 to-emerald-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_20px_rgba(16,185,129,0.35)] ring-1 ring-white/10">
              <CheckCircle2 size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold tracking-tight text-slate-900">Refund Processed Successfully</h3>
              <p className="text-sm text-slate-600 mt-1">
                {bookingId ? `Booking #${bookingId.slice(0, 8).toUpperCase()}` : "The refund"} has been processed successfully.
              </p>
              
              {refundAmount > 0 ? (
                <div className="mt-4 p-4 rounded-xl border border-emerald-200 bg-emerald-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-emerald-900">Refund Amount:</span>
                    <span className="text-lg font-bold text-emerald-700">
                      ₱{refundAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700">
                    {refundPercentage}% refund has been credited to the guest's E-Wallet
                  </p>
                </div>
              ) : (
                <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="text-sm text-slate-600">No refund was processed.</p>
                </div>
              )}
              
              <div className="mt-4 p-3 rounded-xl border border-slate-200 bg-slate-50">
                <p className="text-xs text-slate-600">
                  {emailSent 
                    ? "✓ A confirmation email has been sent to the guest."
                    : "⚠ We couldn't send the confirmation email right now, but the refund is processed."}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end">
            <button
              onClick={onClose}
              className="h-10 px-6 rounded-xl text-white bg-gradient-to-b from-emerald-600 to-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_16px_rgba(16,185,129,0.35)] hover:from-emerald-500 hover:to-emerald-700 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 transition"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
};

// Helper function to get listing from any collection
async function getListingLike(database, idOrRef) {
  if (!idOrRef) return null;
  
  // If it's already a DocumentReference
  if (typeof idOrRef === "object" && idOrRef?.path) {
    try {
      const snap = await getDoc(idOrRef);
      return snap.exists() ? { col: idOrRef.parent?.id || "", snap } : null;
    } catch {
      return null;
    }
  }

  const id = String(idOrRef);
  // Try different collections
  const candidates = ["experiences", "services", "homes", "properties", "listings"];

  for (const col of candidates) {
    try {
      const snap = await getDoc(doc(database, col, id));
      if (snap.exists()) return { col, snap };
    } catch {
      // ignore and try next
    }
  }
  return null;
}

// Helper to determine category kind
function categoryToKind(category) {
  const c = (category || "").toString().toLowerCase();
  if (c.startsWith("home")) return "home";
  if (c.startsWith("service")) return "service";
  if (c.startsWith("experience")) return "experience";
  return null;
}

// Helper to get full preference summary (simplified version)
function getFullPrefSummary(prefs, category) {
  const items = [];
  
  if (category === "home") {
    if (prefs.privacyLevel) items.push({ label: "Privacy level", value: prefs.privacyLevel, isArray: false });
    if (prefs.cleanlinessTier) items.push({ label: "Cleanliness tier", value: prefs.cleanlinessTier, isArray: false });
    if (prefs.scentPreference) items.push({ label: "Scent preference", value: prefs.scentPreference, isArray: false });
    if (prefs.linens?.threadCount) items.push({ label: "Thread count (sheets)", value: `${prefs.linens.threadCount}tc`, isArray: false });
    if (prefs.linens?.towels) items.push({ label: "Towels", value: prefs.linens.towels, isArray: false });
    if (prefs.linens?.pillowFirmness) items.push({ label: "Pillow firmness", value: prefs.linens.pillowFirmness, isArray: false });
    if (prefs.linens?.duvetWarmth) items.push({ label: "Duvet warmth", value: prefs.linens.duvetWarmth, isArray: false });
    if (prefs.mattressFirmness) items.push({ label: "Mattress firmness", value: prefs.mattressFirmness, isArray: false });
    if (prefs.noiseTolerance) items.push({ label: "Noise tolerance", value: prefs.noiseTolerance, isArray: false });
    if (prefs.quietHours) items.push({ label: "Quiet hours", value: prefs.quietHours, isArray: false });
    if (prefs.lighting) items.push({ label: "Lighting", value: prefs.lighting, isArray: false });
    if (prefs.workspace?.wifiMinMbps) items.push({ label: "Wi-Fi minimum (Mbps)", value: `${prefs.workspace.wifiMinMbps}Mbps`, isArray: false });
    if (prefs.workspace?.desk) items.push({ label: "Desk", value: "Yes", isArray: false });
    if (prefs.workspace?.ergoChair) items.push({ label: "Ergonomic chair", value: "Yes", isArray: false });
    if (prefs.workspace?.backupWifi) items.push({ label: "Backup Wi-Fi", value: "Yes", isArray: false });
    if (prefs.hypoallergenic) items.push({ label: "Hypoallergenic", value: "Yes", isArray: false });
    if (prefs.airPurifier) items.push({ label: "Air purifier", value: "Yes", isArray: false });
    if (prefs.hotWater) items.push({ label: "Hot water", value: "Yes", isArray: false });
    if (prefs.kitchenMust?.length) items.push({ label: "Kitchen must-haves", value: `${prefs.kitchenMust.length} items`, isArray: true, arrayData: prefs.kitchenMust });
    if (prefs.welcomeStocking?.length) items.push({ label: "Welcome stocking (on arrival)", value: `${prefs.welcomeStocking.length} items`, isArray: true, arrayData: prefs.welcomeStocking });
    if (prefs.accessibility?.length) items.push({ label: "Accessibility", value: `${prefs.accessibility.length} items`, isArray: true, arrayData: prefs.accessibility });
    if (prefs.safetyRequests?.length) items.push({ label: "Safety requests", value: `${prefs.safetyRequests.length} items`, isArray: true, arrayData: prefs.safetyRequests });
    if (prefs.hostInteraction) items.push({ label: "Host interaction", value: prefs.hostInteraction, isArray: false });
    if (prefs.rulesFlexibility) items.push({ label: "Rules flexibility", value: prefs.rulesFlexibility, isArray: false });
    if (prefs.amenitiesMust?.length) items.push({ label: "Must-have amenities", value: `${prefs.amenitiesMust.length} items`, isArray: true, arrayData: prefs.amenitiesMust });
    if (prefs.amenitiesNice?.length) items.push({ label: "Nice-to-have amenities", value: `${prefs.amenitiesNice.length} items`, isArray: true, arrayData: prefs.amenitiesNice });
    if (prefs.locations?.length) items.push({ label: "Preferred locations", value: `${prefs.locations.length} locations`, isArray: true, arrayData: prefs.locations });
  } else if (category === "experience") {
    if (prefs.pace) items.push({ label: "Pace", value: prefs.pace, isArray: false });
    if (prefs.depth) items.push({ label: "Depth", value: prefs.depth, isArray: false });
    if (prefs.personalization) items.push({ label: "Personalization", value: prefs.personalization, isArray: false });
    if (prefs.groupType) items.push({ label: "Group type", value: prefs.groupType, isArray: false });
    if (prefs.guideStyle) items.push({ label: "Guide style", value: prefs.guideStyle, isArray: false });
    if (prefs.crowdTolerance) items.push({ label: "Crowd tolerance", value: prefs.crowdTolerance, isArray: false });
    if (prefs.languageLevel) items.push({ label: "Language level", value: prefs.languageLevel, isArray: false });
    if (prefs.audioSupport) items.push({ label: "Audio support (mic/PA)", value: "Yes", isArray: false });
    if (prefs.photoConsent) items.push({ label: "Photo consent", value: prefs.photoConsent, isArray: false });
    if (prefs.photosPriority) items.push({ label: "Photos priority", value: "Yes", isArray: false });
    if (prefs.durationFlexibility) items.push({ label: "Duration flexibility", value: prefs.durationFlexibility, isArray: false });
    if (prefs.weatherPlan) items.push({ label: "Weather plan", value: prefs.weatherPlan, isArray: false });
    if (prefs.comfortAccessibility?.length) items.push({ label: "Comfort / Accessibility", value: `${prefs.comfortAccessibility.length} items`, isArray: true, arrayData: prefs.comfortAccessibility });
    if (prefs.dietRestrictions?.length) items.push({ label: "Diet restrictions", value: `${prefs.dietRestrictions.length} items`, isArray: true, arrayData: prefs.dietRestrictions });
    if (prefs.allergies?.length) items.push({ label: "Allergies", value: `${prefs.allergies.length} items`, isArray: true, arrayData: prefs.allergies });
    if (prefs.themes?.length) items.push({ label: "Themes / Interests", value: `${prefs.themes.length} items`, isArray: true, arrayData: prefs.themes });
    if (prefs.locations?.length) items.push({ label: "Preferred locations", value: `${prefs.locations.length} locations`, isArray: true, arrayData: prefs.locations });
  } else if (category === "service") {
    if (prefs.thoroughness) items.push({ label: "Thoroughness", value: prefs.thoroughness, isArray: false });
    if (prefs.timePrecision) items.push({ label: "Time precision", value: prefs.timePrecision, isArray: false });
    if (prefs.proofOfWork?.length) items.push({ label: "Proof of work", value: `${prefs.proofOfWork.length} items`, isArray: true, arrayData: prefs.proofOfWork });
    if (prefs.immediateDamageReport) items.push({ label: "Immediate damage report", value: "Immediate", isArray: false });
    if (prefs.ecoSupplies) items.push({ label: "Eco supplies", value: "Yes", isArray: false });
    if (prefs.unscented) items.push({ label: "Unscented products", value: "Yes", isArray: false });
    if (prefs.linensHandling) items.push({ label: "Linens handling", value: prefs.linensHandling, isArray: false });
    if (prefs.professionalism?.length) items.push({ label: "Professionalism", value: `${prefs.professionalism.length} items`, isArray: true, arrayData: prefs.professionalism });
    if (prefs.petSafety) items.push({ label: "Pet safety", value: "Yes", isArray: false });
    if (prefs.entryMethod) items.push({ label: "Entry", value: prefs.entryMethod, isArray: false });
    if (prefs.supervision) items.push({ label: "Supervision", value: prefs.supervision, isArray: false });
    if (prefs.scheduleWindow) items.push({ label: "Schedule window", value: prefs.scheduleWindow, isArray: false });
    if (prefs.scheduleDays?.length) items.push({ label: "Schedule days", value: prefs.scheduleDays.join(", "), isArray: false });
    if (prefs.quietHours) items.push({ label: "Quiet hours", value: prefs.quietHours, isArray: false });
    if (prefs.focusChecklist?.length) items.push({ label: "Focus checklist", value: `${prefs.focusChecklist.length} items`, isArray: true, arrayData: prefs.focusChecklist });
    if (prefs.serviceTypes?.length) items.push({ label: "Service types", value: `${prefs.serviceTypes.length} items`, isArray: true, arrayData: prefs.serviceTypes });
    if (prefs.languages?.length) items.push({ label: "Languages", value: `${prefs.languages.length} items`, isArray: true, arrayData: prefs.languages });
    if (prefs.locations?.length) items.push({ label: "Preferred locations", value: `${prefs.locations.length} locations`, isArray: true, arrayData: prefs.locations });
  }
  
  return items;
}

// Helper to get icon for preference label
function labelIcon(label) {
  const L = (label || "").toLowerCase();
  if (L.includes("privacy")) return Shield;
  if (L.includes("cleanliness")) return Sparkles;
  if (L.includes("scent")) return Sun;
  if (L.includes("sheets") || L.includes("thread") || L.includes("towels") || L.includes("pillow") || L.includes("duvet") || L.includes("mattress")) return BedDouble;
  if (L.includes("noise")) return Volume2;
  if (L.includes("quiet hours")) return Clock;
  if (L.includes("lighting") || L.includes("hot water")) return Sun;
  if (L.includes("wi-fi") || L.includes("wifi") || L.includes("workspace")) return Wifi;
  if (L.startsWith("desk")) return Wrench;
  if (L.includes("host interaction") || L.includes("rules")) return Tag;
  return Tag; // default icon
}

// Guest Profile Modal Component
const GuestProfileModal = ({ open, guest, listingCategory, onClose }) => {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(false);
  const [guestProfile, setGuestProfile] = useState(null);
  const [guestPhotoError, setGuestPhotoError] = useState(false);

  // Determine the category filter based on listing category
  const categoryFilter = useMemo(() => {
    const cat = (listingCategory || "").toString().toLowerCase().trim();
    // Check for "experience" first since it's more specific
    if (cat.includes("experience")) return "experience";
    // Then check for "service"
    if (cat.includes("service")) return "service";
    // Finally check for "home"
    if (cat.includes("home")) return "home";
    return "home"; // default
  }, [listingCategory]);

  // Load guest profile and preferences
  useEffect(() => {
    if (!open || !guest?.uid) {
      setGuestProfile(null);
      setPreferences(null);
      setGuestPhotoError(false);
      return;
    }

    let isActive = true;
    setLoading(true);
    setGuestPhotoError(false);

    const loadData = async () => {
      try {
        // Load guest profile and preferences in parallel
        const [profile, prefSnap] = await Promise.all([
          fetchGuestProfile(guest.uid),
          getDoc(doc(database, "preferences", guest.uid)).catch(() => null),
        ]);
        
        if (!isActive) return;
        setGuestProfile(profile);

        // Load preferences for the specific category
        if (prefSnap?.exists()) {
          const prefData = prefSnap.data() || {};
          // Get preferences for the specific category
          const categoryKey = categoryFilter === "home" ? "homes" : categoryFilter === "service" ? "services" : "experiences";
          const categoryPrefs = prefData[categoryKey] || {};
          setPreferences(categoryPrefs);
        } else {
          setPreferences({});
        }
      } catch (error) {
        console.error("Error loading guest profile/preferences:", error);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadData();

    return () => {
      isActive = false;
    };
  }, [open, guest?.uid, categoryFilter]);

  if (!open) return null;

  const guestName = guestProfile?.displayName || 
    [guestProfile?.firstName, guestProfile?.lastName].filter(Boolean).join(" ").trim() ||
    guest?.displayName ||
    "Guest";
  const guestInitial = guestName?.[0]?.toUpperCase() || "G";
  const guestPhoto = guestProfile?.photoURL || guest?.photoURL;

  const categoryLabels = {
    home: { label: "Homes", icon: Building2 },
    service: { label: "Services", icon: Handshake },
    experience: { label: "Experiences", icon: Sparkles },
  };

  const categoryInfo = categoryLabels[categoryFilter] || categoryLabels.home;
  const CategoryIcon = categoryInfo.icon;

  return (
    <Overlay onBackdropClick={onClose}>
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden grid place-items-center text-slate-700 font-semibold shrink-0">
              {guestPhoto && !guestPhotoError ? (
                <img
                  src={guestPhoto}
                  alt={guestName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  onError={() => setGuestPhotoError(true)}
                />
              ) : (
                <span className="text-xl">{guestInitial}</span>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{guestName}'s Profile</h2>
              {guestProfile?.email && (
                <p className="text-sm text-slate-600 mt-0.5">{guestProfile.email}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Wishlist Preferences Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Heart size={20} className="text-rose-500" />
              <h3 className="text-lg font-semibold text-slate-900">
                Wishlist — {categoryInfo.label}
              </h3>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-blue-600" />
                <span className="ml-2 text-sm text-slate-600">Loading preferences...</span>
              </div>
            ) : (() => {
              const prefItems = preferences ? getFullPrefSummary(preferences, categoryFilter) : [];
              return prefItems.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {prefItems.map((item, idx) => {
                    const Icon = labelIcon(item.label);
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200"
                      >
                        <Icon size={16} className="text-slate-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate">{item.label}</p>
                          <p className="text-xs text-slate-600 truncate">{item.value}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-slate-600">No preferences set for {categoryInfo.label.toLowerCase()}</p>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </Overlay>
  );
};

const BookingDetailsModal = ({ open, booking, onClose, onRequestCancel, onConfirm }) => {
  const [listing, setListing] = useState(null);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [guest, setGuest] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatText, setChatText] = useState("");
  const [showGuestProfile, setShowGuestProfile] = useState(false);
  const [guestPhotoError, setGuestPhotoError] = useState(false);
  const [showClaimRewardModal, setShowClaimRewardModal] = useState(false);
  const chatEndRef = useRef(null);
  const navigate = useNavigate();

  const currentSignedUid = auth.currentUser?.uid || null;
  const otherUid = booking?.uid || guest?.uid || null;

  // Data fetching effect
  useEffect(() => {
    if (!open || !booking) return;
    
    let isActive = true;
    setGuestPhotoError(false);
    
    const loadData = async () => {
      const [freshListing, guestProfile] = await Promise.all([
        hydrateListingForBooking(booking),
        fetchGuestProfile(booking?.uid),
      ]);
      
      if (!isActive) return;
      setListing(freshListing);
      setGuest(guestProfile);
      setCurrentPhoto(0);
    };

    loadData();
    
    return () => { isActive = false; };
  }, [open, booking?.id, booking?.uid]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    
    return () => { document.body.style.overflow = prevOverflow || ""; };
  }, [open]);

  // Chat reset
  useEffect(() => {
    if (!open) {
      setChatOpen(false);
      setChatMsgs([]);
      setChatText("");
    }
  }, [open, booking?.id]);

  // Chat subscription
  useEffect(() => {
    if (!open || !chatOpen || !currentSignedUid || !otherUid) return;

    const messages = [];
    
    const queryA = query(
      collection(database, "messages"),
      where("senderId", "==", currentSignedUid),
      where("receiverId", "==", otherUid)
    );
    
    const queryB = query(
      collection(database, "messages"),
      where("senderId", "==", otherUid),
      where("receiverId", "==", currentSignedUid)
    );

    const mergeAndSetMessages = () => {
      const sorted = messages
        .slice()
        .sort((a, b) => {
          const sa = a?.timestamp?.seconds ?? 0;
          const sb = b?.timestamp?.seconds ?? 0;
          const na = a?.timestamp?.nanoseconds ?? 0;
          const nb = b?.timestamp?.nanoseconds ?? 0;
          return sa === sb ? na - nb : sa - sb;
        });
        
      setChatMsgs(sorted);
      requestAnimationFrame(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }));
    };

    const unsubscribeA = onSnapshot(queryA, (snapshot) => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]._dir === "A") messages.splice(i, 1);
      }
      snapshot.forEach((doc) => messages.push({ ...doc.data(), _dir: "A" }));
      mergeAndSetMessages();
    });

    const unsubscribeB = onSnapshot(queryB, (snapshot) => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]._dir === "B") messages.splice(i, 1);
      }
      snapshot.forEach((doc) => messages.push({ ...doc.data(), _dir: "B" }));
      mergeAndSetMessages();
    });

    return () => {
      unsubscribeA();
      unsubscribeB();
    };
  }, [open, chatOpen, currentSignedUid, otherUid]);

  const sendInlineMessage = async () => {
    const text = chatText.trim();
    if (!text || !currentSignedUid || !otherUid) return;

    try {
      await deleteDoc(doc(database, "users", currentSignedUid, "deletedConversations", otherUid));
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }

    try {
      await addDoc(collection(database, "messages"), {
        uid: currentSignedUid,
        senderId: currentSignedUid,
        receiverId: otherUid,
        message: text,
        timestamp: serverTimestamp(),
      });
      setChatText("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleNextPhoto = (e) => {
    e?.stopPropagation();
    if (!hasPhotos) return;
    setCurrentPhoto((prev) => (prev + 1) % photos.length);
  };

  const handlePrevPhoto = (e) => {
    e?.stopPropagation();
    if (!hasPhotos) return;
    setCurrentPhoto((prev) => (prev - 1 + photos.length) % photos.length);
  };

  if (!open || !booking) return null;

  const title = listing?.title || booking?.listingTitle || "Untitled";
  const location = listing?.location || booking?.listingAddress || "—";
  const photos = Array.isArray(listing?.photos) ? listing.photos : (booking?.listingPhotos || []);
  const hasPhotos = photos.length > 0;
  const sBadge = statusBadge(booking.status);
  const pBadge = payBadge(booking.paymentStatus);
  const cat = normalizeCategory(listing?.category || booking?.listingCategory || "");
  const scheduleStr = booking?.schedule?.date
    ? `${fmtDateStr(booking.schedule.date)}${booking?.schedule?.time ? " • " + fmtTimeStr(booking.schedule.time) : ""}`
    : null;
  const nights = typeof booking.nights === "number" ? booking.nights : daysBetween(booking.checkIn, booking.checkOut);
  const subtotal = numberOr(booking.subtotal, NaN);
  const serviceFee = numberOr(booking.serviceFee, NaN);
  const cleaningFee = numberOr(booking.cleaningFee, NaN);
  const discountType = booking.discountType || "none";
  const discountValue = numberOr(booking.discountValue, 0);
  const totalPrice = numberOr(booking.totalPrice, NaN);
  
  // Check if host can claim reward (paid booking with service fee, no existing reward claimed)
  const isPaid = (booking?.paymentStatus || "").toLowerCase() === "paid";
  const hasServiceFee = !Number.isNaN(serviceFee) && serviceFee > 0;
  const hasHostRewardClaimed = booking?.hostRewardId && booking?.hostRewardCashback;
  const canClaimReward = isPaid && hasServiceFee && !hasHostRewardClaimed;
  
  // Check if booking is pending (can be confirmed or cancelled by host)
  const bookingStatus = (booking?.status || "").toLowerCase();
  const isPending = bookingStatus === "pending" && isPaid;
  
  const guestName = booking?.guestName ||
    guest?.displayName ||
    [guest?.firstName, guest?.lastName].filter(Boolean).join(" ").trim() ||
    booking?.guestEmail ||
    "Guest";
  const guestInitial = guestName?.[0]?.toUpperCase() || "G";
  const guestPhoto = guest?.photoURL;

  const createdAt =
    booking?.createdAt?.toDate?.() ? booking.createdAt.toDate() :
    (booking?.createdAt instanceof Date ? booking.createdAt : null);

  const policyText = listing?.cancellationPolicy || "";

  // Removed unused components: chips, Field, PillList, FullDetails
  // Only booking-specific information is displayed in the modal

  return (
    <Overlay onBackdropClick={onClose}>
      <div
        className={[
          "relative w-full h-[100vh] sm:h-[90vh] sm:max-w-[1200px]",
          "grid grid-rows-[auto,1fr] md:grid-rows-1 md:grid-cols-2",
          "min-h-0 rounded-none sm:rounded-[2rem] overflow-hidden",
          "bg-white/60",
          "backdrop-blur-sm border-2 border-white/60",
          "shadow-md",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-[2147483646] inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/95 border border-white/70 shadow hover:shadow-md hover:bg-white transition"
        >
          <X className="w-5 h-5 text-gray-700" />
        </button>

        {/* Photo Gallery - Desktop */}
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
                onClick={handlePrevPhoto}
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-gray-800 grid place-items-center shadow"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNextPhoto}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-gray-800 grid place-items-center shadow"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {photos.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => { e.stopPropagation(); setCurrentPhoto(index); }}
                    className={`h-2 w-2 rounded-full ${index === currentPhoto ? "bg-white" : "bg-white/60"}`}
                    aria-label={`Go to photo ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Photo Gallery - Mobile */}
        <div className="md:hidden relative h-64 w-full bg-gray-900/90">
          {hasPhotos ? (
            <>
              <img 
                src={photos[currentPhoto]} 
                alt={`${title} - photo ${currentPhoto + 1}`} 
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
                onClick={handlePrevPhoto}
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-gray-800 grid place-items-center shadow"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNextPhoto}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-gray-800 grid place-items-center shadow"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {photos.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => { e.stopPropagation(); setCurrentPhoto(index); }}
                    className={`h-2.5 w-2.5 rounded-full ${index === currentPhoto ? "bg-white" : "bg-white/60"}`}
                    aria-label={`Go to photo ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Content Panel */}
        <div className="relative h-full min-h-0 grid grid-rows-[1fr,auto] bg-gradient-to-br from-blue-50/35 via-white/55 to-indigo-50/35">
          <div className="min-h-0 overflow-y-auto">
            <div className="max-w-[720px] mx-auto px-5 sm:px-6 md:px-7 py-5 sm:py-6 md:py-7 space-y-6 sm:space-y-7">
              {/* Header Section */}
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

              {/* Guest Information Section */}
              <section className="rounded-3xl bg-white/80 backdrop-blur border border-white/60 p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-12 h-12 rounded-full bg-white/70 border border-white/60 overflow-hidden grid place-items-center text-gray-900 font-semibold ring-4 ring-white/60 shrink-0">
                      {guestPhoto && !guestPhotoError ? (
                        <img
                          src={guestPhoto}
                          alt={guestName}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          onError={() => setGuestPhotoError(true)}
                        />
                      ) : (
                        <span className="text-base">{guestInitial}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] sm:text-base font-semibold text-gray-900 truncate">{guestName}</p>
                      {guest?.email && (
                        <p className="text-[13px] sm:text-sm text-gray-600 truncate">{guest.email}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowGuestProfile(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-600 hover:bg-slate-700 text-white text-sm font-semibold px-4 py-2 shadow"
                    >
                      <User size={16} />
                      View Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => setChatOpen((v) => !v)}
                      className="inline-flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 shadow"
                    >
                      {chatOpen ? "Hide Chat" : "Message Guest"}
                    </button>
                  </div>
                </div>

                {/* Inline Chat Panel */}
                {chatOpen && (
                  <div className="mt-4 rounded-2xl border border-white/60 bg-white/90 backdrop-blur-sm shadow-sm">
                    <div className="px-3 py-2 border-b border-slate-200 text-sm font-semibold text-slate-800">
                      Chat with {guestName}
                    </div>
                    <div className="h-56 overflow-y-auto p-3 bg-slate-50/70">
                      {chatMsgs.length === 0 ? (
                        <div className="h-full grid place-items-center text-sm text-slate-500">
                          Say hello 👋
                        </div>
                      ) : (
                        chatMsgs.map((message, index) => {
                          const isOwnMessage = message.senderId === currentSignedUid;
                          return (
                            <div
                              key={`${message.timestamp?.seconds || 0}-${index}`}
                              className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} mb-2`}
                            >
                              <div
                                className={`max-w-[75%] rounded-2xl px-3 py-2 shadow ${
                                  isOwnMessage
                                    ? "bg-blue-600 text-white"
                                    : "bg-white text-gray-800 border border-gray-200"
                                }`}
                              >
                                <span className="text-[13.5px] leading-snug">{message.message}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <div className="p-2 border-t border-slate-200 bg-white/80">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Type a message…"
                          value={chatText}
                          onChange={(e) => setChatText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && sendInlineMessage()}
                          className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                        />
                        <button
                          onClick={sendInlineMessage}
                          disabled={!chatText.trim()}
                          className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 shadow disabled:opacity-50 disabled:pointer-events-none"
                          aria-label="Send"
                        >
                          <Send size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Booking Details Section */}
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
                        {(booking.adults || 0) + (booking.children || 0) + (booking.infants || 0)} guests
                        {typeof booking.adults === "number" ? ` — ${booking.adults} adults` : ""}
                        {typeof booking.children === "number" ? `, ${booking.children} children` : ""}
                        {typeof booking.infants === "number" ? `, ${booking.infants} infants` : ""}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                      <div className="flex items-center gap-2">
                      <CalIcon size={16} />
                      <span>{scheduleStr || "—"}</span>
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
                  {!Number.isNaN(subtotal) && (
                    <div className="flex items-center justify-between">
                        <span className="text-slate-600">Subtotal</span>
                        <span className="font-medium text-slate-900">₱{subtotal.toLocaleString()}</span>
                    </div>
                  )}
                  {!Number.isNaN(cleaningFee) && cleaningFee > 0 && (
                    <div className="flex items-center justify-between">
                        <span className="text-slate-600">Cleaning fee</span>
                        <span className="text-slate-900">₱{cleaningFee.toLocaleString()}</span>
                    </div>
                  )}
                  {!Number.isNaN(serviceFee) && (
                    <div className="flex items-center justify-between">
                        <span className="text-slate-600">Service fee</span>
                        <span className="text-slate-900">₱{serviceFee.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {hasHostRewardClaimed && (
                    <div className="flex items-center justify-between text-purple-700">
                      <span className="flex items-center gap-1">
                        <Gift size={14} />
                        Reward Cashback
                      </span>
                      <span className="font-medium">+ ₱{Number(booking.hostRewardCashback || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {discountType !== "none" && discountValue > 0 && (
                    <div className="flex items-center justify-between text-emerald-700">
                      <span>Discount ({discountType})</span>
                        <span className="font-medium">− ₱{discountValue.toLocaleString()}</span>
                    </div>
                  )}

                    <div className="my-2 h-px bg-slate-200" />

                  {!Number.isNaN(totalPrice) ? (
                      <div className="flex items-center justify-between pt-1">
                      <span className="text-base font-bold text-slate-900">Total</span>
                      <span className="text-base font-bold text-blue-700">
                        ₱{totalPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">Total unavailable.</div>
                  )}
                  </div>
                </div>
              </section>

              {/* Cancellation Policy */}
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

          {/* Footer Actions */}
          <div
            className="w-full bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-t border-white/50 px-4 pt-4 pb-6 sm:pb-6"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
          >
            <div className="flex flex-col sm:flex-row gap-3">
              {isPending && (
                <>
                  <button
                    type="button"
                    onClick={() => onConfirm && onConfirm(booking)}
                    className="w-full sm:w-auto flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-700 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-emerald-500 hover:to-emerald-700 active:scale-[0.99] transition"
                  >
                    <CheckCircle2 size={16} />
                    Confirm Booking
                  </button>
                  <button
                    type="button"
                    onClick={() => onRequestCancel && onRequestCancel(booking)}
                    className="w-full sm:w-auto flex-1 min-w-[140px] inline-flex items-center justify-center rounded-full bg-gradient-to-r from-rose-600 to-rose-700 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-rose-500 hover:to-rose-700 active:scale-[0.99] transition"
                  >
                    Cancel Booking
                  </button>
                </>
              )}
              {!isPending && canClaimReward && (
                <button
                  type="button"
                  onClick={() => setShowClaimRewardModal(true)}
                  className="w-full sm:w-auto flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-purple-700 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-purple-500 hover:to-purple-700 active:scale-[0.99] transition"
                >
                  <Gift size={16} />
                  Claim Reward
                </button>
              )}
              {!isPending && isCancelable(booking) && (
                <button
                  type="button"
                  onClick={() => onRequestCancel && onRequestCancel(booking)}
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
      </div>
      
      {/* Guest Profile Modal */}
      <GuestProfileModal
        open={showGuestProfile}
        guest={guest}
        listingCategory={listing?.category || booking?.listingCategory}
        onClose={() => setShowGuestProfile(false)}
      />

      {/* Claim Reward Modal */}
      <ClaimRewardModal
        open={showClaimRewardModal}
        onClose={() => {
          setShowClaimRewardModal(false);
          // Reload booking to show updated reward info
          if (booking?.id) {
            // Trigger a refresh by closing and reopening would work, but for now just close
          }
        }}
        booking={booking}
        serviceFee={serviceFee}
      />
    </Overlay>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function TodayTab() {
  // Authentication state
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Bookings data
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // UI state
  const [tab, setTab] = useState("today");
  const [cancelledFilter, setCancelledFilter] = useState("all"); // "all", "for_refund", "refunded"
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [reasonOpen, setReasonOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [policyText, setPolicyText] = useState("");
  const [submittingCancel, setSubmittingCancel] = useState(false);
  const [refundPercentage, setRefundPercentage] = useState(100);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState(null);
  // Refund modal state
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundModalPolicyText, setRefundModalPolicyText] = useState("");
  const [refundModalPercentage, setRefundModalPercentage] = useState(100);
  const [submittingRefund, setSubmittingRefund] = useState(false);
  // Refund success modal state
  const [refundSuccessModalOpen, setRefundSuccessModalOpen] = useState(false);
  const [refundSuccessData, setRefundSuccessData] = useState(null);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user || null);
      setAuthLoading(false);
    });
    
    return unsubscribe;
  }, []);

  const uid = authUser?.uid || null;

  // Bookings subscription - only fetch host bookings
  useEffect(() => {
    if (!uid) {
      setRows([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);

    // Store unsubscribe functions
    const unsubs = [];
    let cancelled = false;
    
    // First, get all listing IDs owned by this host
    (async () => {
      try {
        // Query listings by multiple fields to catch all host's listings
        const q1 = query(collection(database, "listings"), where("uid", "==", uid));
        const q2 = query(collection(database, "listings"), where("hostId", "==", uid));
        const q3 = query(collection(database, "listings"), where("ownerId", "==", uid));

        const [snap1, snap2, snap3] = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);
        
        if (cancelled) return;

        const listingIdsSet = new Set();
        [snap1, snap2, snap3].forEach((snap) => {
          snap.docs.forEach((d) => listingIdsSet.add(d.id));
        });
        const listingIds = Array.from(listingIdsSet);
        
        // Query bookings by hostId, ownerId, and listingId
        const bookingsMap = new Map();
        
        const processBookings = () => {
          if (cancelled) return;
          const rows = Array.from(bookingsMap.values());
          
          rows.sort((a, b) => {
        const aSeconds = a?.createdAt?.seconds || 0;
        const bSeconds = b?.createdAt?.seconds || 0;
        const aNanos = a?.createdAt?.nanoseconds || 0;
        const bNanos = b?.createdAt?.nanoseconds || 0;
        return bSeconds === aSeconds ? bNanos - aNanos : bSeconds - aSeconds;
      });
      
          setRows(rows);
      setLoading(false);
    };

        // Query bookings by hostId
        const hostQuery = query(collection(database, "bookings"), where("hostId", "==", uid));
        const unsubHost = onSnapshot(hostQuery, (snapshot) => {
          if (cancelled) return;
          snapshot.docs.forEach((d) => {
            bookingsMap.set(d.id, { id: d.id, ...d.data() });
          });
          processBookings();
        }, (err) => {
          console.error("Host bookings query error:", err);
          if (!cancelled) setLoading(false);
        });
        unsubs.push(unsubHost);
        
        // Query bookings by ownerId
        const ownerQuery = query(collection(database, "bookings"), where("ownerId", "==", uid));
        const unsubOwner = onSnapshot(ownerQuery, (snapshot) => {
          if (cancelled) return;
          snapshot.docs.forEach((d) => {
            bookingsMap.set(d.id, { id: d.id, ...d.data() });
          });
          processBookings();
        }, (err) => {
          console.error("Owner bookings query error:", err);
          if (!cancelled) setLoading(false);
        });
        unsubs.push(unsubOwner);
        
        // Query bookings by listingId (chunked due to Firestore's 'in' clause limit of 10)
        if (listingIds.length > 0) {
          const chunkSize = 10;
          for (let i = 0; i < listingIds.length; i += chunkSize) {
            const chunk = listingIds.slice(i, i + chunkSize);
            const listingQuery = query(collection(database, "bookings"), where("listingId", "in", chunk));
            const unsubListing = onSnapshot(listingQuery, (snapshot) => {
              if (cancelled) return;
              snapshot.docs.forEach((d) => {
                const data = d.data();
                // Only include if this listing is owned by the host (double-check)
                if (listingIdsSet.has(data.listingId)) {
                  bookingsMap.set(d.id, { id: d.id, ...data });
                }
              });
              processBookings();
            }, (err) => {
              console.error("Listing bookings query error:", err);
              if (!cancelled && i + chunkSize >= listingIds.length) setLoading(false);
            });
            unsubs.push(unsubListing);
          }
        } else {
          // No listings, but we still want to process host/owner bookings
          processBookings();
        }
      } catch (e) {
        console.error("Failed to load listings for bookings:", e);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((unsub) => unsub());
    };
  }, [uid]);

  // Date helpers for filtering
  const todayKey = (() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  })();

  const isDateToday = (date) => {
    try {
      const key = new Date(`${date}T00:00:00`).toISOString().slice(0, 10);
      return key === todayKey;
    } catch {
      return false;
    }
  };

  const isStayToday = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return false;
    
    const start = checkIn?.toDate ? checkIn.toDate() : new Date(checkIn);
    const end = checkOut?.toDate ? checkOut.toDate() : new Date(checkOut);
    const today = new Date();
    
    const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    return todayDate >= startDate && todayDate < endDate;
  };

  // Filtered bookings
  const cancelledBookings = useMemo(
    () =>
      rows.filter(
        (booking) =>
          ["cancelled", "canceled", "rejected"].includes((booking.status || "").toLowerCase()) ||
          ["refunded", "failed"].includes((booking.paymentStatus || "").toLowerCase())
      ),
    [rows]
  );

  // Filter cancelled bookings by sub-category
  const filteredCancelledBookings = useMemo(() => {
    if (cancelledFilter === "all") return cancelledBookings;
    
    const hostUid = authUser?.uid || null;
    
    if (cancelledFilter === "for_refund") {
      // Bookings cancelled by guest (uid !== hostUid) and not yet refunded
      return cancelledBookings.filter((booking) => {
        const bookingUid = booking?.uid || null;
        const refundAmount = numberOr(booking?.refundAmount, 0);
        // Cancelled by guest (not host) and no refund processed yet
        return bookingUid && bookingUid !== hostUid && refundAmount === 0;
      });
    }
    
    if (cancelledFilter === "refunded") {
      // Bookings that have been refunded
      return cancelledBookings.filter((booking) => {
        const refundAmount = numberOr(booking?.refundAmount, 0);
        return refundAmount > 0;
      });
    }
    
    return cancelledBookings;
  }, [cancelledBookings, cancelledFilter, authUser?.uid]);

  const todayBookings = useMemo(
    () =>
      rows.filter((booking) => {
        const status = (booking.status || "").toLowerCase();
        if (["cancelled", "canceled", "rejected"].includes(status)) return false;
        
        const category = normalizeCategory(booking.listing?.category || booking.listingCategory || "");
        
        if (category.startsWith("home")) return isStayToday(booking.checkIn, booking.checkOut);
        if (booking?.schedule?.date) return isDateToday(booking.schedule.date);
        
        return false;
      }),
    [rows]
  );

  const upcomingBookings = useMemo(
    () =>
      rows.filter((booking) => {
        const status = (booking.status || "").toLowerCase();
        if (["cancelled", "canceled", "rejected"].includes(status)) return false;
        
        const category = normalizeCategory(booking.listing?.category || booking.listingCategory || "");
        const now = new Date();
        
        if (category.startsWith("home")) {
          const checkIn = booking.checkIn?.toDate?.() ?? null;
          return checkIn && checkIn > now && !isStayToday(booking.checkIn, booking.checkOut);
        }
        
        if (booking?.schedule?.date) {
          const scheduleTime = new Date(`${booking.schedule.date}T${booking.schedule.time || "00:00"}`);
          return scheduleTime > now && !isDateToday(booking.schedule.date);
        }
        
        return false;
      }),
    [rows]
  );

  const tabbedBookings = tab === "today" ? todayBookings : 
                        tab === "upcoming" ? upcomingBookings : 
                        filteredCancelledBookings;

  // Statistics calculations
  // Note: rows now only contains host bookings (fetched by hostId, ownerId, and listingId)
  const stats = useMemo(() => {
    const totalBookings = rows.length;
    const todayCount = todayBookings.length;
    const upcomingCount = upcomingBookings.length;
    const cancelledCount = cancelledBookings.length;
    
    // Calculate total revenue from confirmed/paid host bookings
    const totalRevenue = rows
      .filter((b) => {
        const status = (b.status || "").toLowerCase();
        const paymentStatus = (b.paymentStatus || "").toLowerCase();
        return (
          !["cancelled", "canceled", "rejected"].includes(status) &&
          !["refunded", "failed"].includes(paymentStatus)
        );
      })
      .reduce((sum, b) => {
        const price = numberOr(b.totalPrice, 0);
        return sum + price;
      }, 0);

    return {
      totalBookings,
      todayCount,
      upcomingCount,
      cancelledCount,
      totalRevenue,
    };
  }, [rows, todayBookings, upcomingBookings, cancelledBookings]);

  // Cancel flow handlers
  const loadPolicyForBooking = async (booking) => {
    if (booking?.listing?.cancellationPolicy) {
      return String(booking.listing.cancellationPolicy);
    }
    
    if (booking?.listingId) {
      try {
        const listingDoc = await getDoc(doc(database, "listings", booking.listingId));
        if (listingDoc.exists()) {
          const data = listingDoc.data();
          return data?.cancellationPolicy || 
                 data?.policy?.cancellation || 
                 data?.cancellation_policy || 
                 "";
        }
      } catch (error) {
        console.error("Failed to fetch cancellation policy:", error);
      }
    }
    
    return "";
  };

  const startCancel = (booking) => {
    setCancelTarget(booking);
    setCancelReason("");
    setPolicyText("");
    setRefundPercentage(100); // Default to 100% refund
    setReasonOpen(true);
    setConfirmOpen(false);
  };

  // Refund flow handlers
  const startRefund = async (booking) => {
    setRefundTarget(booking);
    setRefundModalPercentage(100); // Default to 100% refund
    const policy = await loadPolicyForBooking(booking);
    setRefundModalPolicyText(policy || "");
    setRefundModalOpen(true);
  };

  // Handle booking confirmation
  const handleConfirmBooking = async (booking) => {
    if (!booking || !booking.id) return;
    
    try {
      // Update booking status to "confirmed"
      const bookingRef = doc(database, "bookings", booking.id);
      await updateDoc(bookingRef, {
        status: "confirmed",
        updatedAt: serverTimestamp(),
      });

      // Send confirmation email to guest (simple approach, matching HomeDetailsPage)
      const isDevelopment = typeof window !== "undefined" && 
                           (window.location.hostname === "localhost" || 
                            window.location.hostname === "127.0.0.1");
      
      let emailSent = false;
      try {
        const listing = await hydrateListingForBooking(booking);
        const guestProfile = await fetchGuestProfile(booking?.uid);
        
        const guestUser = {
          displayName: booking?.guestName || guestProfile?.displayName || "",
          email: booking?.guestEmail || guestProfile?.email || "",
        };
        
        if (guestUser.email) {
          await sendBookingConfirmationEmail({
            user: guestUser,
            listing,
            totalAmount: numberOr(booking?.totalPrice, 0),
            paymentStatus: "paid",
          });
          emailSent = true;
        }
      } catch (emailError) {
        // Handle different types of errors
        const errorMessage = emailError?.message || String(emailError);
        const errorStatus = emailError?.status || emailError?.text;
        const isCorsError = errorMessage.includes("Failed to fetch") || errorMessage.includes("CORS");
        const is400Error = errorStatus === 400 || errorMessage.includes("400") || errorMessage.includes("Bad Request");
        
        if (isCorsError && isDevelopment) {
          console.log("[EmailJS] Email blocked by CORS in development - this is expected. Emails will work in production.");
        } else if (is400Error) {
          console.error("[EmailJS] Email failed with 400 Bad Request - check EmailJS template parameters:", {
            error: emailError,
            status: errorStatus,
            message: errorMessage,
          });
          console.warn("[EmailJS] This usually means a parameter doesn't match your EmailJS template. Check:", {
            serviceId: EMAILJS_SERVICE_ID,
            templateId: EMAILJS_TEMPLATE_ID,
            publicKey: EMAILJS_PUBLIC_KEY ? "Set" : "Missing",
          });
        } else {
          console.error("[EmailJS] Email send failed:", emailError);
        }
        // Don't fail the confirmation if email fails
      }
      
      if (emailSent && !isDevelopment) {
        alert("Booking confirmed! Confirmation email has been sent to the guest.");
      } else if (isDevelopment) {
        alert("Booking confirmed! Email notifications will work when deployed to production.");
      } else {
        alert("Booking confirmed! Confirmation email will be sent to the guest.");
      }
      closeDetails();
    } catch (error) {
      console.error("Failed to confirm booking:", error);
      alert(`Failed to confirm booking: ${error?.message || "Unknown error"}`);
    }
  };

  const handleConfirmRefund = async () => {
    if (!refundTarget || !refundTarget.id) return;
    
    setSubmittingRefund(true);
    
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Not signed in");
      
      // Validate refund percentage
      if (refundModalPercentage < 0 || refundModalPercentage > 100) {
        throw new Error("Refund percentage must be between 0 and 100.");
      }
      
      // Check if booking has already been refunded
      const existingRefundAmount = numberOr(refundTarget?.refundAmount, 0);
      if (existingRefundAmount > 0) {
        throw new Error(`This booking has already been refunded (₱${existingRefundAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}). Cannot process duplicate refund.`);
      }
      
      // Check if booking is cancelled
      const bookingStatus = (refundTarget?.status || "").toLowerCase();
      if (!["cancelled", "canceled", "rejected"].includes(bookingStatus)) {
        throw new Error("Refunds can only be processed for cancelled bookings.");
      }
      
      const bookingTotal = numberOr(refundTarget?.totalPrice, 0);
      if (bookingTotal <= 0) {
        throw new Error("Invalid booking total. Cannot process refund.");
      }
      
      const refundAmount = (bookingTotal * refundModalPercentage) / 100;
      const guestUid = refundTarget?.uid || null;
      
      if (!guestUid) {
        throw new Error("Guest UID not found in booking. Cannot process refund.");
      }
      
      // Process refund: credit guest wallet and deduct from host wallet
      if (refundAmount > 0 && guestUid) {
        // Get host ID from booking
        const hostId = refundTarget?.hostId || refundTarget?.ownerId || currentUser.uid;
        
        if (!hostId) {
          console.warn("Host ID not found in booking, using current user UID");
        }
        
        try {
          await runTransaction(database, async (tx) => {
            // STEP 1: ALL READS FIRST (Firestore requirement)
            const wrefGuest = doc(database, "guestWallets", guestUid);
            const wrefHost = doc(database, "wallets", hostId);
            
            const wSnapGuest = await tx.get(wrefGuest);
            const wSnapHost = await tx.get(wrefHost);
            
            // Calculate balances
            const guestCurrentBal = Number(wSnapGuest.data()?.balance || 0);
            const guestNewBal = guestCurrentBal + refundAmount;
            
            const hostCurrentBal = Number(wSnapHost.data()?.balance || 0);
            
            // Check if host has sufficient balance
            if (hostCurrentBal < refundAmount) {
              throw new Error(`Insufficient host wallet balance. Required: ₱${refundAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}, Available: ₱${hostCurrentBal.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
            }
            
            const hostNewBal = hostCurrentBal - refundAmount;
            
            // STEP 2: ALL WRITES AFTER ALL READS
            const walletTxGuestRef = doc(collection(database, "guestWallets", guestUid, "transactions"));
            const walletTxHostRef = doc(collection(database, "wallets", hostId, "transactions"));
            
            // Credit guest wallet
            tx.set(
              wrefGuest,
              {
                uid: guestUid,
                balance: guestNewBal,
                currency: "PHP",
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
            
            // Log refund transaction in guest wallet
            tx.set(walletTxGuestRef, {
              uid: guestUid,
              type: "refund",
              delta: +refundAmount,
              amount: refundAmount,
              status: "completed",
              method: "system",
              note: `Refund for cancelled booking ${refundTarget.id}${refundTarget?.listingTitle ? ` — ${refundTarget.listingTitle}` : ""}`,
              metadata: { 
                bookingId: refundTarget.id, 
                listingId: refundTarget?.listingId || null,
                refundPercentage: refundModalPercentage,
                processedBy: currentUser.uid,
              },
              balanceAfter: guestNewBal,
              timestamp: serverTimestamp(),
            });
            
            // Deduct from host wallet (create if doesn't exist, then update)
            if (!wSnapHost.exists()) {
              tx.set(wrefHost, {
                uid: hostId,
                balance: hostNewBal,
                currency: "PHP",
                updatedAt: serverTimestamp(),
              });
            } else {
              tx.set(
                wrefHost,
                {
                  uid: hostId,
                  balance: hostNewBal,
                  currency: "PHP",
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );
            }
            
            // Log refund deduction transaction in host wallet
            tx.set(walletTxHostRef, {
              uid: hostId,
              type: "refund_deduction",
              delta: -refundAmount,
              amount: refundAmount,
              status: "completed",
              method: "system",
              note: `Refund deduction for cancelled booking ${refundTarget.id}${refundTarget?.listingTitle ? ` — ${refundTarget.listingTitle}` : ""}`,
              metadata: { 
                bookingId: refundTarget.id, 
                listingId: refundTarget?.listingId || null,
                refundPercentage: refundModalPercentage,
                guestUid: guestUid,
                processedBy: currentUser.uid,
              },
              balanceAfter: hostNewBal,
              timestamp: serverTimestamp(),
            });
          });
          console.log(`Refund processed: ₱${refundAmount} credited to guest ${guestUid}, deducted from host ${hostId}`);
        } catch (walletError) {
          console.error("Failed to process refund wallets:", walletError);
          const errorMsg = walletError?.message || String(walletError);
          const errorCode = walletError?.code || "unknown";
          console.error("Wallet error details:", {
            code: errorCode,
            message: errorMsg,
            hostId,
            guestUid,
            refundAmount,
            fullError: walletError,
          });
          
          // Show error to user but don't block the booking update
          alert(
            `Warning: Could not process wallet transactions.\n\n` +
            `Error: ${errorMsg}\n` +
            `Code: ${errorCode}\n\n` +
            `The refund has been recorded in the booking, but wallet updates may have failed.\n` +
            `Please check the console for more details.`
          );
        }
      }
      
      // Update booking with refund information
      // IMPORTANT: Preserve the original guest UID (don't overwrite it with host's UID)
      // Also check if booking still exists and hasn't been refunded by another process
      try {
        const bookingRef = doc(database, "bookings", refundTarget.id);
        const bookingSnap = await getDoc(bookingRef);
        
        if (!bookingSnap.exists()) {
          throw new Error("Booking no longer exists. Cannot process refund.");
        }
        
        const currentBookingData = bookingSnap.data();
        const currentRefundAmount = numberOr(currentBookingData?.refundAmount, 0);
        
        // Double-check: prevent duplicate refund if another process already refunded
        if (currentRefundAmount > 0) {
          throw new Error(`This booking has already been refunded (₱${currentRefundAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}). Cannot process duplicate refund.`);
        }
        
        await updateDoc(bookingRef, {
          refundAmount: refundAmount,
          refundPercentage: refundModalPercentage,
          refundedAt: serverTimestamp(),
          refundedBy: currentUser.uid, // Track who processed the refund
          uid: guestUid, // CRITICAL: Preserve the original guest UID
          // Preserve hostId and ownerId so security rules can verify host ownership
          hostId: refundTarget?.hostId || currentUser.uid,
          ownerId: refundTarget?.ownerId || refundTarget?.hostId || currentUser.uid,
          updatedAt: serverTimestamp(),
        });
      } catch (updateError) {
        console.error("Failed to update booking with refund info:", updateError);
        const errorMsg = updateError?.message || String(updateError);
        throw new Error(`Failed to update booking: ${errorMsg}`);
      }
      
      // Send EmailJS to the guest (best effort, don't fail if this fails)
      let emailSent = false;
      try {
        const emailRes = await sendCancellationEmail({
          booking: refundTarget,
          reasonText: refundTarget?.cancelReason || "Refund processed by host",
          refundAmount: refundAmount,
          guestEmail: refundTarget?.guestEmail,
          guestName: refundTarget?.guestName,
        });
        emailSent = emailRes?.ok || false;
      } catch (emailError) {
        console.error("Failed to send refund email:", emailError);
        // Don't throw - email is not critical
      }
      
      // Show success modal
      setRefundSuccessData({
        bookingId: refundTarget?.id || null,
        refundAmount: refundAmount,
        refundPercentage: refundModalPercentage,
        emailSent: emailSent,
      });
      
      // Reset flow UI
      setRefundModalOpen(false);
      setRefundTarget(null);
      setRefundModalPolicyText("");
      setRefundModalPercentage(100);
      
      // Show success modal
      setRefundSuccessModalOpen(true);
    } catch (error) {
      console.error("Process refund failed:", error);
      const errorMsg = error?.message || String(error) || "Unknown error";
      alert(`Failed to process refund: ${errorMsg}\n\nPlease check the console for more details.`);
    } finally {
      setSubmittingRefund(false);
    }
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
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Not signed in");
      
      const bookingTotal = numberOr(cancelTarget?.totalPrice, 0);
      const refundAmount = (bookingTotal * refundPercentage) / 100;
      const guestUid = cancelTarget?.uid || null;
      
      // 1) Process refund: credit guest wallet and deduct from host wallet
      if (refundAmount > 0 && guestUid) {
        // Get host ID from booking
        const hostId = cancelTarget?.hostId || cancelTarget?.ownerId || currentUser.uid;
        
        if (!hostId) {
          console.warn("Host ID not found in booking, using current user UID");
        }
        
        try {
          await runTransaction(database, async (tx) => {
            // STEP 1: ALL READS FIRST (Firestore requirement)
            const wrefGuest = doc(database, "guestWallets", guestUid);
            const wrefHost = doc(database, "wallets", hostId);
            
            const wSnapGuest = await tx.get(wrefGuest);
            const wSnapHost = await tx.get(wrefHost);
            
            // Calculate balances
            const guestCurrentBal = Number(wSnapGuest.data()?.balance || 0);
            const guestNewBal = guestCurrentBal + refundAmount;
            
            const hostCurrentBal = Number(wSnapHost.data()?.balance || 0);
            
            // Check if host has sufficient balance
            if (hostCurrentBal < refundAmount) {
              throw new Error(`Insufficient host wallet balance. Required: ₱${refundAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}, Available: ₱${hostCurrentBal.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
            }
            
            const hostNewBal = hostCurrentBal - refundAmount;
            
            // STEP 2: ALL WRITES AFTER ALL READS
            const walletTxGuestRef = doc(collection(database, "guestWallets", guestUid, "transactions"));
            const walletTxHostRef = doc(collection(database, "wallets", hostId, "transactions"));
            
            // Credit guest wallet
            tx.set(
              wrefGuest,
              {
                uid: guestUid,
                balance: guestNewBal,
                currency: "PHP",
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
            
            // Log refund transaction in guest wallet
            tx.set(walletTxGuestRef, {
              uid: guestUid,
              type: "refund",
              delta: +refundAmount,
              amount: refundAmount,
              status: "completed",
              method: "system",
              note: `Refund for cancelled booking ${cancelTarget.id}${cancelTarget?.listingTitle ? ` — ${cancelTarget.listingTitle}` : ""}`,
              metadata: { 
                bookingId: cancelTarget.id, 
                listingId: cancelTarget?.listingId || null,
                refundPercentage,
                cancelledBy: currentUser.uid,
              },
              balanceAfter: guestNewBal,
              timestamp: serverTimestamp(),
            });
            
            // Deduct from host wallet (create if doesn't exist, then update)
            if (!wSnapHost.exists()) {
              tx.set(wrefHost, {
                uid: hostId,
                balance: hostNewBal,
                currency: "PHP",
                updatedAt: serverTimestamp(),
              });
            } else {
              tx.set(
                wrefHost,
                {
                  uid: hostId,
                  balance: hostNewBal,
                  currency: "PHP",
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );
            }
            
            // Log refund deduction transaction in host wallet
            tx.set(walletTxHostRef, {
              uid: hostId,
              type: "refund_deduction",
              delta: -refundAmount,
              amount: refundAmount,
              status: "completed",
              method: "system",
              note: `Refund deduction for cancelled booking ${cancelTarget.id}${cancelTarget?.listingTitle ? ` — ${cancelTarget.listingTitle}` : ""}`,
              metadata: { 
                bookingId: cancelTarget.id, 
                listingId: cancelTarget?.listingId || null,
                refundPercentage,
                guestUid: guestUid,
                cancelledBy: currentUser.uid,
              },
              balanceAfter: hostNewBal,
              timestamp: serverTimestamp(),
            });
          });
          console.log(`Refund processed: ₱${refundAmount} credited to guest ${guestUid}, deducted from host ${hostId}`);
        } catch (walletError) {
          console.error("Failed to process refund wallets:", walletError);
          const errorMsg = walletError?.message || String(walletError);
          const errorCode = walletError?.code || "unknown";
          console.error("Wallet error details:", {
            code: errorCode,
            message: errorMsg,
            hostId,
            guestUid,
            refundAmount,
            fullError: walletError,
          });
          
          // Show error to user but don't block the cancellation
          alert(
            `Warning: Could not process wallet transactions.\n\n` +
            `Error: ${errorMsg}\n` +
            `Code: ${errorCode}\n\n` +
            `The booking will still be cancelled, but wallet updates may have failed.\n` +
            `Please check the console for more details.`
          );
        }
      }
      
      // 2) Mark booking cancelled in Firestore
      // IMPORTANT: Preserve the original guest UID (don't overwrite it with host's UID)
      // The guest UID is needed so the booking appears in the guest's cancelled list
      const originalGuestUid = cancelTarget?.uid || null;
      if (!originalGuestUid) {
        throw new Error("Guest UID not found in booking");
      }
      
      // Check if booking still exists and hasn't been cancelled/refunded already
      const bookingRef = doc(database, "bookings", cancelTarget.id);
      const bookingSnap = await getDoc(bookingRef);
      
      if (!bookingSnap.exists()) {
        throw new Error("Booking no longer exists. Cannot cancel.");
      }
      
      const currentBookingData = bookingSnap.data();
      const currentStatus = (currentBookingData?.status || "").toLowerCase();
      
      // Check if already cancelled
      if (["cancelled", "canceled", "rejected"].includes(currentStatus)) {
        throw new Error("This booking has already been cancelled.");
      }
      
      // Check if already refunded (shouldn't happen in cancel flow, but safety check)
      const currentRefundAmount = numberOr(currentBookingData?.refundAmount, 0);
      if (currentRefundAmount > 0 && refundAmount > 0) {
        console.warn("Booking already has a refund amount, but proceeding with cancellation.");
      }
      
      await updateDoc(bookingRef, {
        status: "cancelled",
        cancelReason: cancelReason,
        refundAmount: refundAmount,
        refundPercentage: refundPercentage,
        cancelledAt: serverTimestamp(),
        cancelledBy: currentUser.uid, // Track who cancelled (host in this case)
        uid: originalGuestUid, // CRITICAL: Preserve the original guest UID
        // Preserve hostId and ownerId so security rules can verify host ownership
        hostId: cancelTarget?.hostId || currentUser.uid,
        ownerId: cancelTarget?.ownerId || cancelTarget?.hostId || currentUser.uid,
        updatedAt: serverTimestamp(),
      });
      
      // 3) Send EmailJS to the guest
      const res = await sendCancellationEmail({
        booking: cancelTarget,
        reasonText: cancelReason,
        refundAmount: refundAmount,
        guestEmail: cancelTarget?.guestEmail,
        guestName: cancelTarget?.guestName,
      });
      
      // 4) Show success message
      const base = `Booking ${cancelTarget?.id ? `(#${cancelTarget.id.slice(0, 8).toUpperCase()}) ` : ""}was cancelled successfully.`;
      const refundNote = refundAmount > 0 
        ? `\n\nRefund: ₱${refundAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${refundPercentage}%) has been credited to the guest's E-Wallet.`
        : "\n\nNo refund was processed.";
      const emailNote = res.ok
        ? "\n\nA confirmation email has been sent to the guest."
        : "\n\nWe couldn't send the confirmation email right now, but the booking is cancelled.";
      
      alert(base + refundNote + emailNote);
      
      // 5) Reset flow UI
      setConfirmOpen(false);
      setCancelTarget(null);
      setCancelReason("");
      setPolicyText("");
      setRefundPercentage(100);
    } catch (error) {
      console.error("Cancel booking failed:", error);
      const errorMsg = error?.message || String(error) || "Unknown error";
      const errorCode = error?.code || "unknown";
      console.error("Cancel error details:", {
        code: errorCode,
        message: errorMsg,
        fullError: error,
      });
      alert(`Failed to cancel booking: ${errorMsg}\n\nCode: ${errorCode}\n\nPlease check the console for more details.`);
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Details modal handlers
  const startDetails = (booking) => {
    setDetailsTarget(booking);
    setDetailsOpen(true);
  };

  const closeDetails = () => setDetailsOpen(false);

  // Render loading state
  if (authLoading) {
    return (
      <div className="rounded-2xl p-8 bg-white/60 border-2 border-white/60 backdrop-blur-sm shadow-md text-center">
        Loading…
      </div>
    );
  }

  const tabs = [
    { key: "today", label: "Today" },
    { key: "upcoming", label: "Upcoming" },
    { key: "cancelled", label: "Cancelled" },
  ];

  // Dynamic title and subtitle based on active tab
  const getTitleAndSubtitle = () => {
    switch (tab) {
      case "today":
        return {
          title: "Today",
          subtitle: "Your bookings at a glance"
        };
      case "upcoming":
        return {
          title: "Upcoming",
          subtitle: "Future bookings and reservations"
        };
      case "cancelled":
        return {
          title: "Cancelled",
          subtitle: "Cancelled and refunded bookings"
        };
      default:
        return {
          title: "Today",
          subtitle: "Your bookings at a glance"
        };
    }
  };

  const { title, subtitle } = getTitleAndSubtitle();

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{title}</h2>
          <p className="text-sm text-slate-600 mt-1">{subtitle}</p>
        </div>

        <div className="inline-flex rounded-2xl border border-white/60 bg-white/80 backdrop-blur-sm p-1 shadow-md self-start">
          {tabs.map((tabItem) => {
            const isActive = tab === tabItem.key;
            return (
              <button
                key={tabItem.key}
                onClick={() => {
                  setTab(tabItem.key);
                  if (tabItem.key !== "cancelled") {
                    setCancelledFilter("all"); // Reset filter when switching away from cancelled
                  }
                }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {tabItem.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-tabs for Cancelled Bookings */}
      {tab === "cancelled" && (
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-white/60 bg-white/80 backdrop-blur-sm p-1 shadow-sm">
            {[
              { key: "all", label: "All" },
              { key: "for_refund", label: "For Refund" },
              { key: "refunded", label: "Refunded" },
            ].map((filterItem) => {
              const isActive = cancelledFilter === filterItem.key;
              return (
                <button
                  key={filterItem.key}
                  onClick={() => setCancelledFilter(filterItem.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {filterItem.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Total Bookings */}
        <div className="rounded-2xl bg-white/60 border-2 border-white/60 backdrop-blur-sm shadow-md p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-slate-600 font-medium">Total Bookings</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">{stats.totalBookings}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-100/80">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Today's Bookings */}
        <div className="rounded-2xl bg-white/60 border-2 border-white/60 backdrop-blur-sm shadow-md p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-slate-600 font-medium">Today</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">{stats.todayCount}</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-100/80">
              <CalIcon className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
            </div>
          </div>
        </div>

        {/* Upcoming Bookings */}
        <div className="rounded-2xl bg-white/60 border-2 border-white/60 backdrop-blur-sm shadow-md p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-slate-600 font-medium">Upcoming</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">{stats.upcomingCount}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-100/80">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
            </div>
          </div>
        </div>

        {/* Cancelled Bookings */}
        <div className="rounded-2xl bg-white/60 border-2 border-white/60 backdrop-blur-sm shadow-md p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-slate-600 font-medium">Cancelled</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">{stats.cancelledCount}</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-100/80">
              <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-rose-600" />
            </div>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="rounded-2xl bg-white/60 border-2 border-white/60 backdrop-blur-sm shadow-md p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-slate-600 font-medium">Total Revenue</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{peso(stats.totalRevenue)}</p>
            </div>
            <div className="p-3 rounded-xl bg-green-100/80">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Bookings Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : tabbedBookings.length === 0 ? (
        <div className="rounded-2xl p-8 bg-white/60 border-2 border-white/60 backdrop-blur-sm shadow-md text-center">
          <p className="text-slate-600">No bookings found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {tabbedBookings.map((booking) => {
            const category = normalizeCategory(booking.listing?.category || booking.listingCategory || "");
            const hostUid = authUser?.uid || null;
            const bookingUid = booking?.uid || null;
            const refundAmount = numberOr(booking?.refundAmount, 0);
            // Show refund button if: cancelled by guest (not host) and not yet refunded
            const showRefundButton = tab === "cancelled" && 
              cancelledFilter === "for_refund" &&
              bookingUid && 
              bookingUid !== hostUid && 
              refundAmount === 0;
            
            const commonProps = {
              b: booking,
              onRequestCancel: startCancel,
              onRequestDetails: startDetails,
              onRequestRefund: startRefund,
              showRefundButton: showRefundButton,
            };

            if (category.startsWith("experience")) return <ExperienceCard key={booking.id} {...commonProps} />;
            if (category.startsWith("service")) return <ServiceCard key={booking.id} {...commonProps} />;
            return <HomesCard key={booking.id} {...commonProps} />;
          })}
        </div>
      )}

      {/* Cancel Flow Modals */}
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
        bookingTotal={numberOr(cancelTarget?.totalPrice, 0)}
        refundPercentage={refundPercentage}
        onRefundPercentageChange={setRefundPercentage}
        refundAmount={(numberOr(cancelTarget?.totalPrice, 0) * refundPercentage) / 100}
      />

      {/* Refund Modal */}
      <RefundModal
        open={refundModalOpen}
        onClose={() => {
          setRefundModalOpen(false);
          setRefundTarget(null);
          setRefundModalPolicyText("");
          setRefundModalPercentage(100);
        }}
        onConfirm={handleConfirmRefund}
        listingTitle={refundTarget?.listing?.title || refundTarget?.listingTitle}
        policyText={refundModalPolicyText}
        submitting={submittingRefund}
        bookingTotal={numberOr(refundTarget?.totalPrice, 0)}
        refundPercentage={refundModalPercentage}
        onRefundPercentageChange={setRefundModalPercentage}
        refundAmount={(numberOr(refundTarget?.totalPrice, 0) * refundModalPercentage) / 100}
      />

      {/* Refund Success Modal */}
      <RefundSuccessModal
        open={refundSuccessModalOpen}
        onClose={() => {
          setRefundSuccessModalOpen(false);
          setRefundSuccessData(null);
        }}
        bookingId={refundSuccessData?.bookingId || null}
        refundAmount={refundSuccessData?.refundAmount || 0}
        refundPercentage={refundSuccessData?.refundPercentage || 0}
        emailSent={refundSuccessData?.emailSent || false}
      />

      {/* Details Modal */}
      <BookingDetailsModal
        open={detailsOpen}
        booking={detailsTarget}
        onClose={closeDetails}
        onRequestCancel={(booking) => {
          closeDetails();
          startCancel(booking);
        }}
        onConfirm={handleConfirmBooking}
      />
    </div>
  );
}