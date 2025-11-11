// src/pages/ServiceDetailsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { PayPalButtons } from "@paypal/react-paypal-js";
import { auth, database } from "../../config/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  runTransaction,
} from "firebase/firestore";
import emailjs from "@emailjs/browser";
import {
  ChevronLeft, ChevronRight, Plus, Minus, Clock, Users, Languages, MapPin, Building2,  MessageSquareText, Loader2, CheckCircle2, AlertCircle, Percent, Star, Briefcase, GraduationCap, Home, CalendarDays, ShieldCheck
} from "lucide-react";
import { MessageHostModal } from "../../components/message-host-modal";

/* =============== Rewards =============== */
const BOOKING_REWARD_POINTS = 80; // guest reward
const HOST_BOOKING_REWARD_POINTS = 100; // provider/host reward per booking (wallet flow)

/* ================= EmailJS config & helper ================= */
// const EMAILJS_SERVICE_ID = "service_xxx";
// const EMAILJS_TEMPLATE_ID = "template_xxx";
// const EMAILJS_PUBLIC_KEY = "public_xxx";
const EMAILJS_SERVICE_ID = "";
const EMAILJS_TEMPLATE_ID = "";
const EMAILJS_PUBLIC_KEY = "";
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
    listing_category: String(category || "Services"),
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

/* ===================== helpers ===================== */
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

/* ==== Discount helpers ==== */
function sanitizeDiscount(typeRaw, valueRaw) {
  const type = String(typeRaw || "").toLowerCase();
  const value = Number(valueRaw || 0);
  if (type === "percentage") {
    if (value > 0 && value <= 100) return { type: "percentage", value };
    return { type: "", value: 0 };
  }
  if (type === "fixed") {
    if (value > 0) return { type: "fixed", value };
    return { type: "", value: 0 };
  }
  return { type: "", value: 0 };
}

function computePayment({ price, quantity, discountType, discountValue }) {
  const base = Math.max(0, Number(price || 0));
  const qty = Math.max(1, Number(quantity || 1));
  const { type, value } = sanitizeDiscount(discountType, discountValue);

  const unitDiscount =
    type === "percentage" ? (base * value) / 100 : type === "fixed" ? Math.min(value, base) : 0;
  const unitAfter = Math.max(0, base - unitDiscount);

  const subtotal = unitAfter * qty; // provider receives this
  const tax = subtotal * 0.12; // 12% platform fee
  const total = subtotal + tax; // guest pays this

  return {
    quantity: qty,
    basePrice: base,
    unitDiscount,
    unitPriceAfter: unitAfter,
    discountTotal: unitDiscount * qty,
    subtotal,
    tax,
    total,
    hasDiscount: unitDiscount > 0,
    discountType: type,
    discountValue: value,
  };
}

/* ================= Coupons (normalize / check / apply) ================= */
function normalizeCoupon(d = {}, id = null) {
  const type = String(d.type || d.discountType || "").toLowerCase();
  return {
    id: id || d.id || null,
    code: String(d.code || d.offerCode || "").trim(),
    type: type === "percentage" ? "percentage" : type === "fixed" ? "fixed" : "",
    value: Number(d.value ?? d.discountValue ?? 0),
    active: !!(d.active ?? d.isActive ?? true),
    startDate: d.startDate || d.validFrom || null, // "YYYY-MM-DD"
    endDate: d.endDate || d.validTo || null, // "YYYY-MM-DD"
    minQuantity: Number(d.minQuantity || 0),
    minSubtotal: Number(d.minSubtotal || 0),
    scopeListingId: d.listingId || d.scopeListingId || null,
    appliesPerUnit: !!d.appliesPerUnit,
    maxDiscount: Number(d.maxDiscount || 0) || null,
    label: d.label || d.name || null,
  };
}
function dateInRange(ymd, startYmd, endYmd) {
  if (!ymd) return true;
  if (startYmd && ymd < startYmd) return false;
  if (endYmd && ymd > endYmd) return false;
  return true;
}
function isCouponEligible(c, { listingId, scheduleDate, quantity, subtotalAfterListing }) {
  if (!c?.active) return { ok: false, reason: "Coupon is not active." };
  if (!c.type || !(c.value > 0)) return { ok: false, reason: "Invalid coupon." };
  if (!dateInRange(scheduleDate || null, c.startDate || null, c.endDate || null)) {
    return { ok: false, reason: "Coupon not valid for selected date." };
  }
  if (c.scopeListingId && c.scopeListingId !== String(listingId || "")) {
    return { ok: false, reason: "Coupon not valid for this service." };
  }
  if (c.minQuantity > 0 && Number(quantity || 0) < c.minQuantity) {
    return { ok: false, reason: `Minimum of ${c.minQuantity} participant(s) required.` };
  }
  if (c.minSubtotal > 0 && Number(subtotalAfterListing || 0) < c.minSubtotal) {
    return { ok: false, reason: `Subtotal must be at least ${c.minSubtotal}.` };
  }
  return { ok: true, reason: "" };
}
function describeOffer(c) {
  if (!c) return "";
  if (c.type === "percentage") return `${c.value}% OFF`;
  if (c.type === "fixed") return `₱${Number(c.value).toLocaleString()} OFF`;
  return "";
}
function applyCouponToPayment(basePay, coupon, quantity) {
  if (!basePay || !coupon?.type || !(coupon.value > 0)) {
    return {
      ...basePay,
      couponDiscount: 0,
      couponLabel: "",
      couponId: null,
      offerCode: null,
    };
  }
  const subtotal = Number(basePay.subtotal || 0);
  let couponDiscount = 0;

  if (coupon.type === "percentage") {
    couponDiscount = (subtotal * Number(coupon.value)) / 100;
  } else if (coupon.type === "fixed") {
    if (coupon.appliesPerUnit) {
      couponDiscount = Number(coupon.value) * Math.max(1, Number(quantity || 1));
    } else {
      couponDiscount = Number(coupon.value);
    }
  }

  if (coupon.maxDiscount && coupon.maxDiscount > 0) {
    couponDiscount = Math.min(couponDiscount, Number(coupon.maxDiscount));
  }

  couponDiscount = Math.max(0, Math.min(subtotal, couponDiscount));
  const subtotalAfterCoupon = subtotal - couponDiscount;
  const tax = subtotalAfterCoupon * 0.12;
  const total = subtotalAfterCoupon + tax;

  return {
    ...basePay,
    subtotal: subtotalAfterCoupon,
    tax,
    total,
    couponDiscount,
    couponLabel: describeOffer(coupon),
    couponId: coupon?.id || null,
    offerCode: coupon?.code || null,
  };
}

/* ===================== PROMOS (auto-apply) ===================== */
function isYmdInRange(ymd, start, end) {
  if (!ymd) return true;
  if (start && ymd < start) return false;
  if (end && ymd > end) return false;
  return true;
}
function normalizePromo(d = {}, id = null) {
  return {
    id: id || d.id || null,
    status: String(d.status || "inactive").toLowerCase(), // "active"
    appliesTo: String(d.appliesTo || "all").toLowerCase(), // "all" | "listings"
    listingIds: Array.isArray(d.listingIds) ? d.listingIds.map(String) : [],
    startsAt: d.startsAt || null, // "YYYY-MM-DD"
    endsAt: d.endsAt || null, // "YYYY-MM-DD"
    type: String(d.discountType || "").toLowerCase(), // "percentage" | "fixed"
    value: Number(d.discountValue || 0),
    minSubtotal: Number(d.minSubtotal || 0),
    title: d.title || "",
    description: d.description || "",
  };
}

/* Host normalize helpers */
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

async function mergeHostPhoto(uid, current) {
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

  // Load host profile
  React.useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      if (!hostUid) {
        setProfile({});
        return;
      }
      try {
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

  // Compute stats
  React.useEffect(() => {
    let cancelled = false;
    async function compute() {
      if (!hostUid) {
        setStats((s) => ({ ...s, listingsCount: 1, avgRating: Number(avgRating) || 0, totalReviews: reviews?.length || 0 }));
        return;
      }
      try {
        const q1 = query(collection(database, "listings"), where("hostId", "==", hostUid));
        const q2 = query(collection(database, "listings"), where("uid", "==", hostUid));
        const q3 = query(collection(database, "listings"), where("ownerId", "==", hostUid));

        const [s1, s2, s3] = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);
        const map = new Map();
        for (const s of [s1, s2, s3]) s.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
        const allListings = Array.from(map.values());
        const listingsCount = allListings.length || 1;

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
              // ignore
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
  const age = profile?.age ?? (function calcAge(birth) {
    const d = (typeof birth?.toDate === "function" ? birth.toDate() : birth ? new Date(birth) : null);
    if (!d || isNaN(d)) return null;
    const now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
    return a;
  })(profile?.birthdate || profile?.birthDate);

  const languages = Array.isArray(profile?.languages)
    ? profile.languages
    : typeof profile?.languages === "string"
    ? profile.languages.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const shownLangs = languages.length ? languages : [];

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
            <p className="mt-2 text-[14px] leading-relaxed text-slate-800 whitespace-pre-wrap">{profile?.about || profile?.bio || "—"}</p>
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

/* Simple host avatar */
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

/* Small UI helper */
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

/* ============================ Overlays & Modals (wallet flow) ============================ */
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
  const Icon = kind === "success" ? CheckCircle2 : kind === "error" ? AlertCircle : null;
  const tone =
    kind === "success" ? "text-emerald-600" : kind === "error" ? "text-rose-600" : "text-blue-600";

  return createPortal(
    <div className="fixed inset-0 z-[2147483646] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
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

/* ============================ PayPal + E-Wallet Checkout (Service) ============================ */
function ServiceCheckout({
  payment, // includes promo audit fields now
  selectedSchedule, // { date, time? startTime? }
  service,
  listingId,
  currencySymbol,
  setShowPayPal,
  onClose,

  // capacity
  maxParticipants,

  // wallet additions
  wallet,
  payWithWallet,
  isPayingWallet,
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
              const storedPaymentStatus = completed ? "paid" : "pending";
              const emailPaymentStatus = completed ? "Paid" : "Pending";

              const targetId = service?.id || listingId || null;
              const rawTime = selectedSchedule.time || selectedSchedule.startTime || "";
              const timeKey = String(rawTime).replace(/:/g, "");
              const lockId = `${targetId}_${selectedSchedule.date}_${timeKey}`;
              const participants = Number(payment.quantity || 1);

              // Preflight capacity check
              try {
                if (maxParticipants > 0) {
                  const lref = doc(database, "serviceLocks", lockId);
                  const lsnap = await getDoc(lref);
                  const currentCount = Number(lsnap.data()?.count || 0);
                  const nextCount = currentCount + participants;
                  if (nextCount > maxParticipants) {
                    alert(
                      "Not enough available slots for this schedule. Please pick a different time or reduce participants."
                    );
                    return;
                  }
                }
              } catch {
                // ignore
              }

              await runTransaction(database, async (tx) => {
                const bookingRef = doc(collection(database, "bookings"));
                const pointsRef = doc(database, "points", user.uid);
                const ptsLogRef = doc(collection(database, "points", user.uid, "transactions"));
                const lref = doc(database, "serviceLocks", lockId);

                // READS
                const pSnap = await tx.get(pointsRef);
                const lsnap = await tx.get(lref);

                const prevCount = Number(lsnap.data()?.count || 0);
                const newCount = prevCount + participants;
                if (maxParticipants > 0 && newCount > maxParticipants) {
                  throw new Error("Those slots were just taken. Please choose a different time.");
                }

                const curPts = Number(pSnap.data()?.balance || 0);
                const nextPts = completed ? curPts + BOOKING_REWARD_POINTS : curPts;

                const bookingData = {
                  uid: user.uid,
                  guestEmail: user.email,
                  guestName: user.displayName || "",

                  quantity: participants,
                  schedule: { date: selectedSchedule.date, time: rawTime },
                  subtotal: Number(payment.subtotal || 0),
                  serviceFee: Number(payment.tax || 0),
                  totalPrice: Number(payment.total || 0),

                  listingId: targetId,
                  listingTitle: service?.title || "Untitled",
                  listingCategory: service?.category || "Services",
                  listingAddress: service?.address || "",
                  listingPhotos: Array.isArray(service?.photos) ? service.photos : [],

                  // listing discount audit
                  discount: payment.hasDiscount
                    ? { type: payment.discountType, value: payment.discountValue, discountTotal: payment.discountTotal }
                    : null,

                  // promo audit (auto-applied)
                  promo: (payment?.promoDiscount ?? 0) > 0
                    ? {
                        promoId: payment?.promoId || null,
                        title: payment?.promoTitle || "",
                        type: payment?.promoType || "",
                        value: payment?.promoValue || 0,
                        promoDiscount: Number(payment?.promoDiscount || 0),
                      }
                    : null,

                  // coupon audit
                  coupon:
                    Number(payment?.couponDiscount || 0) > 0
                      ? {
                          couponId: payment?.couponId || null,
                          code: payment?.offerCode || null,
                          label: payment?.couponLabel || null,
                          couponDiscount: Number(payment?.couponDiscount || 0),
                        }
                      : null,

                  status: bookingStatus,
                  paymentStatus: storedPaymentStatus,
                  paymentMethod: "paypal",
                  paypalOrderId: details?.id || null,

                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                };

                if (service?.uid || service?.ownerId || service?.hostId) {
                  bookingData.hostId = service.uid || service.ownerId || service.hostId;
                }
                if (service?.providerName) bookingData.providerName = service.providerName;

                // WRITES
                tx.set(bookingRef, bookingData);

                // include uid on create/update to satisfy rules
                if (!lsnap.exists()) {
                  tx.set(lref, {
                    uid: user.uid,
                    listingId: targetId,
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
                    note: `Reward for booking ${bookingData.listingTitle}`,
                    bookingId: bookingRef.id,
                    balanceAfter: nextPts,
                    timestamp: serverTimestamp(),
                  });
                }
              });

              try {
                await sendBookingEmail({
                  user,
                  title: service?.title || "Untitled",
                  category: service?.category || "Services",
                  location: service?.address || "",
                  total: payment.total,
                  paymentStatus: emailPaymentStatus,
                  currencySymbol,
                  brandSiteUrl: typeof window !== "undefined" ? window.location.origin : "",
                });
              } catch (mailErr) {
                console.error("EmailJS send failed:", mailErr);
              }

              alert(
                completed
                  ? "Booking successful! 80 points were added to your account."
                  : "Order captured; booking pending."
              );
              onClose?.();
            } catch (err) {
              console.error("Error creating reservation:", err);
              alert(`Failed to create reservation: ${err.message}`);
            }
          }}
          onCancel={() => setShowPayPal(false)}
        />
      </div>

      {/* E-Wallet */}
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
        className="mt-3 w-full inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 transition"
      >
        Cancel
      </button>
    </div>
  );
}

/* ============================ Page component ============================ */
export default function ServiceDetailsPage({ listingId: propListingId }) {
  const navigate = useNavigate();
  const { listingId: routeListingId } = useParams();
  const listingId = propListingId ?? routeListingId;

  const [service, setService] = useState(null);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [payment, setPayment] = useState(null);
  const [showPayPal, setShowPayPal] = useState(false);

  const [host, setHost] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);

  // Reviews
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({ avg: 0, count: 0 });

  // Wallet live state
  const [wallet, setWallet] = useState({ balance: 0, currency: "PHP" });

  // Wallet UI state
  const [isPayingWallet, setIsPayingWallet] = useState(false);
  const [modal, setModal] = useState({ open: false, kind: "info", title: "", message: "" });
  const openModal = (kind, title, message) => setModal({ open: true, kind, title, message });
  const closeModal = () => setModal((m) => ({ ...m, open: false }));

  // Coupons UI state
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponMsg, setCouponMsg] = useState("");

  // PROMO state (auto-applied)
  const [autoPromo, setAutoPromo] = useState(null);

  /* Fetch service */
  useEffect(() => {
    const fetchServiceDetails = async () => {
      if (!listingId) return;
      try {
        const docRef = doc(database, "listings", listingId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          setService(null);
          return;
        }
        const data = docSnap.data();
        const normalized = { id: docSnap.id, ...data };
        setService(normalized);
        setSelectedQuantity(1);

        // Preselect soonest schedule
        const sched = Array.isArray(data.schedule) ? [...data.schedule] : [];
        const soonest = sched
          .filter((s) => s?.date)
          .sort((a, b) =>
            `${a.date} ${a.time || a.startTime || ""}`.localeCompare(
              `${b.date} ${b.time || b.startTime || ""}`
            )
          )[0];
        setSelectedSchedule(soonest || null);
        setCurrentPhoto(0);
      } catch (error) {
        console.error("Error fetching service details:", error);
        setService(null);
      }
    };
    fetchServiceDetails();
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

  /* Fetch host */
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const uid = service?.uid || service?.ownerId || service?.hostId;
      if (!uid) {
        if (!cancelled) setHost(null);
        return;
      }
      try {
        const hostsDoc = await getDoc(doc(database, "hosts", uid));
        if (hostsDoc.exists()) {
          let h = normalizeHost(hostsDoc, uid);
          h = await mergeHostPhoto(uid, h);
          if (!cancelled) setHost(h);
          return;
        }
        const usersDoc = await getDoc(doc(database, "users", uid));
        if (usersDoc.exists()) {
          let h = normalizeHost(usersDoc, uid);
          h = await mergeHostPhoto(uid, h);
          if (!cancelled) setHost(h);
          return;
        }
        const usersQ = await getDocs(query(collection(database, "users"), where("uid", "==", uid)));
        if (!usersQ.empty) {
          let h = normalizeHost(usersQ.docs[0], uid);
          h = await mergeHostPhoto(uid, h);
          if (!cancelled) setHost(h);
          return;
        }
        const hostsQ = await getDocs(query(collection(database, "hosts"), where("uid", "==", uid)));
        if (!hostsQ.empty) {
          let h = normalizeHost(hostsQ.docs[0], uid);
          h = await mergeHostPhoto(uid, h);
          if (!cancelled) setHost(h);
          return;
        }
        if (!cancelled) setHost(null);
      } catch (e) {
        console.error("Failed to fetch host for service:", e);
        if (!cancelled) setHost(null);
      }
    };

    run();
  }, [service?.uid, service?.ownerId, service?.hostId]);

  /* Keep photo index in bounds */
  useEffect(() => {
    if (!service?.photos?.length) return setCurrentPhoto(0);
    setCurrentPhoto((idx) => {
      const len = service.photos.length;
      if (idx >= len) return 0;
      if (idx < 0) return (idx + len) % len;
      return idx;
    });
  }, [service?.photos]);

  /* Load and select matching promo (status=active + date + scope) */
  useEffect(() => {
    let cancelled = false;
    async function loadPromo() {
      if (!service) { setAutoPromo(null); return; }
      // Prefer booking date if selected; else today (YYYY-MM-DD)
      const ymd = (selectedSchedule?.date) || new Date().toISOString().slice(0,10);
      try {
        const qs = await getDocs(query(collection(database, "promos"), where("status", "==", "active")));
        const match = qs.docs
          .map(d => normalizePromo({ id: d.id, ...d.data() }, d.id))
          .filter(p =>
            p.status === "active" &&
            (p.type === "percentage" || p.type === "fixed") &&
            p.value > 0 &&
            isYmdInRange(ymd, p.startsAt, p.endsAt) &&
            (p.appliesTo === "all" ||
              (p.appliesTo === "listings" && p.listingIds.includes(String(service.id))))
          )
          // You can prioritize here (e.g., highest value)
          .sort((a,b) => (b.type === "percentage" ? b.value : 0) - (a.type === "percentage" ? a.value : 0))
          [0] || null;

        if (!cancelled) setAutoPromo(match);
      } catch (e) {
        console.warn("promo lookup failed:", e);
        if (!cancelled) setAutoPromo(null);
      }
    }
    loadPromo();
    return () => { cancelled = true; };
  }, [service?.id, selectedSchedule?.date]);

  /* Recompute payment: listing discount → auto promo → coupon */
  useEffect(() => {
    if (!service || !selectedSchedule) return setPayment(null);

    // 1) base payment after listing's discount
    const base = computePayment({
      price: service.price,
      quantity: selectedQuantity,
      discountType: service.discountType,
      discountValue: service.discountValue,
    });

    // 2) auto promo
    let withPromo = { ...base, promoDiscount: 0, promoId: null, promoTitle: "", promoType: "", promoValue: 0, promoApplied: false };
    if (autoPromo && autoPromo.value > 0 && (autoPromo.type === "percentage" || autoPromo.type === "fixed")) {
      const meetsMin = Number(base.subtotal || 0) >= Number(autoPromo.minSubtotal || 0);
      if (meetsMin) {
        const promoDiscount = autoPromo.type === "percentage"
          ? (base.subtotal * autoPromo.value) / 100
          : Math.min(base.subtotal, autoPromo.value);
        const subAfterPromo = Math.max(0, base.subtotal - promoDiscount);
        const tax = subAfterPromo * 0.12;
        const total = subAfterPromo + tax;
        withPromo = {
          ...base,
          subtotal: subAfterPromo,
          tax,
          total,
          promoApplied: true,
          promoId: autoPromo.id,
          promoTitle: autoPromo.title || "",
          promoType: autoPromo.type,
          promoValue: autoPromo.value,
          promoDiscount,
        };
      }
    }

    // 3) validate attached coupon against new state (note: after promo)
    let useCoupon = appliedCoupon;
    if (useCoupon) {
      const elig = isCouponEligible(useCoupon, {
        listingId,
        scheduleDate: selectedSchedule?.date || null,
        quantity: Number(withPromo?.quantity || 1),
        subtotalAfterListing: Number(withPromo?.subtotal || 0),
      });
      if (!elig.ok) {
        useCoupon = null;
        setAppliedCoupon(null);
        setCouponMsg(elig.reason || "Coupon removed (no longer applicable).");
      }
    }

    // 4) apply coupon
    const afterCoupon = applyCouponToPayment(withPromo, useCoupon, withPromo.quantity);

    setPayment({
      ...afterCoupon,
      listingDiscount: Number(base?.discountTotal || 0),
      promoDiscount: Number(withPromo?.promoDiscount || 0) || 0,
      couponDiscount: Number(afterCoupon?.couponDiscount || 0),
      totalDiscount:
        Number(base?.discountTotal || 0) +
        Number(withPromo?.promoDiscount || 0) +
        Number(afterCoupon?.couponDiscount || 0),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, selectedSchedule, selectedQuantity, appliedCoupon, autoPromo, listingId]);

  /* ==================== Reviews subscription ==================== */
  useEffect(() => {
    if (!listingId) return;

    const subOrdered = query(
      collection(database, "listings", String(listingId), "reviews"),
      orderBy("createdAt", "desc")
    );

    const topOrdered = query(
      collection(database, "reviews"),
      where("listingId", "==", String(listingId)),
      orderBy("createdAt", "desc")
    );

    const topSimple = query(
      collection(database, "reviews"),
      where("listingId", "==", String(listingId))
    );

    let unsub = () => {};
    let cancelled = false;

    const normalizeUser = (uid, d = {}) => {
      const first = d.firstName || d.givenName || d.first_name || "";
      const last = d.lastName || d.familyName || d.last_name || "";
      const displayName =
        d.displayName ||
        d.name ||
        [first, last].filter(Boolean).join(" ") ||
        (d.email ? d.email.split("@")[0] : "Guest");
      const photoURL =
        d.photoURL || d.photoUrl || d.avatarURL || d.photo || d.avatar || d.profileImageUrl || null;
      return { uid, displayName, photoURL, email: d.email || "" };
    };

    const hydrateUsersAndSet = async (rows) => {
      const uids = Array.from(
        new Set(rows.map((r) => r.uid || r.userId || r.authorUid || r.user?.uid).filter(Boolean))
      );

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
          (r.createdAt && typeof r.createdAt.toDate === "function" && r.createdAt.toDate()) ||
          (r.createdAt instanceof Date && r.createdAt) ||
          (typeof r.createdAt === "string" && new Date(r.createdAt)) ||
          null;

        const uid = r.uid || r.userId || r.authorUid || r.user?.uid || null;
        return { ...r, rating, createdAtDate: created, user: uid ? userMap[uid] : null };
      });

      enriched.sort((a, b) => {
        const ta = a.createdAtDate?.getTime?.() ?? 0;
        const tb = b.createdAtDate?.getTime?.() ?? 0;
        return tb - ta;
      });

      const ratings = enriched.map((r) => r.rating).filter((n) => Number.isFinite(n) && n > 0);
      const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

      if (!cancelled) {
        setReviewStats({ avg, count: ratings.length });
        setReviews(enriched);
      }
    };

    const handleSnapshot = (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      hydrateUsersAndSet(rows);
    };

    const handleError = (err) => {
      console.error("[reviews] snapshot error:", err?.message || err);
      setReviewStats({ avg: 0, count: 0 });
      setReviews([]);
    };

    (async () => {
      try {
        const probe = await getDocs(subOrdered);
        if (!cancelled && !probe.empty) {
          unsub = onSnapshot(subOrdered, handleSnapshot, handleError);
          return;
        }
      } catch {}

      try {
        unsub = onSnapshot(topOrdered, handleSnapshot, async (err) => {
          console.warn("[reviews] ordered top-level failed. Falling back.", err?.message || err);
          try {
            unsub();
          } catch {}
          unsub = onSnapshot(topSimple, handleSnapshot, handleError);
        });
      } catch (e2) {
        console.warn("[reviews] top-level ordered threw. Falling back to simple where.", e2?.message || e2);
        unsub = onSnapshot(topSimple, handleSnapshot, handleError);
      }
    })();

    return () => {
      cancelled = true;
      try {
        unsub();
      } catch {}
    };
  }, [listingId]);

  const photos = useMemo(
    () => (Array.isArray(service?.photos) ? service.photos : []),
    [service?.photos]
  );
  const hasPhotos = photos.length > 0;
  const hasSchedule = Array.isArray(service?.schedule) && service.schedule.length > 0;
  const hasLanguages = Array.isArray(service?.languages) && service.languages.length > 0;
  const hasAmenities = Array.isArray(service?.amenities) && service.amenities.length > 0;

  const currencySymbol =
    service?.currencySymbol ||
    (service?.currency === "USD" ? "$" : service?.currency === "EUR" ? "€" : "₱");

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

  const handleBookNow = () => {
    if (!selectedSchedule || !payment) {
      alert("Please select a schedule and ensure payment details are calculated.");
      return;
    }
    setShowPayPal(true);
  };
  const onClose = () => navigate(-1);

  /* ==================== E-Wallet payment flow ==================== */
  const payWithWallet = async () => {
    const user = auth.currentUser;

    if (!user) return openModal("error", "Sign in required", "Please log in to pay with your wallet.");
    if (!payment) return openModal("error", "Select schedule", "Please select a schedule first.");
    if (!selectedSchedule?.date)
      return openModal("error", "Invalid schedule", "Please pick a valid date and time.");

    const total = Number(payment.total || 0);
    const subtotal = Number(payment.subtotal || 0); // provider payout
    const serviceFee = Number(payment.tax || 0);
    if (!Number.isFinite(total) || total <= 0)
      return openModal("error", "Invalid total", "We could not compute a valid total.");

    if (wallet.balance < total)
      return openModal("error", "Insufficient balance", "Your wallet balance is not enough for this booking.");

    const rawTime = selectedSchedule.time || selectedSchedule.startTime || "";
    const timeKey = String(rawTime).replace(/:/g, "");
    const lockId = `${listingId}_${selectedSchedule.date}_${timeKey}`;
    const maxParticipants = Number(service?.maxParticipants || 0);
    const participants = Number(payment?.quantity || 1);

    try {
      setIsPayingWallet(true);
      if (maxParticipants > 0) {
        const lref = doc(database, "serviceLocks", lockId);
        const lsnap = await getDoc(lref);
        const currentCount = Number(lsnap.data()?.count || 0);
        const nextCount = currentCount + participants;
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

    try {
      await runTransaction(database, async (tx) => {
        const hostUid = service?.uid || service?.ownerId || service?.hostId || "";
        if (!hostUid) throw new Error("Service provider not found.");

        const wrefGuest = doc(database, "wallets", user.uid);
        const wrefHost = doc(database, "wallets", hostUid);
        const walletTxGuestRef = doc(collection(database, "wallets", user.uid, "transactions"));
        const walletTxHostRef = doc(collection(database, "wallets", hostUid, "transactions"));

        const pointsGuestRef = doc(database, "points", user.uid);
        const pointsHostRef = doc(database, "points", hostUid);
        const ptsLogGuestRef = doc(collection(database, "points", user.uid, "transactions"));
        const ptsLogHostRef = doc(collection(database, "points", hostUid, "transactions"));

        const bookingRef = doc(collection(database, "bookings"));
        const lref = doc(database, "serviceLocks", lockId);

        // READS
        const wSnapGuest = await tx.get(wrefGuest);
        const wSnapHost = await tx.get(wrefHost);
        const pSnapGuest = await tx.get(pointsGuestRef);
        const pSnapHost = await tx.get(pointsHostRef);
        const lsnap = await tx.get(lref);

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

        const bookingData = {
          uid: user.uid,
          guestEmail: user.email,
          guestName: user.displayName || "",

          listingId,
          hostId: hostUid,

          listingTitle: service?.title || "Untitled",
          listingCategory: service?.category || "Services",
          listingAddress: service?.address || "",
          listingPhotos: Array.isArray(service?.photos) ? service.photos : [],

          schedule: { date: selectedSchedule.date, time: rawTime },
          quantity: participants,
          subtotal: Number(payment.subtotal || 0), // after discounts
          serviceFee: Number(payment.tax || 0),
          totalPrice: total,

          // listing discount audit
          discount: payment.hasDiscount
            ? { type: payment.discountType, value: payment.discountValue, discountTotal: payment.discountTotal }
            : null,

          // promo audit (auto-applied)
          promo: (payment?.promoDiscount ?? 0) > 0
            ? {
                promoId: payment?.promoId || null,
                title: payment?.promoTitle || "",
                type: payment?.promoType || "",
                value: payment?.promoValue || 0,
                promoDiscount: Number(payment?.promoDiscount || 0),
              }
            : null,

          // coupon audit
          coupon:
            Number(payment?.couponDiscount || 0) > 0
              ? {
                  couponId: payment?.couponId || null,
                  code: payment?.offerCode || null,
                  label: payment?.couponLabel || null,
                  couponDiscount: Number(payment?.couponDiscount || 0),
                }
              : null,

          status: "confirmed",
          paymentStatus: "paid",
          paymentMethod: "wallet",

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        tx.set(bookingRef, bookingData);

        // Lock
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

        // Guest wallet: debit
        tx.set(walletTxGuestRef, {
          uid: user.uid,
          type: "booking_payment",
          delta: -total,
          amount: total,
          status: "completed",
          method: "wallet",
          note: `${service?.title || "Service"} — ${fmtDate(selectedSchedule.date)} ${rawTime}`,
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

        // Host wallet: credit
        tx.set(
          wrefHost,
          { uid: user.uid, ownerUid: hostUid, balance: hostBalAfter, currency: "PHP", updatedAt: serverTimestamp() },
          { merge: true }
        );
        tx.set(walletTxHostRef, {
          uid: user.uid,
          type: "booking_income",
          delta: +subtotal,
          amount: subtotal,
          status: "completed",
          method: "wallet",
          sourceUid: user.uid,
          note: `Earnings from ${service?.title || "Service"} — ${fmtDate(selectedSchedule.date)} ${rawTime}`,
          metadata: { bookingId: bookingRef.id, payerUid: user.uid, listingId },
          balanceAfter: hostBalAfter,
          timestamp: serverTimestamp(),
        });

        // Points
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
          note: `Reward for booking ${service?.title || "Service"}`,
          bookingId: bookingRef.id,
          balanceAfter: guestPtsAfter,
          timestamp: serverTimestamp(),
        });

        tx.set(
          pointsHostRef,
          { uid: user.uid, ownerUid: hostUid, balance: hostPtsAfter, updatedAt: serverTimestamp() },
          { merge: true }
        );
        tx.set(ptsLogHostRef, {
          uid: user.uid,
          type: "host_booking_reward",
          delta: HOST_BOOKING_REWARD_POINTS,
          amount: HOST_BOOKING_REWARD_POINTS,
          status: "completed",
          note: `Reward for hosting a booking on ${service?.title || "Service"}`,
          bookingId: bookingRef.id,
          balanceAfter: hostPtsAfter,
          timestamp: serverTimestamp(),
        });

        // Platform fee
        if (serviceFee > 0) {
          const platformFeeRef = doc(collection(database, "platformFees"));
          tx.set(platformFeeRef, {
            uid: user.uid,
            payerUid: user.uid,
            hostUid,
            listingId,
            bookingId: bookingRef.id,
            amount: serviceFee,
            currency: "PHP",
            status: "owed",
            createdAt: serverTimestamp(),
          });
        }
      });

      try {
        await sendBookingEmail({
          user: auth.currentUser,
          title: service?.title || "Untitled",
          category: service?.category || "Services",
          location: service?.address || "",
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
      openModal(
        "success",
        "Booking confirmed",
        `Paid with E-Wallet.
• Provider received: ${currencySymbol}${Number(payment.subtotal || 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
• Listing discount: ${Number(payment.listingDiscount||0)>0?`- ${currencySymbol}${Number(payment.listingDiscount||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`:"None"}
• Promo: ${Number(payment.promoDiscount||0)>0?`- ${currencySymbol}${Number(payment.promoDiscount||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`:"None"}
• Coupon: ${Number(payment.couponDiscount||0)>0?`- ${currencySymbol}${Number(payment.couponDiscount||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`:"None"}
• You earned: +${BOOKING_REWARD_POINTS} pts
• Provider earned: +${HOST_BOOKING_REWARD_POINTS} pts

A confirmation email will follow shortly.`
      );
    } catch (e) {
      console.error(e);
      setIsPayingWallet(false);
      openModal("error", "Payment failed", e?.message || "We couldn’t complete your wallet payment.");
    }
  };

  // Coupon handlers
  async function handleApplyCoupon() {
    const raw = String(couponInput || "").trim();
    if (!raw) {
      setAppliedCoupon(null);
      setCouponMsg("Enter a coupon code.");
      return;
    }
    if (!selectedSchedule || !payment) {
      setAppliedCoupon(null);
      setCouponMsg("Select a schedule first.");
      return;
    }

    try {
      const codeLower = raw.toLowerCase();
      const byLower = query(collection(database, "coupons"), where("codeLower", "==", codeLower));
      const byExact = query(collection(database, "coupons"), where("code", "==", raw));

      let snap = await getDocs(byLower);
      if (snap.empty) snap = await getDocs(byExact);
      if (snap.empty) {
        setAppliedCoupon(null);
        setCouponMsg("Coupon not found.");
        return;
      }

      const cdoc = snap.docs[0];
      const coupon = normalizeCoupon({ id: cdoc.id, ...cdoc.data() }, cdoc.id);

      const elig = isCouponEligible(coupon, {
        listingId,
        scheduleDate: selectedSchedule?.date || null,
        quantity: Number(payment?.quantity || 1),
        subtotalAfterListing: Number(payment?.subtotal || 0),
      });

      if (!elig.ok) {
        setAppliedCoupon(null);
        setCouponMsg(elig.reason || "Coupon not applicable.");
        return;
      }

      setAppliedCoupon(coupon);
      setCouponMsg(`Applied: ${coupon.code} (${describeOffer(coupon)})`);
    } catch (e) {
      console.error("Apply coupon failed:", e);
      setAppliedCoupon(null);
      setCouponMsg("Could not validate coupon right now.");
    }
  }

  function clearCoupon() {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponMsg("");
  }

  if (!service) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-blue-50/35 via-white/55 to-indigo-50/35">
        <div className="text-center p-8 rounded-3xl bg-white/80 border border-slate-200 shadow">
          <p className="text-slate-700">Loading service…</p>
        </div>
      </div>
    );
  }

  const maxParticipants = Number(service?.maxParticipants || 0);

  // Discount view helpers
  const cleanDiscount = sanitizeDiscount(service?.discountType, service?.discountValue);
  const hasListingDiscount =
    cleanDiscount.type && Number(cleanDiscount.value) > 0 && Number(payment?.unitDiscount || 0) > 0;
  const percentOff = cleanDiscount.type === "percentage" ? cleanDiscount.value : null;
  const hasCouponApplied = Number(payment?.couponDiscount || 0) > 0;
  const hasPromoApplied = Number(payment?.promoDiscount || 0) > 0;

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
            {service.title || "Untitled"}
          </h1>

          {host && (
            <button
              onClick={() => setShowMessageModal(true)}
              className="ml-auto inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition"
            >
              <MessageSquareText className="w-5 h-5" /> Message Provider
            </button>
          )}
        </div>
      </header>

      {/* ===== Hero Gallery ===== */}
      <section className="max-w-[1200px] mx-auto px-4 pt-4">
        <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
          <div className="aspect-[16/9] sm:aspect-[21/9] bg-slate-200">
            {hasPhotos ? (
              <img
                src={photos[currentPhoto]}
                alt={`${service?.title || "Service"} photo ${currentPhoto + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-slate-600">
                No photos available
              </div>
            )}

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

                {/* Discount flag over image */}
                {(hasListingDiscount || hasCouponApplied || hasPromoApplied) && (
                  <div className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-emerald-600/95 text-white px-3 py-1 text-xs font-bold shadow">
                    <Percent className="w-3.5 h-3.5" />
                    {hasPromoApplied
                      ? (payment?.promoTitle || "Promo Applied")
                      : hasListingDiscount && percentOff
                      ? `${percentOff}% OFF`
                      : hasCouponApplied
                      ? "Coupon Applied"
                      : "On Sale"}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* ===== Badges row ===== */}
      <section className="max-w-[1200px] mx-auto px-4 mt-4">
        <div className="flex flex-wrap items-center gap-2">
          {service.category && (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">
              {service.category}
            </span>
          )}
          {service.serviceType && (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm">
              {service.serviceType}
            </span>
          )}
          {service.pricingType && (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-purple-700 shadow-sm">
              {service.pricingType}
            </span>
          )}
          {service.recurrence && (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
              Repeats: {service.recurrence}
            </span>
          )}
          {hasListingDiscount && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm">
              <Percent className="w-3.5 h-3.5" /> On Sale
            </span>
          )}
          {hasPromoApplied && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm">
              <Percent className="w-3.5 h-3.5" /> {payment?.promoTitle || "Promo Applied"}
            </span>
          )}
          {hasCouponApplied && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm">
              <Percent className="w-3.5 h-3.5" /> Coupon Applied
            </span>
          )}

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
        {/* LEFT column */}
        <div className="lg:col-span-7 space-y-6">
          {/* Title + Description */}
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {service.title || "Untitled"}
            </h2>
            {(hasListingDiscount || hasCouponApplied || hasPromoApplied) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5 text-xs font-bold">
                <Percent className="w-3.5 h-3.5" />
                {hasPromoApplied
                  ? (payment?.promoTitle || "Promo Applied")
                  : hasListingDiscount && percentOff
                  ? `${percentOff}% OFF`
                  : hasCouponApplied
                  ? "Coupon Applied"
                  : "On Sale"}
              </span>
            )}
          </div>
          {service.description && (
            <GlassCard className="p-5 sm:p-6">
              <p className="text-[15px] sm:text-base leading-relaxed text-slate-800">
                {service.description}
              </p>
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
                    "Service Provider"}
                </p>
                <p className="text-[13px] sm:text-sm text-slate-600 truncate">Service Provider</p>
              </div>
              <button
                onClick={() => setShowMessageModal(true)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[13px] sm:text-sm font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 shadow-sm active:scale-[0.98] transition"
              >
                <MessageSquareText className="w-5 h-5" /> Message Provider
              </button>
            </GlassCard>
          )}

          {/* Details grid */}
          <GlassCard className="p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-slate-900 tracking-wide mb-3">Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 rounded-2xl bg-white/90 backdrop-blur border border-slate-200 p-3 shadow-sm">
                <Clock className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-[12px] sm:text-xs text-slate-600">Pricing Type</p>
                  <p className="text-sm font-medium text-slate-900">{service.pricingType || "—"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-white/90 backdrop-blur border border-slate-200 p-3 shadow-sm">
                <Users className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-[12px] sm:text-xs text-slate-600">Max Participants</p>
                  <p className="text-sm font-medium text-slate-900">{service.maxParticipants ?? "—"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-white/90 backdrop-blur border border-slate-200 p-3 shadow-sm">
                <MapPin className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-[12px] sm:text-xs text-slate-600">Location Type</p>
                  <p className="text-sm font-medium text-slate-900">
                    {service.locationType === "in-person" ? "In-Person" : "Online"}
                  </p>
                </div>
              </div>

              {hasLanguages && (
                <div className="flex items-center gap-3 rounded-2xl bg-white/90 backdrop-blur border border-slate-200 p-3 shadow-sm">
                  <Languages className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-[12px] sm:text-xs text-slate-600">Languages</p>
                    <p className="text-sm font-medium text-slate-900">{service.languages.join(", ")}</p>
                  </div>
                </div>
              )}

              {service.serviceType && (
                <div className="flex items-center gap-3 rounded-2xl bg-white/90 backdrop-blur border border-slate-200 p-3 shadow-sm">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-[12px] sm:text-xs text-slate-600">Service Type</p>
                    <p className="text-sm font-medium text-slate-900">{service.serviceType}</p>
                  </div>
                </div>
              )}

              {service.duration && (
                <div className="flex items-center gap-3 rounded-2xl bg-white/90 backdrop-blur border border-slate-200 p-3 shadow-sm">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-[12px] sm:text-xs text-slate-600">Duration</p>
                    <p className="text-sm font-medium text-slate-900">{service.duration}</p>
                  </div>
                </div>
              )}

              {service.address && (
                <div className="flex items-center gap-3 rounded-2xl bg-white/90 backdrop-blur border border-slate-200 p-3 shadow-sm col-span-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <div className="min-w-0">
                    <p className="text-[12px] sm:text-xs text-slate-600">Address</p>
                    <p className="text-sm font-medium text-slate-900 truncate">{service.address}</p>
                  </div>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Optional sections */}
          {service.providerName && (
            <GlassCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-slate-900 tracking-wide">Provider</h3>
              <p className="mt-2 text-sm font-medium text-slate-900">{service.providerName}</p>
            </GlassCard>
          )}

          {service.ageRestriction && (
            <GlassCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-slate-900 tracking-wide">Age Requirements</h3>
              <p className="mt-2 text-sm text-slate-900">
                {service.ageRestriction.min} – {service.ageRestriction.max} years old
              </p>
            </GlassCard>
          )}

          {service.clientRequirements && (
            <GlassCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-slate-900 tracking-wide">Requirements</h3>
              <p className="mt-2 text-sm text-slate-800">{service.clientRequirements}</p>
            </GlassCard>
          )}

          {hasAmenities && (
            <GlassCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-slate-900 tracking-wide">Included Amenities</h3>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {service.amenities.map((a, i) => (
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

          {service.includes && (
            <GlassCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-slate-900 tracking-wide">What’s Included</h3>
              <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-slate-800">
                {splitList(service.includes).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </GlassCard>
          )}

          {service.qualifications && (
            <GlassCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-slate-900 tracking-wide">Qualifications</h3>
              <p className="mt-2 text-sm text-slate-800">{service.qualifications}</p>
            </GlassCard>
          )}

          {service.targetAudience && (
            <GlassCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-slate-900 tracking-wide">Best For</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {splitTags(service.targetAudience).map((tag, i) => (
                  <span
                    key={`${tag}-${i}`}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] sm:text-xs font-medium text-slate-900 shadow-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </GlassCard>
          )}

          {service.cancellationPolicy && (
            <GlassCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-slate-900 tracking-wide">Cancellation Policy</h3>
              <p className="mt-2 text-sm text-slate-600">{service.cancellationPolicy}</p>
            </GlassCard>
          )}

          {/* ===== Ratings & Reviews ===== */}
          <GlassCard className="p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-3">
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

            {reviews.length === 0 ? (
              <p className="text-sm text-slate-600">No reviews yet.</p>
            ) : (
              <ul className="space-y-4">
                {reviews.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
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
                        {String(r.comment || r.text || r.content || "").trim() && (
                          <p className="mt-1 text-[13.5px] text-slate-800 whitespace-pre-wrap">
                            {r.comment || r.text || r.content}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>

        {/* RIGHT column (Booking) */}
        <div className="lg:col-span-5">
          <aside className="lg:sticky lg:top-20">
            <div className="rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5 overflow-hidden">
              {/* Price */}
              <div className="px-5 pt-5">
                {!hasListingDiscount ? (
                  <div className="text-xl font-semibold text-slate-900">
                    {currencySymbol}
                    {(service.price || 0).toLocaleString()}
                    <span className="text-sm font-medium text-slate-500"> / person</span>
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <div className="text-xl font-bold text-slate-900">
                      {currencySymbol}
                      {Number(payment?.unitPriceAfter || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                      <span className="text-sm font-medium text-slate-500"> / person</span>
                    </div>
                    <div className="text-sm text-slate-500 line-through">
                      {currencySymbol}
                      {Number(service.price || 0).toLocaleString()}
                    </div>
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[11px] font-bold">
                      <Percent className="w-3.5 h-3.5" />
                      {percentOff
                        ? `${percentOff}% OFF`
                        : `- ${currencySymbol}${Number(payment?.unitDiscount || 0).toLocaleString()}`}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-4 h-px bg-slate-200" />

              {/* Schedule */}
              <div className="px-5 py-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Select Schedule</h4>
                {hasSchedule ? (
                  <div className="grid gap-2">
                    {service.schedule.map((s, idx) => {
                      const isSelected =
                        selectedSchedule?.date === s.date &&
                        (selectedSchedule?.time || selectedSchedule?.startTime || "") ===
                          (s.time || s.startTime || "");
                      return (
                        <button
                          key={`${s.date}-${s.time || s.startTime || ""}-${idx}`}
                          type="button"
                          onClick={() => setSelectedSchedule(s)}
                          className={`flex w-full items-start justify-between rounded-2xl border p-3 text-left transition ${
                            isSelected
                              ? "border-2 border-blue-500 bg-blue-50"
                              : "border-slate-200 bg-white hover:border-blue-300"
                          }`}
                        >
                          <div>
                            <p className="font-semibold text-slate-900">{fmtDate(s.date)}</p>
                            <p className="text-sm text-slate-600">{s.time || s.startTime || ""}</p>
                          </div>
                          {isSelected && (
                            <span className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">No schedules available.</p>
                )}
              </div>

              {/* Quantity */}
              <div className="px-5 pb-2">
                <div className="rounded-2xl bg-white/90 backdrop-blur border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <p className="text-[13.5px] sm:text-sm font-semibold text-slate-900">
                      Participants
                    </p>
                    {!!service.maxParticipants && (
                      <span className="ml-auto text-[12px] sm:text-xs text-slate-600">
                        Max: {service.maxParticipants}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedQuantity((v) => Math.max(1, v - 1))}
                      disabled={selectedQuantity <= 1}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 shadow disabled:opacity-50 disabled:pointer-events-none"
                      aria-label="Decrease participants"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-center font-semibold text-slate-900">
                      {selectedQuantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedQuantity((v) =>
                          service.maxParticipants ? Math.min(service.maxParticipants, v + 1) : v + 1
                        )
                      }
                      disabled={!!service.maxParticipants && selectedQuantity >= service.maxParticipants}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow disabled:opacity-50 disabled:pointer-events-none"
                      aria-label="Increase participants"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Coupon field */}
              <div className="px-5 pb-3">
                <div className="rounded-2xl bg-white/90 backdrop-blur border border-slate-200 p-4 shadow-sm">
                  <label className="text-[13.5px] sm:text-sm font-semibold text-slate-900">Coupon</label>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="Enter coupon code"
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      className="shrink-0 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-black"
                    >
                      Apply
                    </button>
                  </div>
                  <div className="mt-2 text-xs">
                    {couponMsg ? <span className="text-slate-700">{couponMsg}</span> : null}
                    {appliedCoupon ? (
                      <button
                        type="button"
                        onClick={clearCoupon}
                        className="ml-2 inline-flex items-center text-rose-600 hover:underline"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Payment summary */}
              {payment && (
                <div className="px-5 pb-4">
                  <section className="rounded-3xl bg-white/90 backdrop-blur border border-slate-200 p-4 sm:p-5 shadow-lg space-y-2">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
                      Payment Summary
                    </h3>

                    {/* Row: Base price x qty */}
                    <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                      <span>
                        <span className="font-semibold">
                          {currencySymbol}
                          {Number(service.price || 0).toLocaleString()}
                        </span>{" "}
                        × {payment.quantity} {payment.quantity === 1 ? "person" : "people"}
                      </span>
                      <span className={hasListingDiscount ? "text-slate-500 line-through" : "font-medium"}>
                        {currencySymbol}
                        {(Number(service.price || 0) * payment.quantity).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    {/* Row: Listing Discount */}
                    {hasListingDiscount && (
                      <div className="flex items-center justify-between text-[13.5px] sm:text-sm text-emerald-700">
                        <span className="inline-flex items-center gap-1">
                          <Percent className="w-4 h-4" /> Discount
                          {percentOff ? ` (${percentOff}%)` : ""}
                        </span>
                        <span className="font-semibold">
                          - {currencySymbol}
                          {Number(payment.discountTotal).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    )}

                    {/* Row: Promo */}
                    {Number(payment?.promoDiscount || 0) > 0 && (
                      <div className="flex items-center justify-between text-[13.5px] sm:text-sm text-emerald-700">
                        <span className="inline-flex items-center gap-1">
                          <Percent className="w-4 h-4" /> {payment.promoTitle || "Promo"}
                          {payment.promoType === "percentage" ? ` (${payment.promoValue}%)` : ""}
                        </span>
                        <span className="font-semibold">
                          - {currencySymbol}
                          {Number(payment.promoDiscount).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    )}

                    {/* Row: Coupon */}
                    {Number(payment?.couponDiscount || 0) > 0 && (
                      <div className="flex items-center justify-between text-[13.5px] sm:text-sm text-emerald-700">
                        <span className="inline-flex items-center gap-1">
                          <Percent className="w-4 h-4" /> Coupon
                          {payment.couponLabel ? ` (${payment.couponLabel})` : payment.offerCode ? ` (${payment.offerCode})` : ""}
                        </span>
                        <span className="font-semibold">
                          - {currencySymbol}
                          {Number(payment.couponDiscount).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    )}

                    {/* Row: Subtotal (after discounts) */}
                    <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                      <span>Subtotal (after discounts)</span>
                      <span className="font-medium">
                        {currencySymbol}
                        {payment.subtotal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    {/* Row: Service fee */}
                    <div className="flex items-center justify-between text-[13.5px] sm:text-sm">
                      <span>Service fee (12%)</span>
                      <span>
                        {currencySymbol}
                        {payment.tax.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    <div className="my-2 h-px bg-slate-200" />

                    {/* Total */}
                    <div className="flex items-center justify-between">
                      <span className="text-base sm:text-lg font-bold text-slate-900">
                        Total
                      </span>
                      <span className="text-base sm:text-lg font-bold text-blue-700">
                        {currencySymbol}
                        {payment.total.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    {/* Savings note */}
                    {(Number(payment?.discountTotal || 0) + Number(payment?.promoDiscount || 0) + Number(payment?.couponDiscount || 0)) > 0 && (
                      <p className="text-xs text-emerald-700/90">
                        You save {currencySymbol}
                        {(Number(payment.discountTotal || 0) + Number(payment.promoDiscount || 0) + Number(payment.couponDiscount || 0)).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        on this booking.
                      </p>
                    )}
                  </section>
                </div>
              )}

              {/* CTA (desktop) */}
              <div className="px-5 pb-6 hidden lg:block">
                {showPayPal ? (
                  <ServiceCheckout
                    payment={payment}
                    selectedSchedule={selectedSchedule}
                    service={service}
                    listingId={listingId}
                    currencySymbol={currencySymbol}
                    setShowPayPal={setShowPayPal}
                    onClose={onClose}
                    maxParticipants={maxParticipants}
                    wallet={wallet}
                    payWithWallet={payWithWallet}
                    isPayingWallet={isPayingWallet}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={handleBookNow}
                    disabled={!payment || !selectedSchedule}
                    className="w-full inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 active:scale-[0.99] transition disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    Book Now
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Message Host / Provider modal */}
      {showMessageModal &&
        createPortal(
          <div className="fixed inset-0 z-[2147483646]">
            <MessageHostModal
              open
              onClose={() => setShowMessageModal(false)}
              host={host}
              hostId={host?.uid || service?.uid || service?.ownerId || service?.hostId}
            />
          </div>,
          document.body
        )}

      {/* Footer actions (mobile) */}
      <div
        className="w-full bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-t border-slate-200 px-4 pt-4 pb-6 lg:hidden"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row gap-3">
          {showPayPal ? (
            <ServiceCheckout
              payment={payment}
              selectedSchedule={selectedSchedule}
              service={service}
              listingId={listingId}
              currencySymbol={currencySymbol}
              setShowPayPal={setShowPayPal}
              onClose={onClose}
              maxParticipants={maxParticipants}
              wallet={wallet}
              payWithWallet={payWithWallet}
              isPayingWallet={isPayingWallet}
            />
          ) : (
            <>
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
                className="w-full sm:w-auto flex-1 min-w-[140px] inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 transition"
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
          listing={service}
          reviews={reviews}
          avgRating={reviewStats.avg}
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
