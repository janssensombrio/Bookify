// src/pages/host/ExperienceDetailsPage.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { PayPalButtons } from "@paypal/react-paypal-js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  onSnapshot,
  runTransaction,
  orderBy,
  limit,
} from "firebase/firestore";
import { auth, database } from "../../config/firebase";
import emailjs from "@emailjs/browser";

import { MessageHostModal } from "../../components/message-host-modal";
import PointsNotificationModal from "../../components/PointsNotificationModal.jsx";
import { useServiceFeeRate } from "../../utils/serviceFeeRate.js";

import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Tag,
  Users,
  Clock,
  Languages,
  MessageSquareText,
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
  ShieldCheck,
  Ticket,
  X,
  Share2,
  Copy,
  Facebook,
  LogIn,
} from "lucide-react";

/* =============== Rewards =============== */
const BOOKING_REWARD_POINTS = 80; // guest reward
const HOST_BOOKING_REWARD_POINTS = 100; // host reward per booking (E-Wallet flow)

/* ================= EmailJS config & helper ================= */
const EMAILJS_SERVICE_ID = "service_x9dtjt6";
const EMAILJS_TEMPLATE_ID = "template_vrfey3u";
const EMAILJS_PUBLIC_KEY = "hHgssQum5iOFlnJRD";
// const EMAILJS_SERVICE_ID = "";
// const EMAILJS_TEMPLATE_ID = "";
// const EMAILJS_PUBLIC_KEY = "";
emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

async function sendBookingEmail({
  user,
  title,
  category,
  location,
  total,
  paymentStatus = "Paid",
  currencySymbol = "₱",
  brandSiteUrl,
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
    brand_site_url: String(
      brandSiteUrl || (typeof window !== "undefined" ? window.location.origin : "")
    ),
  };
  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params, EMAILJS_PUBLIC_KEY);
}

/* ================================= helpers ================================= */
const numberOr = (v, d = 0) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : d;
};
const ADMIN_WALLET_ID = "admin";

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

const toUpperSafe = (s) => (s ? String(s).toUpperCase() : "");
const nowMs = () => Date.now();
const inRange = (startMs, endMs, probe = nowMs()) => {
  const s = Number(startMs || 0) || 0;
  const e = Number(endMs || 0) || 0;
  if (s && probe < s) return false;
  if (e && probe > e) return false;
  return true;
};

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

function ResultModal({ open, kind = "info", title, message, onClose, primaryLabel = "OK", preventClose = false }) {
  if (!open) return null;
  const Icon = kind === "success" ? CheckCircle2 : kind === "error" ? AlertCircle : null;
  const tone =
    kind === "success" ? "text-emerald-600" : kind === "error" ? "text-rose-600" : "text-blue-600";

  return createPortal(
    <div className="fixed inset-0 z-[2147483646] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
        onClick={preventClose ? undefined : onClose} 
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-5">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className={`mt-0.5 ${tone}`}>
              <Icon className="w-6 h-6" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            {message ? (
              <p className="mt-1 text-sm text-slate-700 whitespace-pre-line">{message}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={preventClose ? undefined : onClose}
            disabled={preventClose}
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
  const languages = Array.isArray(profile?.languages) ? profile.languages : [];
  const shownLangs = languages.length ? languages : [];

  // small atoms
  const Avatar = () => {
    const [ok, setOk] = React.useState(true);
    const initial = displayName?.[0]?.toUpperCase?.() || "H";
    return (
      <div className="w-12 h-12 rounded-full bg.white/85 border border-slate-200 overflow-hidden grid place-items-center ring-2 ring-slate-200">
        {photoURL && ok ? (
          <img
            src={photoURL}
            alt="Host avatar"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
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


/* --- Host avatar --- */
function HostAvatar({ host }) {
  const [ok, setOk] = useState(true);
  const name =
    ([host?.firstName, host?.lastName].filter(Boolean).join(" ")) ||
    host?.displayName ||
    host?.email ||
    "H";
  const initial = (name?.[0] || "H").toUpperCase();
  return (
    <div className="relative w-12 h-12 rounded-full bg-white/80 border border-slate-200 overflow-hidden shrink-0 grid place-items-center text-slate-900 font-semibold ring-2 ring-slate-200">
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

/* ======================= Promo/Coupon helpers ======================= */
// Existing general normalizer used elsewhere
function normalizeCodeDoc(d, source = "coupon") {
  const code = String(d?.code || d?.codeUpper || d?.codeLower || "").trim();
  const ruleType = (d?.ruleType || d?.type || "none").toString().toLowerCase();
  const value = numberOr(d?.value, 0);
  const minSpend = numberOr(d?.minSpend, 0);
  const maxDiscount = numberOr(d?.maxDiscount, Infinity);
  const active = !!(d?.active ?? true);
  const startAtMs =
    numberOr(d?.startAtMs, 0) || (d?.startAt?._seconds ? d.startAt._seconds * 1000 : 0);
  const endAtMs =
    numberOr(d?.endAtMs, 0) || (d?.endAt?._seconds ? d.endAt._seconds * 1000 : 0);
  const appliesToListingIds = Array.isArray(d?.appliesToListingIds) ? d.appliesToListingIds : null;
  const appliesToCategories = Array.isArray(d?.appliesToCategories) ? d.appliesToCategories : null;

  return {
    source, // 'coupon' | 'promo'
    code,
    codeUpper: toUpperSafe(code),
    ruleType, // 'percentage' | 'fixed' | 'none'
    value,
    minSpend,
    maxDiscount,
    active,
    startAtMs,
    endAtMs,
    appliesToListingIds,
    appliesToCategories,
  };
}

function ruleEligibleForExperience(rule, listing, scheduleDate = null) {
  if (!rule || !rule.active) return false;
  
  // Date validation - check if schedule date is within rule date range
  if (scheduleDate && (rule.startAtMs || rule.endAtMs)) {
    const scheduleMs = typeof scheduleDate === "string" 
      ? ymdToMs(scheduleDate) 
      : (scheduleDate?.toDate ? scheduleDate.toDate().getTime() : new Date(scheduleDate).getTime());
    // inRange function signature: inRange(startMs, endMs, probe = nowMs())
    if (!inRange(rule.startAtMs, rule.endAtMs, scheduleMs)) {
      return false;
    }
  } else if (!inRange(rule.startAtMs, rule.endAtMs)) {
    // If no schedule date provided, check if current date is in range
    return false;
  }
  
  if (rule.appliesToListingIds?.length) {
    const id = listing?.id || listing?.listingId || "";
    if (!id || !rule.appliesToListingIds.includes(id)) return false;
  }
  if (rule.appliesToCategories?.length) {
    const cat = (listing?.category || "").toString().toLowerCase();
    if (!cat || !rule.appliesToCategories.map((c) => String(c).toLowerCase()).includes(cat)) return false;
  }
  return true;
}

/**
 * Qualify with RAW subtotal vs. minSpend; compute amount over baseAfterListing (stacking).
 */
function computeRuleDiscountStacked({ rawSubtotal, baseAfterListing, rule }) {
  if (!rule || rule.ruleType === "none") return 0;

  // Qualify using RAW subtotal
  if (numberOr(rule.minSpend, 0) > 0 && numberOr(rawSubtotal, 0) < numberOr(rule.minSpend, 0)) return 0;

  const base = Math.max(0, numberOr(baseAfterListing, 0));
  let amt = 0;

  if (rule.ruleType === "percentage") {
    amt = base * (numberOr(rule.value, 0) / 100);
  } else if (rule.ruleType === "fixed") {
    amt = numberOr(rule.value, 0);
  }

  if (Number.isFinite(rule.maxDiscount)) amt = Math.min(amt, rule.maxDiscount);
  return Math.max(0, Math.min(amt, base));
}

/* ======= NEW: Helpers to read promo/coupon docs saved by PromoCouponsModal ======= */
const ymdToMs = (ymd) => {
  if (!ymd) return 0;
  const d = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};

function normalizeCouponFromModal(d) {
  const appliesTo =
    (d?.appliesTo || "").toString().toLowerCase() === "selected" ? "selected" : "all";
  return {
    source: "coupon",
    id: d?.id || null,
    code: String(d?.code || "").trim(),
    codeUpper: toUpperSafe(d?.code || ""),
    ruleType: (d?.discountType || "none").toString().toLowerCase(),
    value: numberOr(d?.discountValue, 0),
    minSpend: numberOr(d?.minSubtotal, 0),
    maxDiscount: Infinity,
    active: (d?.status || "active").toString().toLowerCase() === "active",
    startAtMs: ymdToMs(d?.startsAt),
    endAtMs: ymdToMs(d?.endsAt),
    appliesToListingIds:
      appliesTo === "selected" && Array.isArray(d?.listingIds) ? d.listingIds : null,
    appliesToCategories: null,
  };
}

function normalizePromoFromModal(d) {
  const appliesTo =
    (d?.appliesTo || "").toString().toLowerCase() === "selected" ? "selected" : "all";
  return {
    source: "promoAuto",
    id: d?.id || null,
    title: d?.title || "",
    ruleType: (d?.discountType || "none").toString().toLowerCase(),
    value: numberOr(d?.discountValue, 0),
    minSpend: numberOr(d?.minSubtotal, 0),
    maxDiscount: Infinity,
    active: (d?.status || "active").toString().toLowerCase() === "active",
    startAtMs: ymdToMs(d?.startsAt),
    endAtMs: ymdToMs(d?.endsAt),
    appliesToListingIds:
      appliesTo === "selected" && Array.isArray(d?.listingIds) ? d.listingIds : null,
    appliesToCategories: null,
  };
}

/* ============================ Reusable PayPal + Wallet Checkout ============================ */
function PayPalCheckout({
  payment,
  selectedSchedule,
  listingId,
  title,
  category,
  locationStr,
  photos,
  currencySymbol,
  setShowPayPal,
  onClose,
  maxParticipants,
  // wallet props
  wallet,
  payWithWallet,
  isPayingWallet,
  // points modal
  onPointsAwarded,
  // Modal
  openModal,
  // reward
  setSelectedReward,
}) {
  const computedTotal = Number(payment?.total ?? 0);

  return (
    <div className="w-full sm:max-w-md">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <PayPalButtons
          style={{ layout: "vertical" }}
          createOrder={(data, actions) => {
            return actions.order.create({
              purchase_units: [{ amount: { value: (payment?.total || 0).toFixed(2) } }],
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

              // ---- Preflight capacity check (best-effort; tx will enforce) ----
              const rawTime = selectedSchedule.time || selectedSchedule.startTime || "";
              const timeKey = String(rawTime).replace(/:/g, "");
              const lockId = `${listingId}_${selectedSchedule.date}_${timeKey}`;
              try {
                if (maxParticipants > 0) {
                  const lref = doc(database, "experienceLocks", lockId);
                  const lsnap = await getDoc(lref);
                  const currentCount = Number(lsnap.data()?.count || 0);
                  const nextCount = currentCount + Number(payment.participants || 1);
                  if (nextCount > maxParticipants) {
                    alert(
                      "Not enough available slots for this schedule. Please pick a different time or reduce participants."
                    );
                    return;
                  }
                }
              } catch {
                // ignore, enforce in tx
              }

              // ---- Transaction: lock capacity + create booking + (if completed) award points + credit admin wallet ----
              let bookingId = null;
              await runTransaction(database, async (tx) => {
                const participants = Number(payment.participants || 1);
                const serviceFee = Number(payment.serviceFee || 0);
                const hostUid = payment?.hostUid || null;

                const bookingRef = doc(collection(database, "bookings"));
                bookingId = bookingRef.id; // Store booking ID for use outside transaction
                const pointsRef = doc(database, "points", user.uid);
                const ptsLogRef = doc(collection(database, "points", user.uid, "transactions"));
                const lref = doc(database, "experienceLocks", lockId);

                // READS
                const pSnap = await tx.get(pointsRef);
                const lsnap = await tx.get(lref);

                // Read admin wallet balance (if service fee will be credited)
                let adminBal = 0;
                let adminBalAfter = 0;
                if (completed && serviceFee > 0) {
                  const wrefAdmin = doc(database, "wallets", ADMIN_WALLET_ID);
                  const adminSnap = await tx.get(wrefAdmin);
                  adminBal = Number(adminSnap.data()?.balance || 0);
                  adminBalAfter = adminBal + serviceFee;
                }

                const prevCount = Number(lsnap.data()?.count || 0);
                const newCount = prevCount + participants;
                if (maxParticipants > 0 && newCount > maxParticipants) {
                  throw new Error("Those slots were just taken. Please choose a different time.");
                }

                const curPts = Number(pSnap.data()?.balance || 0);
                const nextPts = completed ? curPts + BOOKING_REWARD_POINTS : curPts;

                const bookingData = {
                  uid: user.uid,
                  listingId,
                  quantity: participants,
                  schedule: { date: selectedSchedule.date, time: rawTime },
                  guestEmail: user.email,
                  guestName: user.displayName || "",
                  // pricing
                  basePrice: Number(payment.basePrice || 0),
                  priceBeforeDiscount: Number(payment.rawSubtotal || 0),
                  // listing discount
                  discountType: payment?.discount?.type || "none",
                  discountValue: Number(payment?.discount?.value || 0),
                  discountAmount: Number(payment.listingDiscountAmount || 0),

                  // === NEW: promo info (auto-applied) ===
                  promoRuleType: payment?.promo?.ruleType || null,
                  promoValue: Number(payment?.promo?.value || 0),
                  promoDiscountAmount: Number(payment?.promoDiscountAmount || 0),
                  promoTitle: payment?.promo?.title || null,

                  // coupon/promo code info
                  couponCode: payment?.discounts?.code?.codeUpper || null,
                  couponSource: payment?.discounts?.code?.source || null,
                  couponRuleType: payment?.discounts?.code?.ruleType || null,
                  couponValue: Number(payment?.discounts?.code?.value || 0),
                  couponDiscountAmount: Number(payment?.couponDiscountAmount || 0),

                  // reward audit
                  reward:
                    Number(payment?.rewardDiscount || 0) > 0 && payment?.rewardId
                      ? {
                          rewardId: payment.rewardId,
                          rewardName: payment?.rewardLabel || "",
                          discount: Number(payment?.rewardDiscount || 0),
                        }
                      : null,

                  subtotal: Number(payment.subtotal || 0),
                  serviceFee: Number(payment.serviceFee || 0),
                  totalPrice: Number(payment.total || 0),
                  // listing props
                  listingTitle: title,
                  listingCategory: category,
                  listingAddress: locationStr,
                  listingPhotos: photos,
                  experienceType: "experience",
                  // status
                  status: bookingStatus,
                  paymentStatus: storedPaymentStatus,
                  paymentMethod: "paypal",
                  paypalOrderId: details?.id || null,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                };

                // WRITES
                tx.set(bookingRef, bookingData);

                if (!lsnap.exists()) {
                  // include uid to satisfy rules
                  tx.set(lref, {
                    uid: user.uid,
                    listingId,
                    date: selectedSchedule.date,
                    time: rawTime,
                    count: participants,
                    lastBookingId: bookingRef.id,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                } else {
                  // include uid in update to satisfy rules
                  tx.set(
                    lref,
                    {
                      uid: user.uid,
                      count: newCount,
                      lastBookingId: bookingRef.id,
                      updatedAt: serverTimestamp(),
                    },
                    { merge: true }
                  );
                }

                // Mark reward as used (if reward applied)
                if (completed && Number(payment?.rewardDiscount || 0) > 0 && payment?.rewardId) {
                  const rewardRef = doc(database, "users", user.uid, "redeemedRewards", payment.rewardId);
                  tx.update(rewardRef, {
                    used: true,
                    usedAt: serverTimestamp(),
                    bookingId: bookingRef.id,
                  });
                }

                // Points (only if PayPal completed)
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
                    note: `Reward for booking ${title}`,
                    bookingId: bookingRef.id,
                    balanceAfter: nextPts,
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
                    note: `Service fee from ${title} — ${fmtDate(selectedSchedule.date)} ${rawTime}`,
                    metadata: { bookingId: bookingRef.id, listingId, hostUid, payerUid: user.uid },
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

              // Email (best-effort)
              try {
                await sendBookingEmail({
                  user,
                  title,
                  category,
                  location: locationStr,
                  total: payment.total,
                  paymentStatus: emailPaymentStatus,
                  currencySymbol,
                  brandSiteUrl: typeof window !== "undefined" ? window.location.origin : "",
                });
              } catch (mailErr) {
                console.error("EmailJS send failed:", mailErr);
              }

              // Show points notification modal if points were awarded
              if (completed && onPointsAwarded) {
                setTimeout(() => {
                  onPointsAwarded(BOOKING_REWARD_POINTS, `Reward for booking ${title || "this experience"}!`);
                }, 500);
              }

              // Clear selected reward from localStorage after successful booking
              if (completed && payment?.rewardId) {
                localStorage.removeItem("selectedReward");
                setSelectedReward(null);
              }

              // Show success modal for PayPal payment
              if (completed) {
                openModal(
                  "success",
                  "Payment Successful!",
                  `Your booking for "${title || "this experience"}" has been confirmed.\n\nBooking ID: ${bookingId ? bookingId.slice(0, 8).toUpperCase() : "N/A"}\nTotal Paid: ₱${(payment?.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                );
                // Close the booking modal after showing success
                setTimeout(() => {
              onClose?.();
                }, 2000);
              } else {
                openModal(
                  "info",
                  "Order Captured",
                  "Your order has been captured. Booking is pending confirmation."
                );
                onClose?.();
              }
            } catch (err) {
              console.error("Error creating reservation:", err);
              alert(`Failed to create reservation: ${err.message}`);
            }
          }}
          onCancel={() => setShowPayPal(false)}
        />
      </div>

      {/* E-Wallet button */}
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
            ? "Select schedule first"
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
        className="mt-3 w-full inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font.medium text-slate-800 hover:bg-slate-50 transition"
      >
        Cancel
      </button>
    </div>
  );
}

/* ================================ PAGE ================================ */
export default function ExperienceDetailsPage({ listingId: propListingId }) {
  // Get service fee rate from admin settings
  const serviceFeeRate = useServiceFeeRate("Experiences");
  const navigate = useNavigate();
  const { listingId: routeListingId } = useParams();
  const listingId = propListingId ?? routeListingId;

  const [experience, setExperience] = useState(null);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
  const [fullScreenPhoto, setFullScreenPhoto] = useState(0);
  const [selectedParticipants, setSelectedParticipants] = useState(1);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [payment, setPayment] = useState(null);
  const [scheduleCapacity, setScheduleCapacity] = useState({}); // { "date_time": count }
  const [showPayPal, setShowPayPal] = useState(false);

  const [host, setHost] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Reviews
  const [reviews, setReviews] = useState([]);
  const reviewsScrollRef = useRef(null);
  const [reviewStats, setReviewStats] = useState({ avg: 0, count: 0 });

  // Wallet live state
  const [wallet, setWallet] = useState({ balance: 0, currency: "PHP" });

  // Wallet UI state (modal + loader)
  const [isPayingWallet, setIsPayingWallet] = useState(false);
  const [modal, setModal] = useState({ open: false, kind: "info", title: "", message: "" });
  const openModal = (kind, title, message) => setModal({ open: true, kind, title, message });
  const closeModal = () => setModal((m) => ({ ...m, open: false }));
  const [pointsModal, setPointsModal] = useState({ open: false, points: 0, reason: "" });

  // Promo/Coupon state
  const [codeInput, setCodeInput] = useState("");
  const [codeStatus, setCodeStatus] = useState({ checking: false, error: "" });
  const [appliedCode, setAppliedCode] = useState(null); // normalized coupon doc

  // NEW: promos (auto-applied)
  const [activePromos, setActivePromos] = useState([]); // normalized promos eligible for this listing
  const [bestPromo, setBestPromo] = useState(null);

  // Reward state
  const [selectedReward, setSelectedReward] = useState(null);

  /* ======= Share functionality ======= */
  const [shareToast, setShareToast] = useState(null);
  
  const getShareUrl = () => {
    return `${window.location.origin}/experiences/${listingId}`;
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
    const title = experience?.title || "Check out this experience";
    const description = experience?.description || "";
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(title + (description ? ` - ${description.substring(0, 100)}` : ""))}`;
    window.open(shareUrl, "_blank", "width=600,height=400");
  };

  /* Update Open Graph meta tags for Facebook sharing */
  useEffect(() => {
    if (!experience || !listingId) return;

    const photos = Array.isArray(experience?.photos) ? experience.photos : [];
    const firstImage = photos.length > 0 ? photos[0] : null;
    const title = experience?.title || "Check out this experience";
    const description = experience?.description || "";
    const url = `${window.location.origin}/experiences/${listingId}`;

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
  }, [experience, listingId]);

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

  // Subscribe wallet of current user
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    const wref = doc(database, "guestWallets", u.uid);
    const unsub = onSnapshot(wref, (s) => {
      const d = s.data() || {};
      setWallet({ balance: Number(d.balance || 0), currency: d.currency || "PHP" });
    });
    return unsub;
  }, []);

  // Load selected reward from localStorage on mount and when page becomes visible
  useEffect(() => {
    const loadReward = () => {
      const rewardStr = localStorage.getItem("selectedReward");
      if (rewardStr) {
        try {
          const reward = JSON.parse(rewardStr);
          setSelectedReward(reward);
        } catch (e) {
          console.error("Failed to parse selected reward:", e);
          localStorage.removeItem("selectedReward");
          setSelectedReward(null);
        }
      } else {
        setSelectedReward(null);
      }
    };

    // Load on mount
    loadReward();

    // Listen for custom event when reward is selected (same tab)
    const handleRewardSelected = (e) => {
      if (e.detail) {
        setSelectedReward(e.detail);
      }
    };
    window.addEventListener("rewardSelected", handleRewardSelected);

    // Also listen for storage changes (when reward is selected from another tab/page)
    const handleStorageChange = (e) => {
      if (e.key === "selectedReward") {
        loadReward();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // Also check periodically when page is visible (for same-tab updates)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadReward();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Check on focus (when user switches back to this tab)
    const handleFocus = () => {
      loadReward();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("rewardSelected", handleRewardSelected);
      window.removeEventListener("storage", handleStorageChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // Fetch schedule capacity (experienceLocks)
  useEffect(() => {
    if (!listingId || !experience?.schedule || !Array.isArray(experience.schedule)) return;

    const fetchCapacity = async () => {
      try {
        const capacityMap = {};
        const locksRef = collection(database, "experienceLocks");
        
        // Fetch all locks for this listing
        const locksQuery = query(locksRef, where("listingId", "==", listingId));
        const locksSnap = await getDocs(locksQuery);
        
        locksSnap.docs.forEach((doc) => {
          const data = doc.data();
          const date = data.date;
          const time = data.time || "";
          const timeKey = String(time).replace(/:/g, "");
          const key = `${date}_${timeKey}`;
          capacityMap[key] = Number(data.count || 0);
        });

        setScheduleCapacity(capacityMap);
      } catch (err) {
        console.error("Error fetching schedule capacity:", err);
      }
    };

    fetchCapacity();

    // Subscribe to real-time updates
    const locksRef = collection(database, "experienceLocks");
    const locksQuery = query(locksRef, where("listingId", "==", listingId));
    const unsub = onSnapshot(locksQuery, (snap) => {
      const capacityMap = {};
      snap.docs.forEach((doc) => {
        const data = doc.data();
        const date = data.date;
        const time = data.time || "";
        const timeKey = String(time).replace(/:/g, "");
        const key = `${date}_${timeKey}`;
        capacityMap[key] = Number(data.count || 0);
      });
      setScheduleCapacity(capacityMap);
    });

    return () => unsub();
  }, [listingId, experience?.schedule]);

  // Load host profile
  useEffect(() => {
    let cancelled = false;

    const normalizeHost = (docSnap, fallbackUid) => {
      const d = docSnap.data() || {};
      const first = d.firstName || d.givenName || d.first_name || "";
      const last = d.lastName || d.familyName || d.last_name || "";
      const displayName = d.displayName || d.name || [first, last].filter(Boolean).join(" ");
      const photoURL =
        d.photoURL || d.photoUrl || d.avatarURL || d.photo || d.avatar || d.profileImageUrl || null;
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
    return () => {
      cancelled = true;
    };
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

  // Full-screen modal photo navigation - sync with currentPhoto when modal opens
  useEffect(() => {
    if (isFullScreenOpen && experience) {
      setFullScreenPhoto(currentPhoto);
    }
  }, [isFullScreenOpen, currentPhoto, experience]);

  // Keyboard navigation for full-screen modal
  useEffect(() => {
    if (!isFullScreenOpen || !experience) return;
    
    const photos = Array.isArray(experience?.photos) ? experience.photos : [];
    if (photos.length === 0) return;
    
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsFullScreenOpen(false);
      } else if (e.key === "ArrowLeft") {
        setFullScreenPhoto((p) => (p - 1 + photos.length) % photos.length);
      } else if (e.key === "ArrowRight") {
        setFullScreenPhoto((p) => (p + 1) % photos.length);
      }
    };
    
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isFullScreenOpen, experience]);

  /* ======================= Load & auto-apply PROMOS (no code) ======================= */
  useEffect(() => {
    let cancelled = false;

    async function loadPromos() {
      try {
        if (!experience || !listingId) {
          if (!cancelled) {
            setActivePromos([]);
            setBestPromo(null);
          }
          return;
        }

        const ownerUid = experience?.uid || experience?.ownerId || experience?.hostId || null;
        if (!ownerUid) {
          if (!cancelled) {
            setActivePromos([]);
            setBestPromo(null);
          }
          return;
        }

        // fetch promos by current owner (support legacy ownerUid)
        const q1 = query(collection(database, "promos"), where("uid", "==", ownerUid));
        const q2 = query(collection(database, "promos"), where("ownerUid", "==", ownerUid));
        const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);

        const map = new Map();
        s1.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
        s2.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));

        // normalize and filter for eligibility
        const all = Array.from(map.values()).map((raw) => normalizePromoFromModal(raw));
        const eligible = all.filter((rule) =>
          ruleEligibleForExperience(rule, { ...experience, id: listingId })
        );

        if (!cancelled) {
          setActivePromos(eligible);
        }
      } catch (e) {
        console.error("Failed to load promos:", e);
        if (!cancelled) {
          setActivePromos([]);
          setBestPromo(null);
        }
      }
    }

    loadPromos();
    return () => {
      cancelled = true;
    };
  }, [experience, listingId]);

  /* ======================= APPLY COUPON CODE (by code, stacking after promo) ======================= */
  const tryApplyPromoOrCoupon = async () => {
    const code = (codeInput || "").trim();
    if (!code) return setCodeStatus({ checking: false, error: "Enter a code." });
    if (!experience) return setCodeStatus({ checking: false, error: "Experience not loaded yet." });

    setCodeStatus({ checking: true, error: "" });

    try {
      // coupons are saved by the modal with uppercase codes; query exact uppercase
      const probe = code.toUpperCase();
      const qs = await getDocs(
        query(collection(database, "coupons"), where("code", "==", probe), limit(1))
      );

      if (qs.empty) {
        setAppliedCode(null);
        setCodeStatus({ checking: false, error: "Code not found." });
        return;
      }

      const raw = { id: qs.docs[0].id, ...qs.docs[0].data() };
      const found = normalizeCouponFromModal(raw);

      // eligibility vs this listing and schedule date
      const scheduleDate = selectedSchedule?.date || null;
      if (!ruleEligibleForExperience(found, { ...experience, id: listingId }, scheduleDate)) {
        setAppliedCode(null);
        setCodeStatus({ checking: false, error: "This code is not eligible for this experience or date." });
        return;
      }

      // min spend check vs RAW subtotal
      const basePrice = numberOr(experience?.price);
      const rawSubtotal = basePrice * Number(selectedParticipants || 1);
      if (found.minSpend && rawSubtotal < found.minSpend) {
        setAppliedCode(null);
        setCodeStatus({
          checking: false,
          error: `Min spend ${currencySymbol}${found.minSpend.toLocaleString()} not met.`,
        });
        return;
      }

      setAppliedCode(found);
      setCodeStatus({ checking: false, error: "" });
    } catch (e) {
      console.error("apply code failed:", e);
      setAppliedCode(null);
      setCodeStatus({ checking: false, error: "Failed to apply code." });
    }
  };

  const clearAppliedCode = () => {
    setAppliedCode(null);
    setCodeStatus({ checking: false, error: "" });
    // keep input for convenience
  };

  // Compute payment (listing discount -> best promo -> coupon)
  useEffect(() => {
    if (!experience || !selectedSchedule) return setPayment(null);

    const basePrice = numberOr(experience.price);
    const participants = selectedParticipants;

    const rawSubtotal = basePrice * participants; // before any discounts

    // Listing-level discount
    const dt = experience?.discountType || "none";
    const dv = numberOr(experience?.discountValue, 0);

    let listingDiscountAmount = 0;
    if (dt === "percentage" && dv > 0) {
      const pct = Math.max(0, Math.min(100, dv));
      listingDiscountAmount = rawSubtotal * (pct / 100);
    } else if (dt === "fixed" && dv > 0) {
      listingDiscountAmount = Math.min(dv, rawSubtotal); // once per booking
    }

    const baseAfterListing = Math.max(0, rawSubtotal - listingDiscountAmount);

    // 1) PROMO (auto): pick best eligible (uses RAW for qualification; amount computed on baseAfterListing)
    let chosenPromo = null;
    let promoDiscountAmount = 0;
    if (activePromos?.length) {
      for (const pr of activePromos) {
        if (numberOr(pr.minSpend, 0) > 0 && rawSubtotal < pr.minSpend) continue;
        const amt = computeRuleDiscountStacked({
          rawSubtotal,
          baseAfterListing,
          rule: pr,
        });
        if (amt > promoDiscountAmount) {
          promoDiscountAmount = amt;
          chosenPromo = pr;
        }
      }
    }
    setBestPromo(chosenPromo);

    // 2) COUPON (code): compute on remaining after promo
    const baseAfterPromo = Math.max(0, baseAfterListing - promoDiscountAmount);
    let couponDiscountAmount = 0;
    if (appliedCode) {
      couponDiscountAmount = computeRuleDiscountStacked({
        rawSubtotal,
        baseAfterListing: baseAfterPromo,
        rule: appliedCode,
      });
    }

    // 3) REWARD applies to AFTER-COUPON amount (last in stack)
    const baseAfterCoupon = Math.max(0, baseAfterListing - promoDiscountAmount - couponDiscountAmount);
    let rewardDiscount = 0;
    if (selectedReward) {
      const rewardType = selectedReward.discountType || "percentage";
      const rewardValue = Number(selectedReward.discountValue || 0);
      if (rewardType === "percentage") {
        rewardDiscount = Math.min(baseAfterCoupon, (baseAfterCoupon * rewardValue) / 100);
      } else {
        rewardDiscount = Math.min(baseAfterCoupon, rewardValue);
      }
    }

    const discountedSubtotal = Math.max(
      0,
      baseAfterCoupon - rewardDiscount
    );
    const serviceFee = discountedSubtotal * serviceFeeRate;
    const total = discountedSubtotal + serviceFee;

    setPayment({
      basePrice,
      participants,
      rawSubtotal,
      // listing discount
      discount: { type: dt, value: dv },
      listingDiscountAmount,
      // promo
      promoDiscountAmount,
      promo: chosenPromo,
      // coupon
      couponDiscountAmount,
      discounts: { code: appliedCode || null },
      // reward
      rewardDiscount,
      rewardLabel: selectedReward ? `${selectedReward.rewardName} (${selectedReward.discountType === "percentage" ? `${selectedReward.discountValue}%` : `₱${Number(selectedReward.discountValue).toLocaleString()}`} OFF)` : "",
      rewardId: selectedReward?.id || null,
      // derived
      subtotal: discountedSubtotal,
      serviceFee,
      total,
    });
  }, [experience, selectedSchedule, selectedParticipants, appliedCode, activePromos, serviceFeeRate, selectedReward]);

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
  const exType = experience?.experienceType === "online" ? "Online" : "In-Person";
  const locationStr = experience?.location || "—";
  const duration = experience?.duration || "—";
  const price = numberOr(experience?.price);
  const currencySymbol =
    experience?.currencySymbol ||
    (experience?.currency === "USD" ? "$" : experience?.currency === "EUR" ? "€" : "₱");

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

  const nextFullScreenPhoto = () => {
    if (!hasPhotos) return;
    setFullScreenPhoto((p) => (p + 1) % photos.length);
  };
  
  const prevFullScreenPhoto = () => {
    if (!hasPhotos) return;
    setFullScreenPhoto((p) => (p - 1 + photos.length) % photos.length);
  };

  const handleBookNow = () => {
    // Check if user is logged in
    if (!auth.currentUser) {
      setShowLoginModal(true);
      return;
    }

    if (!payment || !selectedSchedule) {
      alert("Please select a schedule first.");
      return;
    }
    setShowPayPal(true);
  };

  const onClose = () => {
    const category = experience?.category || "Experiences";
    navigate(`/explore?category=${category}`);
  };

  const dt = experience?.discountType || "none";
  const dv = numberOr(experience?.discountValue);
  const hasDiscount = dt !== "none" && dv > 0;
  const discountText = dt === "percentage" ? `${dv}% off` : `${currencySymbol}${dv.toLocaleString()} off`;

  /* ==================== E-Wallet flow: debit guest, credit host (subtotal), +points ==================== */
  const payWithWallet = async () => {
    const user = auth.currentUser;

    if (!user) return openModal("error", "Sign in required", "Please log in to pay with your wallet.");
    if (!payment) return openModal("error", "Select schedule", "Please select a schedule first.");
    if (!selectedSchedule?.date)
      return openModal("error", "Invalid schedule", "Please pick a valid date and time.");

    const total = Number(payment.total || 0);
    const subtotal = Number(payment.subtotal || 0); // host payout (after listing + promo + coupon)
    const serviceFee = Number(payment.serviceFee || 0); // platform fee
    if (!Number.isFinite(total) || total <= 0)
      return openModal("error", "Invalid total", "We could not compute a valid total.");

    if (wallet.balance < total)
      return openModal("error", "Insufficient balance", "Your wallet balance is not enough for this booking.");

    const rawTime = selectedSchedule.time || selectedSchedule.startTime || "";
    const timeKey = String(rawTime).replace(/:/g, "");
    const lockId = `${listingId}_${selectedSchedule.date}_${timeKey}`;

    // --- Optional preflight capacity check (best effort) ---
    try {
      setIsPayingWallet(true);
      if (maxParticipants > 0) {
        const lref = doc(database, "experienceLocks", lockId);
        const lsnap = await getDoc(lref);
        const currentCount = Number(lsnap.data()?.count || 0);
        const nextCount = currentCount + payment.participants;
        if (nextCount > maxParticipants) {
          setIsPayingWallet(false);
          return openModal(
            "error",
            "Fully booked",
            "Not enough available slots for this schedule. Please pick a different time or reduce participants."
          );
        }
      }
    } catch (e) {
      console.warn("Preflight capacity check failed:", e);
    }

    // --- Transaction: lock slot(s) + create booking + debit guest + credit host + points ---
    try {
      await runTransaction(database, async (tx) => {
        const hostUid = experience?.uid || experience?.ownerId || experience?.hostId || "";
        if (!hostUid) throw new Error("Experience host not found.");

        const participants = Number(payment.participants || 1);

        // Refs
        // Use guestWallets for guest (catch-all rule allows if uid matches)
        // Use wallets for host (credit-only rule allows any auth user to credit)
        const wrefGuest = doc(database, "guestWallets", user.uid);
        const wrefHost = doc(database, "wallets", hostUid);
        const walletTxGuestRef = doc(collection(database, "guestWallets", user.uid, "transactions"));
        const walletTxHostRef = doc(collection(database, "wallets", hostUid, "transactions"));

        const pointsGuestRef = doc(database, "points", user.uid);
        const pointsHostRef = doc(database, "points", hostUid);
        const ptsLogGuestRef = doc(collection(database, "points", user.uid, "transactions"));
        const ptsLogHostRef = doc(collection(database, "points", hostUid, "transactions"));

        const bookingRef = doc(collection(database, "bookings"));
        const lref = doc(database, "experienceLocks", lockId);

        // ---------- READS ----------
        const wSnapGuest = await tx.get(wrefGuest);
        const pSnapGuest = await tx.get(pointsGuestRef);
        const wSnapHost = await tx.get(wrefHost);
        const pSnapHost = await tx.get(pointsHostRef);
        const lsnap = await tx.get(lref);

        // Read admin wallet balance (if service fee will be credited)
        let adminBal = 0;
        let adminBalAfter = 0;
        if (serviceFee > 0) {
          const wrefAdmin = doc(database, "wallets", ADMIN_WALLET_ID);
          const adminSnap = await tx.get(wrefAdmin);
          adminBal = Number(adminSnap.data()?.balance || 0);
          adminBalAfter = adminBal + serviceFee;
        }

        const currentBal = Number(wSnapGuest.data()?.balance || 0);
        if (currentBal < total) throw new Error("Insufficient wallet balance.");

        const prevCount = Number(lsnap.data()?.count || 0);
        const newCount = prevCount + participants;
        if (maxParticipants > 0 && newCount > maxParticipants) {
          throw new Error("Those slots were just taken. Please choose a different time.");
        }

        const guestPtsBefore = Number(pSnapGuest.data()?.balance || 0);
        const hostPtsBefore = Number(pSnapHost.data()?.balance || 0);
        const guestPtsAfter = guestPtsBefore + BOOKING_REWARD_POINTS;
        const hostPtsAfter = hostPtsBefore + HOST_BOOKING_REWARD_POINTS;

        const hostBalBefore = Number(wSnapHost.data()?.balance || 0);
        const hostBalAfter = hostBalBefore + subtotal;

        const guestBalAfter = currentBal - total;

        // ---------- BOOKING ----------
        const bookingData = {
          uid: user.uid, // satisfies rules
          guestEmail: user.email,
          guestName: user.displayName || "",
          listingId,
          hostId: hostUid,
          listingTitle: title,
          listingCategory: category,
          listingAddress: locationStr,
          listingPhotos: Array.isArray(experience?.photos) ? experience.photos : [],
          experienceType: experience?.experienceType || "in-person",
          duration: experience?.duration || "",
          schedule: { date: selectedSchedule.date, time: rawTime },
          quantity: participants,
          // pricing
          basePrice: Number(payment.basePrice || 0),
          priceBeforeDiscount: Number(payment.rawSubtotal || 0),

          // listing discount
          discountType: payment?.discount?.type || "none",
          discountValue: Number(payment?.discount?.value || 0),
          discountAmount: Number(payment.listingDiscountAmount || 0),

          // === NEW: promo info (auto-applied) ===
          promoRuleType: payment?.promo?.ruleType || null,
          promoValue: Number(payment?.promo?.value || 0),
          promoDiscountAmount: Number(payment?.promoDiscountAmount || 0),
          promoTitle: payment?.promo?.title || null,

          // coupon/promo code info
          couponCode: payment?.discounts?.code?.codeUpper || null,
          couponSource: payment?.discounts?.code?.source || null,
          couponRuleType: payment?.discounts?.code?.ruleType || null,
          couponValue: Number(payment?.discounts?.code?.value || 0),
          couponDiscountAmount: Number(payment?.couponDiscountAmount || 0),

          // reward audit
          reward:
            Number(payment?.rewardDiscount || 0) > 0 && payment?.rewardId
              ? {
                  rewardId: payment.rewardId,
                  rewardName: payment?.rewardLabel || "",
                  discount: Number(payment?.rewardDiscount || 0),
                }
              : null,

          subtotal,
          serviceFee,
          totalPrice: total,
          status: "confirmed",
          paymentStatus: "paid",
          paymentMethod: "wallet",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        tx.set(bookingRef, bookingData);

        // ---------- CAPACITY LOCK (include uid on both create/update to satisfy rules) ----------
        if (!lsnap.exists()) {
          tx.set(lref, {
            uid: user.uid,
            listingId,
            date: selectedSchedule.date,
            time: rawTime,
            count: participants,
            lastBookingId: bookingRef.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          tx.set(
            lref,
            {
              uid: user.uid,
              count: newCount,
              lastBookingId: bookingRef.id,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }

        // ---------- GUEST wallet: debit total ----------
        tx.set(walletTxGuestRef, {
          uid: user.uid,
          type: "booking_payment",
          delta: -total,
          amount: total,
          status: "completed",
          method: "wallet",
          note: `${title} — ${fmtDate(selectedSchedule.date)} ${rawTime}`,
          metadata: {
            bookingId: bookingRef.id,
            listingId,
            schedule: { date: selectedSchedule.date, time: rawTime },
          },
          balanceAfter: guestBalAfter,
          timestamp: serverTimestamp(),
        });
        tx.set(
          wrefGuest,
          { uid: user.uid, balance: guestBalAfter, currency: "PHP", updatedAt: serverTimestamp() },
          { merge: true }
        );

        // ---------- HOST wallet: credit SUBTOTAL (no service fee) ----------
        // Use wallets/{hostUid} with credit-only rule (balance can only increase)
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
          note: `Earnings from ${title} — ${fmtDate(selectedSchedule.date)} ${rawTime}`,
          metadata: { bookingId: bookingRef.id, payerUid: user.uid, listingId },
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
          note: `Reward for booking ${title}`,
          bookingId: bookingRef.id,
          balanceAfter: guestPtsAfter,
          timestamp: serverTimestamp(),
        });

        // Mark reward as used (if reward applied)
        if (Number(payment?.rewardDiscount || 0) > 0 && payment?.rewardId) {
          const rewardRef = doc(database, "users", user.uid, "redeemedRewards", payment.rewardId);
          tx.update(rewardRef, {
            used: true,
            usedAt: serverTimestamp(),
            bookingId: bookingRef.id,
          });
        }

        // ---------- HOST points (+100) ----------
        tx.set(
          pointsHostRef,
          // set uid to writer to satisfy rules; keep ownerUid to track intended owner
          { uid: user.uid, ownerUid: hostUid, balance: hostPtsAfter, updatedAt: serverTimestamp() },
          { merge: true }
        );
        tx.set(ptsLogHostRef, {
          uid: user.uid, // writer
          type: "host_booking_reward",
          delta: HOST_BOOKING_REWARD_POINTS,
          amount: HOST_BOOKING_REWARD_POINTS,
          status: "completed",
          note: `Reward for hosting a booking on ${title}`,
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
            note: `Service fee from ${title} — ${fmtDate(selectedSchedule.date)} ${rawTime}`,
            metadata: { bookingId: bookingRef.id, listingId, hostUid, payerUid: user.uid },
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

      // Email confirmation (best-effort)
      try {
        await sendBookingEmail({
          user: auth.currentUser,
          title,
          category,
          location: locationStr,
          total: payment.total,
          paymentStatus: "Paid",
          currencySymbol,
          brandSiteUrl: typeof window !== "undefined" ? window.location.origin : "",
        });
      } catch (e) {
        console.error("Email send failed:", e);
      }

      setIsPayingWallet(false);
      setShowPayPal(false);
      
      // Clear selected reward from localStorage after successful booking
      if (Number(payment?.rewardDiscount || 0) > 0 && payment?.rewardId) {
        localStorage.removeItem("selectedReward");
        setSelectedReward(null);
      }

      // Show points notification modal
      setPointsModal({
        open: true,
        points: BOOKING_REWARD_POINTS,
        reason: `Reward for booking ${title || "this experience"}!`
      });
      
      openModal(
        "success",
        "Booking confirmed",
        `Paid with E-Wallet.\n• Host received: ${currencySymbol}${Number(payment.subtotal || 0).toLocaleString(
          undefined,
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        )}\n\nA confirmation email will follow shortly.`
      );
    } catch (e) {
      console.error(e);
      setIsPayingWallet(false);
      openModal("error", "Payment failed", e?.message || "We couldn’t complete your wallet payment.");
    }
  };

  /* ==================== Reviews subscription ==================== */
  useEffect(() => {
    if (!listingId) return;

    const qRef = query(
      collection(database, "reviews"),
      where("listingId", "==", listingId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(qRef, async (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Collect user IDs from reviews
      const uids = Array.from(
        new Set(
          rows
            .map((r) => r.uid || r.userId || r.authorUid || r.user?.uid)
            .filter(Boolean)
        )
      );

      const normalizeUser = (uid, d = {}) => {
        const first = d.firstName || d.givenName || d.first_name || "";
        const last = d.lastName || d.familyName || d.last_name || "";
        const displayName =
          d.displayName ||
          d.name ||
          [first, last].filter(Boolean).join(" ") ||
          d.email?.split("@")[0] ||
          "Guest";
        const photoURL =
          d.photoURL ||
          d.photoUrl ||
          d.avatarURL ||
          d.photo ||
          d.avatar ||
          d.profileImageUrl ||
          null;
        return { uid, displayName, photoURL, email: d.email || "" };
      };

      const userMap = {};
      await Promise.all(
        uids.map(async (uid) => {
          try {
            const uDoc = await getDoc(doc(database, "users", uid));
            if (uDoc.exists()) {
              userMap[uid] = normalizeUser(uid, uDoc.data() || {});
              return;
            }
          } catch {}
          try {
            const hDoc = await getDoc(doc(database, "hosts", uid));
            if (hDoc.exists()) {
              userMap[uid] = normalizeUser(uid, hDoc.data() || {});
              return;
            }
          } catch {}
          userMap[uid] = normalizeUser(uid, {});
        })
      );

      const enriched = rows.map((r) => {
        const rating = Number(r.rating ?? r.stars ?? r.score ?? 0) || 0;
        const created =
          typeof r.createdAt?.toDate === "function"
            ? r.createdAt.toDate()
            : r.createdAt instanceof Date
            ? r.createdAt
            : typeof r.createdAt === "string"
            ? new Date(r.createdAt)
            : null;

        const uid = r.uid || r.userId || r.authorUid || r.user?.uid || null;
        return {
          ...r,
          rating,
          createdAtDate: created,
          user: uid ? userMap[uid] : null,
        };
      });

      const ratings = enriched
        .map((r) => r.rating)
        .filter((n) => Number.isFinite(n) && n > 0);
      const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

      setReviewStats({ avg, count: ratings.length });
      setReviews(enriched);
    });

    return () => unsub();
  }, [listingId]);

  if (!experience) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient.to-br from-blue-50/35 via-white/55 to-indigo-50/35">
        <div className="text-center p-8 rounded-3xl bg-white/80 border border-slate-200 shadow">
          <p className="text-slate-700">Loading experience…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/35 via-white/55 to-indigo-50/35">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center gap-3">
          {auth.currentUser && (
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          )}

          <h1 className="text.base sm:text-lg font-semibold text-slate-900 truncate">
            {experience?.title || "Untitled"}
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
        <div 
          className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-sm cursor-pointer"
          onClick={() => hasPhotos && setIsFullScreenOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && hasPhotos) {
              e.preventDefault();
              setIsFullScreenOpen(true);
            }
          }}
        >
          <div className="aspect-[16/9] sm:aspect-[21/9] bg-slate-200">
            {hasPhotos ? (
              <img
                src={photos[currentPhoto]}
                alt={`${experience?.title || "Experience"} photo ${currentPhoto + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-slate-600">No photos available</div>
            )}

            {/* Optional discount badge */}
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
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg.white px-4 py-2 text-sm sm:text-base font-semibold text-slate-900 shadow-sm">
            <MapPin className="w-5 h-5 text-blue-600" />
            {locationStr}
          </span>

          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-blue-700 shadow-sm">
            <Tag className="w-5 h-5" />
            {currencySymbol}
            {price.toLocaleString()}/person
          </span>

          {/* Rating summary pill (shown only if there are reviews) */}
          <div className="flex items-center gap-3 mb-3 ml-auto">
              <div className="flex items-center">
                <Stars value={reviewStats.avg} size={18} />
              </div>
              <p className="text-sm text-slate-800">
                <span className="font-semibold">
                  {reviewStats.avg ? reviewStats.avg.toFixed(1) : "—"}
                </span>
                <span className="mx-1">/ 5</span>
                <span className="text-slate-500">
                  ({reviewStats.count} review{reviewStats.count === 1 ? "" : "s"})
                </span>
              </p>
            </div>
        </div>
      </section>


      {/* ===== Main grid ===== */}
      <main className="max-w-[1200px] mx-auto px-4 mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-24">
        {/* LEFT: Details */}
        <div className="lg:col-span-7 space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 sm:mb-3">{title}</h2>

          {/* Description */}
          <GlassCard className="p-5 sm:p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">About this experience</h2>
            {experience.description ? (
              <p className="text-[15px] sm:text-base leading-relaxed text-slate-800">
                {experience.description}
              </p>
            ) : (
              <p className="text-[15px] sm:text-base text-slate-600">No description provided.</p>
            )}
          </GlassCard>

          {/* Facts */}
          <GlassCard className="p-5 sm:p-6">
            <h3 className="text.sm font-semibold text-slate-900 tracking-wide mb-3">Quick facts</h3>
            <div className="grid grid-cols-2 gap-3">
              <IconStat Icon={Clock} label="Duration" value={duration} />
              <IconStat Icon={Users} label="Max Participants" value={maxParticipants || "—"} />
              <IconStat
                Icon={Languages}
                label="Languages"
                value={languages?.length ? languages.join(", ") : "—"}
              />
              <IconStat Icon={Tag} label="Type" value={exType} />
            </div>
          </GlassCard>

          {/* Amenities */}
          {hasAmenities && (
            <GlassCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-slate-900 tracking-wide">Included Amenities</h3>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {amenities.map((a, i) => (
                  <span
                    key={`${a}-${i}`}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] sm:text-xs font-medium text-slate-900 shadow-sm"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Location Map */}
          {locationStr && locationStr !== "—" && experience?.experienceType !== "online" && (
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
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(locationStr)}&output=embed`}
                  title="Location Map"
                  className="w-full h-[300px] sm:h-[400px]"
                />
              </div>
            </GlassCard>
          )}

          {/* Requirements */}
          {!!experience?.hostRequirements && (
            <GlassCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-slate-900 tracking-wide mb-1">Requirements</h3>
              <p className="text-[15px] sm:text-base text-slate-800">{experience.hostRequirements}</p>
            </GlassCard>
          )}

          {/* Age restriction */}
          {experience?.ageRestriction &&
            (typeof experience.ageRestriction.min !== "undefined" ||
              typeof experience.ageRestriction.max !== "undefined") && (
              <GlassCard className="p-5 sm:p-6">
                <h3 className="text-sm font-semibold text-slate-900 tracking-wide mb-1">Age Requirements</h3>
                <p className="text-[15px] sm:text-base text-slate-800">
                  {typeof experience.ageRestriction.min !== "undefined"
                    ? experience.ageRestriction.min
                    : 0}{" "}
                  –{" "}
                  {typeof experience.ageRestriction.max !== "undefined"
                    ? experience.ageRestriction.max
                    : 100}{" "}
                  years old
                </p>
              </GlassCard>
            )}

          {/* Cancellation Policy */}
          {!!experience?.cancellationPolicy && (
            <GlassCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-slate-900 tracking-wide mb-1">Cancellation Policy</h3>
              <p className="text-[14px] sm:text-[15px] text-slate-800">{experience.cancellationPolicy}</p>
            </GlassCard>
          )}

          {/* Host */}
          {host && (
            <GlassCard className="p-4 sm:p-5 flex items-center gap-4">
              <HostAvatar host={host} />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] sm:text-base font-semibold text-slate-900 truncate">
                  {([host.firstName, host.lastName].filter(Boolean).join(" ")) ||
                    host.displayName ||
                    host.email ||
                    "Host"}
                </p>
                <p className="text-[13px] sm:text-sm text-slate-600 truncate">Host of this experience</p>
              </div>
              <button
                onClick={() => setShowMessageModal(true)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[13px] sm:text-sm font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 shadow-sm active:scale-[0.98] transition"
              >
                <MessageSquareText className="w-5 h-5" /> Message Host
              </button>
            </GlassCard>
          )}

          {/* Ratings & Reviews */}
          <GlassCard className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center">
                  <Stars value={reviewStats.avg} size={18} />
                </div>
                <p className="text-sm text-slate-800">
                  <span className="font-semibold">
                    {reviewStats.avg ? reviewStats.avg.toFixed(1) : "—"}
                  </span>
                  <span className="mx-1">/ 5</span>
                  <span className="text-slate-500">
                    ({reviewStats.count} review{reviewStats.count === 1 ? "" : "s"})
                  </span>
                </p>
              </div>
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

            {reviews.length === 0 ? (
              <p className="text-sm text-slate-600">No reviews yet.</p>
            ) : (
              <div
                ref={reviewsScrollRef}
                className="flex gap-4 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden scrollbar-hide"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {reviews.map((r) => (
                  <div
                    key={r.id}
                    className="flex-shrink-0 w-[320px] sm:w-[360px] flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <UserAvatar user={r.user} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {r.user?.displayName || "Guest"}
                          </p>
                          <span className="inline-flex items-center gap-1 text-[12px] text-slate-600">
                            <Stars value={r.rating} size={14} />
                            <span className="font-medium">
                              {Number(r.rating || 0).toFixed(1)}
                            </span>
                          </span>
                          {r.createdAtDate && (
                            <span className="text-[12px] text-slate-500">
                              •{" "}
                              {r.createdAtDate.toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {String(r.comment || r.text || r.content || "").trim() && (
                      <p className="text-[13.5px] text-slate-800 whitespace-pre-wrap line-clamp-4">
                        {r.comment || r.text || r.content}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        {/* RIGHT: Booking sidebar (schedule + participants + payment) */}
        <div className="lg:col-span-5">
          <aside className="lg:sticky lg:top-20">
            <div className="rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5 overflow-hidden">
              {/* Price (per person) */}
              <div className="px-5 pt-5">
                <div className="flex items-end justify-between">
                  <div className="text-xl font-semibold text-slate-900">
                    {currencySymbol}
                    {price.toLocaleString()}
                    <span className="text-sm font-medium text-slate-500"> / person</span>
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

              {/* Schedule selector */}
              <div className="px-5 py-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Select Schedule</h4>
                {hasSchedule ? (
                  <div className="grid gap-2">
                    {schedule.map((s, idx) => {
                      const t = s?.time || s?.startTime || "";
                      const isSelected =
                        selectedSchedule?.date === s.date &&
                        (selectedSchedule?.time || selectedSchedule?.startTime || "") === t;
                      
                      // Calculate capacity
                      const timeKey = String(t).replace(/:/g, "");
                      const capacityKey = `${s.date}_${timeKey}`;
                      const bookedCount = scheduleCapacity[capacityKey] || 0;
                      const availableSlots = maxParticipants > 0 ? maxParticipants - bookedCount : Infinity;
                      const isFull = maxParticipants > 0 && availableSlots <= 0;
                      
                      return (
                        <button
                          key={`${s.date}-${t}-${idx}`}
                          type="button"
                          onClick={() => !isFull && setSelectedSchedule(s)}
                          disabled={isFull}
                          className={`flex w-full items-start justify-between rounded-2xl border p-3 text-left transition ${
                            isFull
                              ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed"
                              : isSelected
                              ? "border-2 border-blue-500 bg-blue-50"
                              : "border-slate-200 bg-white hover:border-blue-300"
                          }`}
                        >
                          <div className="flex-1">
                            <p className={`font-semibold ${isFull ? "text-slate-500" : "text-slate-900"}`}>
                              {fmtDate(s.date)}
                            </p>
                            <p className={`text-sm ${isFull ? "text-slate-400" : "text-slate-600"}`}>
                              {fmtTime(t)}
                            </p>
                            {maxParticipants > 0 && (
                              <p className={`text-xs mt-1 ${isFull ? "text-rose-600 font-semibold" : "text-slate-500"}`}>
                                {isFull ? "Fully booked" : `${availableSlots} slot${availableSlots !== 1 ? "s" : ""} available`}
                              </p>
                            )}
                          </div>
                          {isSelected && !isFull && (
                            <span className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                          )}
                          {isFull && (
                            <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold">
                              Full
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">No schedules available.</p>
                )}
              </div>

              {/* Participants */}
              <div className="px-5 pb-2">
                <div className="rounded-2xl bg-white/90 backdrop-blur border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <p className="text-[13.5px] sm:text-sm font-semibold text-slate-900">Participants</p>
                    {!!maxParticipants && (
                      <span className="ml-auto text-[12px] sm:text-xs text-slate-600">
                        Max: {maxParticipants}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedParticipants((v) => Math.max(1, v - 1))}
                      disabled={selectedParticipants <= 1}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 shadow disabled:opacity-50 disabled:pointer-events-none"
                      aria-label="Decrease participants"
                    >
                      –
                    </button>
                    <span className="w-10 text-center font-semibold text-slate-900" aria-live="polite">
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
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text.white hover:from-blue-600 hover:to-blue-700 shadow disabled:opacity-50 disabled:pointer-events-none"
                      aria-label="Increase participants"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Promo / Coupon apply */}
              <div className="px-5 pb-2">
                <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Ticket className="w-5 h-5 text-blue-600" />
                    <p className="text-sm font-semibold text-slate-900">Promo / Coupon</p>
                  </div>

                  {/* Auto-applied promo info preview (if any) */}
                  {bestPromo ? (
                    <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      <span className="font-semibold">Promotion:</span>{" "}
                      {bestPromo.title || (bestPromo.ruleType === "percentage"
                        ? `${numberOr(bestPromo.value)}% off`
                        : `₱${numberOr(bestPromo.value).toLocaleString()} off`)}
                      {bestPromo.minSpend
                        ? ` • min ${currencySymbol}${bestPromo.minSpend.toLocaleString()}`
                        : ""}
                    </div>
                  ) : null}

                  {/* Coupon input */}
                  {appliedCode ? (
                    <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                      <div className="text-sm">
                        <span className="font-semibold text-blue-700">{appliedCode.codeUpper}</span>
                        <span className="ml-2 text-slate-700">
                          {appliedCode.ruleType === "percentage"
                            ? `${numberOr(appliedCode.value)}%`
                            : `${currencySymbol}${numberOr(appliedCode.value).toLocaleString()}`}
                          {appliedCode.minSpend
                            ? ` • min ${currencySymbol}${appliedCode.minSpend.toLocaleString()}`
                            : ""}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={clearAppliedCode}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-[12px] font-semibold text-slate-800 hover:bg-slate-50"
                        title="Remove code"
                      >
                        <X className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/50"
                          placeholder="Enter code"
                          value={codeInput}
                          onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                          style={{ textTransform: 'uppercase' }}
                        />
                        <button
                          type="button"
                          disabled={!codeInput.trim() || codeStatus.checking}
                          onClick={tryApplyPromoOrCoupon}
                          className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {codeStatus.checking ? "Checking…" : "Apply"}
                        </button>
                      </div>
                      {codeStatus.error && (
                        <p className="mt-2 text-xs text-rose-600">{codeStatus.error}</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Payment breakdown */}
              {payment && (
                <div className="px-5 pb-4">
                  <section
                    className="rounded-3xl bg-white/90 backdrop-blur border border-slate-200 p-4 sm:p-5 shadow-lg space-y-2"
                    aria-live="polite"
                  >
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
                      Payment Breakdown
                    </h3>
                    <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                      <span>
                        <span className="font-semibold">
                          {currencySymbol}
                          {price.toLocaleString()}
                        </span>{" "}
                        × {payment.participants} {payment.participants === 1 ? "person" : "people"}
                      </span>
                      <span className="font-medium">
                        {currencySymbol}
                        {payment.rawSubtotal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    {payment.listingDiscountAmount > 0 && (
                      <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                        <span className="inline-flex items-center gap-2">
                          <BadgePercent className="w-4 h-4 text-blue-600" />
                          Listing discount{" "}
                          {payment?.discount?.type === "percentage"
                            ? `(${numberOr(payment?.discount?.value)}% off)`
                            : `(${currencySymbol}${numberOr(payment?.discount?.value).toLocaleString()} off)`}
                        </span>
                        <span className="font-medium">
                          - {currencySymbol}
                          {payment.listingDiscountAmount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    )}

                    {/* NEW: Promotion line */}
                    {payment.promoDiscountAmount > 0 && (
                      <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                        <span className="inline-flex items-center gap-2">
                          <BadgePercent className="w-4 h-4 text-blue-600" />
                          Promotion {payment?.promo?.title ? `(${payment.promo.title})` : ""}
                        </span>
                        <span className="font-medium">
                          - {currencySymbol}
                          {payment.promoDiscountAmount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    )}

                    {payment.couponDiscountAmount > 0 && (
                      <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                        <span className="inline-flex items-center gap-2">
                          <BadgePercent className="w-4 h-4 text-blue-600" />
                          Promo/Coupon{" "}
                          {payment?.discounts?.code?.codeUpper
                            ? `(${payment.discounts.code.codeUpper})`
                            : ""}
                        </span>
                        <span className="font-medium">
                          - {currencySymbol}
                          {payment.couponDiscountAmount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    )}

                    {/* Reward line */}
                    {Number(payment?.rewardDiscount || 0) > 0 && (
                      <div className="flex items-center justify-between text-[13.5px] sm:text-sm text-emerald-700">
                        <span>
                          Reward{payment.rewardLabel ? ` — ${payment.rewardLabel}` : ""}
                        </span>
                        <span>
                          − {currencySymbol}
                          {Number(payment.rewardDiscount).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                      <span>Subtotal</span>
                      <span className="font-medium">
                        {currencySymbol}
                        {payment.subtotal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                      <span>Service fee ({Math.round(serviceFeeRate * 100)}%)</span>
                      <span>
                        {currencySymbol}
                        {payment.serviceFee.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="my-2 h-px bg-slate-200" />
                    <div className="flex items-center justify-between">
                      <span className="text-base sm:text-lg font-bold text-slate-900">Total</span>
                      <span className="text-base sm:text-lg font-bold text-blue-700">
                        {currencySymbol}
                        {payment.total.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </section>
                </div>
              )}

              {/* Book Now / Checkout (desktop) */}
              <div className="px-5 pb-6 hidden lg:block">
                {showPayPal ? (
                  <PayPalCheckout
                    payment={payment}
                    selectedSchedule={selectedSchedule}
                    listingId={listingId}
                    title={title}
                    category={category}
                    locationStr={locationStr}
                    photos={photos}
                    currencySymbol={currencySymbol}
                    setShowPayPal={setShowPayPal}
                    onClose={onClose}
                    maxParticipants={maxParticipants}
                    wallet={wallet}
                    payWithWallet={payWithWallet}
                    isPayingWallet={isPayingWallet}
                    onPointsAwarded={(points, reason) => setPointsModal({ open: true, points, reason })}
                    openModal={openModal}
                    setSelectedReward={setSelectedReward}
                  />
                ) : (
                  (() => {
                    const currentUser = auth.currentUser;
                    const hostUid = experience?.uid || experience?.ownerId || experience?.hostId;
                    const isHost = currentUser && hostUid && currentUser.uid === hostUid;
                    return (
                  <button
                    type="button"
                        disabled={!payment || !selectedSchedule || isHost}
                        aria-disabled={!payment || !selectedSchedule || isHost}
                    onClick={handleBookNow}
                    className="w-full inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 active:scale-[0.99] transition disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    Book Now
                  </button>
                    );
                  })()
                )}
              </div>
            </div>
          </aside>
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
              hostId={host?.uid || experience?.uid || experience?.ownerId || experience?.hostId}
            />
          </div>,
          document.body
        )}

      {/* Footer booking actions (mobile) */}
      <div
        className="w-full bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-t border-slate-200 px-4 pt-4 pb-6 lg:hidden"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row gap-3">
          {showPayPal ? (
            <PayPalCheckout
              payment={payment}
              selectedSchedule={selectedSchedule}
              listingId={listingId}
              title={title}
              category={category}
              locationStr={locationStr}
              photos={photos}
              currencySymbol={currencySymbol}
              setShowPayPal={setShowPayPal}
              onClose={onClose}
              maxParticipants={maxParticipants}
              wallet={wallet}
              payWithWallet={payWithWallet}
              isPayingWallet={isPayingWallet}
              onPointsAwarded={(points, reason) => setPointsModal({ open: true, points, reason })}
              openModal={openModal}
              setSelectedReward={setSelectedReward}
            />
          ) : (
            <>
              {(() => {
                const currentUser = auth.currentUser;
                const hostUid = experience?.uid || experience?.ownerId || experience?.hostId;
                const isHost = currentUser && hostUid && currentUser.uid === hostUid;
                return (
              <button
                type="button"
                    disabled={!payment || !selectedSchedule || isHost}
                    aria-disabled={!payment || !selectedSchedule || isHost}
                onClick={handleBookNow}
                    className="w-full sm:w-auto flex-1 min-w-[140px] inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 active:scale-[0.99] transition disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                Book Now
              </button>
                );
              })()}
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto flex-1 min-w-[140px] inline-flex items.center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>

      {host && (
        <HostSectionForGuest
          host={host}
          listing={experience}
          reviews={reviews}
          avgRating={reviewStats.avg}
        />
      )}

      {/* Global overlays for E-Wallet flow */}
      {isPayingWallet && <FullScreenLoader text="Processing E-Wallet payment…" />}
      {/* Points Notification Modal */}
      <PointsNotificationModal
        open={pointsModal.open}
        onClose={() => setPointsModal({ open: false, points: 0, reason: "" })}
        points={pointsModal.points}
        reason={pointsModal.reason}
        title="Points Earned!"
      />

      {/* Full-Screen Image Viewer Modal */}
      {isFullScreenOpen && hasPhotos && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setIsFullScreenOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Full-screen image viewer"
        >
          {/* Close button */}
          <button
            onClick={() => setIsFullScreenOpen(false)}
            className="absolute top-4 right-4 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Close image viewer"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Image container */}
          <div
            className="relative w-full h-full flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photos[fullScreenPhoto]}
              alt={`Photo ${fullScreenPhoto + 1} of ${photos.length}`}
              className="max-w-full max-h-full object-contain"
            />

            {/* Navigation buttons */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    prevFullScreenPhoto();
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="w-7 h-7" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    nextFullScreenPhoto();
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  aria-label="Next photo"
                >
                  <ChevronRight className="w-7 h-7" />
                </button>

                {/* Photo counter */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm font-medium">
                  {fullScreenPhoto + 1} / {photos.length}
                </div>

                {/* Dots indicator */}
                <div
                  className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2"
                  role="tablist"
                  aria-label="Gallery slides"
                >
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFullScreenPhoto(i);
                      }}
                      role="tab"
                      aria-label={`Go to photo ${i + 1}`}
                      aria-selected={i === fullScreenPhoto}
                      className={`h-2.5 w-2.5 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
                        i === fullScreenPhoto
                          ? "bg-white w-8"
                          : "bg-white/50 hover:bg-white/70"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      <ResultModal
        open={modal.open}
        kind={modal.kind}
        title={modal.title}
        message={modal.message}
        onClose={closeModal}
        preventClose={pointsModal.open}
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

/* ============================ Helpers: Reviews UI ============================ */

function UserAvatar({ user }) {
  const [ok, setOk] = useState(true);
  const initial = (user?.displayName?.[0] || user?.email?.[0] || "U").toUpperCase();
  const src = user?.photoURL || null;
  return (
    <div className="relative w-10 h-10 rounded-full bg-white/80 border border-slate-200 overflow-hidden shrink-0 grid place-items-center text-slate-900 font-semibold ring-2 ring-slate-200">
      {src && ok ? (
        <img
          src={src}
          alt="User avatar"
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

function Stars({ value = 0, size = 16 }) {
  const clamped = Math.max(0, Math.min(5, Number(value) || 0));
  const full = Math.floor(clamped);
  const frac = Math.max(0, Math.min(1, clamped - full));
  const items = Array.from({ length: 5 }, (_, i) => i);
  return (
    <div className="inline-flex items-center gap-0.5 align-middle" aria-label={`${clamped} out of 5 stars`}>
      {items.map((i) => {
        const filled = i < full;
        const partial = i === full && frac > 0 && full < 5;
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star
              className={filled ? "text-amber-500" : "text-slate-300"}
              style={{ width: size, height: size }}
              fill={filled ? "currentColor" : "none"}
              strokeWidth={2}
            />
            {partial && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${frac * 100}%` }}
                aria-hidden
              >
                <Star
                  className="text-amber-500"
                  style={{ width: size, height: size }}
                  fill="currentColor"
                  strokeWidth={2}
                />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
