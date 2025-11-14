// src/pages/host/HomeDetailsPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import emailjs from "@emailjs/browser";

import {
  doc,
  getDoc,
  addDoc, // (existing import — kept)
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  onSnapshot,
  runTransaction,
  orderBy,
} from "firebase/firestore";
import { database, auth } from "../../config/firebase";
import { PayPalButtons } from "@paypal/react-paypal-js";
import DateRangePickerInline from "../guest/components/DateRangeInlinePicker";
import { MessageHostModal } from "../../components/message-host-modal";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Tag,
  Users,
  Minus,
  Plus,
  MessageSquareText,
  ShieldCheck,
  Info,
  BedDouble,
  BedSingle,
  ShowerHead,
  BadgePercent,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Star,
  Briefcase,
  GraduationCap,
  Home,
  CalendarDays,
  Share2,
  Copy,
  Facebook,
  LogIn
} from "lucide-react";

/* ================== Admin Wallet ================== */
const ADMIN_WALLET_ID = "admin";

/* ================== Rewards ================== */
const BOOKING_REWARD_POINTS = 80;            // guest reward (existing behavior)
const HOST_BOOKING_REWARD_POINTS = 100;      // NEW: host reward per booking (E-Wallet flow)

/* ================== EmailJS env ================== */
// const EMAILJS_SERVICE_ID = "service_x9dtjt6";
// const EMAILJS_TEMPLATE_ID = "template_vrfey3u";
// const EMAILJS_PUBLIC_KEY = "hHgssQum5iOFlnJRD";
const EMAILJS_SERVICE_ID = "";
const EMAILJS_TEMPLATE_ID = "";
const EMAILJS_PUBLIC_KEY = "";
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

const rangesOverlap = (aStart, aEnd, bStart, bEnd) => sameOrBefore(aStart, bEnd) && sameOrBefore(bStart, aEnd);

// Nights [start, end) as individual dates (each night)
const eachNight = (start, end) => {
  if (!start || !end) return [];
  const nights = [];
  let d = startOfDay(start);
  const last = addDays(startOfDay(end), -1);
  while (sameOrBefore(d, last)) {
    nights.push(new Date(d));
    d = addDays(d, 1);
  }
  return nights;
};

/* ================== Promo/Coupon helpers (ADDED) ================== */
const clampPercent = (v) => Math.max(0, Math.min(100, Number(v) || 0));
const money = (n) => Math.max(0, Number(n) || 0);

// offer applies if CHECK-IN date is inside [startsAt, endsAt] (inclusive)
function withinOfferWindow(offer, start, end) { 
  if (!start || !end) return false; 
  const s = startOfDay(start); 
  const oS = toJSDate(offer?.startsAt); 
  const oE = toJSDate(offer?.endsAt); 
  const afterStart = oS ? sameOrAfter(s, oS) : true; 
  const beforeEnd  = oE ? sameOrBefore(s, oE) : true; 
  return afterStart && beforeEnd; 
}

function appliesToListing(offer, listingId) {
  if (!offer) return false;
  if (offer.appliesTo === "all") return true;
  const ids = Array.isArray(offer.listingIds) ? offer.listingIds : [];
  return ids.includes(listingId);
}

function offerDiscountAmount({ discountType, discountValue }, baseSubtotal) {
  const base = money(baseSubtotal);
  if ((discountType || "percentage").toLowerCase() === "percentage") {
    return (base * clampPercent(discountValue)) / 100;
  }
  return Math.min(base, money(discountValue));
}

function describeOffer(offer) {
  if (!offer) return "";
  const t = (offer.discountType || "percentage").toLowerCase();
  return t === "percentage"
    ? `${Number(offer.discountValue || 0)}% off`
    : `₱${Number(offer.discountValue || 0).toLocaleString()} off`;
}

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

/* ============================ Small UI helpers ============================ */
const GlassCard = ({ as: Comp = "section", className = "", children, ...rest }) => (
  <Comp
    className={[
      "rounded-3xl bg-white/90 backdrop-blur border border-slate-200 shadow-sm",
      className,
    ].join(" ")}
    {...rest}
  >
    {children}
  </Comp>
);

const IconStat = ({ Icon, label, value }) => (
  <div className="rounded-2xl bg-white/90 backdrop-blur border border-slate-200 p-4 shadow-sm">
    <div className="flex items-center gap-2 text-slate-700">
      <Icon className="w-6 h-6 text-blue-600" />
      <p className="text-[12px] sm:text-xs">{label}</p>
    </div>
    <p className="mt-1 text-lg sm:text-xl font-semibold text-slate-900">{value}</p>
  </div>
);

/* ============================ NEW: Reviews helpers (stars, avatar, dates) ============================ */
const toPlainDate = (ts) =>
  typeof ts?.toDate === "function" ? ts.toDate() : ts instanceof Date ? ts : null;

const fmtReviewDate = (ts) => {
  const d = toPlainDate(ts);
  return d
    ? d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "";
};

function Stars({ value = 0, size = 16 }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <span className="inline-flex items-center" aria-label={`${v} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          width={size}
          height={size}
          className={i <= v ? "text-amber-500" : "text-slate-300"}
          stroke="currentColor"
          fill={i <= v ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

function ReviewerAvatar({ name, photoURL, size = 40 }) {
  const [ok, setOk] = React.useState(true);
  const initial = (String(name || "G").trim()[0] || "G").toUpperCase();
  return (
    <div
      className="relative rounded-full bg-white/85 border border-slate-200 overflow-hidden shrink-0 grid place-items-center text-slate-900 font-semibold"
      style={{ width: size, height: size }}
    >
      {photoURL && ok ? (
        <img
          src={photoURL}
          alt={`${name || "Guest"} avatar`}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          loading="lazy"
          onError={() => setOk(false)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

/* ============================ Overlays & Modals ============================ */
function FullScreenLoader({ text = "Processing…" }) {
  return createPortal(
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="rounded-2xl bg-white border border-slate-200 shadow-xl p-5 flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <p className="text-sm font-medium text-slate-900">{text}</p>
      </div>
    </div>,
    document.body
  );
}

function ResultModal({ open, kind = "info", title, message, onClose, primaryLabel = "OK" }) {
  if (!open) return null;
  const Icon = kind === "success" ? CheckCircle2 : kind === "error" ? AlertCircle : Info;
  const tone =
    kind === "success" ? "text-emerald-600" : kind === "error" ? "text-rose-600" : "text-blue-600";

  return createPortal(
    <div className="fixed inset-0 z-[2147483646] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-5">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 ${tone}`}><Icon className="w-6 h-6" /></div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            {message ? <p className="mt-1 text-sm text-slate-700 whitespace-pre-line">{message}</p> : null}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ============================ Host section (guest view) ============================ */
function HostSectionForGuest({ host, listing, reviews, avgRating }) {
  const [profile, setProfile] = React.useState(null);
  const [stats, setStats] = React.useState({
    listingsCount: 0,
    totalReviews: 0,
    avgRating: 0,
    startedYear: "—",
    verified: false,
  });

  const toJsDate = (ts) => (typeof ts?.toDate === "function" ? ts.toDate() : ts ? new Date(ts) : null);
  const calcAge = (birth) => {
    const d = toJsDate(birth);
    if (!d || isNaN(d)) return null;
    const now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
    return a;
  };
  const toArray = (v) =>
    Array.isArray(v) ? v : typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];

  const hostUid = host?.uid || listing?.uid || listing?.ownerId || listing?.hostId || null;

  // Load host profile (hosts where uid==, fallback users where uid==)
  React.useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      if (!hostUid) {
        setProfile({});
        return;
      }
      try {
        // hosts where uid == hostUid
        let snap = await getDocs(query(collection(database, "hosts"), where("uid", "==", hostUid)));
        let data = null;
        if (!snap.empty) data = snap.docs[0].data();
        if (!data) {
          const usersQ = await getDocs(query(collection(database, "users"), where("uid", "==", hostUid)));
          if (!usersQ.empty) data = usersQ.docs[0].data();
        }
        if (!cancelled) setProfile(data || {});
      } catch (e) {
        console.warn("HostSectionForGuest: profile read failed:", e?.code || e?.message || e);
        if (!cancelled) setProfile({});
      }
    }
    loadProfile();
    return () => (cancelled = true);
  }, [hostUid]);

  // Compute stats across all listings for this host
  React.useEffect(() => {
    let cancelled = false;
    async function compute() {
      if (!hostUid) {
        setStats((s) => ({ ...s, listingsCount: 1, avgRating: Number(avgRating) || 0, totalReviews: reviews?.length || 0 }));
        return;
      }
      try {
        // Gather listings by any field commonly used for ownership
        const q1 = query(collection(database, "listings"), where("hostId", "==", hostUid));
        const q2 = query(collection(database, "listings"), where("uid", "==", hostUid));
        const q3 = query(collection(database, "listings"), where("ownerId", "==", hostUid));

        const [s1, s2, s3] = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);
        const map = new Map();
        for (const s of [s1, s2, s3]) s.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
        const allListings = Array.from(map.values());
        const listingsCount = allListings.length || 1;

        // Aggregate reviews: prefer subcollection, fallback to listing.rating + reviewCount
        let totalReviews = 0;
        let sumRatings = 0;
        let earliest = null;

        await Promise.all(
          allListings.map(async (l) => {
            const created = toJsDate(l.createdAt) || toJsDate(l.updatedAt);
            if (created && (!earliest || created < earliest)) earliest = created;

            let count = Number(l?.reviewCount) || 0;
            let avg = Number(l?.rating) || 0;

            try {
              const sub = collection(database, "listings", l.id, "reviews");
              const rs = await getDocs(sub);
              let c = 0;
              let s = 0;
              rs.forEach((rd) => {
                const r = rd.data();
                const v = Number(r?.rating) || 0;
                if (v > 0) {
                  c += 1;
                  s += v;
                }
              });
              if (c > 0) {
                count = c;
                avg = s / c;
              }
            } catch {
              // If rules block reviews, we stick with listing.rating/reviewCount
            }

            if (count > 0 && avg > 0) {
              totalReviews += count;
              sumRatings += avg * count;
            }
          })
        );

        const avgR = totalReviews > 0 ? sumRatings / totalReviews : Number(avgRating) || 0;
        const startedYear =
          earliest?.getFullYear?.() ||
          (toJsDate(profile?.createdAt)?.getFullYear?.() || "—");

        const verified = !!(
          profile?.isVerified ||
          profile?.verified ||
          profile?.verifiedHost ||
          (profile?.verificationStatus || "").toString().toLowerCase() === "verified"
        );

        if (!cancelled) {
          setStats({
            listingsCount,
            totalReviews,
            avgRating: avgR,
            startedYear,
            verified,
          });
        }
      } catch (e) {
        console.warn("HostSectionForGuest: stats compute failed:", e?.code || e?.message || e);
        if (!cancelled) {
          setStats((s) => ({
            ...s,
            listingsCount: s.listingsCount || 1,
            avgRating: Number(avgRating) || 0,
            totalReviews: reviews?.length || 0,
            startedYear: s.startedYear || "—",
          }));
        }
      }
    }
    compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostUid, avgRating, JSON.stringify(reviews), JSON.stringify(profile)]);

  // ----- display fields (fallbacks) -----
  const displayName =
    ([host?.firstName, host?.lastName].filter(Boolean).join(" ")) ||
    host?.displayName ||
    profile?.displayName ||
    host?.email ||
    profile?.email ||
    "Host";

  const email = host?.email || profile?.email || "";
  const photoURL =
    host?.photoURL ||
    profile?.photoURL || profile?.photoUrl || profile?.avatarURL || profile?.photo || profile?.avatar || profile?.profileImageUrl || null;

  const work = profile?.work || profile?.occupation || "—";
  const education = profile?.education || profile?.collegeHighSchoolGraduateName || "—";
  const address =
    profile?.address ||
    profile?.location ||
    [profile?.city, profile?.province || profile?.state, profile?.country].filter(Boolean).join(", ") ||
    "—";
  const age = profile?.age ?? calcAge(profile?.birthdate || profile?.birthDate);
  const about = profile?.about || profile?.bio || "—";
  const languages = toArray(profile?.languages);
  const shownLangs = languages.length ? languages : [];

  // small atoms
  const Avatar = () => {
    const [ok, setOk] = React.useState(true);
    const initial = displayName?.[0]?.toUpperCase?.() || "H";
    return (
      <div className="w-12 h-12 rounded-full bg-white/85 border border-slate-200 overflow-hidden grid place-items-center ring-2 ring-slate-200">
        {photoURL && ok ? (
          <img
            src={photoURL}
            alt="Host avatar"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            loading="lazy"
            onError={() => setOk(false)}
          />
        ) : (
          <span className="text-slate-900 font-semibold">{initial}</span>
        )}
      </div>
    );
  };

  const StatPill = ({ icon: Icon, label, tone }) => {
    const palette = {
      blue: "bg-blue-50 text-blue-700 ring-blue-100",
      amber: "bg-amber-50 text-amber-700 ring-amber-100",
      violet: "bg-violet-50 text-violet-700 ring-violet-100",
      emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    }[tone || "blue"];
    return (
      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${palette}`}>
        <Icon className="w-4 h-4" />
        {label}
      </span>
    );
  };

  const hoverCard =
    "rounded-3xl bg-white/90 backdrop-blur border border-slate-200 shadow-sm p-5 transition transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/10";

  return (
    <section className="max-w-[1200px] mx-auto px-4 mt-8 mb-10">
      <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-6">Meet Your Host</h2>
      {/* Top row: Identity / About / Verified */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-5">
          <div className={hoverCard}>
            <div className="flex items-center gap-3">
              <Avatar />
              <div className="min-w-0">
                <p className="text-[15px] sm:text-base font-semibold text-slate-900 truncate">{displayName}</p>
                {email ? <p className="text-xs text-slate-600 truncate">{email}</p> : null}
              </div>
            </div>
            {/* Quick facts (inline) */}
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-slate-500 shrink-0 whitespace-nowrap">
                  <Briefcase size={16} /> Work
                </dt>
                <dd className="font-medium text-right text-slate-900 min-w-0 truncate">{work || "—"}</dd>
              </div>

              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-slate-500 shrink-0 whitespace-nowrap">
                  <GraduationCap size={16} /> College/HS Graduate
                </dt>
                <dd className="font-medium text-right text-slate-900 min-w-0 truncate">{education || "—"}</dd>
              </div>

              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-slate-500 shrink-0 whitespace-nowrap">
                  <MapPin size={16} /> Address
                </dt>
                <dd className="font-medium text-right text-slate-900 min-w-0 truncate">{address || "—"}</dd>
              </div>

              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-slate-500 shrink-0 whitespace-nowrap">
                  <Users size={16} /> Age
                </dt>
                <dd className="font-medium text-right text-slate-900 min-w-0 truncate">{age ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <div className={hoverCard}>
            <p className="text-sm font-semibold text-slate-900">About</p>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-800 whitespace-pre-wrap">{about}</p>
            <div className="mt-4">
              <p className="text-sm font-semibold text-slate-900">Languages</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {shownLangs.length
                  ? shownLangs.map((lang, i) => (
                      <span key={`${lang}-${i}`} className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-900 shadow-sm">
                        {lang}
                      </span>
                    ))
                  : <span className="text-sm text-slate-600">—</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-2">
          <div className="h-full rounded-3xl border border-emerald-100 bg-gradient-to-b from-emerald-50 to-white shadow-sm p-5 flex flex-col items-center justify-center text-center transition transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/10">
            <div className="w-16 h-16 rounded-2xl bg-white grid place-items-center shadow-sm border border-emerald-100">
              <ShieldCheck className="w-8 h-8 text-emerald-600" />
            </div>
            <p className="mt-3 text-sm font-semibold text-emerald-800">Verified Host</p>
            <p className="mt-1 text-xs text-emerald-700">
              {stats.verified ? "Host's identity and details are verified." : "Verification pending or not completed."}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom stats row with colored chips and hover lift */}
      <div className="grid grid-cols-12 gap-5 mt-5">
        <div className="col-span-12 sm:col-span-3">
          <div className={`${hoverCard} cursor-default`}>
            <StatPill icon={Home} label="Listings" tone="blue" />
            <p className="mt-3 text-2xl font-bold text-slate-900">{stats.listingsCount}</p>
          </div>
        </div>
        <div className="col-span-12 sm:col-span-3">
          <div className={`${hoverCard} cursor-default`}>
            <StatPill icon={Star} label="Average Rating" tone="amber" />
            <p className="mt-3 text-2xl font-bold text-slate-900">
              {(Number(stats.avgRating || 0)).toFixed(2)}
            </p>
          </div>
        </div>
        <div className="col-span-12 sm:col-span-3">
          <div className={`${hoverCard} cursor-default`}>
            <StatPill icon={MessageSquareText} label="Reviews" tone="violet" />
            <p className="mt-3 text-2xl font-bold text-slate-900">{stats.totalReviews}</p>
          </div>
        </div>
        <div className="col-span-12 sm:col-span-3">
          <div className={`${hoverCard} cursor-default`}>
            <StatPill icon={CalendarDays} label="Started Hosting" tone="emerald" />
            <p className="mt-3 text-2xl font-bold text-slate-900">{stats.startedYear}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================ Reusable PayPal Checkout ============================ */
function PayPalCheckout({
  payment,
  totalAmount,
  setShowPayPal,
  selectedDates,
  listing,
  includeCleaningFee,
  adults,
  children,
  infants,
  setBookedIntervals,
  onClose,
  // Wallet
  wallet,
  payWithWallet,
  isPayingWallet,
}) {
  const computedTotal = Number(payment?.total ?? totalAmount ?? 0);

  return (
    <div className="w-full sm:max-w-md">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
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

              const completed = details?.status === "COMPLETED";
              const bookingStatus = completed ? "confirmed" : "pending";
              const paymentStatus = completed ? "paid" : "pending";

              // Preflight overlap guard (outside tx)
              const preQ = query(
                collection(database, "bookings"),
                where("listingId", "==", listing.id),
                where("status", "in", ["confirmed", "pending"])
              );
              const preSnap = await getDocs(preQ);
              const s0 = startOfDay(selectedDates.start);
              const e0 = startOfDay(selectedDates.end);
              const conflict = preSnap.docs.some((d) => {
                const b = d.data();
                const ci = toJSDate(b.checkIn);
                const co = toJSDate(b.checkOut);
                if (!ci || !co) return false;
                return rangesOverlap(s0, addDays(e0, -1), startOfDay(ci), addDays(startOfDay(co), -1));
              });
              if (conflict) {
                alert("Those dates were just booked. Please pick different dates.");
                return;
              }

              // Transaction: lock nights + create booking + award points + credit admin wallet
              await runTransaction(database, async (tx) => {
                const sLock = startOfDay(selectedDates.start);
                const eLock = startOfDay(selectedDates.end);
                const nightsArr = eachNight(sLock, eLock);

                // refs
                const bookingRef = doc(collection(database, "bookings"));
                const pointsRef = doc(database, "points", user.uid);
                const ptsLogRef = doc(collection(database, "points", user.uid, "transactions"));
                const nightRefs = nightsArr.map((d) =>
                  doc(database, "nightLocks", `${listing.id}_${ymd(d)}`)
                );
                const hostUid = listing.uid || listing.ownerId || listing.hostId || "";

                // Calculate service fee
                const subtotal = Number(payment?.subtotal || 0);
                const serviceFee = Number(payment?.serviceFee || 0);

                // ---------- READS ----------
                const pSnap = await tx.get(pointsRef);
                // ensure none of the night locks exist
                for (const nref of nightRefs) {
                  const nsnap = await tx.get(nref);
                  if (nsnap.exists()) {
                    throw new Error("One or more nights just became unavailable. Please choose new dates.");
                  }
                }

                // Read admin wallet balance (if service fee will be credited)
                let adminBal = 0;
                let adminBalAfter = 0;
                if (completed && serviceFee > 0) {
                  const wrefAdmin = doc(database, "wallets", ADMIN_WALLET_ID);
                  const adminSnap = await tx.get(wrefAdmin);
                  adminBal = Number(adminSnap.data()?.balance || 0);
                  adminBalAfter = adminBal + serviceFee;
                }

                const curPts = Number(pSnap.data()?.balance || 0);
                const nextPts = curPts + (completed ? BOOKING_REWARD_POINTS : 0);

                const appliedOffers = [
                  ...(Number(payment?.promoDiscount || 0) > 0
                    ? [{
                        kind: "promo",
                        offerId: payment?.promoId || null,
                        label: payment?.promoLabel || "",
                        discount: Number(payment?.promoDiscount || 0),
                      }]
                    : []),
                  ...(Number(payment?.couponDiscount || 0) > 0
                    ? [{
                        kind: "coupon",
                        offerId: payment?.couponId || null,
                        code: payment?.offerCode || null,
                        label: payment?.couponLabel || "",
                        discount: Number(payment?.couponDiscount || 0),
                      }]
                    : []),
                ];

                const bookingData = {
                  uid: user.uid,
                  guestEmail: user.email,
                  guestName: user.displayName || "",
                  checkIn: sLock,
                  checkOut: eLock,
                  nights: payment.nights,
                  adults,
                  children,
                  infants,
                  pricePerNight: Number(listing.price || 0),
                  cleaningFee: includeCleaningFee ? Number(listing.cleaningFee || 0) : 0,
                  discountType: listing.discountType || "none",
                  discountValue: Number(listing.discountValue || 0),
                  totalPrice: payment?.total ?? 0,
                  listingTitle: listing.title || "Untitled",
                  listingCategory: listing.category || "Homes",
                  listingAddress: listing.location || "",
                  listingPhotos: Array.isArray(listing.photos) ? listing.photos : [],
                  hostId: listing.uid || listing.ownerId || listing.hostId || "",
                  listingId: listing?.id || null,
                  status: bookingStatus,
                  paymentStatus,
                  paymentMethod: "paypal",
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                  paypalOrderId: details?.id || null,
                  // ADDED: applied offers (promo + coupon)
                  appliedOffers,
                };

                // ---------- WRITES ----------
                tx.set(bookingRef, bookingData);

                for (const [i, nref] of nightRefs.entries()) {
                  tx.set(nref, {
                    listingId: listing.id,
                    date: ymd(nightsArr[i]),
                    bookingId: bookingRef.id,
                    uid: user.uid,
                    createdAt: serverTimestamp(),
                  });
                }

                if (completed) {
                  tx.set(
                    pointsRef,
                    { uid: user.uid, balance: nextPts, updatedAt: serverTimestamp() },
                    { merge: true }
                  );
                  tx.set(ptsLogRef, {
                    uid: user.uid,
                    type: "booking_reward",
                    delta: BOOKING_REWARD_POINTS,
                    amount: BOOKING_REWARD_POINTS,
                    status: "completed",
                    note: `Reward for booking ${listing.title || "Listing"}`,
                    bookingId: bookingRef.id,
                    balanceAfter: nextPts,
                    timestamp: serverTimestamp(),
                  });
                }

                // ADDED: coupon redemption audit row (if coupon applied)
                if (Number(payment?.couponDiscount || 0) > 0 && payment?.couponId) {
                  const redRef = doc(collection(database, "couponRedemptions"));
                  tx.set(redRef, {
                    uid: user.uid,
                    couponId: payment.couponId,
                    code: payment?.offerCode || null,
                    bookingId: bookingRef.id,
                    listingId: listing.id,
                    hostUid: listing?.uid || listing?.ownerId || listing?.hostId || null,
                    timestamp: serverTimestamp(),
                  });
                }

                // ---------- ADMIN wallet: credit service fee (PayPal payment) ----------
                if (completed && serviceFee > 0) {
                  const wrefAdmin = doc(database, "wallets", ADMIN_WALLET_ID);
                  
                  // Ensure admin wallet exists (if it didn't exist, balance was 0)
                  const walletTxAdminRef = doc(collection(database, "wallets", ADMIN_WALLET_ID, "transactions"));
                  tx.set(walletTxAdminRef, {
                    uid: ADMIN_WALLET_ID,
                    type: "service_fee",
                    delta: +serviceFee,
                    amount: serviceFee,
                    status: "completed",
                    method: "paypal",
                    note: `Service fee from ${listing.title || "Listing"} — ${ymd(sLock)} to ${ymd(addDays(eLock, -1))}`,
                    metadata: { bookingId: bookingRef.id, listingId: listing.id, hostUid, payerUid: user.uid },
                    balanceAfter: adminBalAfter,
                    timestamp: serverTimestamp(),
                  });
                  
                  tx.set(
                    wrefAdmin,
                    { uid: ADMIN_WALLET_ID, balance: adminBalAfter, currency: "PHP", updatedAt: serverTimestamp() },
                    { merge: true }
                  );
                }
              });

              // Update UI locks locally
              const s = startOfDay(selectedDates.start);
              const e = addDays(startOfDay(selectedDates.end), -1);
              if (s && e && e >= s) {
                setBookedIntervals((prev) => mergeIntervals([...prev, { start: s, end: e }]));
              }

              // Email best-effort
              try {
                await sendBookingConfirmationEmail({
                  user,
                  listing,
                  totalAmount: payment?.total ?? 0,
                  paymentStatus,
                });
              } catch (mailErr) {
                console.error("EmailJS send failed:", mailErr);
              }

              alert(completed ? "Booking successful!" : "Order captured; booking pending.");
              onClose?.();
            } catch (error) {
              console.error("Error creating reservation:", error);
              alert(`Failed to create reservation: ${error.message}`);
            }
          }}
          onCancel={() => setShowPayPal(false)}
        />
      </div>

      {/* E-Wallet button appears above Cancel */}
      <button
        type="button"
        onClick={payWithWallet}
        disabled={!payment || wallet?.balance < computedTotal || isPayingWallet}
        className={[
          "mt-3 w-full inline-flex items-center justify-center rounded-full",
          "bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-black",
          "transition disabled:opacity-50 disabled:pointer-events-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60",
        ].join(" ")}
        title={
          !payment
            ? "Select dates first"
            : wallet?.balance < computedTotal
            ? "Insufficient wallet balance"
            : "Pay with E-Wallet"
        }
      >
        {isPayingWallet ? "Processing…" : "Pay with E-Wallet"}
      </button>

      <button
        type="button"
        onClick={() => setShowPayPal(false)}
        className="mt-3 w-full inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 transition"
      >
        Cancel
      </button>
    </div>
  );
}

/* ============================ PAGE component ============================ */
export default function HomeDetailsPage({ listingId: propListingId }) {
  const navigate = useNavigate();
  const { listingId: routeListingId } = useParams();
  const listingId = propListingId ?? routeListingId;

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
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [bookedIntervals, setBookedIntervals] = useState([]); // [{start: Date, end: Date}] (inclusive)

  // Wallet live state
  const [wallet, setWallet] = useState({ balance: 0, currency: "PHP" });

  // NEW: UI state for wallet flow
  const [isPayingWallet, setIsPayingWallet] = useState(false);
  const [modal, setModal] = useState({ open: false, kind: "info", title: "", message: "" });
  const openModal = (kind, title, message) => setModal({ open: true, kind, title, message });
  const closeModal = () => setModal((m) => ({ ...m, open: false }));

  /* NEW: Reviews state */
  const [reviews, setReviews] = useState([]);       // all reviews for this listing
  const reviewsScrollRef = useRef(null);
  const [profiles, setProfiles] = useState({});     // uid -> profile data (users/hosts)
  const [loadingReviews, setLoadingReviews] = useState(true);

  /* ======= ADDED: Promo/Coupon UI state ======= */
  const [autoPromo, setAutoPromo] = useState(null);        // best matching promo for this listing/dates
  const [appliedCoupon, setAppliedCoupon] = useState(null); // chosen coupon (user input)
  const [couponInput, setCouponInput] = useState("");
  const [couponErr, setCouponErr] = useState("");
  const promosCacheRef = useRef([]);                        // cache active promos for this host

  /* ======= Share functionality ======= */
  const [shareToast, setShareToast] = useState(null);
  
  const getShareUrl = () => {
    return `${window.location.origin}/homes/${listingId}`;
  };

  const handleCopyLink = async () => {
    try {
      const url = getShareUrl();
      await navigator.clipboard.writeText(url);
      setShareToast({ kind: "success", text: "Link copied to clipboard!" });
      setTimeout(() => setShareToast(null), 3000);
    } catch (err) {
      setShareToast({ kind: "error", text: "Failed to copy link" });
      setTimeout(() => setShareToast(null), 3000);
    }
  };

  const handleFacebookShare = () => {
    const url = getShareUrl();
    const title = listing?.title || "Check out this home";
    const description = listing?.description || "";
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(title + (description ? ` - ${description.substring(0, 100)}` : ""))}`;
    window.open(shareUrl, "_blank", "width=600,height=400");
  };

  /* Update Open Graph meta tags for Facebook sharing */
  useEffect(() => {
    if (!listing || !listingId) return;

    const photos = Array.isArray(listing?.photos) ? listing.photos : [];
    const firstImage = photos.length > 0 ? photos[0] : null;
    const title = listing?.title || "Check out this home";
    const description = listing?.description || "";
    const url = `${window.location.origin}/homes/${listingId}`;

    // Update or create og:title
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute('content', title);

    // Update or create og:description
    let ogDescription = document.querySelector('meta[property="og:description"]');
    if (!ogDescription) {
      ogDescription = document.createElement('meta');
      ogDescription.setAttribute('property', 'og:description');
      document.head.appendChild(ogDescription);
    }
    ogDescription.setAttribute('content', description.substring(0, 200));

    // Update or create og:image
    if (firstImage) {
      let ogImage = document.querySelector('meta[property="og:image"]');
      if (!ogImage) {
        ogImage = document.createElement('meta');
        ogImage.setAttribute('property', 'og:image');
        document.head.appendChild(ogImage);
      }
      ogImage.setAttribute('content', firstImage);
    }

    // Update or create og:url
    let ogUrl = document.querySelector('meta[property="og:url"]');
    if (!ogUrl) {
      ogUrl = document.createElement('meta');
      ogUrl.setAttribute('property', 'og:url');
      document.head.appendChild(ogUrl);
    }
    ogUrl.setAttribute('content', url);

    // Update or create og:type
    let ogType = document.querySelector('meta[property="og:type"]');
    if (!ogType) {
      ogType = document.createElement('meta');
      ogType.setAttribute('property', 'og:type');
      document.head.appendChild(ogType);
    }
    ogType.setAttribute('content', 'website');

    // Cleanup function to remove meta tags when component unmounts or listing changes
    return () => {
      // Optionally remove meta tags on cleanup, but we'll keep them for better sharing
    };
  }, [listing, listingId]);

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

  /* Subscribe wallet of current user */
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    const wref = doc(database, "wallets", u.uid);
    const unsub = onSnapshot(wref, (s) => {
      const d = s.data() || {};
      setWallet({ balance: Number(d.balance || 0), currency: d.currency || "PHP" });
    });
    return unsub;
  }, []);

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
    return () => {
      cancel = true;
    };
  }, [listingId]);

  /* Load host */
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
    return () => {
      cancelled = true;
    };
  }, [listing?.uid, listing?.ownerId, listing?.hostId]);

  /* Prefill availability */
  useEffect(() => {
    if (!listing?.availability?.start || !listing?.availability?.end) return;
    const s = new Date(listing.availability.start + "T00:00:00");
    const e = new Date(listing.availability.end + "T00:00:00");
    setSelectedDates({ start: s, end: e });
  }, [listing]);

  /* ======= ADDED: Load active promos for host (cache) ======= */
  useEffect(() => {
    let cancelled = false;
    async function fetchPromos() {
      const hostUid = listing?.uid || listing?.ownerId || listing?.hostId || null;
      promosCacheRef.current = [];
      if (!hostUid) { setAutoPromo(null); return; }
      try {
        const promosRef = collection(database, "promos");
        const q1 = query(promosRef, where("uid", "==", hostUid), where("status", "==", "active"));
        const q2 = query(promosRef, where("ownerUid", "==", hostUid), where("status", "==", "active"));
        const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        const map = new Map();
        s1.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
        s2.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
        const all = Array.from(map.values());
        if (!cancelled) {
          promosCacheRef.current = all;
          setAutoPromo((p) => p ?? null);
        }
      } catch (e) {
        console.warn("Promo load failed:", e?.message || e);
        if (!cancelled) {
          promosCacheRef.current = [];
          setAutoPromo(null);
        }
      }
    }
    fetchPromos();
    return () => { cancelled = true; };
  }, [listing?.uid, listing?.ownerId, listing?.hostId, listingId]);

  /* ======================= NEW: Subscribe to reviews for this listing ======================= */
  useEffect(() => {
    if (!listingId) {
      setReviews([]);
      setLoadingReviews(false);
      return;
    }

    setLoadingReviews(true);
    const reviewsRef = collection(database, "listings", listingId, "reviews");
    const qRef = query(reviewsRef, orderBy("updatedAt", "desc"));

    const unsub = onSnapshot(
      qRef,
      async (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })) || [];
        setReviews(rows);

        // Fetch missing reviewer profiles (users/{uid} or hosts/{uid})
        const missingUids = [...new Set(rows.map((r) => r.uid).filter((u) => u && !profiles[u]))];
        if (missingUids.length) {
          const fetchOne = async (uid) => {
            try {
              const u = await getDoc(doc(database, "users", uid));
              if (u.exists()) return [uid, u.data()];
            } catch {}
            try {
              const h = await getDoc(doc(database, "hosts", uid));
              if (h.exists()) return [uid, h.data()];
            } catch {}
            return [uid, null];
          };
          const pairs = await Promise.all(missingUids.map(fetchOne));
          setProfiles((prev) => {
            const next = { ...prev };
            for (const [uid, data] of pairs) next[uid] = data;
            return next;
          });
        }

        setLoadingReviews(false);
      },
      (err) => {
        console.error("reviews subscribe failed:", err);
        setReviews([]);
        setLoadingReviews(false);
      }
    );
    return () => unsub();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  const avgRating =
    reviews.length
      ? Math.round(
          (reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviews.length) * 10
        ) / 10
      : 0;

  /* ======= ADDED: coupon apply/clear handlers ======= */
  const applyCouponCode = async () => {
    setCouponErr("");
    const user = auth.currentUser;
    if (!user) {
      setCouponErr("Please sign in to apply a coupon.");
      return;
    }
    if (!payment) {
      setCouponErr("Select valid dates first.");
      return;
    }
    const code = (couponInput || "").trim().toUpperCase();
    if (!code) { setCouponErr("Enter a coupon code."); return; }

    try {
      // Find coupon docs with this code
      const couponsRef = collection(database, "coupons");
      const snap = await getDocs(query(couponsRef, where("code", "==", code)));
      const candidates = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const { start, end } = selectedDates || {};
      const baseSubtotal = Number(payment?.subtotalBase || 0); // set below in payment effect

      const valid = [];
      for (const c of candidates) {
        const statusOk = (c.status || "active") === "active";
        const listingOk = appliesToListing(c, listingId);
        const windowOk = withinOfferWindow(c, start, end);
        const minOk = c.minSubtotal == null || Number(c.minSubtotal) <= baseSubtotal;

        if (!(statusOk && listingOk && windowOk && minOk)) continue;

        // maxUses (global)
        let maxOk = true;
        if (Number.isFinite(Number(c.maxUses))) {
          try {
            const rAll = await getDocs(query(collection(database, "couponRedemptions"), where("couponId", "==", c.id)));
            maxOk = rAll.size < Number(c.maxUses);
          } catch {}
        }

        // perUserLimit
        let perUserOk = true;
        if (Number.isFinite(Number(c.perUserLimit))) {
          try {
            const rMe = await getDocs(query(
              collection(database, "couponRedemptions"),
              where("couponId", "==", c.id),
              where("uid", "==", user.uid)
            ));
            perUserOk = rMe.size < Number(c.perUserLimit);
          } catch {}
        }

        if (maxOk && perUserOk) valid.push(c);
      }

      if (!valid.length) {
        setAppliedCoupon(null);
        setCouponErr("This code isn't valid for your stay.");
        return;
      }

      // keep the most generous for the current base subtotal
      const best = valid.reduce((a, b) => {
        const da = offerDiscountAmount(a, baseSubtotal);
        const db = offerDiscountAmount(b, baseSubtotal);
        return db > da ? b : a;
      });

      setAppliedCoupon(best);
      // NOTE: we no longer clear autoPromo here; stacking logic handles both
      setCouponErr("");
    } catch (e) {
      console.error(e);
      setCouponErr("Could not verify coupon. Please try again.");
    }
  };

  const clearCoupon = () => {
    setAppliedCoupon(null);
    setCouponErr("");
  };

  /* Payment recompute — NOW STACKS PROMO + COUPON */
  useEffect(() => {
    if (!listing) return setPayment(null);
    const { start, end } = selectedDates || {};
    const nights = nightsBetween(start, end);
    if (!nights) return setPayment(null);

    const price = numberOr(listing.price);
    const clean = includeCleaningFee ? numberOr(listing.cleaningFee) : 0;

    // ----- Listing's own discount (existing behavior) -----
    const type = (listing.discountType || "none").toLowerCase();
    const dVal = numberOr(listing.discountValue);

    const cappedPercent = Math.min(100, Math.max(0, dVal));
    const perNightDiscount = type === "percentage" ? (price * cappedPercent) / 100 : 0;
    const nightlyAfter = Math.max(0, price - perNightDiscount);

    const staySubtotal = nightlyAfter * nights;
    const fixedDiscount = type === "fixed" ? Math.max(0, dVal) : 0;

    // Base BEFORE fees/cleaning (used for offer/coupon minSubtotal checks)
    const baseSubtotal = Math.max(0, staySubtotal - fixedDiscount);

    // ----- Stacking: promo first, coupon second -----
    const promos = promosCacheRef.current || [];

    // Best PROMO against baseSubtotal
    const eligiblePromos = promos.filter(
      (p) =>
        (p.status || "active") === "active" &&
        appliesToListing(p, listingId) &&
        withinOfferWindow(p, start, end) &&
        (p.minSubtotal == null || Number(p.minSubtotal) <= baseSubtotal)
    );
    const bestPromo = eligiblePromos.length
      ? eligiblePromos.reduce((a, b) => {
          const da = offerDiscountAmount(a, baseSubtotal);
          const db = offerDiscountAmount(b, baseSubtotal);
          return db > da ? b : a;
        })
      : null;

    // Valid COUPON (against baseSubtotal policy; change to afterPromo if desired)
    const couponOk =
      appliedCoupon &&
      (appliedCoupon.status || "active") === "active" &&
      appliesToListing(appliedCoupon, listingId) &&
      withinOfferWindow(appliedCoupon, start, end) &&
      (appliedCoupon.minSubtotal == null || Number(appliedCoupon.minSubtotal) <= baseSubtotal);

    const promoDiscount = bestPromo ? offerDiscountAmount(bestPromo, baseSubtotal) : 0;
    const afterPromo = Math.max(0, baseSubtotal - promoDiscount);

    // coupon applies to AFTER-PROMO amount
    const couponDiscount = couponOk ? offerDiscountAmount(appliedCoupon, afterPromo) : 0;

    const offerDiscount = promoDiscount + couponDiscount;
    const subtotal = Math.max(0, afterPromo - couponDiscount);

    const serviceRate = 0.1;
    const serviceFee = subtotal * serviceRate;
    const total = subtotal + serviceFee;

    // keep sidebar hint for auto promo (it shows when no coupon is applied in UI)
    setAutoPromo(bestPromo || null);

    setPayment({
      nights,
      price,
      perNightDiscount,
      nightlyAfter,
      cleaningFee: clean,
      fixedDiscount,
      subtotal,            // post-offer subtotal (used for host payout with wallet)
      subtotalBase: baseSubtotal, // for coupon validity calculations
      serviceFee,
      serviceRate,
      total,
      type,
      dVal: type === "percentage" ? cappedPercent : dVal,

      // Aggregate discount (sum)
      offerDiscount,

      // PROMO detail
      promoDiscount,
      promoLabel: bestPromo ? describeOffer(bestPromo) : "",
      promoId: bestPromo?.id || null,

      // COUPON detail
      couponDiscount,
      couponLabel: couponOk ? describeOffer(appliedCoupon) : "",
      couponId: couponOk ? (appliedCoupon?.id || null) : null,
      offerCode: couponOk ? (appliedCoupon?.code || null) : null,
    });
  }, [selectedDates, includeCleaningFee, listing, appliedCoupon, listingId]);

  if (!listing) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-blue-50/35 via-white/55 to-indigo-50/35">
        <div className="text-center p-8 rounded-3xl bg-white/80 border border-slate-200 shadow">
          <p className="text-slate-700">Loading listing…</p>
        </div>
      </div>
    );
  }

  const photos = Array.isArray(listing?.photos) ? listing.photos : [];
  const hasPhotos = photos.length > 0;

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

  /* ---- selection with validation against booked intervals ---- */
  const handleDateChange = ({ start, end }) => {
    const s = fromYMD(start);
    const e = fromYMD(end);

    if (s && !e) return setSelectedDates({ start: s, end: null });

    if (s && e) {
      const s0 = startOfDay(s);
      const e0 = startOfDay(e);

      const overlaps = bookedIntervals.some(({ start: bs, end: be }) =>
        rangesOverlap(s0, addDays(e0, -1), bs, be)
      );

      if (overlaps) {
        alert("Those dates include already-booked nights. Please pick a different range.");
        return setSelectedDates({ start: s0, end: null });
      }

      return setSelectedDates({ start: s0, end: e0 });
    }

    setSelectedDates({ start: null, end: null });
  };

  /* Final button gate */
  const handleBookNow = () => {
    // Check if user is logged in
    if (!auth.currentUser) {
      setShowLoginModal(true);
      return;
    }

    const { start, end } = selectedDates || {};
    if (!start || !end) return alert("Please select valid dates.");

    const overlaps = bookedIntervals.some(({ start: bs, end: be }) =>
      rangesOverlap(startOfDay(start), addDays(startOfDay(end), -1), bs, be)
    );
    if (overlaps) {
      alert("Selected dates overlap with an existing booking. Please adjust your dates.");
      return;
    }

    setTotalAmount(payment.total);
    setShowPayPal(true); // opens checkout that includes PayPal + E-Wallet button
  };

  /* Helper for the datepicker's filterDate */
  const isDisabledDay = (date) =>
    bookedIntervals.some(({ start, end }) => dayBetweenInclusive(startOfDay(date), start, end));

  const onClose = () => navigate(-1);

  const hasDiscount = !!(listing.discountType && numberOr(listing.discountValue) > 0);
  const discountText =
    listing.discountType === "percentage"
      ? `${numberOr(listing.discountValue)}% off`
      : `₱${numberOr(listing.discountValue).toLocaleString()} off`;

  /* ==================== E-Wallet payment flow ==================== */
  const payWithWallet = async () => {
    const user = auth.currentUser;

    if (!user) return openModal("error", "Sign in required", "Please log in to pay with your wallet.");
    if (!payment) return openModal("error", "Select dates", "Please select valid dates first.");

    const { start, end } = selectedDates || {};
    if (!start || !end) return openModal("error", "Select dates", "Please select valid dates.");

    const total = Number(payment.total || 0);
    const subtotal = Number(payment.subtotal || 0);        // host payout (no service fee)
    const serviceFee = Number(payment.serviceFee || 0);    // platform fee (not sent to host)
    if (!Number.isFinite(total) || total <= 0)
      return openModal("error", "Invalid total", "We could not compute a valid total.");

    if (wallet.balance < total)
      return openModal("error", "Insufficient balance", "Your wallet balance is not enough for this booking.");

    // --- Preflight overlap check (outside tx) ---
    try {
      setIsPayingWallet(true);
      const preQ = query(
        collection(database, "bookings"),
        where("listingId", "==", listing.id),
        where("status", "in", ["confirmed", "pending"])
      );
      const snap = await getDocs(preQ);

      const s0 = startOfDay(start);
      const e0 = startOfDay(end);
      const conflict = snap.docs.some((d) => {
        const b = d.data();
        const ci = toJSDate(b.checkIn);
        const co = toJSDate(b.checkOut);
        if (!ci || !co) return false;
        return rangesOverlap(s0, addDays(e0, -1), startOfDay(ci), addDays(startOfDay(co), -1));
      });
      if (conflict) {
        setIsPayingWallet(false);
        return openModal("error", "Dates unavailable", "Those dates were just booked. Please pick different dates.");
      }
    } catch (e) {
      console.error("Preflight overlap check failed:", e);
      setIsPayingWallet(false);
      return openModal("error", "Availability check failed", "Could not verify availability. Please try again.");
    }

    // --- Transaction: lock nights + booking + guest debit + host payout (subtotal) + points (guest & host) ---
    try {
      await runTransaction(database, async (tx) => {
        const s0 = startOfDay(start);
        const e0 = startOfDay(end);
        const nights = eachNight(s0, e0);

        const hostUid = listing?.uid || listing?.ownerId || listing?.hostId || "";
        if (!hostUid) throw new Error("Listing host not found.");

        // Refs
        const wrefGuest = doc(database, "wallets", user.uid);
        const wrefHost  = doc(database, "wallets", hostUid);
        const walletTxGuestRef = doc(collection(database, "wallets", user.uid, "transactions"));
        const walletTxHostRef  = doc(collection(database, "wallets", hostUid, "transactions"));

        const pointsGuestRef = doc(database, "points", user.uid);
        const pointsHostRef  = doc(database, "points", hostUid);
        const ptsLogGuestRef = doc(collection(database, "points", user.uid, "transactions"));
        const ptsLogHostRef  = doc(collection(database, "points", hostUid, "transactions"));

        const bookingRef = doc(collection(database, "bookings"));
        const nightRefs = nights.map((d) =>
          doc(database, "nightLocks", `${listing.id}_${ymd(d)}`)
        );

        // ---------- READS (before any write) ----------
        const wSnapGuest = await tx.get(wrefGuest);
        const pSnapGuest = await tx.get(pointsGuestRef);
        const wSnapHost  = await tx.get(wrefHost);
        const pSnapHost  = await tx.get(pointsHostRef);

        // Read admin wallet balance (if service fee will be credited)
        let adminBal = 0;
        let adminBalAfter = 0;
        if (serviceFee > 0) {
          const wrefAdmin = doc(database, "wallets", ADMIN_WALLET_ID);
          const adminSnap = await tx.get(wrefAdmin);
          adminBal = Number(adminSnap.data()?.balance || 0);
          adminBalAfter = adminBal + serviceFee;
        }

        for (const nref of nightRefs) {
          const nsnap = await tx.get(nref);
          if (nsnap.exists()) throw new Error("One or more nights just became unavailable. Please choose new dates.");
        }

        const guestBalBefore = Number(wSnapGuest.data()?.balance || 0);
        if (guestBalBefore < total) throw new Error("Insufficient wallet balance.");

        const guestPtsBefore = Number(pSnapGuest.data()?.balance || 0);
        const guestPtsAfter  = guestPtsBefore + BOOKING_REWARD_POINTS;

        const hostBalBefore = Number(wSnapHost.data()?.balance || 0);
        const hostBalAfter  = hostBalBefore + subtotal;

        const hostPtsBefore = Number(pSnapHost.data()?.balance || 0);
        const hostPtsAfter  = hostPtsBefore + HOST_BOOKING_REWARD_POINTS;

        const guestBalAfter = guestBalBefore - total;

        const appliedOffers = [
          ...(Number(payment?.promoDiscount || 0) > 0
            ? [{
                kind: "promo",
                offerId: payment?.promoId || null,
                label: payment?.promoLabel || "",
                discount: Number(payment?.promoDiscount || 0),
              }]
            : []),
          ...(Number(payment?.couponDiscount || 0) > 0
            ? [{
                kind: "coupon",
                offerId: payment?.couponId || null,
                code: payment?.offerCode || null,
                label: payment?.couponLabel || "",
                discount: Number(payment?.couponDiscount || 0),
              }]
            : []),
        ];

        // ---------- BOOKING ----------
        const bookingData = {
          uid: user.uid,
          guestEmail: user.email,
          guestName: user.displayName || "",
          checkIn: s0,
          checkOut: e0,
          nights: payment.nights,
          adults,
          children,
          infants,
          pricePerNight: Number(listing.price || 0),
          cleaningFee: includeCleaningFee ? Number(listing.cleaningFee || 0) : 0,
          discountType: listing.discountType || "none",
          discountValue: Number(listing.discountValue || 0),
          totalPrice: total,
          listingTitle: listing.title || "Untitled",
          listingCategory: listing.category || "Homes",
          listingAddress: listing.location || "",
          listingPhotos: Array.isArray(listing.photos) ? listing.photos : [],
          hostId: hostUid,
          listingId: listing.id,
          status: "confirmed",
          paymentStatus: "paid",
          paymentMethod: "wallet",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          // ADDED: both promo & coupon saved
          appliedOffers,
        };
        tx.set(bookingRef, bookingData);

        // night locks
        for (const [i, nref] of nightRefs.entries()) {
          tx.set(nref, {
            listingId: listing.id,
            date: ymd(nights[i]),
            bookingId: bookingRef.id,
            uid: user.uid,
            createdAt: serverTimestamp(),
          });
        }

        // ---------- GUEST wallet: debit total ----------
        tx.set(walletTxGuestRef, {
          uid: user.uid,
          type: "booking_payment",
          delta: -total,
          amount: total,
          status: "completed",
          method: "wallet",
          note: `${listing.title || "Listing"} — ${ymd(s0)} to ${ymd(addDays(e0, -1))}`,
          metadata: { bookingId: bookingRef.id, listingId: listing.id, hostUid },
          balanceAfter: guestBalAfter,
          timestamp: serverTimestamp(),
        });
        tx.set(
          wrefGuest,
          { uid: user.uid, balance: guestBalAfter, currency: "PHP", updatedAt: serverTimestamp() },
          { merge: true }
        );

        // ---------- HOST wallet: credit SUBTOTAL (no service fee) ----------
        tx.set(
          wrefHost,
          { uid: hostUid, balance: hostBalAfter, currency: "PHP", updatedAt: serverTimestamp() },
          { merge: true }
        );
        tx.set(walletTxHostRef, {
          uid: hostUid,
          type: "booking_income",
          delta: +subtotal,
          amount: subtotal,
          status: "completed",
          method: "wallet",
          sourceUid: user.uid,
          note: `Earnings from ${listing.title || "Listing"} — ${ymd(s0)} to ${ymd(addDays(e0, -1))}`,
          metadata: { bookingId: bookingRef.id, payerUid: user.uid, listingId: listing.id },
          balanceAfter: hostBalAfter,
          timestamp: serverTimestamp(),
        });

        // ---------- GUEST points (+80) ----------
        tx.set(
          pointsGuestRef,
          { uid: user.uid, balance: guestPtsAfter, updatedAt: serverTimestamp() },
          { merge: true }
        );
        tx.set(ptsLogGuestRef, {
          uid: user.uid,
          type: "booking_reward",
          delta: BOOKING_REWARD_POINTS,
          amount: BOOKING_REWARD_POINTS,
          status: "completed",
          note: `Reward for booking ${listing.title || "Listing"}`,
          bookingId: bookingRef.id,
          balanceAfter: guestPtsAfter,
          timestamp: serverTimestamp(),
        });

        // ---------- HOST points (+100) ----------
        tx.set(
          pointsHostRef,
          { uid: hostUid, balance: hostPtsAfter, updatedAt: serverTimestamp() },
          { merge: true }
        );
        tx.set(ptsLogHostRef, {
          uid: hostUid,
          type: "host_booking_reward",
          delta: HOST_BOOKING_REWARD_POINTS,
          amount: HOST_BOOKING_REWARD_POINTS,
          status: "completed",
          note: `Reward for hosting a booking on ${listing.title || "Listing"}`,
          bookingId: bookingRef.id,
          balanceAfter: hostPtsAfter,
          timestamp: serverTimestamp(),
        });

        // ---------- ADMIN wallet: credit service fee ----------
        if (serviceFee > 0) {
          const wrefAdmin = doc(database, "wallets", ADMIN_WALLET_ID);
          
          // Ensure admin wallet exists (if it didn't exist, balance was 0)
          const walletTxAdminRef = doc(collection(database, "wallets", ADMIN_WALLET_ID, "transactions"));
          tx.set(walletTxAdminRef, {
            uid: ADMIN_WALLET_ID,
            type: "service_fee",
            delta: +serviceFee,
            amount: serviceFee,
            status: "completed",
            method: "wallet",
            note: `Service fee from ${listing.title || "Listing"} — ${ymd(s0)} to ${ymd(addDays(e0, -1))}`,
            metadata: { bookingId: bookingRef.id, listingId: listing.id, hostUid, payerUid: user.uid },
            balanceAfter: adminBalAfter,
            timestamp: serverTimestamp(),
          });
          
          tx.set(
            wrefAdmin,
            { uid: ADMIN_WALLET_ID, balance: adminBalAfter, currency: "PHP", updatedAt: serverTimestamp() },
            { merge: true }
          );
        }

        // ADDED: coupon redemption audit row (if coupon applied)
        if (Number(payment?.couponDiscount || 0) > 0 && payment?.couponId) {
          const redRef = doc(collection(database, "couponRedemptions"));
          tx.set(redRef, {
            uid: user.uid,
            couponId: payment.couponId,
            code: payment?.offerCode || null,
            bookingId: bookingRef.id,
            listingId: listing.id,
            hostUid,
            timestamp: serverTimestamp(),
          });
        }
      });

      // Update disabled days locally
      const s = startOfDay(selectedDates.start);
      const e = addDays(startOfDay(selectedDates.end), -1);
      if (s && e && e >= s) {
        setBookedIntervals((prev) => mergeIntervals([...prev, { start: s, end: e }]));
      }

      // Email confirmation (best-effort)
      try {
        await sendBookingConfirmationEmail({
          user: auth.currentUser,
          listing,
          totalAmount: payment.total,
          paymentStatus: "paid",
        });
      } catch (e) {
        console.error("Email send failed:", e);
      }

      setIsPayingWallet(false);
      setShowPayPal(false);
      openModal(
        "success",
        "Booking confirmed",
        `Paid with E-Wallet.\n• Host received: ₱${Number(payment.subtotal || 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}\n• You earned: +${BOOKING_REWARD_POINTS} pts\n• Host earned: +${HOST_BOOKING_REWARD_POINTS} pts\n\nA confirmation email will follow shortly.`
      );
    } catch (e) {
      console.error(e);
      setIsPayingWallet(false);
      openModal("error", "Payment failed", e?.message || "We couldn’t complete your wallet payment.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/35 via-white/55 to-indigo-50/35">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
            {listing.title || "Home details"}
          </h1>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleFacebookShare}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition"
              title="Share on Facebook"
            >
              <Facebook className="w-4 h-4" />
            </button>
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition"
              title="Copy link"
            >
              <Copy className="w-4 h-4" />
            </button>
            {host && (
              <button
                onClick={() => setShowMessageModal(true)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition"
              >
                <MessageSquareText className="w-5 h-5" /> Message Host
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ===== Hero Gallery ===== */}
      <section className="max-w-[1200px] mx-auto px-4 pt-4">
        <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
          <div className="aspect-[16/9] sm:aspect-[21/9] bg-slate-200">
            {hasPhotos ? (
              <img
                src={photos[currentPhoto]}
                alt={`Photo ${currentPhoto + 1} of ${photos.length}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-slate-600">No photos available</div>
            )}

            {/* Discount badge */}
            {hasDiscount && (
              <div className="absolute left-4 top-4 z-10">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/95 backdrop-blur px-4 py-2 text-sm sm:text-base font-bold text-slate-900 shadow-lg ring-1 ring-black/5">
                  <BadgePercent className="w-5 h-5 text-blue-600" />
                  <span className="text-blue-700">{discountText}</span>
                  <Sparkles className="w-6 h-6 text-indigo-500" />
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />

            {hasPhotos && photos.length > 1 && (
              <>
                <button
                  onClick={prevPhoto}
                  aria-label="Previous photo"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-800 grid place-items-center shadow transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={nextPhoto}
                  aria-label="Next photo"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-800 grid place-items-center shadow transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                <div
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2"
                  role="tablist"
                  aria-label="Gallery slides"
                >
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentPhoto(i);
                      }}
                      role="tab"
                      aria-label={`Go to photo ${i + 1}`}
                      aria-selected={i === currentPhoto}
                      className={`h-2.5 w-2.5 rounded-full ring-1 ring-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                        i === currentPhoto ? "bg-white" : "bg-white/70"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ===== Location & Price ===== */}
      <section className="max-w-[1200px] mx-auto px-4 mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm sm:text-base font-semibold text-slate-900 shadow-sm">
            <MapPin className="w-5 h-5 text-blue-600" />
            {listing.location || "Location not set"}
          </span>

          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-blue-700 shadow-sm">
            <Tag className="w-5 h-5" />
            ₱{numberOr(listing.price).toLocaleString()}/night
          </span>

          {reviews.length > 0 && (
                <div className="inline-flex items-center gap-2 ml-auto">
                  <Stars value={avgRating} />
                  <span className="text-sm font-medium text-slate-800">
                    {avgRating.toFixed(1)} · {reviews.length} review{reviews.length === 1 ? "" : "s"}
                  </span>
                </div>
              )}
        </div>
      </section>

      {/* ===== Main content grid ===== */}
      <main className="max-w-[1200px] mx-auto px-4 mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-4">
        {/* LEFT: Details */}
        <div className="lg:col-span-7 space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 sm:mb-3">
            {listing.title || "Home details"}
          </h2>

          {/* Description */}
          <GlassCard className="p-5 sm:p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">About this place</h2>
            <p className="text-[15px] sm:text-base leading-relaxed text-slate-800">
              {listing.description || "No description provided."}
            </p>
            {!!listing.uniqueDescription && (
              <p className="mt-2 text-[15px] sm:text-base leading-relaxed text-slate-800">
                {listing.uniqueDescription}
              </p>
            )}
          </GlassCard>

          {/* Space Overview */}
          <GlassCard className="p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-slate-900 tracking-wide mb-3">Space overview</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <IconStat Icon={BedDouble} label="Bedrooms" value={listing.bedrooms ?? "N/A"} />
              <IconStat Icon={BedSingle} label="Beds" value={listing.beds ?? "N/A"} />
              <IconStat Icon={ShowerHead} label="Bathrooms" value={listing.bathrooms ?? "N/A"} />
            </div>
          </GlassCard>

          {/* Amenities */}
          <GlassCard className="p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-slate-900 tracking-wide">Amenities</h3>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {Array.isArray(listing.amenities) && listing.amenities.length ? (
                listing.amenities.map((a, i) => (
                  <span
                    key={`${a}-${i}`}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] sm:text-xs font-medium text-slate-900 shadow-sm"
                  >
                    {a}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-600">N/A</span>
              )}
            </div>
          </GlassCard>

          {/* Location Map */}
          {listing.location && (
            <GlassCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-slate-900 tracking-wide mb-3">Location</h3>
              <div className="w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                <iframe
                  width="100%"
                  height="400"
                  style={{ border: 0, minHeight: '300px' }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(listing.location)}&output=embed`}
                  title="Location Map"
                  className="w-full h-[300px] sm:h-[400px]"
                />
              </div>
            </GlassCard>
          )}

          {/* ===== NEW: Guest Reviews ===== */}
          <GlassCard className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              {reviews.length > 0 && (
                <div className="inline-flex items-center gap-2">
                  <Stars value={avgRating} />
                  <span className="text-sm font-medium text-slate-800">
                    {avgRating.toFixed(1)} · {reviews.length} review{reviews.length === 1 ? "" : "s"}
                  </span>
                </div>
              )}
              {reviews.length > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (reviewsScrollRef.current) {
                        reviewsScrollRef.current.scrollBy({ left: -320, behavior: "smooth" });
                      }
                    }}
                    className="p-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 shadow-sm transition-colors"
                    aria-label="Scroll reviews left"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-700" />
                  </button>
                  <button
                    onClick={() => {
                      if (reviewsScrollRef.current) {
                        reviewsScrollRef.current.scrollBy({ left: 320, behavior: "smooth" });
                      }
                    }}
                    className="p-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 shadow-sm transition-colors"
                    aria-label="Scroll reviews right"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-700" />
                  </button>
                </div>
              )}
            </div>

            {loadingReviews ? (
              <div className="text-sm text-slate-600">Loading reviews…</div>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-slate-600">No reviews yet.</p>
            ) : (
              <div
                ref={reviewsScrollRef}
                className="flex gap-4 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden scrollbar-hide"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {reviews.map((r) => {
                  const prof = profiles[r.uid] || {};
                  const name =
                    r.guestName ||
                    [prof.firstName, prof.lastName].filter(Boolean).join(" ") ||
                    prof.displayName ||
                    prof.email ||
                    "Guest";
                  const photoURL =
                    prof.photoURL ||
                    prof.photoUrl ||
                    prof.avatarURL ||
                    prof.photo ||
                    prof.avatar ||
                    prof.profileImageUrl ||
                    null;
                  const when = fmtReviewDate(r.updatedAt || r.createdAt);

                  return (
                    <div
                      key={r.id}
                      className="flex-shrink-0 w-[320px] sm:w-[360px] flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <ReviewerAvatar name={name} photoURL={photoURL} />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="font-semibold text-slate-900 truncate">{name}</p>
                            {!!when && <span className="text-xs text-slate-500">{when}</span>}
                          </div>
                          <div className="mt-1"><Stars value={Number(r.rating) || 0} /></div>
                        </div>
                      </div>
                      {r.text && (
                        <p className="text-sm text-slate-800 whitespace-pre-wrap line-clamp-4">{r.text}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>

          {/* Cancellation Policy */}
          <GlassCard className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900 tracking-wide">Cancellation Policy</h3>
            </div>
            <div className="rounded-3xl bg-white border border-slate-200 p-4 shadow-sm">
              {String(listing?.cancellationPolicy ?? "").trim() ? (
                <p className="text-[14px] sm:text-[15px] leading-relaxed text-slate-800 whitespace-pre-line">
                  {listing.cancellationPolicy}
                </p>
              ) : (
                <p className="text-[14px] sm:text-[15px] text-slate-600">
                  No cancellation policy provided by the host.
                </p>
              )}
              <div className="mt-3 flex items-start gap-2 text-[12.5px] sm:text-xs text-slate-600">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-[1px]" />
                <span>By booking, you agree to this host’s cancellation terms.</span>
              </div>
            </div>
          </GlassCard>

          {/* Host */}
          {host && (
            <GlassCard className="p-4 sm:p-5 flex items-center gap-4">
              <HostAvatar host={host} />
              <div className="flex-1">
                <p className="text-[15px] sm:text-base font-semibold text-slate-900">
                  {([host.firstName, host.lastName].filter(Boolean).join(" ")) ||
                    host.displayName ||
                    host.email ||
                    "Host"}
                </p>
                <p className="text-[13px] sm:text-sm text-slate-600">Host of this listing</p>
              </div>
              <button
                onClick={() => setShowMessageModal(true)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[13px] sm:text-sm font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 shadow-sm active:scale-[0.98] transition"
              >
                <MessageSquareText className="w-5 h-5" /> Message Host
              </button>
            </GlassCard>
          )}
        </div>

        {/* RIGHT: Booking sidebar */}
        <div className="lg:col-span-5">
          <BookingSidebar
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
            hasDiscount={hasDiscount}
            discountText={discountText}
            // Wallet props (for checkout)
            wallet={wallet}
            payWithWallet={payWithWallet}
            isPayingWallet={isPayingWallet}
            // ADDED: coupon/promo props
            couponInput={couponInput}
            setCouponInput={setCouponInput}
            couponErr={couponErr}
            appliedCoupon={appliedCoupon}
            applyCouponCode={applyCouponCode}
            clearCoupon={clearCoupon}
            autoPromo={autoPromo}
          />
        </div>
      </main>

      {/* Message Host modal */}
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

      {/* Footer booking actions */}
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
        // Wallet props (for checkout)
        wallet={wallet}
        payWithWallet={payWithWallet}
        isPayingWallet={isPayingWallet}
      />

      {host && (
        <HostSectionForGuest
          host={host}
          listing={listing}
          reviews={reviews}
          avgRating={avgRating}
        />
      )}

      {/* Global overlays for E-Wallet flow */}
      {isPayingWallet && <FullScreenLoader text="Processing E-Wallet payment…" />}

      <ResultModal
        open={modal.open}
        kind={modal.kind}
        title={modal.title}
        message={modal.message}
        onClose={closeModal}
      />

      {/* Share toast notification */}
      {shareToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70]">
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm shadow border ${
              shareToast.kind === "success"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            {shareToast.kind === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {shareToast.text}
          </div>
        </div>
      )}

      {/* Login Modal */}
      {showLoginModal &&
        createPortal(
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="relative w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-6">
              <div className="flex items-start gap-4">
                <div className="mt-0.5">
                  <div className="h-12 w-12 rounded-xl bg-blue-100 grid place-items-center">
                    <LogIn className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Login Required</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    You need to be logged in to make a booking. Please log in to continue.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowLoginModal(false)}
                      className="flex-1 inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setShowLoginModal(false);
                        navigate("/");
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition"
                    >
                      <LogIn className="w-4 h-4" />
                      Go to Login
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

/* ============================ Booking Sidebar ============================ */
function BookingSidebar(props) {
  const {
    listing,
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
    hasDiscount,
    discountText,
    // wallet (for checkout)
    wallet,
    payWithWallet,
    isPayingWallet,
    // ADDED: coupon/promo props
    couponInput, setCouponInput, couponErr, appliedCoupon, applyCouponCode, clearCoupon, autoPromo,
  } = props;

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

  const totalCap = Number.isFinite(totalCapRaw) && totalCapRaw > 0 ? totalCapRaw : numberOr(listing?.maxGuests, Infinity);

  const maxGuests =
    Number.isFinite(totalCap) && totalCap !== Infinity ? totalCap : numberOr(listing?.maxGuests, 1);

  const totalGuests = adults + children + infants;

  return (
    <aside className="lg:sticky lg:top-20">
      <div className="rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5 overflow-hidden">
        {/* Price + discount */}
        <div className="px-5 pt-5">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xl font-semibold text-slate-900">
                ₱{numberOr(listing.price).toLocaleString()}
                <span className="text-sm font-medium text-slate-500"> / night</span>
              </div>
            </div>
            {hasDiscount && (
              <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1.5 text-xs sm:text-sm font-bold shadow">
                <BadgePercent className="w-5 h-5" />
                {discountText}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 h-px bg-slate-200" />

        {/* Dates */}
        <div className="px-4 py-4">
          <h4 className="text-sm font-semibold text-slate-900 mb-2">Dates</h4>
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
                ? [
                    {
                      start: new Date(listing.availability.start + "T00:00:00"),
                      end: new Date(listing.availability.end + "T00:00:00"),
                    },
                  ]
                : undefined
            }
            excludeDateIntervals={bookedIntervals}
            selectsDisabledDaysInRange={false}
            filterDate={filterDate}
          />
        </div>

        {/* Guests */}
        <div className="px-5 pb-2">
          <div className="rounded-2xl bg-white/90 backdrop-blur border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
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
                  if (nextTotal <= maxGuests && (Number.isFinite(adultsCap) ? adults + 1 <= adultsCap : true))
                    setAdults((v) => v + 1);
                }}
              />
              {/* Children */}
              <RowCounter
                label="Children (2–12)"
                value={children}
                min={0}
                onDec={() => setChildren((v) => clamp(v - 1, 0, 999))}
                onInc={() => {
                  const nextTotal = adults + children + infants + 1;
                  if (
                    nextTotal <= maxGuests &&
                    (Number.isFinite(childrenCap) ? children + 1 <= childrenCap : true)
                  ) {
                    setChildren((v) => v + 1);
                  }
                }}
              />

              {/* Infants */}
              <RowCounter
                label="Infants (under 2)"
                value={infants}
                min={0}
                onDec={() => setInfants((v) => clamp(v - 1, 0, 999))}
                onInc={() => {
                  const nextTotal = adults + children + infants + 1;
                  if (
                    nextTotal <= maxGuests &&
                    (Number.isFinite(infantsCap) ? infants + 1 <= infantsCap : true)
                  ) {
                    setInfants((v) => v + 1);
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Cleaning Fee toggle */}
        {!!numberOr(listing.cleaningFee) && (
          <div className="px-5 pb-2">
            <section className="flex items-center justify-between rounded-2xl bg-white/90 backdrop-blur border border-slate-200 p-3.5 sm:p-4 shadow-sm">
              <p className="text-[13.5px] sm:text-sm font-semibold text-slate-900">
                Cleaning Fee: <span className="font-bold">₱{numberOr(listing.cleaningFee).toLocaleString()}</span>
              </p>
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <span id="cleaning-fee-label" className="sr-only">
                  Toggle cleaning fee
                </span>
                <input
                  aria-labelledby="cleaning-fee-label"
                  type="checkbox"
                  checked={includeCleaningFee}
                  onChange={(e) => setIncludeCleaningFee(e.target.checked)}
                  className="peer sr-only"
                />
                <span className="w-11 h-6 rounded-full bg-slate-300 relative transition after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-5 after:h-5 after:bg-white after:rounded-full after:transition peer-checked:bg-blue-600 peer-checked:after:translate-x-5" />
                <span className="text-[13.5px] sm:text-sm text-slate-900">
                  {includeCleaningFee ? "Included" : "Excluded"}
                </span>
              </label>
            </section>
          </div>
        )}

        {/* ADDED: Promo / Coupon UI */}
        <div className="px-5 pb-2">
          <section className="rounded-2xl bg-white/90 backdrop-blur border border-slate-200 p-4 shadow-sm">
            <p className="text-[13.5px] sm:text-sm font-semibold text-slate-900">Promo / Coupon</p>

            {/* Auto-applied promo hint (only when no coupon applied) */}
            {!appliedCoupon && autoPromo ? (
              <p className="mt-1 text-xs text-emerald-700">
                Auto-applied promo: <span className="font-semibold">{describeOffer(autoPromo)}</span>
              </p>
            ) : null}

            {/* Coupon input */}
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                inputMode="text"
                placeholder="Enter coupon code"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              {appliedCoupon ? (
                <button
                  type="button"
                  onClick={clearCoupon}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={applyCouponCode}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                >
                  Apply
                </button>
              )}
            </div>
            {couponErr ? <p className="mt-2 text-xs text-rose-600">{couponErr}</p> : null}

            {appliedCoupon ? (
              <p className="mt-2 text-xs text-emerald-700">
                Coupon applied: <span className="font-semibold">{appliedCoupon.code}</span> · {describeOffer(appliedCoupon)}
              </p>
            ) : null}
          </section>
        </div>

        {/* Payment breakdown */}
        {payment && (
          <div className="px-5 pb-4">
            <section
              className="rounded-3xl bg-white/90 backdrop-blur border border-slate-200 p-4 sm:p-5 shadow-lg space-y-2"
              aria-live="polite"
            >
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">Payment Breakdown</h3>

              <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                <span>
                  <span className="font-semibold">₱{payment.price.toLocaleString()}</span> × {payment.nights} night
                  {payment.nights > 1 ? "s" : ""}
                </span>
                <span className="font-medium">₱{(payment.price * payment.nights).toLocaleString()}</span>
              </div>

              {payment.type === "percentage" && payment.dVal > 0 && (
                <div className="flex items-center justify-between text-[13.5px] sm:text-sm text-green-700">
                  <span>Discount ({payment.dVal}%)</span>
                  <span>
                    − ₱
                    {(
                      payment.perNightDiscount * payment.nights
                    ).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {payment.type === "percentage" && (
                <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                  <span>Nightly after discount</span>
                  <span className="font-medium">
                    ₱{payment.nightlyAfter.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {!!numberOr(listing.cleaningFee) && (
                <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                  <span className={includeCleaningFee ? "" : "text-slate-400 line-through"}>Cleaning Fee</span>
                  <span className={includeCleaningFee ? "" : "text-slate-400 line-through"}>
                    ₱{numberOr(listing.cleaningFee).toLocaleString()}
                  </span>
                </div>
              )}

              {payment.type === "fixed" && payment.dVal > 0 && (
                <div className="flex items-center justify-between text-[13.5px] sm:text-sm text-green-700">
                  <span>Discount (fixed)</span>
                  <span>
                    − ₱{payment.fixedDiscount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* PROMO line */}
              {payment.promoDiscount > 0 && (
                <div className="flex items-center justify-between text-[13.5px] sm:text-sm text-green-700">
                  <span>Promo{payment.promoLabel ? ` — ${payment.promoLabel}` : ""}</span>
                  <span>
                    − ₱{payment.promoDiscount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* COUPON line */}
              {payment.couponDiscount > 0 && (
                <div className="flex items-center justify-between text-[13.5px] sm:text-sm text-green-700">
                  <span>
                    Coupon{payment.offerCode ? ` (${payment.offerCode})` : ""}{payment.couponLabel ? ` — ${payment.couponLabel}` : ""}
                  </span>
                  <span>
                    − ₱{payment.couponDiscount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                <span>Subtotal</span>
                <span className="font-medium">
                  ₱{payment.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                <span>Service fee (10%)</span>
                <span>₱{payment.serviceFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>

              <div className="my-2 h-px bg-slate-200" />

              <div className="flex items-center justify-between">
                <span className="text-base sm:text-lg font-bold text-slate-900">Total</span>
                <span className="text-base sm:text-lg font-bold text-blue-700">
                  ₱
                  {payment.total.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              {!includeCleaningFee && !!numberOr(listing.cleaningFee) && (
                <p className="text-[12.5px] sm:text-xs text-slate-600">*Cleaning fee excluded from total</p>
              )}
            </section>
          </div>
        )}

        {/* Book flow: only Book Now initially; checkout shows PayPal + E-Wallet */}
        <div className="px-5 pb-6 hidden lg:block">
          {showPayPal ? (
            <PayPalCheckout
              payment={payment}
              totalAmount={totalAmount}
              setShowPayPal={setShowPayPal}
              selectedDates={selectedDates}
              listing={listing}
              includeCleaningFee={includeCleaningFee}
              adults={adults}
              children={children}
              infants={infants}
              setBookedIntervals={setBookedIntervals}
              onClose={onClose}
              wallet={wallet}
              payWithWallet={payWithWallet}
              isPayingWallet={isPayingWallet}
            />
          ) : (
            <button
              type="button"
              disabled={!payment}
              aria-disabled={!payment}
              onClick={handleBookNow}
              className="w-full inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 active:scale-[0.99] transition disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Book Now
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

/* --- Host avatar --- */
function HostAvatar({ host }) {
  const [imgOk, setImgOk] = useState(true);
  const initial = (
    ([host.firstName, host.lastName].filter(Boolean).join(" ")) || host.displayName || host.email || "H"
  )[0].toUpperCase();

  return (
    <div className="relative w-12 h-12 rounded-full bg-white/80 border border-slate-200 overflow-hidden shrink-0 grid place-items-center text-slate-900 font-semibold ring-2 ring-slate-200">
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

/* --- Footer / bottom actions --- */
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
  wallet,
  payWithWallet,
  isPayingWallet,
}) {
  return (
    <div
      className="w-full bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-t border-slate-200 px-4 pt-4 pb-6 lg:hidden"
      style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row gap-3">
        {showPayPal ? (
          <PayPalCheckout
            payment={payment}
            totalAmount={totalAmount}
            setShowPayPal={setShowPayPal}
            selectedDates={selectedDates}
            listing={listing}
            includeCleaningFee={includeCleaningFee}
            adults={adults}
            children={children}
            infants={infants}
            setBookedIntervals={setBookedIntervals}
            onClose={onClose}
            wallet={wallet}
            payWithWallet={payWithWallet}
            isPayingWallet={isPayingWallet}
          />
        ) : (
          <>
            <button
              type="button"
              disabled={!payment}
              aria-disabled={!payment}
              onClick={handleBookNow}
              className="w-full sm:w-auto flex-1 min-w-[140px] inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 active:scale-[0.99] transition disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Book Now
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto flex-1 min-w-[140px] inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 transition"
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
    <div className="flex items-center justify-between rounded-2xl bg-white/90 backdrop-blur border border-slate-200 px-3 py-2 shadow-sm">
      <span className="text-sm font-semibold text-slate-900">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDec}
          disabled={value <= min}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 shadow active:scale-95 transition disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-8 text-center font-semibold text-slate-900" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          onClick={onInc}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          aria-label={`Increase ${label}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
