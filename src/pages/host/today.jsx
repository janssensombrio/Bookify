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
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { database, auth } from "../../config/firebase";
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
} from "lucide-react";

/* ---------------- small utils ---------------- */
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
    ? n.toLocaleString(undefined, { style: "currency", currency: "PHP", maximumFractionDigits: 0 })
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

/* ---------------- profile + listing helpers ---------------- */
const __userCache = new Map();
async function fetchGuestProfile(uid) {
  if (!uid) return null;
  if (__userCache.has(uid)) return __userCache.get(uid);
  try {
    const snap = await getDoc(doc(database, "users", uid));
    if (snap.exists()) {
      const d = snap.data();
      const v = {
        firstName: d.firstName || "",
        lastName: d.lastName || "",
        displayName: d.displayName || [d.firstName, d.lastName].filter(Boolean).join(" ").trim(),
        photoURL:
          d.photoURL ||
          d.photoUrl ||
          d.avatarURL ||
          d.avatar ||
          d.profileImageUrl ||
          null,
        email: d.email || null,
        uid,
      };
      __userCache.set(uid, v);
      return v;
    }
  } catch {}
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

const __listingCache = new Map();
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
  const out = {
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
  };
  if (cat.startsWith("service")) {
    out.serviceType = raw.serviceType || raw.type;
    out.pricingType = raw.pricingType || raw?.pricing?.type;
    out.duration = raw.duration || raw?.service?.duration;
    out.address = pick(raw.address, raw?.location?.address, raw?.addressLine);
  }
  if (cat.startsWith("experience")) {
    out.experienceType = raw.experienceType || raw.type;
    out.duration = raw.duration;
    out.languages = Array.isArray(raw.languages) ? raw.languages : [];
    out.hostRequirements = raw.hostRequirements || raw.requirements;
  }
  if (cat.startsWith("home")) {
    out.propertyType = raw.propertyType || raw?.home?.propertyType || raw?.details?.propertyType;
    out.bedrooms = number(raw.bedrooms ?? raw?.rooms?.bedrooms, undefined);
    out.beds = number(raw.beds ?? raw?.rooms?.beds, undefined);
    out.bathrooms = number(raw.bathrooms ?? raw?.rooms?.bathrooms, undefined);
    out.maxGuests = number(raw.maxGuests ?? raw.capacity, undefined);
  }
  return out;
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
  } catch {}
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

/* ---------------- Skeleton + Shell ---------------- */
const CardSkeleton = () => (
  <div className="rounded-3xl bg-white/80 border border-white/50 shadow-[0_10px_30px_rgba(2,6,23,0.08)] overflow-hidden animate-pulse">
    <div className="h-40 bg-slate-200/80" />
    <div className="p-5 space-y-3">
      <div className="h-5 bg-slate-200 rounded w-2/3" />
      <div className="h-4 bg-slate-200/90 rounded w-1/2" />
      <div className="h-4 bg-slate-200/90 rounded w-3/4" />
    </div>
  </div>
);

const CardShell = ({ cover, chip, header, children, onClick }) => (
  <div
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={(e) => {
      if (!onClick) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault(); onClick();
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-white/10 mix-blend-overlay" />
      {chip && (
        <span className="absolute top-3 left-3 text-xs px-2 py-1 rounded-full bg-black/60 text-white">
          {chip}
        </span>
      )}
    </div>
    <div className="p-5">
      {header}
      {children}
    </div>
  </div>
);

/* ---------------- Guest avatar (card header) ---------------- */
const GuestPill = ({ booking }) => {
  const [guest, setGuest] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const prof = await fetchGuestProfile(booking?.uid);
      if (alive) setGuest(prof);
    })();
    return () => { alive = false; };
  }, [booking?.uid]);

  const name =
    booking?.guestName ||
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

/* ---------------- Cards (Homes / Experiences / Services) ---------------- */
const HomesCard = ({ b, onRequestCancel, onRequestDetails }) => {
  const title = b.listing?.title || b.listingTitle || "Untitled listing";
  const loc = b.listing?.location || b.listingAddress || "";
  const dates = fmtRange(b.checkIn, b.checkOut);
  const nights = typeof b.nights === "number" ? b.nights : undefined;
  const guests = (b.adults || 0) + (b.children || 0) + (b.infants || 0);
  const sBadge = statusBadge(b.status);
  const pBadge = payBadge(b.paymentStatus);

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

      <div className="mt-4">
        {isCancelable(b) && (
          <button
            onClick={(e) => { e.stopPropagation(); onRequestCancel(b); }}
            className="w-full h-10 px-4 rounded-xl text-white bg-gradient-to-b from-rose-600 to-rose-700 border border-rose-700/50 shadow
                        hover:from-rose-500 hover:to-rose-700 active:translate-y-px transition"
          >
            Cancel Booking
          </button>
        )}
      </div>
    </CardShell>
  );
};

const ExperienceCard = ({ b, onRequestCancel, onRequestDetails }) => {
  const title = b.listing?.title || b.listingTitle || "Untitled experience";
  const cover = b.listing?.photos?.[0] || b.listingPhotos?.[0];
  const sBadge = statusBadge(b.status);
  const pBadge = payBadge(b.paymentStatus);

  const dateStr = b?.schedule?.date ? fmtDateStr(b.schedule.date) : "";
  const timeStr = b?.schedule?.time ? fmtTimeStr(b.schedule.time) : "";
  const type = b.experienceType ? b.experienceType[0].toUpperCase() + b.experienceType.slice(1) : null;

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

      <div className="mt-2 flex items-center gap-2 text-sm text-slate-700">
        <CalIcon size={16} />
        <span>{[dateStr, timeStr].filter(Boolean).join(" • ")}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-700">
        {b.duration && (
          <span className="inline-flex items-center gap-1">
            <CircleUserRound size={16} />
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
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${pBadge.cls}`}>
          <CreditCard size={14} className="mr-1 opacity-80" />
          {pBadge.text}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-600">Total</div>
        <div className="text-lg font-bold text-blue-600">{peso(b.totalPrice)}</div>
      </div>

      <div className="mt-4">
        {isCancelable(b) && (
          <button
            onClick={(e) => { e.stopPropagation(); onRequestCancel(b); }}
            className="w-full h-10 px-4 rounded-xl text-white bg-gradient-to-b from-rose-600 to-rose-700 border border-rose-700/50 shadow
                        hover:from-rose-500 hover:to-rose-700 active:translate-y-px transition"
          >
            Cancel Booking
          </button>
        )}
      </div>
    </CardShell>
  );
};

const ServiceCard = ({ b, onRequestCancel, onRequestDetails }) => {
  const title = b.listing?.title || b.listingTitle || "Untitled service";
  const cover = b.listing?.photos?.[0] || b.listingPhotos?.[0];
  const sBadge = statusBadge(b.status);
  const pBadge = payBadge(b.paymentStatus);
  const dateStr = b?.schedule?.date ? fmtDateStr(b.schedule.date) : "";
  const timeStr = b?.schedule?.time ? fmtTimeStr(b.schedule.time) : "";

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

      <div className="mt-2 flex items-center gap-2 text-sm text-slate-700">
        <CalIcon size={16} />
        <span>{[dateStr, timeStr].filter(Boolean).join(" • ")}</span>
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

      <div className="mt-4">
        {isCancelable(b) && (
          <button
            onClick={(e) => { e.stopPropagation(); onRequestCancel(b); }}
            className="w-full h-10 px-4 rounded-xl text-white bg-gradient-to-b from-rose-600 to-rose-700 border border-rose-700/50 shadow
                        hover:from-rose-500 hover:to-rose-700 active:translate-y-px transition"
          >
            Cancel Booking
          </button>
        )}
      </div>
    </CardShell>
  );
};

/* ---------------- Overlay helpers (PORTAL FIX) ---------------- */
function Overlay({ children, onBackdropClick }) {
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
}

/* ---------------- Cancel Flow (portaled) ---------------- */
const CancelReasonModal = ({ open, onClose, onNext }) => {
  const [selected, setSelected] = useState("");
  const [other, setOther] = useState("");

  useEffect(() => {
    if (!open) { setSelected(""); setOther(""); }
  }, [open]);

  if (!open) return null;

  // Host-oriented copy & reasons
  const reasons = [
    "Calendar conflict / double-booked",
    "Urgent maintenance or repairs required",
    "Safety or cleanliness issue at the property",
    "Host illness or emergency",
    "Severe weather / local restrictions",
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
    <Overlay onBackdropClick={onClose}>
      <div className="relative z-10 w-full sm:w-[560px]">
        <div className="mx-3 sm:mx-0 rounded-2xl bg-gradient-to-b from-white to-slate-50 border border-slate-200/70 shadow-[0_10px_30px_rgba(2,6,23,0.12),inset_0_1px_0_rgba(255,255,255,0.6)] p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-slate-900">Cancel booking</h3>
              <p className="text-sm text-slate-600 mt-1">
                Please tell the guest why you’re canceling as the host.
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" aria-label="Close">
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
    </Overlay>
  );
};

const CancelConfirmModal = ({ open, onBack, onConfirm, listingTitle, policyText, submitting }) => {
  if (!open) return null;
  const title = listingTitle || "this booking";
  const policy = policyText?.trim() || "No specific cancellation policy was provided by the host.";
  return (
    <Overlay onBackdropClick={onBack}>
      <div className="relative z-10 w-full sm:w-[560px]">
        <div className="mx-3 sm:mx-0 rounded-2xl bg-gradient-to-b from-white to-slate-50 border border-slate-200/70 shadow-[0_10px_30px_rgba(2,6,23,0.12),inset_0_1px_0_rgba(255,255,255,0.6)] p-6">
          <div className="flex items-start gap-3">
            <div className="shrink-0 grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-b from-rose-600 to-rose-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_20px_rgba(225,29,72,0.35)] ring-1 ring-white/10">
              <AlertTriangle size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold tracking-tight text-slate-900">Cancel {title}?</h3>
              <p className="text-sm text-slate-600 mt-1">Before you proceed, review the host’s cancellation policy:</p>
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
    </Overlay>
  );
};

/* ---------------- Booking Details Modal (portaled, with guest + inline chat) ---------------- */
const BookingDetailsModal = ({ open, booking, onClose, onRequestCancel }) => {
  const [listing, setListing] = useState(null);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [guest, setGuest] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatText, setChatText] = useState("");
  const chatEndRef = useRef(null);
  const navigate = useNavigate();

  const currentSignedUid = auth.currentUser?.uid || null;
  const otherUid = booking?.uid || guest?.uid || null; // guest/user you're chatting with

  // fetch data when open
  useEffect(() => {
    if (!open || !booking) return;
    let alive = true;
    (async () => {
      const [freshListing, guestProfile] = await Promise.all([
        hydrateListingForBooking(booking),
        fetchGuestProfile(booking?.uid),
      ]);
      if (!alive) return;
      setListing(freshListing);
      setGuest(guestProfile);
      setCurrentPhoto(0);
    })();
    return () => { alive = false; };
  }, [open, booking?.id, booking?.uid]);

  // lock body scroll WHILE OPEN
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow || ""; };
  }, [open]);

  // Reset chat when modal closes or booking changes
  useEffect(() => {
    if (!open) {
      setChatOpen(false);
      setChatMsgs([]);
      setChatText("");
    }
  }, [open, booking?.id]);

  // Subscribe to two-way messages when chat is open
  useEffect(() => {
    if (!open || !chatOpen || !currentSignedUid || !otherUid) return;

    const msgs = [];
    const qA = query(
      collection(database, "messages"),
      where("senderId", "==", currentSignedUid),
      where("receiverId", "==", otherUid)
    );
    const qB = query(
      collection(database, "messages"),
      where("senderId", "==", otherUid),
      where("receiverId", "==", currentSignedUid)
    );

    const mergeAndSet = () => {
      const sorted = msgs
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

    const unsubA = onSnapshot(qA, (snap) => {
      for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i]._dir === "A") msgs.splice(i, 1);
      snap.forEach((d) => msgs.push({ ...d.data(), _dir: "A" }));
      mergeAndSet();
    });

    const unsubB = onSnapshot(qB, (snap) => {
      for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i]._dir === "B") msgs.splice(i, 1);
      snap.forEach((d) => msgs.push({ ...d.data(), _dir: "B" }));
      mergeAndSet();
    });

    return () => { unsubA(); unsubB(); };
  }, [open, chatOpen, currentSignedUid, otherUid]);

  const sendInlineMessage = async () => {
    const text = chatText.trim();
    if (!text || !currentSignedUid || !otherUid) return;

    // If you use per-user hide markers, unhide for current user when sending
    try {
      await deleteDoc(doc(database, "users", currentSignedUid, "deletedConversations", otherUid));
    } catch {}

    await addDoc(collection(database, "messages"), {
      uid: currentSignedUid,
      senderId: currentSignedUid,
      receiverId: otherUid,
      message: text,
      timestamp: serverTimestamp(),
    });
    setChatText("");
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

  const nextPhoto = (e) => { e?.stopPropagation(); if (!hasPhotos) return; setCurrentPhoto((p) => (p + 1) % photos.length); };
  const prevPhoto = (e) => { e?.stopPropagation(); if (!hasPhotos) return; setCurrentPhoto((p) => (p - 1 + photos.length) % photos.length); };

  const guestName =
    booking?.guestName ||
    guest?.displayName ||
    [guest?.firstName, guest?.lastName].filter(Boolean).join(" ").trim() ||
    booking?.guestEmail ||
    "Guest";
  const guestInitial = guestName?.[0]?.toUpperCase() || "G";
  const guestPhoto = guest?.photoURL;

  return (
    <Overlay onBackdropClick={onClose}>
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
          <X className="w-5 h-5 text-gray-700" />
        </button>

        {/* LEFT: photos */}
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

        {/* RIGHT: content */}
        <div className="relative h-full min-h-0 grid grid-rows-[1fr,auto] bg-gradient-to-br from-blue-50/35 via-white/55 to-indigo-50/35">
          <div className="min-h-0 overflow-y-auto">
            <div className="max-w-[720px] mx-auto px-5 sm:px-6 md:px-7 py-5 sm:py-6 md:py-7 space-y-6 sm:space-y-7">
              {/* Header */}
              <section className="space-y-3">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{title}</h2>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${sBadge.cls}`}>
                    {sBadge.text}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${pBadge.cls}`}>
                    <CreditCard size={14} className="mr-1 opacity-80" />
                    {pBadge.text}
                  </span>
                </div>

                <p className="inline-flex items-center gap-2 text-sm sm:text-[15px] text-gray-700">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-gray-900">{location}</span>
                </p>
              </section>

              {/* Guest block */}
              <section className="rounded-3xl bg-white/80 backdrop-blur border border-white/60 p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-12 h-12 rounded-full bg-white/70 border border-white/60 overflow-hidden grid place-items-center text-gray-900 font-semibold ring-4 ring-white/60 shrink-0">
                      {guestPhoto ? (
                        <img
                          src={guestPhoto}
                          alt={guestName}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                          loading="lazy"
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

                  <button
                    type="button"
                    onClick={() => setChatOpen((v) => !v)}
                    className="inline-flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 shadow"
                  >
                    {chatOpen ? "Hide Chat" : "Message Guest"}
                  </button>
                </div>

                {/* Inline chat panel */}
                {chatOpen && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white/90">
                    <div className="px-3 py-2 border-b border-slate-200 text-sm font-semibold text-slate-800">
                      Chat with {guestName}
                    </div>
                    <div className="h-56 overflow-y-auto p-3 bg-slate-50/70">
                      {chatMsgs.length === 0 ? (
                        <div className="h-full grid place-items-center text-sm text-slate-500">
                          Say hello 👋
                        </div>
                      ) : (
                        chatMsgs.map((m, i) => {
                          const own = m.senderId === currentSignedUid;
                          return (
                            <div
                              key={`${m.timestamp?.seconds || 0}-${i}`}
                              className={`flex ${own ? "justify-end" : "justify-start"} mb-2`}
                            >
                              <div
                                className={`max-w-[75%] rounded-2xl px-3 py-2 shadow ${
                                  own
                                    ? "bg-blue-600 text-white"
                                    : "bg-white text-gray-800 border border-gray-200"
                                }`}
                              >
                                <span className="text-[13.5px] leading-snug">{m.message}</span>
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

              {/* Booking meta + payment */}
              <section className="rounded-3xl bg-white/85 backdrop-blur border border-white/60 p-4 sm:p-5 shadow-lg space-y-2">
                {cat.startsWith("home") ? (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <CalIcon size={16} />
                      <span>{fmtRange(booking.checkIn, booking.checkOut) || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <BedDouble size={16} />
                      <span>{nights || 0} night{(nights || 0) === 1 ? "" : "s"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
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
                    <div className="flex items-center gap-2 text-sm">
                      <CalIcon size={16} />
                      <span>{scheduleStr || "—"}</span>
                    </div>
                    {typeof booking.quantity === "number" && (
                      <div className="flex items-center gap-2 text-sm">
                        <Users size={16} />
                        <span>Qty {booking.quantity}</span>
                      </div>
                    )}
                  </>
                )}

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
                      <span className="text-base font-bold text-blue-700">
                        ₱{totalPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">Total unavailable.</div>
                  )}
                </div>
              </section>
            </div>
          </div>

          {/* Footer actions */}
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
      </div>
    </Overlay>
  );
};

/* ---------------- Today Tab ---------------- */
export default function TodayTab() {
  // auth
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

  // bookings
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // tabs
  const [tab, setTab] = useState("today"); // today | upcoming | cancelled

  // cancel flow
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [reasonOpen, setReasonOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [policyText, setPolicyText] = useState("");
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // details
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState(null);

  // subscribe (as host + as guest, then merge)
  useEffect(() => {
    if (!uid) { setRows([]); setLoading(false); return; }
    setLoading(true);

    const qHost = query(collection(database, "bookings"), where("hostId", "==", uid));
    const qGuest = query(collection(database, "bookings"), where("uid", "==", uid));

    const current = new Map();

    const apply = (docs) => {
      docs.forEach((d) => current.set(d.id, { id: d.id, ...d.data() }));
      const merged = Array.from(current.values());
      merged.sort((a, b) => {
        const as = a?.createdAt?.seconds || 0;
        const bs = b?.createdAt?.seconds || 0;
        const an = a?.createdAt?.nanoseconds || 0;
        const bn = b?.createdAt?.nanoseconds || 0;
        return bs === as ? bn - an : bs - as;
      });
      setRows(merged);
      setLoading(false);
    };

    const unsubHost = onSnapshot(qHost, (snap) => apply(snap.docs), () => setLoading(false));
    const unsubGuest = onSnapshot(qGuest, (snap) => apply(snap.docs), () => setLoading(false));

    return () => { unsubHost(); unsubGuest(); };
  }, [uid]);

  // grouping logic
  const todayKey = (() => {
    const d = new Date();
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  })();

  const isDateToday = (d) => {
    try {
      const k = new Date(`${d}T00:00:00`).toISOString().slice(0, 10);
      return k === todayKey;
    } catch { return false; }
  };

  const isStayToday = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return false;
    const s = checkIn?.toDate ? checkIn.toDate() : new Date(checkIn);
    const e = checkOut?.toDate ? checkOut.toDate() : new Date(checkOut);
    const t = new Date();
    const a = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const b = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    const x = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    return x >= a && x < b;
  };

  const cancelled = useMemo(
    () =>
      rows.filter(
        (r) =>
          ["cancelled", "canceled", "rejected"].includes((r.status || "").toLowerCase()) ||
          ["refunded", "failed"].includes((r.paymentStatus || "").toLowerCase())
      ),
    [rows]
  );

  const today = useMemo(
    () =>
      rows
        .filter((r) => {
          const cat = normalizeCategory(r.listing?.category || r.listingCategory || "");
          if (["cancelled", "canceled", "rejected"].includes((r.status || "").toLowerCase())) return false;
          if (cat.startsWith("home")) return isStayToday(r.checkIn, r.checkOut);
          if (r?.schedule?.date) return isDateToday(r.schedule.date);
          return false;
        }),
    [rows]
  );

  const upcoming = useMemo(
    () =>
      rows.filter((r) => {
        if (["cancelled", "canceled", "rejected"].includes((r.status || "").toLowerCase())) return false;
        const cat = normalizeCategory(r.listing?.category || r.listingCategory || "");
        const now = new Date();
        if (cat.startsWith("home")) {
          const ci = r.checkIn?.toDate?.() ?? null;
          return ci && ci > now && !isStayToday(r.checkIn, r.checkOut);
        }
        if (r?.schedule?.date) {
          const dt = new Date(`${r.schedule.date}T${r.schedule.time || "00:00"}`);
          return dt > now && !isDateToday(r.schedule.date);
        }
        return false;
      }),
    [rows]
  );

  const tabbed = tab === "today" ? today : tab === "upcoming" ? upcoming : cancelled;

  /* ---------- cancel flow handlers ---------- */
  const loadPolicyForBooking = async (booking) => {
    if (booking?.listing?.cancellationPolicy) return String(booking.listing.cancellationPolicy);
    if (booking?.listingId) {
      try {
        const ld = await getDoc(doc(database, "listings", booking.listingId));
        if (ld.exists()) {
          const d = ld.data();
          return d?.cancellationPolicy || d?.policy?.cancellation || d?.cancellation_policy || "";
        }
      } catch (e) { console.error("Fetch policy failed:", e); }
    }
    return "";
  };

  const startCancel = (booking) => {
    setCancelTarget(booking);
    setCancelReason("");
    setPolicyText("");
    setReasonOpen(true);
    setConfirmOpen(false);
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
      const me = auth.currentUser;
      if (!me) throw new Error("Not signed in");
      await updateDoc(doc(database, "bookings", cancelTarget.id), {
        status: "cancelled",
        cancelReason: cancelReason,
        cancelledAt: serverTimestamp(),
        uid: me.uid, // inject current user's uid to satisfy rules
        updatedAt: serverTimestamp(),
      });
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
  const closeDetails = () => setDetailsOpen(false);

  /* ---------- UI ---------- */
  if (authLoading) {
    return (
      <div className="glass rounded-3xl p-8 bg-white/70 border border-white/40 shadow text-center">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section header + tabs */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Today</h2>
          <p className="text-muted-foreground">Your bookings at a glance</p>
        </div>

        <div className="inline-flex rounded-2xl border border-gray-200 bg-white p-1 shadow-sm self-start">
          {[
            { key: "today", label: "Today" },
            { key: "upcoming", label: "Upcoming" },
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
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : tabbed.length === 0 ? (
        <div className="glass rounded-3xl p-8 bg-white/70 border border-white/40 shadow text-center">
          <p className="text-muted-foreground">No bookings found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl-grid-cols-3 xl:grid-cols-3 gap-6">
          {tabbed.map((b) => {
            const cat = normalizeCategory(b.listing?.category || b.listingCategory || "");
            const common = { b, onRequestCancel: startCancel, onRequestDetails: startDetails };
            if (cat.startsWith("experience")) return <ExperienceCard key={b.id} {...common} />;
            if (cat.startsWith("service")) return <ServiceCard key={b.id} {...common} />;
            return <HomesCard key={b.id} {...common} />;
          })}
        </div>
      )}

      {/* Cancel flow (portaled) */}
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

      {/* Details modal (portaled) */}
      <BookingDetailsModal
        open={detailsOpen}
        booking={detailsTarget}
        onClose={closeDetails}
        onRequestCancel={(b) => {
          closeDetails();
          startCancel(b);
        }}
      />
    </div>
  );
}
