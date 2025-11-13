// src/pages/admin/AdminDashboard.jsx
"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Home,
  Building2,
  CalendarDays,
  Coins,
  TrendingUp,
  Search,
  Download,
  AlertTriangle,
  Star,
  StarHalf,
  Sparkles,
  CheckCircle2,
  XCircle,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Menu,
} from "lucide-react";

import { auth, database } from "../../config/firebase";
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from "firebase/firestore";

import AdminSidebar from "./components/AdminSidebar.jsx";
import { useSidebar } from "../../context/SidebarContext";
import BookifyLogo from "../../components/bookify-logo.jsx";

/* ---------------- utils ---------------- */
const peso = (n) =>
  typeof n === "number"
    ? n.toLocaleString(undefined, {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 0,
      })
    : "₱—";

const toDate = (x) => (x?.toDate ? x.toDate() : new Date(x));
const isFiniteNum = (v) => Number.isFinite(Number(v));

const startOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
const endOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
const startOfYear = (d = new Date()) =>
  new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
const endOfYear = (d = new Date()) =>
  new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);

const addDays = (d, n) =>
  new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + n,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds()
  );

const inRange = (dt, min, max) => {
  if (!dt) return false;
  const t = dt.getTime?.() ?? new Date(dt).getTime();
  if (!Number.isFinite(t)) return false;
  return (!min || t >= min.getTime()) && (!max || t <= max.getTime());
};

const toCSV = (rows) => {
  if (!rows?.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const lines = [
    headers.map(esc).join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ];
  return lines.join("\n");
};

const downloadBlob = (content, filename, type = "text/csv;charset=utf-8;") => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const chunk = (arr, size = 10) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const clip = (str, n = 96) =>
  !str ? "" : String(str).length > n ? String(str).slice(0, n) + "…" : String(str);

const ADMIN_WALLET_ID = "admin";

/* ---------------- main component ---------------- */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const { sidebarOpen, setSidebarOpen } = useSidebar() || {};
  const sideOffset = sidebarOpen === false ? "md:ml-20" : "md:ml-72";

  // auth & guard
  const [user, setUser] = useState(() => auth.currentUser);
  const [isAdmin, setIsAdmin] = useState(null); // null = unknown, true = admin, false = not admin
  const [guardChecked, setGuardChecked] = useState(false);

  // ui
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  // filters
  const FILTERS = ["Last 30d", "This Month", "YTD", "All Time"];
  const [rangeKey, setRangeKey] = useState(FILTERS[0]);
  const [searchTerm, setSearchTerm] = useState("");

  // kpis
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalHosts, setTotalHosts] = useState(0); // from `hosts`
  const [totalListings, setTotalListings] = useState(0); // from `listings` (fixed)
  const [totalBookings, setTotalBookings] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);

  // tables
  const [recentBookings, setRecentBookings] = useState([]);

  // listings + rating sections
  const [topRated, setTopRated] = useState([]); // + ratingAvg, ratingCount
  const [needsLove, setNeedsLove] = useState([]); // + ratingAvg, ratingCount

  // hosts dataset for table
  const [hostsList, setHostsList] = useState([]);

  // refs for scrollable containers
  const needsLoveScrollRef = useRef(null);
  const topRatedScrollRef = useRef(null);

  // scroll functions for Needs Love section
  const scrollNeedsLoveLeft = () => {
    if (needsLoveScrollRef.current) {
      needsLoveScrollRef.current.scrollBy({ left: -400, behavior: "smooth" });
    }
  };

  const scrollNeedsLoveRight = () => {
    if (needsLoveScrollRef.current) {
      needsLoveScrollRef.current.scrollBy({ left: 400, behavior: "smooth" });
    }
  };

  // scroll functions for Top Rated section
  const scrollTopRatedLeft = () => {
    if (topRatedScrollRef.current) {
      topRatedScrollRef.current.scrollBy({ left: -400, behavior: "smooth" });
    }
  };

  const scrollTopRatedRight = () => {
    if (topRatedScrollRef.current) {
      topRatedScrollRef.current.scrollBy({ left: 400, behavior: "smooth" });
    }
  };

  /* auth watch */
  useEffect(() => auth.onAuthStateChanged((u) => setUser(u || null)), []);

  /* role guard */
  useEffect(() => {
    (async () => {
      try {
        if (!user?.uid) {
          setGuardChecked(true);
          return;
        }
        let ok = false;
        const token = await user.getIdTokenResult?.();
        if (token?.claims?.admin === true) ok = true;

        if (!ok) {
          const usersRef = collection(database, "users");
          const qUser = query(usersRef, where("uid", "==", user.uid));
          const snap = await getDocs(qUser);
          if (!snap.empty) {
            const ud = snap.docs[0].data();
            if (
              String(ud?.role).toLowerCase() === "admin" ||
              ud?.isAdmin === true
            )
              ok = true;
          }
        }

        setIsAdmin(ok);
        setGuardChecked(true);
      } catch (e) {
        console.error("Admin guard error:", e);
        setIsAdmin(false);
        setGuardChecked(true);
      }
    })();
  }, [user]);

  /* compute date bounds */
  const { minDate, maxDate, labelSuffix } = useMemo(() => {
    const now = new Date();
    switch (rangeKey) {
      case "Last 30d":
        return {
          minDate: addDays(now, -30),
          maxDate: now,
          labelSuffix: " (Last 30 days)",
        };
      case "This Month":
        return {
          minDate: startOfMonth(now),
          maxDate: endOfMonth(now),
          labelSuffix: " (This Month)",
        };
      case "YTD":
        return {
          minDate: startOfYear(now),
          maxDate: endOfYear(now),
          labelSuffix: " (YTD)",
        };
      default:
        return { minDate: null, maxDate: null, labelSuffix: "" };
    }
  }, [rangeKey]);

  /* data fetch — logic with hosts & listings fixes */
  useEffect(() => {
    (async () => {
      if (isAdmin !== true) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setErrMsg("");
      let notes = [];

      try {
        // USERS (count)
        try {
          const usersRef = collection(database, "users");
          const us = await getDocs(usersRef);
          let count = 0;
          us.forEach((d) => {
            const v = d.data() || {};
            const created =
              v?.createdAt?.toDate?.() ??
              (v?.createdAt ? new Date(v.createdAt) : null);
            // Count users created in date range (or all if no range)
            if (!minDate || inRange(created, minDate, maxDate)) count += 1;
          });
          setTotalUsers(count);
        } catch (e) {
          console.error("Users fetch error:", e);
          notes.push(hintFromError("Users", e));
        }

        // HOSTS (count + list for table)
        try {
          const hostsRef = collection(database, "hosts");
          const hs = await getDocs(hostsRef);
          let hostCount = 0;
          const rows = [];
          hs.forEach((d) => {
            const v = d.data() || {};
            const created =
              v?.createdAt?.toDate?.() ??
              (v?.createdAt ? new Date(v.createdAt) : null);
            // Count hosts created in date range (or all if no range)
            if (!minDate) {
              hostCount += 1;
            } else if (created && inRange(created, minDate, maxDate)) {
              hostCount += 1;
            }

            rows.push({
              id: v?.uid || d.id,
              name:
                v?.displayName ||
                [v?.firstName, v?.lastName].filter(Boolean).join(" ") ||
                "—",
              email: v?.email || "—",
              address: v?.address || "—",
              about: v?.about ? clip(v.about, 110) : "",
              photoURL: v?.photoURL || null,
              isVerified:
                v?.isVerified === true ||
                String(v?.isVerified).toLowerCase() === "true",
              createdAt: created ? created.toLocaleString() : "—",
              createdAtDate: created,
            });
          });
          rows.sort((a, b) => {
            const aDate = a.createdAtDate ? new Date(a.createdAtDate) : new Date(0);
            const bDate = b.createdAtDate ? new Date(b.createdAtDate) : new Date(0);
            return bDate.getTime() - aDate.getTime();
          });
          setTotalHosts(hostCount);
          setHostsList(rows.slice(0, 100)); // give the table more rows to fill space
        } catch (e) {
          console.error("Hosts fetch error:", e);
          notes.push(hintFromError("Hosts", e));
        }

        // LISTINGS (accurate KPI from 'listings')
        let listingRows = [];
        try {
          const listingsRef = collection(database, "listings");
          const ls = await getDocs(listingsRef);

          // Some listing docs use different timestamp fields (createdAt, publishedAt, savedAt).
          // Prefer createdAt but fall back to publishedAt/savedAt to avoid missing listings
          // when computing date-range KPIs.
          const extractCreated = (v) => {
            if (!v) return null;
            return (
              v?.createdAt?.toDate?.() ??
              v?.publishedAt?.toDate?.() ??
              v?.savedAt?.toDate?.() ??
              (v?.createdAt ? new Date(v.createdAt) : null) ??
              (v?.publishedAt ? new Date(v.publishedAt) : null) ??
              (v?.savedAt ? new Date(v.savedAt) : null) ??
              null
            );
          };

          let count;
          if (!minDate) {
            count = ls.size; // All Time -> total docs
          } else {
            let c = 0;
            ls.forEach((d) => {
              const v = d.data() || {};
              const created = extractCreated(v);
              if (created && inRange(created, minDate, maxDate)) c += 1;
            });
            count = c;
          }

          // First pass: collect rows and host uids we need to resolve
          const hostUids = new Set();
          ls.forEach((d) => {
            const v = d.data() || {};
            const created = extractCreated(v);
            const hostUid = v?.uid || v?.hostId || v?.ownerId || v?.host?.uid || null;
            if (hostUid) hostUids.add(hostUid);

            // Extract location from various possible fields
            let location = v?.location || v?.address || v?.municipality?.name || v?.province?.name || "";
            if (!location) {
              // Fallback for experiences/services
              if (v?.category?.toLowerCase() === "experiences" || v?.category?.toLowerCase() === "services") {
                location = v?.experienceType || v?.locationType || "";
              } else {
                location = v?.locationType || "";
              }
            }

            listingRows.push({
              id: d.id,
              title: v?.title || "Untitled",
              cover: v?.photos?.[0] || v?.coverUrl || null,
              hostUid,
              // prefer explicit hostName if included on the listing doc
              hostName: v?.hostName || v?.host?.name || "",
              description: v?.description || "",
              location: location || "—",
              price: v?.price ?? null,
              createdAt: created,
            });
          });

          // Resolve host names for any missing hostName values by querying `hosts` collection
          const hostUidList = Array.from(hostUids).filter(Boolean);
          if (hostUidList.length) {
            const hostMap = new Map(); // uid -> display name
            const batches = chunk(hostUidList, 10);
            for (const b of batches) {
              const qHosts = query(collection(database, "hosts"), where("uid", "in", b));
              const hs = await getDocs(qHosts);
              hs.forEach((hDoc) => {
                const hv = hDoc.data() || {};
                const name = hv?.displayName || [hv?.firstName, hv?.lastName].filter(Boolean).join(" ") || null;
                if (name) hostMap.set(hv?.uid || hDoc.id, name);
              });
            }

            // Fill listingRows hostName where missing
            listingRows = listingRows.map((L) => ({
              ...L,
              hostName: L.hostName || hostMap.get(L.hostUid) || "—",
            }));
          } else {
            // ensure hostName fallback is at least a dash
            listingRows = listingRows.map((L) => ({ ...L, hostName: L.hostName || "—" }));
          }
          setTotalListings(Number.isFinite(count) ? count : 0);
        } catch (e) {
          console.error("Listings fetch error:", e);
          notes.push(hintFromError("Listings", e));
        }

        // BOOKINGS
        try {
          const bookingsRef = collection(database, "bookings");
          const bs = await getDocs(bookingsRef);
          let bCount = 0;
          const _recentBookings = [];
          bs.forEach((d) => {
            const v = d.data() || {};
            const ts =
              v?.createdAt?.toDate?.() ??
              (v?.createdAt ? new Date(v.createdAt) : null);
            const inScope = !minDate || inRange(ts, minDate, maxDate);
            
            // Only count paid/confirmed bookings for KPIs
            const paymentStatus = (v?.paymentStatus || "").toLowerCase();
            const status = (v?.status || "").toLowerCase();
            const isPaidOrConfirmed = 
              paymentStatus === "paid" || 
              status === "confirmed" || 
              (status === "pending" && paymentStatus === "paid");
            
            if (inScope && isPaidOrConfirmed) {
              bCount += 1;
            }
            
            _recentBookings.push({
              id: d.id,
              guest: v?.guestName || v?.guest?.name || "—",
              listing: v?.listing?.title || v?.listingTitle || "—",
              listingId: v?.listingId || null,
              category: v?.listingCategory || v?.listing?.category || "Uncategorized",
              when:
                v?.checkIn && v?.checkOut
                  ? `${toDate(v.checkIn).toLocaleDateString()}–${toDate(
                      v.checkOut
                    ).toLocaleDateString()}`
                  : v?.schedule?.date || "—",
              total: isFiniteNum(v?.totalPrice)
                ? peso(Number(v?.totalPrice))
                : "—",
              totalPrice: Number(v?.totalPrice || 0),
              status: (v?.status || "pending").toLowerCase(),
              paymentStatus: (v?.paymentStatus || "pending").toLowerCase(),
              createdAt: ts ? ts.toLocaleString() : "—",
              createdAtDate: ts,
            });
          });
          _recentBookings.sort(
            (a, b) => {
              const aDate = a.createdAtDate ? new Date(a.createdAtDate) : new Date(0);
              const bDate = b.createdAtDate ? new Date(b.createdAtDate) : new Date(0);
              return bDate.getTime() - aDate.getTime();
            }
          );
          setRecentBookings(_recentBookings.slice(0, 10));
          setTotalBookings(bCount);
        } catch (e) {
          console.error("Bookings fetch error:", e);
          notes.push(hintFromError("Bookings", e));
        }

        // RATINGS (from `reviews`, aggregated by listingId)
        try {
          const ids = Array.from(new Set(listingRows.map((x) => x.id))).filter(
            Boolean
          );
          if (ids.length) {
            const acc = new Map(); // lid -> { sum, count }
            const batches = chunk(ids, 10);
            for (const c of batches) {
              const qRev = query(
                collection(database, "reviews"),
                where("listingId", "in", c)
              );
              const rs = await getDocs(qRev);
              rs.forEach((d) => {
                const v = d.data() || {};
                const lid = v?.listingId;
                const ratingNum = Number(v?.rating);
                if (!lid || !Number.isFinite(ratingNum)) return;
                if (!acc.has(lid)) acc.set(lid, { sum: 0, count: 0 });
                const cur = acc.get(lid);
                cur.sum += ratingNum;
                cur.count += 1;
              });
            }

            const withRatings = listingRows.map((L) => {
              const r = acc.get(L.id) || { sum: 0, count: 0 };
              const count = r.count;
              const avg = count ? r.sum / count : 0;
              return { ...L, ratingAvg: avg, ratingCount: count };
            });

            const TOP_MIN_AVG = 4.5;
            const TOP_MIN_COUNT = 5;

            let top = withRatings
              .filter(
                (x) => x.ratingAvg >= TOP_MIN_AVG && x.ratingCount >= TOP_MIN_COUNT
              )
              .sort((a, b) =>
                b.ratingAvg === a.ratingAvg
                  ? b.ratingCount - a.ratingCount
                  : b.ratingAvg - a.ratingAvg
              )
              .slice(0, 9);

            if (top.length === 0) {
              const haveAny = withRatings.filter((x) => x.ratingCount > 0);
              top = haveAny
                .sort((a, b) =>
                  b.ratingAvg === a.ratingAvg
                    ? b.ratingCount - a.ratingCount
                    : b.ratingAvg - a.ratingAvg
                )
                .slice(0, 9);
            }

            const low = withRatings
              .filter((x) => (x.ratingCount || 0) <= 2 && (x.ratingAvg || 0) <= 2)
              .sort((a, b) => {
                // Sort by rating count first (fewest first), then by average rating (lowest first)
                const countDiff = (a.ratingCount || 0) - (b.ratingCount || 0);
                if (countDiff !== 0) return countDiff;
                return (a.ratingAvg || 0) - (b.ratingAvg || 0);
              })
              .slice(0, 9);

            setTopRated(top);
            setNeedsLove(low);
          } else {
            setTopRated([]);
            setNeedsLove([]);
          }
        } catch (e) {
          console.warn("Ratings aggregation failed (non-fatal):", e);
          setTopRated([]);
          setNeedsLove([]);
        }

        setErrMsg(notes.filter(Boolean).join(" • "));
      } catch (e) {
        console.error(e);
        setErrMsg("Failed to load admin dashboard.");
      } finally {
        setLoading(false);
      }
    })();

    function hintFromError(section, e) {
      const code = e?.code || e?.name || "error";
      if (code === "failed-precondition")
        return `${section}: index needed (open Firestore error link).`;
      if (code === "permission-denied")
        return `${section}: permission denied (check Firestore Rules).`;
      return `${section}: ${code}`;
    }
  }, [isAdmin, rangeKey, minDate, maxDate]);

  // Fetch admin wallet balance for total revenue (real-time)
  useEffect(() => {
    if (isAdmin !== true) return;
    
    const wref = doc(database, "wallets", ADMIN_WALLET_ID);
    
    // Initial fetch
    getDoc(wref).then((snap) => {
      const data = snap.data() || { balance: 0 };
      setTotalRevenue(Number(data.balance || 0));
    }).catch((e) => {
      console.error("Admin wallet fetch error:", e);
      setTotalRevenue(0);
    });
    
    // Real-time updates
    const unsub = onSnapshot(wref, (snap) => {
      const data = snap.data() || { balance: 0 };
      setTotalRevenue(Number(data.balance || 0));
    }, (e) => {
      console.error("Admin wallet snapshot error:", e);
    });
    
    return unsub;
  }, [isAdmin]);

  const adminName =
    user?.displayName?.split(" ")?.[0] || user?.email || "Admin";

  const filteredBookings = useMemo(() => {
    if (!searchTerm) return recentBookings;
    const t = searchTerm.toLowerCase();
    return recentBookings.filter(
      (r) =>
        (r.guest || "").toLowerCase().includes(t) ||
        (r.listing || "").toLowerCase().includes(t) ||
        (r.id || "").toLowerCase().includes(t)
    );
  }, [recentBookings, searchTerm]);

  const filteredHosts = useMemo(() => {
    if (!searchTerm) return hostsList;
    const t = searchTerm.toLowerCase();
    return hostsList.filter(
      (h) =>
        (h.name || "").toLowerCase().includes(t) ||
        (h.email || "").toLowerCase().includes(t) ||
        (h.address || "").toLowerCase().includes(t) ||
        (h.id || "").toLowerCase().includes(t)
    );
  }, [hostsList, searchTerm]);


  const exportBookingsCSV = () => {
    const csv = toCSV(filteredBookings);
    downloadBlob(csv, `bookings${labelSuffix.replace(/\s|\(|\)/g, "_")}.csv`);
  };

  const exportHostsCSV = () => {
    const csv = toCSV(
      filteredHosts.map((h) => ({
        id: h.id,
        name: h.name,
        email: h.email,
        address: h.address,
        isVerified: h.isVerified ? "true" : "false",
        createdAt: h.createdAt,
      }))
    );
    downloadBlob(csv, `hosts${labelSuffix.replace(/\s|\(|\)/g, "_")}.csv`);
  };

  /* ------------ guard states ------------- */
  // Show loading while checking authorization
  if (!guardChecked) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full border-4 border-gray-200 border-t-blue-500 animate-spin mb-4" />
          <p className="text-gray-600">Checking admin access…</p>
        </div>
      </div>
    );
  }

  // Only show "Not authorized" if guard is checked AND we have a user AND they're explicitly not admin (false, not null)
  // This prevents showing the message during the brief moment when guardChecked is true but isAdmin is still null
  if (guardChecked && user && isAdmin === false) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50 p-6">
        <div className="max-w-md w-full rounded-3xl p-8 text-center bg-white border border-slate-200 shadow-sm">
          <AlertTriangle className="mx-auto text-amber-500 mb-3" size={36} />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Not authorized</h2>
          <p className="text-gray-600 mb-6">
            You need admin privileges to access this page.
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-5 py-2.5 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // If guard is checked but no user, or if isAdmin is still null (checking), show loading
  if (guardChecked && (!user || isAdmin === null)) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full border-4 border-gray-200 border-t-blue-500 animate-spin mb-4" />
          <p className="text-gray-600">Loading…</p>
        </div>
      </div>
    );
  }

  /* -------------- UI (theme aligned with /Dashboard.jsx) --------------- */
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-hidden">
      <AdminSidebar />

      {/* Content area wrapper */}
      <div className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ${sideOffset}`}>
        {/* Top bar — sticky */}
        <header className="fixed top-0 right-0 z-30 bg-white text-gray-800 border-b border-gray-200 shadow-sm transition-all duration-300 left-0">
          <div className="max-w-7xl mx-auto flex items-center justify-between px-3 sm:px-4 md:px-8 py-2.5 sm:py-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                aria-expanded={sidebarOpen}
              >
                <Menu size={22} />
              </button>
              <div className="flex items-center gap-1.5 sm:gap-2 cursor-pointer select-none" onClick={() => navigate("/admin-dashboard")}>
                <BookifyLogo />
                <span className="hidden sm:inline font-semibold text-gray-800 text-sm sm:text-base">Dashboard</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <select
                className="h-9 sm:h-11 rounded-xl sm:rounded-2xl border border-slate-200 bg-white/80 px-2 sm:px-3 text-xs sm:text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 min-w-[100px] sm:min-w-[150px] max-w-full"
                value={rangeKey}
                onChange={(e) => setRangeKey(e.target.value)}
              >
                {FILTERS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>

              <button
                onClick={() => navigate("/explore")}
                className="inline-flex h-9 sm:h-11 items-center justify-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl bg-blue-600 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 whitespace-nowrap flex-shrink-0"
              >
                <TrendingUp size={14} className="sm:w-[17px] sm:h-[17px] flex-shrink-0" /> <span className="hidden sm:inline">Marketplace</span>
              </button>
            </div>
          </div>
        </header>

        {/* Spacer */}
        <div className="h-[56px] md:h-[56px]" />

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0">
        <div className="px-3 sm:px-6 md:px-28 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 lg:space-y-8 overflow-y-auto">
          {/* Welcome / hero */}
          <div className="glass rounded-4xl p-3 sm:p-4 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-600/10 border-white/30 shadow-lg hover:shadow-xl transition-all">
            <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 lg:p-8 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3 sm:space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-2.5 sm:px-3 py-1 text-xs font-semibold text-blue-700">
                  <Sparkles size={12} className="sm:w-[14px] sm:h-[14px]" /> <span className="hidden xs:inline">Overview{labelSuffix}</span><span className="xs:hidden">Overview</span>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-1 sm:mb-2">
                    {loading ? "Loading…" : `Welcome back, ${adminName}! 👋`}
                  </h2>
                  {errMsg ? (
                    <p className="text-xs sm:text-sm text-amber-700">{errMsg}</p>
                  ) : (
                    <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
                      Keep an eye on bookings, revenue, and host performance with a refreshed dashboard experience.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={() => navigate("/admin/bookings")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700 hover:shadow-md"
                >
                  <CalendarDays size={14} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Manage Bookings</span><span className="sm:hidden">Bookings</span>
                </button>
                <button
                  onClick={() => navigate("/admin/listings")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-blue-600 px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  <Home size={14} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Manage Listings</span><span className="sm:hidden">Listings</span>
                </button>
              </div>
            </div>
            {!loading && (
              <div className="border-t border-slate-100 bg-slate-50/60 px-3 sm:px-6 py-3 sm:py-4 w-full rounded-xl overflow-x-auto">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-slate-200 bg-white px-2 sm:px-3 py-1 sm:py-1.5 shadow-sm whitespace-nowrap">
                    <Users size={12} className="sm:w-[14px] sm:h-[14px] text-blue-600 flex-shrink-0" />
                    <span className="font-semibold text-slate-800 text-xs sm:text-sm">
                      {totalUsers.toLocaleString()}
                    </span>
                    <span className="uppercase tracking-wide text-[10px] sm:text-[11px] text-slate-500 hidden xs:inline">
                      Users
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-slate-200 bg-white px-2 sm:px-3 py-1 sm:py-1.5 shadow-sm whitespace-nowrap">
                    <Building2 size={12} className="sm:w-[14px] sm:h-[14px] text-violet-600 flex-shrink-0" />
                    <span className="font-semibold text-slate-800 text-xs sm:text-sm">
                      {totalHosts.toLocaleString()}
                    </span>
                    <span className="uppercase tracking-wide text-[10px] sm:text-[11px] text-slate-500 hidden xs:inline">
                      Hosts
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-slate-200 bg-white px-2 sm:px-3 py-1 sm:py-1.5 shadow-sm whitespace-nowrap">
                    <Home size={12} className="sm:w-[14px] sm:h-[14px] text-emerald-600 flex-shrink-0" />
                    <span className="font-semibold text-slate-800 text-xs sm:text-sm">
                      {totalListings.toLocaleString()}
                    </span>
                    <span className="uppercase tracking-wide text-[10px] sm:text-[11px] text-slate-500 hidden xs:inline">
                      Listings
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-slate-200 bg-white px-2 sm:px-3 py-1 sm:py-1.5 shadow-sm whitespace-nowrap">
                    <CalendarDays size={12} className="sm:w-[14px] sm:h-[14px] text-amber-600 flex-shrink-0" />
                    <span className="font-semibold text-slate-800 text-xs sm:text-sm">
                      {totalBookings.toLocaleString()}
                    </span>
                    <span className="uppercase tracking-wide text-[10px] sm:text-[11px] text-slate-500 hidden xs:inline">
                      Bookings
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-slate-200 bg-white px-2 sm:px-3 py-1 sm:py-1.5 shadow-sm whitespace-nowrap">
                    <Coins size={12} className="sm:w-[14px] sm:h-[14px] text-indigo-600 flex-shrink-0" />
                    <span className="font-semibold text-slate-800 text-xs sm:text-sm">
                      {peso(totalRevenue)}
                    </span>
                    <span className="uppercase tracking-wide text-[10px] sm:text-[11px] text-slate-500 hidden xs:inline">
                      Revenue
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* KPI grid */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
            <KPI
              loading={loading}
              icon={Users}
              label={`Users${labelSuffix}`}
              value={totalUsers}
              color="from-sky-400 to-blue-600"
            />
            <KPI
              loading={loading}
              icon={Building2}
              label={`Hosts${labelSuffix}`}
              value={totalHosts}
              color="from-violet-400 to-fuchsia-500"
            />
            <KPI
              loading={loading}
              icon={Home}
              label={`Listings${labelSuffix}`}
              value={totalListings}
              color="from-emerald-400 to-teal-500"
            />
            <KPI
              loading={loading}
              icon={CalendarDays}
              label={`Bookings${labelSuffix}`}
              value={totalBookings}
              color="from-amber-400 to-orange-500"
            />
            <KPI
              loading={loading}
              icon={Coins}
              label={`Revenue${labelSuffix}`}
              value={peso(totalRevenue)}
              color="from-indigo-400 to-blue-500"
            />
          </section>

          {/* Ratings highlight sections */}
          <section className="grid grid-cols-1 gap-6">
            {/* Top-Rated */}
            <div className="glass rounded-3xl border border-white/40 bg-white/80 shadow-lg">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-200/70 px-4 sm:px-6 py-4 sm:py-5">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="grid h-9 w-9 sm:h-11 sm:w-11 place-items-center rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm flex-shrink-0">
                    <Star size={16} className="sm:w-[18px] sm:h-[18px]" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-foreground">
                      Top-Rated Listings
                    </h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
                      Avg ≥ 4.5 with ≥ 5 reviews (fallback shows highest-rated)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {topRated.length > 0 && (
                    <>
                      <button
                        onClick={scrollTopRatedLeft}
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        aria-label="Scroll left"
                      >
                        <ChevronLeft size={16} className="sm:w-[18px] sm:h-[18px]" />
                      </button>
                      <button
                        onClick={scrollTopRatedRight}
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        aria-label="Scroll right"
                      >
                        <ChevronRight size={16} className="sm:w-[18px] sm:h-[18px]" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => navigate("/admin/listings")}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    Manage
                  </button>
                </div>
              </div>

              {loading ? (
                <CardRowSkeleton />
              ) : topRated.length === 0 ? (
                <EmptyState text="No ratings yet." />
              ) : (
                <div className="px-3 sm:px-6 py-4 sm:py-6">
                  <div
                    ref={topRatedScrollRef}
                    className="flex gap-5 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden"
                    style={{
                      scrollbarWidth: "none",
                      msOverflowStyle: "none",
                    }}
                  >
                    {topRated.map((l) => (
                      <div key={l.id} className="flex-shrink-0 w-[320px]">
                        <ListingCard data={l} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Needs Love */}
            <div className="glass rounded-3xl border border-white/40 bg-white/80 shadow-lg">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-200/70 px-4 sm:px-6 py-4 sm:py-5">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="grid h-9 w-9 sm:h-11 sm:w-11 place-items-center rounded-lg sm:rounded-xl bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-sm flex-shrink-0">
                    <StarHalf size={16} className="sm:w-[18px] sm:h-[18px]" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-foreground">
                      Needs Love
                    </h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
                      Listings with little to no ratings
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {needsLove.length > 0 && (
                    <>
                      <button
                        onClick={scrollNeedsLoveLeft}
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        aria-label="Scroll left"
                      >
                        <ChevronLeft size={16} className="sm:w-[18px] sm:h-[18px]" />
                      </button>
                      <button
                        onClick={scrollNeedsLoveRight}
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        aria-label="Scroll right"
                      >
                        <ChevronRight size={16} className="sm:w-[18px] sm:h-[18px]" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => navigate("/admin/listings")}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    Manage
                  </button>
                </div>
              </div>

              {loading ? (
                <CardRowSkeleton />
              ) : needsLove.length === 0 ? (
                <EmptyState text="All listings have sufficient feedback." />
              ) : (
                <div className="px-3 sm:px-6 py-4 sm:py-6">
                  <div
                    ref={needsLoveScrollRef}
                    className="flex gap-5 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden"
                    style={{
                      scrollbarWidth: "none",
                      msOverflowStyle: "none",
                    }}
                  >
                    {needsLove.map((l) => (
                      <div key={l.id} className="flex-shrink-0 w-[320px]">
                        <ListingCard data={l} muted />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Data: Bookings + Hosts TABLE (replaces Hosts cards) */}
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
            {/* Bookings table */}
            <div className="glass rounded-2xl sm:rounded-3xl border border-white/40 bg-white/80 shadow-lg">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-200/70 px-4 sm:px-6 py-4 sm:py-5">
                <h3 className="text-base sm:text-lg font-semibold text-foreground">
                  Recent Bookings
                </h3>
                <div className="flex items-center gap-2 text-xs sm:text-sm self-end sm:self-auto">
                  <button
                    onClick={exportBookingsCSV}
                    className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-slate-200 px-2.5 sm:px-3 py-1.5 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <Download size={14} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">CSV</span>
                  </button>
                  <button
                    onClick={() => navigate("/admin/bookings")}
                    className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-blue-600 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    Manage
                  </button>
                </div>
              </div>

              {loading ? (
                <TableSkeleton rows={8} />
              ) : filteredBookings.length === 0 ? (
                <EmptyState text="No bookings found." />
              ) : (
                <div className="overflow-x-auto overflow-y-auto max-h-[60vh] sm:max-h-none px-3 sm:px-6 pb-4 sm:pb-6 sm:-mx-3 sm:mx-0" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50/80 text-left text-slate-500">
                        <th className="py-2 sm:py-3 pr-2 sm:pr-4 font-semibold text-[10px] sm:text-xs">ID</th>
                        <th className="py-2 sm:py-3 pr-2 sm:pr-4 font-semibold text-[10px] sm:text-xs">Guest</th>
                        <th className="py-2 sm:py-3 pr-2 sm:pr-4 font-semibold text-[10px] sm:text-xs hidden sm:table-cell">Listing</th>
                        <th className="py-2 sm:py-3 pr-2 sm:pr-4 font-semibold text-[10px] sm:text-xs hidden md:table-cell">When</th>
                        <th className="py-2 sm:py-3 pr-2 sm:pr-4 font-semibold text-[10px] sm:text-xs">Status</th>
                        <th className="py-2 sm:py-3 pr-2 sm:pr-4 font-semibold text-[10px] sm:text-xs hidden lg:table-cell">Payment</th>
                        <th className="py-2 sm:py-3 pr-0 sm:pr-0 text-right font-semibold text-[10px] sm:text-xs">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBookings.map((r) => (
                        <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/40">
                          <td className="py-2 sm:py-3 pr-2 sm:pr-4 font-mono text-[10px] sm:text-xs text-slate-500">
                            {r.id.slice(0, 6)}…
                          </td>
                          <td className="py-2 sm:py-3 pr-2 sm:pr-4 text-slate-700 text-[10px] sm:text-xs truncate max-w-[80px] sm:max-w-none">{r.guest}</td>
                          <td className="py-2 sm:py-3 pr-2 sm:pr-4 text-slate-700 text-[10px] sm:text-xs hidden sm:table-cell truncate max-w-[120px]">{r.listing}</td>
                          <td className="py-2 sm:py-3 pr-2 sm:pr-4 text-[10px] sm:text-xs text-slate-500 hidden md:table-cell">{r.when}</td>
                          <td className="py-2 sm:py-3 pr-2 sm:pr-4">
                            <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-medium ${
                              r.status?.toLowerCase() === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                              r.status?.toLowerCase() === 'pending' ? 'bg-amber-100 text-amber-700' :
                              r.status?.toLowerCase() === 'cancelled' ? 'bg-red-100 text-red-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {r.status || '—'}
                            </span>
                          </td>
                          <td className="py-2 sm:py-3 pr-2 sm:pr-4 hidden lg:table-cell">
                            <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-medium ${
                              r.paymentStatus?.toLowerCase() === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                              r.paymentStatus?.toLowerCase() === 'pending' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {r.paymentStatus || '—'}
                            </span>
                          </td>
                          <td className="py-2 sm:py-3 pr-0 sm:pr-0 text-right font-semibold text-slate-800 text-[10px] sm:text-xs">{r.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Hosts TABLE */}
            <div className="glass rounded-2xl sm:rounded-3xl border border-white/40 bg-white/80 shadow-lg">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-200/70 px-4 sm:px-6 py-4 sm:py-5">
                <div className="flex items-center gap-2">
                  <Building2 className="text-violet-600 w-[18px] h-[18px] sm:w-5 sm:h-5" />
                  <h3 className="text-base sm:text-lg font-semibold text-foreground">
                    Hosts
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm self-end sm:self-auto">
                  <button
                    onClick={exportHostsCSV}
                    className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-slate-200 px-2.5 sm:px-3 py-1.5 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <Download size={14} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">CSV</span>
                  </button>
                  <button
                    onClick={() => navigate("/admin/hosts")}
                    className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-blue-600 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    Manage
                  </button>
                </div>
              </div>

              {loading ? (
                <TableSkeleton rows={8} />
              ) : filteredHosts.length === 0 ? (
                <EmptyState text="No hosts found." />
              ) : (
                <div className="overflow-x-auto overflow-y-auto max-h-[60vh] sm:max-h-none px-3 sm:px-6 pb-4 sm:pb-6 sm:-mx-3 sm:mx-0" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50/80 text-left text-slate-500">
                        <th className="py-2 sm:py-3 pr-2 sm:pr-4 font-semibold text-[10px] sm:text-xs">Name</th>
                        <th className="py-2 sm:py-3 pr-2 sm:pr-4 font-semibold text-[10px] sm:text-xs hidden sm:table-cell">Email</th>
                        <th className="py-2 sm:py-3 pr-2 sm:pr-4 font-semibold text-[10px] sm:text-xs hidden md:table-cell">Address</th>
                        <th className="py-2 sm:py-3 pr-2 sm:pr-4 font-semibold text-[10px] sm:text-xs">Verified</th>
                        <th className="py-2 sm:py-3 pr-0 sm:pr-0 font-semibold text-[10px] sm:text-xs hidden lg:table-cell">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHosts.map((h) => (
                        <tr key={h.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/40">
                          <td className="py-2 sm:py-3 pr-2 sm:pr-4">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <div className="h-6 w-6 sm:h-8 sm:w-8 overflow-hidden rounded-md sm:rounded-lg bg-slate-100 flex-shrink-0">
                                {h.photoURL ? (
                                  <img
                                    src={h.photoURL}
                                    alt={h.name}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="h-full w-full bg-gradient-to-br from-slate-200 to-slate-300" />
                                )}
                              </div>
                              <span className="font-medium text-slate-800 text-[10px] sm:text-xs truncate max-w-[100px] sm:max-w-none">
                                {h.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 sm:py-3 pr-2 sm:pr-4 text-slate-700 text-[10px] sm:text-xs hidden sm:table-cell truncate max-w-[120px]">{h.email}</td>
                          <td className="py-2 sm:py-3 pr-2 sm:pr-4 text-slate-700 text-[10px] sm:text-xs hidden md:table-cell truncate max-w-[150px]">{h.address}</td>
                          <td className="py-2 sm:py-3 pr-2 sm:pr-4">
                            {h.isVerified ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-emerald-700">
                                <CheckCircle2 size={12} className="sm:w-[14px] sm:h-[14px]" /> <span className="hidden sm:inline">Yes</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-slate-600">
                                <XCircle size={12} className="sm:w-[14px] sm:h-[14px]" /> <span className="hidden sm:inline">No</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2 sm:py-3 pr-0 sm:pr-0 text-[10px] sm:text-xs text-slate-500 hidden lg:table-cell">{h.createdAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
      </div>
    </div>
  );
}

/* ---------------- components ---------------- */
function KPI({ loading, icon: Icon, label, value, color }) {
  return (
    <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all group">
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-white mb-3 sm:mb-4 group-hover:scale-110 transition-transform`}>
        <Icon size={20} className="sm:w-6 sm:h-6" />
      </div>
      <p className="text-muted-foreground text-xs sm:text-sm mb-1">{label}</p>
      {loading ? (
        <div className="h-6 sm:h-7 w-20 sm:w-24 animate-pulse rounded bg-slate-100" />
      ) : (
        <p className="text-2xl sm:text-3xl font-bold text-foreground">{value}</p>
      )}
    </div>
  );
}

function TableSkeleton({ rows = 6 }) {
  return (
    <div className="space-y-2 px-6 pb-6">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-10 w-full animate-pulse rounded-xl bg-slate-100/80"
        />
      ))}
    </div>
  );
}

function CardRowSkeleton({ cards = 9 }) {
  return (
    <div className="px-6 py-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="h-28 animate-pulse bg-slate-100/70" />
          <div className="p-4 space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100/80" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100/80" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100/80" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="px-6 py-8">
      <div className="glass rounded-3xl p-8 bg-white/70 border border-white/40 shadow text-center text-muted-foreground">
        {text}
      </div>
    </div>
  );
}

function ListingCard({ data, muted = false }) {
  const { id, title, cover, hostName, ratingAvg = 0, ratingCount = 0, description, location, price } = data;
  const badge =
    ratingCount >= 5 && ratingAvg >= 4.5
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <div className="glass rounded-3xl overflow-hidden border border-white/40 bg-white/80 shadow-lg hover:shadow-xl transition-all group cursor-pointer hover:-translate-y-2">
      <div className="h-40 relative overflow-hidden bg-slate-200">
        {cover ? (
          <>
            <img
              src={cover}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-500" />
        )}
        <div className="absolute top-3 right-3">
          <span
            className={`px-2 py-1 text-xs rounded-full border ${badge} inline-flex items-center gap-1`}
            title={ratingCount ? `${ratingAvg.toFixed(2)} average` : "No ratings yet"}
          >
            <Star size={14} /> {ratingCount ? ratingAvg.toFixed(1) : "—"}{" "}
            <span className="opacity-70">({ratingCount})</span>
          </span>
        </div>
      </div>
      <div className="p-6">
        <h4
          className={`font-bold text-lg ${
            muted ? "text-slate-700" : "text-foreground"
          } line-clamp-1 mb-1`}
        >
          {title}
        </h4>
        {ratingCount > 0 ? (
          <div className="flex items-center gap-1.5 text-sm text-foreground mb-2">
            <Star size={16} className="text-amber-500" />
            <span className="font-semibold">{ratingAvg.toFixed(1)}</span>
            <span className="text-muted-foreground">({ratingCount})</span>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground mb-2">No ratings yet</div>
        )}
        <p className="mt-1 text-xs text-muted-foreground line-clamp-1 mb-2">
          Host: {hostName}
        </p>
        {description && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2 mb-2">
            {description}
          </p>
        )}
        <div className="mt-2 flex flex-col gap-1.5 mb-4">
          {location && location !== "—" && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <MapPin size={16} className="flex-shrink-0" />
              <span className="line-clamp-1">{location}</span>
            </div>
          )}
          {price != null && Number.isFinite(Number(price)) && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Coins size={12} className="text-amber-600 flex-shrink-0" />
                <span className="text-xs text-muted-foreground">Price</span>
              </div>
              <span className="font-bold text-blue-600">
                {peso(Number(price))}
              </span>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            onClick={() => window.open(`/homes/${id}`, "_self")}
          >
            View
          </button>
          <button
            className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
            onClick={() => window.open(`/admin/listings?focus=${id}`, "_self")}
          >
            Manage
          </button>
        </div>
      </div>
    </div>
  );
}
