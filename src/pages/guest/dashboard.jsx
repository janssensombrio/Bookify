// src/pages/Dashboard.jsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  ChevronRight,
  TrendingUp,
  MapPin,
  Compass,
  Heart,
  Star,
  Coins,
} from "lucide-react";

import Sidebar from "./components/sidebar.jsx";
import BookifyLogo from "../../components/bookify-logo.jsx";
import { useSidebar } from "../../context/SidebarContext";

// Firebase
import { auth, database } from "../../config/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";

import HostCategModal from "../../components/host-categ-modal.jsx";
import HostPoliciesModal from "./components/HostPoliciesModal.jsx";

/* ---------------- utils ---------------- */
const peso = (n) =>
  typeof n === "number"
    ? n.toLocaleString(undefined, { style: "currency", currency: "PHP", maximumFractionDigits: 0 })
    : "₱—";

const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
const endOfMonth   = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
const startOfYear  = (d = new Date()) => new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
const endOfYear    = (d = new Date()) => new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);

const ms = (x) => {
  try {
    const d = x?.toDate ? x.toDate() : new Date(x);
    const t = d.getTime();
    return Number.isFinite(t) ? t : NaN;
  } catch { return NaN; }
};

const nightsBetween = (checkIn, checkOut) => {
  const ts = ms(checkIn);
  const te = ms(checkOut);
  if (!Number.isFinite(ts) || !Number.isFinite(te)) return 0;
  const s = new Date(ts); const e = new Date(te);
  const day = 1000 * 60 * 60 * 24;
  const sNoon = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 12);
  const eNoon = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 12);
  return Math.max(0, Math.ceil((eNoon - sNoon) / day));
};

const fmtRangeCompact = (start, end) => {
  try {
    const s = start?.toDate ? start.toDate() : new Date(start);
    const e = end?.toDate ? end.toDate() : new Date(end);
    if (!(s instanceof Date) || isNaN(s.getTime()) || !(e instanceof Date) || isNaN(e.getTime())) return "—";
    const optsM = { month: "short" };
    const optsD = { day: "numeric" };
    const ySame = s.getFullYear() === e.getFullYear();
    const sameMonth = ySame && s.getMonth() === e.getMonth();
    const sStr = `${s.toLocaleDateString(undefined, optsM)} ${s.toLocaleDateString(undefined, optsD)}`;
    const eStr = sameMonth
      ? e.toLocaleDateString(undefined, optsD)
      : `${e.toLocaleDateString(undefined, optsM)} ${e.toLocaleDateString(undefined, optsD)}`;
    const yStr = ySame ? s.getFullYear() : `${s.getFullYear()}–${e.getFullYear()}`;
    return `${sStr}–${eStr}, ${yStr}`;
  } catch {
    return "—";
  }
};

const extractListingIdFromPath = (path) => {
  if (!path) return null;
  const parts = String(path).split("/").filter(Boolean);
  const i = parts.indexOf("listings");
  return i >= 0 && parts[i + 1] ? parts[i + 1] : null;
};

const getListingIdFromBooking = (b) =>
  b?.listingId ||
  extractListingIdFromPath(b?.listingRefPath) ||
  b?.listing?.id ||
  null;

/* ---------------- component ---------------- */
export default function Dashboard() {
  const navigate = useNavigate();
  const { sidebarOpen, setSidebarOpen } = useSidebar();

  const [user, setUser] = useState(() => auth.currentUser);
  const firstName = user?.displayName?.trim()?.split(/\s+/)[0] || user?.email || "there";

  // Host gating
  const [isHost, setIsHost] = useState(localStorage.getItem("isHost") === "true");
  const [showHostModal, setShowHostModal] = useState(false);
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);
  const [policiesAccepted, setPoliciesAccepted] = useState(false);

  // Loading / error
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  // Stats
  const [totalBookings, setTotalBookings] = useState(0);
  const [nightsBooked, setNightsBooked] = useState(0);
  const [savedPlaces, setSavedPlaces] = useState(0);
  const [reviewsGiven, setReviewsGiven] = useState(0);
  const [recentBookings, setRecentBookings] = useState([]);

  const [bookingsThisMonth, setBookingsThisMonth] = useState(0);
  const [bookingsLastMonth, setBookingsLastMonth] = useState(0);
  const [totalSpentYTD, setTotalSpentYTD] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);

  /* auth watch */
  useEffect(() => auth.onAuthStateChanged((u) => setUser(u || null)), []);

  /* host flag */
  useEffect(() => {
    (async () => {
      if (!user?.uid) return;
      try {
        const hostsRef = collection(database, "hosts");
        const qHosts = query(hostsRef, where("uid", "==", user.uid));
        const snap = await getDocs(qHosts);
        const hostStatus = !snap.empty;
        setIsHost(hostStatus);
        localStorage.setItem("isHost", hostStatus ? "true" : "false");
      } catch {}
    })();
  }, [user?.uid]);

  useEffect(() => {
    const key = user?.uid ? `hostPoliciesAccepted:${user.uid}` : null;
    if (key) setPoliciesAccepted(localStorage.getItem(key) === "true");
  }, [user?.uid]);

  const handleHostClick = () => {
    if (isHost) navigate("/hostpage");
    else if (!policiesAccepted) setShowPoliciesModal(true);
    else setShowHostModal(true);
  };
  const handleAgreePolicies = () => {
    const key = user?.uid ? `hostPoliciesAccepted:${user.uid}` : null;
    if (key) localStorage.setItem(key, "true");
    setPoliciesAccepted(true);
    setShowPoliciesModal(false);
    setShowHostModal(true);
  };

  /* -------- main fetch with segmented try/catch -------- */
  useEffect(() => {
    (async () => {
      if (!user?.uid) { setLoading(false); return; }
      setLoading(true);
      setErrMsg("");

      const uid = user.uid;

      let baseBookingsDocs = [];
      let errorNotes = [];

      // 1) Base bookings
      try {
        const bookingsRef = collection(database, "bookings");
        const qUserBookings = query(bookingsRef, where("uid", "==", uid));
        const snap = await getDocs(qUserBookings);
        baseBookingsDocs = snap.docs;
        setTotalBookings(snap.size);

        // derived: nights, month buckets, YTD
        const now = new Date();
        const thisMonthStart = startOfMonth(now);
        const thisMonthEnd   = endOfMonth(now);
        const prevMonthDate  = new Date(now.getFullYear(), now.getMonth() - 1, 15);
        const lastMonthStart = startOfMonth(prevMonthDate);
        const lastMonthEnd   = endOfMonth(prevMonthDate);
        const yearStart      = startOfYear(now);
        const yearEnd        = endOfYear(now);

        let _nights = 0, _thisM = 0, _lastM = 0, _ytd = 0;

        baseBookingsDocs.forEach((d) => {
          const b = d.data() || {};
          const n = typeof b.nights === "number" ? b.nights : nightsBetween(b.checkIn, b.checkOut);
          _nights += Number.isFinite(n) ? n : 0;

          const createdMs = ms(b.createdAt);
          const coMs      = ms(b.checkOut);
          const inYear =
            (Number.isFinite(createdMs) && createdMs >= yearStart.getTime() && createdMs <= yearEnd.getTime()) ||
            (Number.isFinite(coMs)      && coMs      >= yearStart.getTime() && coMs      <= yearEnd.getTime());
          if (inYear && typeof b.totalPrice === "number") _ytd += b.totalPrice;

          const created = Number.isFinite(createdMs)
            ? new Date(createdMs)
            : (b?.schedule?.date ? new Date(`${b.schedule.date}T00:00:00`) : null);
          if (created) {
            if (created >= thisMonthStart && created <= thisMonthEnd) _thisM += 1;
            if (created >= lastMonthStart && created <= lastMonthEnd) _lastM += 1;
          }
        });

        setNightsBooked(_nights);
        setBookingsThisMonth(_thisM);
        setBookingsLastMonth(_lastM);
        setTotalSpentYTD(_ytd);
      } catch (e) {
        console.error("Bookings base error:", e);
        errorNotes.push(hintFromError("Bookings", e));
      }

      // 2) Recent bookings (ordered → fallback)
      try {
        const bookingsRef = collection(database, "bookings");
        const qRecent = query(
          bookingsRef,
          where("uid", "==", uid),
          orderBy("createdAt", "desc"),
          limit(6)
        );
        const rs = await getDocs(qRecent);
        setRecentBookings(await decorateRecent(rs.docs));
      } catch (e) {
        console.warn("Recent bookings ordered query failed, falling back:", e);
        errorNotes.push(hintFromError("Recent Bookings (ordered)", e, true));
        setRecentBookings(await decorateRecent(baseBookingsDocs.slice(0, 6)));
      }

      // 3) Favorites
      try {
        let count = 0;
        try {
          const favRef = collection(database, "users", uid, "favorites");
          const favSnap = await getDocs(favRef);
          count = favSnap.size;
        } catch {}
        if (count === 0) {
          const gFavRef = collection(database, "favorites");
          const gFavQ = query(gFavRef, where("userId", "==", uid));
          const gFavSnap = await getDocs(gFavQ);
          count = gFavSnap.size;
        }
        setSavedPlaces(count);
      } catch (e) {
        console.error("Favorites error:", e);
        errorNotes.push(hintFromError("Favorites", e));
      }

      // 4) Reviews given
      try {
        let rcount = 0;
        try {
          const uRevRef = collection(database, "users", uid, "reviews");
          const uRevSnap = await getDocs(uRevRef);
          rcount = uRevSnap.size;
        } catch {}
        if (rcount === 0) {
          const gRevRef = collection(database, "reviews");
          const gRevQ = query(gRevRef, where("guestUid", "==", uid));
          const gRevSnap = await getDocs(gRevQ);
          rcount = gRevSnap.size;
        }
        setReviewsGiven(rcount);
      } catch (e) {
        console.error("Reviews-given error:", e);
        errorNotes.push(hintFromError("Reviews Given", e));
      }

      // 5) POINTS — read top-level `points` (balance), then fallbacks
      try {
        let points = 0;

        // top-level points: latest by updatedAt
        try {
          const ptsRef = collection(database, "points");
          const ptsQ = query(ptsRef, where("uid", "==", uid));
          const ptsSnap = await getDocs(ptsQ);
          if (!ptsSnap.empty) {
            let latest = { updated: -Infinity, balance: 0 };
            ptsSnap.forEach((d) => {
              const v = d.data() || {};
              const updated = ms(v.updatedAt);
              const bal = Number(v.balance ?? 0);
              const scoreTime = Number.isFinite(updated) ? updated : 0;
              if (scoreTime > latest.updated) latest = { updated: scoreTime, balance: Number.isFinite(bal) ? bal : 0 };
            });
            if (Number.isFinite(latest.balance) && latest.balance > 0) {
              points = latest.balance;
            }
          }
        } catch (e) {
          console.warn("Top-level points fetch failed (non-fatal):", e);
        }

        // users/{uid}.points or users/{uid}.loyalty.points
        if (!Number.isFinite(points) || points === 0) {
          try {
            const uDoc = await getDoc(doc(database, "users", uid));
            if (uDoc.exists()) {
              const raw = uDoc.data();
              const direct = Number(raw?.points);
              const nested = Number(raw?.loyalty?.points);
              if (Number.isFinite(direct)) points = direct;
              else if (Number.isFinite(nested)) points = nested;
            }
          } catch {}
        }

        // users/{uid}/points ledger
        if (!Number.isFinite(points) || points === 0) {
          try {
            const ledgerRef = collection(database, "users", uid, "points");
            const ledgerSnap = await getDocs(ledgerRef);
            let sum = 0;
            ledgerSnap.forEach((d) => {
              const v = d.data();
              const add = Number(v?.points ?? v?.amount ?? 0);
              if (Number.isFinite(add)) sum += add;
            });
            if (sum > 0) points = sum;
          } catch {}
        }

        // bookings[].pointsEarned
        if (!Number.isFinite(points) || points === 0) {
          let sum = 0;
          baseBookingsDocs.forEach((d) => {
            const p = Number(d.data()?.pointsEarned ?? 0);
            if (Number.isFinite(p)) sum += p;
          });
          points = sum;
        }

        points = Number.isFinite(points) ? points : 0;
        setTotalPoints(points);
      } catch (e) {
        console.error("Points error:", e);
        errorNotes.push(hintFromError("Points", e));
      }

      // Summarize non-fatal notes
      setErrMsg(errorNotes.filter(Boolean).join(" • "));
      setLoading(false);
    })();

    // helpers
    async function decorateRecent(docs) {
      const raw = docs.map((d) => {
        const b = { id: d.id, ...d.data() };
        const title = b?.listing?.title || b?.listingTitle || "Untitled";
        const location = b?.listing?.location || b?.listingAddress || "—";
        const price = typeof b.totalPrice === "number" ? peso(b.totalPrice) : "—";
        const when =
          b?.checkIn && b?.checkOut
            ? fmtRangeCompact(b.checkIn, b.checkOut)
            : b?.schedule?.date
            ? (b.schedule?.time ? `${b.schedule.date} • ${b.schedule.time}` : b.schedule.date)
            : "—";
        const listingId = getListingIdFromBooking(b);
        const image =
          b?.listing?.photos?.[0] ||
          b?.listingPhotos?.[0] ||
          null;
        return { id: d.id, title, location, when, price, image, listingId };
      });

      // Ratings summary (best-effort)
      try {
        const ids = Array.from(new Set(raw.map(r => r.listingId).filter(Boolean)));
        if (ids.length === 0) return raw.map(x => ({ ...x, ratingAvg: 0, ratingCount: 0 }));

        // chunk to max 10
        const chunks = [];
        for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));

        let reviewDocs = [];
        for (const c of chunks) {
          const qRev = query(collection(database, "reviews"), where("listingId", "in", c));
          const snap = await getDocs(qRev);
          reviewDocs = reviewDocs.concat(snap.docs);
        }

        const acc = new Map();
        for (const r of reviewDocs) {
          const v = r.data();
          const lid = v?.listingId;
          const ratingNum = Number(v?.rating);
          if (!lid || !Number.isFinite(ratingNum)) continue;
          if (!acc.has(lid)) acc.set(lid, { sum: 0, count: 0 });
          const cur = acc.get(lid);
          cur.sum += ratingNum; cur.count += 1;
        }

        const avgMap = Object.fromEntries(
          Array.from(acc.entries()).map(([lid, { sum, count }]) => [lid, { avg: count ? sum / count : 0, count }])
        );

        return raw.map((item) => {
          const rs = item.listingId ? avgMap[item.listingId] : null;
          return { ...item, ratingAvg: rs?.avg || 0, ratingCount: rs?.count || 0 };
        });
      } catch (e) {
        console.warn("Ratings fetch failed (non-fatal):", e);
        return raw.map((x) => ({ ...x, ratingAvg: 0, ratingCount: 0 }));
      }
    }

    function hintFromError(section, e, silentFallback = false) {
      const code = e?.code || e?.name || "error";
      if (code === "failed-precondition") return `${section}: index needed (open Firestore error link to create).`;
      if (code === "permission-denied") return `${section}: permission denied (check Firestore Rules).`;
      return silentFallback ? "" : `${section}: ${code}`;
    }
  }, [user?.uid]);

  /* derived visuals */
  const trendPct = useMemo(() => {
    if (bookingsLastMonth === 0 && bookingsThisMonth === 0) return 0;
    if (bookingsLastMonth === 0) return 100;
    const diff = bookingsThisMonth - bookingsLastMonth;
    return Math.round((diff / bookingsLastMonth) * 100);
  }, [bookingsThisMonth, bookingsLastMonth]);

  const trendBarWidth = useMemo(() => {
    const base = Math.min(100, Math.max(0, bookingsThisMonth * 10));
    return `${base}%`;
  }, [bookingsThisMonth]);

  const stats = [
    { key: "bookings", label: "Total Bookings", value: loading ? "…" : String(totalBookings), icon: TrendingUp, color: "from-blue-400 to-blue-600" },
    { key: "nights",   label: "Nights Booked",  value: loading ? "…" : String(nightsBooked),   icon: TrendingUp, color: "from-cyan-400 to-blue-500" },
    { key: "saved",    label: "Saved Places",   value: loading ? "…" : String(savedPlaces),    icon: Heart,      color: "from-blue-500 to-indigo-600" },
    { key: "reviews",  label: "Reviews Given",  value: loading ? "…" : String(reviewsGiven),   icon: Star,       color: "from-indigo-400 to-blue-600" },
    {
      key: "points",
      label: "Total Points",
      value: loading ? "…" : Intl.NumberFormat().format(Math.max(0, Number(totalPoints) || 0)),
      icon: Coins,
      color: "from-violet-500 to-fuchsia-600",
    },
  ];

  /* -------- UI -------- */
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-hidden">
      <Sidebar onHostClick={handleHostClick} isHost={isHost} />

      <main className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ml-0 ${sidebarOpen ? "md:ml-72" : "md:ml-20"}`}>
        {/* Navbar */}
        <header className={`fixed top-0 right-0 z-30 bg-white text-gray-800 border-b border-gray-200 shadow-sm transition-all duration-300 left-0 ${sidebarOpen ? "md:left-72" : "md:left-20"}`}>
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
              <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => navigate("/dashboard")}>
                <BookifyLogo />
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
        <div className="px-6 md:px-28 py-8 space-y-8 overflow-y-auto">
          {/* Welcome */}
          <div className="glass rounded-4xl p-8 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-600/10 border-white/30 shadow-lg hover:shadow-xl transition-all">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-4xl font-bold text-foreground mb-2">
                  {loading ? "Loading…" : `Welcome back, ${firstName}! 👋`}
                </h1>
                <p className="text-muted-foreground text-lg">Ready to explore your next booking?</p>
                {errMsg && <p className="mt-3 text-sm text-amber-700">{errMsg}</p>}
              </div>

              <button
                type="button"
                onClick={() => navigate("/explore")}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-md font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 self-start md:self-auto md:ml-6"
                aria-label="Go to Explore"
              >
                <Compass size={20} />
                Explore
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {stats.map((stat) => (
              <div key={stat.key} className="glass rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all group">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}>
                  <stat.icon size={24} />
                </div>
                <p className="text-muted-foreground text-sm mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Recent Bookings */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Recent Bookings</h2>
              <button className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold" onClick={() => navigate("/bookings")}>
                View All <ChevronRight size={20} />
              </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="glass rounded-3xl overflow-hidden shadow-lg animate-pulse">
                    <div className="h-40 bg-slate-200/80" />
                    <div className="p-6 space-y-3">
                      <div className="h-6 bg-slate-200 rounded w-2/3" />
                      <div className="h-4 bg-slate-200 rounded w-1/2" />
                      <div className="h-4 bg-slate-200 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentBookings.length === 0 ? (
              <div className="glass rounded-3xl p-8 bg-white/70 border border-white/40 shadow text-center">
                <p className="text-muted-foreground">No recent bookings.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {recentBookings.map((b) => (
                  <div
                    key={b.id}
                    className="glass rounded-3xl overflow-hidden shadow-lg hover:shadow-xl transition-all group cursor-pointer hover:-translate-y-2"
                    onClick={() => navigate("/bookings")}
                  >
                    <div className="h-40 relative overflow-hidden bg-slate-200">
                      {b.image ? (
                        <img src={b.image} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-500" />
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    </div>
                    <div className="p-6">
                      <h3 className="font-bold text-lg text-foreground mb-1">{b.title}</h3>

                      {/* Rating summary */}
                      {b.ratingCount > 0 ? (
                        <div className="flex items-center gap-1.5 text-sm text-foreground mb-2">
                          <Star size={16} className="text-amber-500" />
                          <span className="font-semibold">{b.ratingAvg.toFixed(1)}</span>
                          <span className="text-muted-foreground">({b.ratingCount})</span>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground mb-2">No ratings yet</div>
                      )}

                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
                        <MapPin size={16} /> {b.location}
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">When</p>
                          <p className="font-semibold text-foreground">{b.when}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground mb-1">Total</p>
                          <p className="font-bold text-blue-600">{b.price}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass rounded-3xl p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 shadow-lg hover:shadow-xl transition-all">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-foreground">Booking Trends</h3>
                <TrendingUp className="text-blue-600" size={24} />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">This Month</span>
                  <span className="font-bold text-foreground">
                    {loading ? "…" : `${bookingsThisMonth} booking${bookingsThisMonth === 1 ? "" : "s"}`}
                  </span>
                </div>
                <div className="w-full bg-white/30 rounded-full h-2">
                  <div className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all" style={{ width: loading ? "0%" : trendBarWidth }} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {loading ? "Comparing with last month…" : `vs last month: ${trendPct > 0 ? "+" : ""}${trendPct}% (${bookingsLastMonth} last month)`}
                </p>
              </div>
            </div>

            <div className="glass rounded-3xl p-6 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 shadow-lg hover:shadow-xl transition-all">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-foreground">Total Spent</h3>
                <Coins className="text-indigo-600" size={24} />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Year to Date</span>
                  <span className="font-bold text-foreground text-xl">{loading ? "…" : peso(totalSpentYTD)}</span>
                </div>
                <p className="text-sm text-muted-foreground">* Based on your bookings in the current calendar year.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Host Modals */}
        {showPoliciesModal && <HostPoliciesModal onClose={() => setShowPoliciesModal(false)} onAgree={handleAgreePolicies} />}
        {showHostModal && <HostCategModal onClose={() => setShowHostModal(false)} onSelectCategory={() => setShowHostModal(false)} />}
      </main>
    </div>
  );
}
