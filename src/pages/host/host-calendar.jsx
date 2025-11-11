// src/pages/host/calendar/HostCalendar.jsx
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { database, auth } from "../../config/firebase";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Building,
  CalendarDays,
  Info,
  Hash,
  CreditCard,
  Clock3,
  X,
  MapPin,
  Users,
  Bed,
  Sparkles,
} from "lucide-react";

/* ----------------- date helpers ----------------- */
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const addDays = (d, n) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

// Build a 6x7 grid (Sun-Sat), starting on the Sunday before (or equal to) the 1st
const buildMonthGrid = (monthDate) => {
  const first = startOfMonth(monthDate);
  const start = addDays(first, -first.getDay()); // Sunday
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    days.push({
      date: d,
      key: ymd(d),
      inMonth: d.getMonth() === monthDate.getMonth(),
      isToday: sameDay(d, new Date()),
    });
  }
  return { days };
};

// Firestore Timestamp or Date → JS Date
const toDate = (v) =>
  v && typeof v.toDate === "function"
    ? v.toDate()
    : v
    ? new Date(v)
    : null;

// Expand [start, end) into day keys; end is exclusive
const daysBetweenKeys = (start, end) => {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const out = [];
  for (let d = s; d < e; d = addDays(d, 1)) out.push(ymd(d));
  return out;
};

/* ----------------- category & status styles ----------------- */
const CATEGORY_STYLES = {
  homes: { 
    pill: "bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-blue-500/25", 
    badge: "bg-gradient-to-br from-sky-100 to-blue-100 text-sky-700 border border-sky-200/50",
    glow: "shadow-lg shadow-blue-500/20"
  },
  experiences: {
    pill: "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25",
    badge: "bg-gradient-to-br from-violet-100 to-purple-100 text-violet-700 border border-violet-200/50",
    glow: "shadow-lg shadow-violet-500/20"
  },
  services: {
    pill: "bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/25",
    badge: "bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-700 border border-emerald-200/50",
    glow: "shadow-lg shadow-emerald-500/20"
  },
  default: { 
    pill: "bg-gradient-to-br from-slate-500 to-gray-600 text-white shadow-lg shadow-slate-500/25", 
    badge: "bg-gradient-to-br from-slate-100 to-gray-100 text-slate-700 border border-slate-200/50",
    glow: "shadow-lg shadow-slate-500/20"
  },
};
const CANCELLED_STYLES = {
  pill: "bg-gradient-to-br from-gray-400 to-gray-500 text-white shadow-lg shadow-gray-400/25",
  badge: "bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 border border-gray-200/50",
  glow: "shadow-lg shadow-gray-400/20"
};

const styleForCategory = (cat) =>
  CATEGORY_STYLES[(cat || "").toLowerCase()] || CATEGORY_STYLES.default;

const isCancelled = (status = "") =>
  ["cancelled", "canceled", "cancellation", "refunded"].includes(
    String(status).toLowerCase()
  );

const stylesForEvent = (category, status) =>
  isCancelled(status) ? CANCELLED_STYLES : styleForCategory(category);

const titleCase = (s = "") => (s ? s[0].toUpperCase() + s.slice(1) : "");
const money = (n) =>
  typeof n === "number"
    ? `₱${n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "—";

const fmtTime = (t) => {
  if (!t) return "—";
  const probe = new Date(`1970-01-01T${t}:00`);
  return Number.isNaN(probe.getTime())
    ? t
    : probe.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

// Small channel badge text (kept for pills only, not in details)
const channelLabel = (channel) => {
  if (!channel) return "Direct";
  if (channel.startsWith("ota:")) return channel.replace("ota:", "").toUpperCase();
  return channel.charAt(0).toUpperCase() + channel.slice(1);
};

/* ----------------- main component ----------------- */
export default function HostCalendar() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [loading, setLoading] = useState(true);

  const [listings, setListings] = useState([]); // {id, title}
  const [selectedListing, setSelectedListing] = useState("all");

  const [bookings, setBookings] = useState([]); // normalized

  // fetch listings for the host (for the selector)
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    (async () => {
      try {
        const q = query(
          collection(database, "listings"),
          where("uid", "==", user.uid)
        );
        const snap = await getDocs(q);
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        setListings(
          rows.map((r) => ({
            id: r.id,
            title: r.title || r.name || "Untitled",
          }))
        );
      } catch (e) {
        console.error("Failed to load listings:", e);
      }
    })();
  }, []);

  // live bookings for this host
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    const q = query(
      collection(database, "bookings"),
      where("hostId", "==", user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

        // normalize into ranged "events"
        const normalized = rows
          .map((b) => {
            const rawCategory =
              (b.listingCategory || b.category || "").toLowerCase();
            const paymentStatus = (b.paymentStatus || "paid").toLowerCase();
            const totalPrice =
              typeof b.totalPrice === "number" ? b.totalPrice : undefined;
            const createdAt = toDate(b.createdAt);

            // Homes: date range [checkIn, checkOut)
            if (b.checkIn && b.checkOut) {
              const start = toDate(b.checkIn);
              const end = toDate(b.checkOut);
              if (!start || !end) return null;
              return {
                id: b.id,
                listingId: b.listingId || b.listingRef?.id || "",
                listingTitle: b.listingTitle || "Untitled",
                guestName: b.guestName || b.guestEmail || "Guest",
                status: (b.status || "booked").toLowerCase(),
                channel: b.channel || b.source || "direct",
                category: rawCategory || "homes",
                start,
                end, // exclusive
                nights: Math.max(0, Math.round((end - start) / 86400000)),
                adults:
                  Number.isFinite(+b.adults) && +b.adults >= 0
                    ? +b.adults
                    : undefined,
                children:
                  Number.isFinite(+b.children) && +b.children >= 0
                    ? +b.children
                    : undefined,
                infants:
                  Number.isFinite(+b.infants) && +b.infants >= 0
                    ? +b.infants
                    : undefined,
                address: b.listingAddress || b.address || "",
                // new:
                paymentStatus,
                totalPrice,
                createdAt,
              };
            }

            // Experiences / Services: single-day schedule
            if (b.schedule?.date) {
              const start =
                toDate(b.schedule.date) ||
                new Date(`${b.schedule.date}T00:00:00`);
              const end = addDays(start, 1);
              const category = ["experiences", "experience"].includes(
                rawCategory
              )
                ? "experiences"
                : ["services", "service"].includes(rawCategory)
                ? "services"
                : "experiences";
              return {
                id: b.id,
                listingId: b.listingId || b.listingRef?.id || "",
                listingTitle: b.listingTitle || "Untitled",
                guestName: b.guestName || b.guestEmail || "Guest",
                status: (b.status || "booked").toLowerCase(),
                channel: b.channel || b.source || "direct",
                category,
                start,
                end, // one day
                nights: 1,
                scheduleDate: b.schedule?.date || null,
                scheduleTime: b.schedule?.time || b.schedule?.startTime || null,
                quantity: Number.isFinite(+b.quantity)
                  ? +b.quantity
                  : Number.isFinite(+b.participants)
                  ? +b.participants
                  : undefined,
                duration: b.duration || b.experienceDuration || null,
                address: b.listingAddress || b.address || b.location || "",
                // new:
                paymentStatus,
                totalPrice,
                createdAt,
              };
            }

            return null;
          })
          .filter(Boolean);

        setBookings(normalized);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load bookings:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // filter by listing
  const filtered = useMemo(() => {
    if (selectedListing === "all") return bookings;
    return bookings.filter((b) => b.listingId === selectedListing);
  }, [bookings, selectedListing]);

  // map dayKey -> array of events touching that day
  const dayMap = useMemo(() => {
    const m = new Map();
    for (const ev of filtered) {
      for (const key of daysBetweenKeys(ev.start, ev.end)) {
        if (!m.has(key)) m.set(key, []);
        m.get(key).push(ev);
      }
    }
    return m;
  }, [filtered]);

  const { days } = useMemo(() => buildMonthGrid(month), [month]);

  const prevMonth = () =>
    setMonth((m) => startOfMonth(new Date(m.getFullYear(), m.getMonth() - 1, 1)));
  const nextMonth = () =>
    setMonth((m) => startOfMonth(new Date(m.getFullYear(), m.getMonth() + 1, 1)));
  const goToday = () => setMonth(startOfMonth(new Date()));

  // side panel state
  const [panel, setPanel] = useState(null); // {dateKey, events[]}

  const openDay = (day) => {
    const key = ymd(day.date);
    setPanel({
      date: new Date(day.date),
      key,
      events: (dayMap.get(key) || []).sort((a, b) => a.start - b.start),
    });
  };
  const closePanel = () => setPanel(null);

  const monthLabel = month.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 p-1 sm:p-1 lg:p-8">
      {/* Main Calendar Container */}
      <div className="max-w-7xl mx-auto">
        <div className={[
          "rounded-[2.5rem] p-6 sm:p-8 lg:p-10",
          // Modern 3D glass effect with enhanced depth
          "bg-white/70 border border-white/50 shadow-2xl",
          "backdrop-blur-2xl",
          "bg-[radial-gradient(1200px_800px_at_0%_-20%,rgba(59,130,246,0.15),transparent_60%),radial-gradient(1000px_600px_at_100%_120%,rgba(139,92,246,0.12),transparent_60%)]",
          "relative overflow-hidden",
          // Subtle inner shadow for depth
          "before:absolute before:inset-0 before:rounded-[2.5rem] before:bg-gradient-to-b before:from-white/40 before:to-transparent before:pointer-events-none"
        ].join(" ")}>
          
          {/* Floating decorative elements */}
          <div className="absolute top-10 left-10 w-20 h-20 bg-blue-200/20 rounded-full blur-xl"></div>
          <div className="absolute bottom-10 right-10 w-24 h-24 bg-purple-200/20 rounded-full blur-xl"></div>
          
          {/* Header Section */}
          <div className="relative z-10">
            {/* Top Bar with Navigation */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
              {/* Left Section - Navigation */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white/80 rounded-2xl p-2 shadow-lg border border-white/60">
                  <button
                    onClick={prevMonth}
                    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-white to-gray-50/80 w-12 h-12 hover:from-white hover:to-gray-100 shadow-md hover:shadow-lg transition-all duration-300 transform-gpu hover:-translate-y-0.5 active:translate-y-0 border border-white/80"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </button>
                  <button
                    onClick={nextMonth}
                    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-white to-gray-50/80 w-12 h-12 hover:from-white hover:to-gray-100 shadow-md hover:shadow-lg transition-all duration-300 transform-gpu hover:-translate-y-0.5 active:translate-y-0 border border-white/80"
                    aria-label="Next month"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-700" />
                  </button>
                </div>
                
                <button
                  onClick={goToday}
                  className="inline-flex items-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 px-6 h-12 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 transform-gpu hover:-translate-y-0.5 active:translate-y-0"
                >
                  Today
                </button>
              </div>

              {/* Listing Selector */}
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 bg-white/80 rounded-2xl px-4 py-2 shadow-lg border border-white/60">
                  <Building className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Property</span>
                </div>
                
                <div className="relative flex-1 min-w-0">
                  <div className={[
                    "rounded-2xl overflow-hidden",
                    "bg-gradient-to-br from-white/95 to-white/80",
                    "shadow-lg hover:shadow-xl transition-all duration-300",
                    "border border-white/60",
                    "backdrop-blur-sm"
                  ].join(" ")}>
                    <select
                      value={selectedListing}
                      onChange={(e) => setSelectedListing(e.target.value)}
                      className={[
                        "w-full lg:w-80",
                        "appearance-none bg-transparent px-5 py-3 text-sm outline-none",
                        "pr-10 font-medium text-gray-700",
                        "cursor-pointer"
                      ].join(" ")}
                    >
                      <option value="all">All Listings</option>
                      {listings.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.title}
                        </option>
                      ))}
                    </select>
                    
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                      <ChevronRight className="-rotate-90 w-4 h-4 text-gray-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Month Title */}
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30">
                <CalendarDays className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                  {monthLabel}
                </h1>
                <p className="text-sm text-gray-600 mt-1">Manage your property bookings and availability</p>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 mb-8 p-4 bg-white/50 rounded-2xl border border-white/60 shadow-lg">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white text-xs font-medium shadow-md">
                  <span className="w-2 h-2 rounded-full bg-white/90" />
                  Homes
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-medium shadow-md">
                  <span className="w-2 h-2 rounded-full bg-white/90" />
                  Experiences
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white text-xs font-medium shadow-md">
                  <span className="w-2 h-2 rounded-full bg-white/90" />
                  Services
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-br from-gray-400 to-gray-500 text-white text-xs font-medium shadow-md">
                  <span className="w-2 h-2 rounded-full bg-white/90" />
                  Cancelled
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-gray-600 ml-auto">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium">Click any date to view details</span>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="relative z-10">
            {/* Weekday Header */}
            <div className="grid grid-cols-7 gap-2 mb-4 px-2">
              {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => (
                <div key={day} className="text-center">
                  <div className="text-xs font-semibold text-gray-600 tracking-wide py-3 bg-white/50 rounded-xl border border-white/60 shadow-sm">
                    {day}
                  </div>
                </div>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-2">
              {days.map((day) => {
                const key = day.key;
                const events = dayMap.get(key) || [];
                const hasAny = events.length > 0;
                
                const baseStyles = [
                  "group relative min-h-[120px] rounded-2xl p-3 text-left overflow-hidden",
                  "transition-all duration-300 transform-gpu",
                  "border-2 backdrop-blur-sm",
                  day.inMonth ? "border-white/60" : "border-gray-100/40",
                  day.isToday 
                    ? "bg-gradient-to-br from-blue-500/10 to-blue-600/10 ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/20" 
                    : hasAny
                    ? "bg-gradient-to-br from-blue-50/60 to-blue-100/40 shadow-md hover:shadow-lg"
                    : "bg-white/60 shadow-sm hover:shadow-md",
                  !day.inMonth && "opacity-60",
                  "hover:-translate-y-1 hover:scale-[1.02]"
                ].join(" ");

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => openDay(day)}
                    className={baseStyles}
                  >
                    {/* 3D Depth Effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {/* Date Number */}
                    <div className="flex items-center justify-between mb-2 relative z-10">
                      <span
                        className={`text-sm font-semibold ${
                          day.inMonth 
                            ? day.isToday 
                              ? "text-blue-700" 
                              : "text-gray-900"
                            : "text-gray-400"
                        }`}
                      >
                        {day.date.getDate()}
                      </span>
                      
                      {/* Event Count Badge */}
                      {hasAny && (
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/90 text-gray-700 text-xs font-bold border border-white/80 shadow-sm">
                          {events.length}
                        </span>
                      )}
                    </div>

                    {/* Event Pills */}
                    <div className="space-y-1.5 relative z-10">
                      {events.slice(0, 2).map((ev) => {
                        const isCheckIn = sameDay(day.date, ev.start);
                        const isCheckOut = sameDay(day.date, addDays(ev.end, -1));
                        const { pill, glow } = stylesForEvent(ev.category, ev.status);
                        
                        return (
                          <div
                            key={ev.id}
                            className={`relative text-xs leading-tight rounded-lg px-2 py-1.5 ${pill} ${glow} transition-all duration-300 group-hover:scale-105`}
                          >
                            {/* Check-in/out Indicators */}
                            {isCheckIn && (
                              <div className="absolute -left-1 -top-1 w-3 h-3 bg-white rounded-full shadow-md flex items-center justify-center">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                              </div>
                            )}
                            {isCheckOut && (
                              <div className="absolute -right-1 -bottom-1 w-3 h-3 bg-white rounded-full shadow-md flex items-center justify-center">
                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                              </div>
                            )}
                            
                            <div className="truncate font-medium">{ev.listingTitle}</div>
                            <div className="text-white/80 text-[10px] truncate">
                              {channelLabel(ev.channel)}
                            </div>
                          </div>
                        );
                      })}
                      
                      {events.length > 2 && (
                        <div className="text-xs text-gray-600 font-medium bg-white/80 rounded-lg px-2 py-1.5 shadow-sm border border-white/60">
                          +{events.length - 2} more bookings
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center gap-3 mt-8 p-6 bg-white/50 rounded-2xl border border-white/60 shadow-lg">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-gray-700 font-medium">Loading your bookings...</span>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Side Panel */}
      <AnimatePresence>
        {panel && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePanel}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            
            {/* Panel */}
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] max-w-full z-50 overflow-hidden"
            >
              <div className="h-full bg-gradient-to-br from-white to-gray-50/80 backdrop-blur-2xl shadow-2xl border-l border-white/60">
                {/* Header */}
                <div className="p-6 border-b border-gray-200/50 bg-gradient-to-r from-white/80 to-white/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Selected Date</p>
                      <p className="text-xl font-bold text-gray-900 mt-1">
                        {panel.date.toLocaleDateString(undefined, {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                    <button
                      onClick={closePanel}
                      className="p-2 rounded-xl bg-white/80 hover:bg-white shadow-lg hover:shadow-xl border border-white/60 transition-all duration-300 transform hover:scale-110"
                    >
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="h-full overflow-y-auto">
                  <div className="p-6">
                    {panel.events.length ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                          <Users className="w-4 h-4" />
                          <span>{panel.events.length} booking{panel.events.length !== 1 ? 's' : ''} on this date</span>
                        </div>
                        
                        {panel.events.map((ev) => {
                          const cat = (ev.category || "").toLowerCase();
                          const styles = stylesForEvent(ev.category, ev.status);
                          const when = ev.start.toLocaleDateString();
                          const lastNight = addDays(ev.end, -1).toLocaleDateString();
                          const bookedOn = ev.createdAt
                            ? ev.createdAt.toLocaleString()
                            : "—";
                          const paymentChip =
                            ev.paymentStatus === "paid"
                              ? "bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-700 border border-emerald-200/50"
                              : ev.paymentStatus === "pending"
                              ? "bg-gradient-to-br from-amber-100 to-yellow-100 text-amber-700 border border-amber-200/50"
                              : "bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 border border-gray-200/50";

                          return (
                            <motion.div
                              key={ev.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-5 shadow-lg hover:shadow-xl transition-all duration-300"
                            >
                              {/* Header */}
                              <div className="flex items-start justify-between gap-3 mb-4">
                                <h3 className="text-lg font-bold text-gray-900 leading-tight">
                                  {ev.listingTitle}
                                </h3>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={`text-xs px-3 py-1.5 rounded-full font-semibold uppercase tracking-wide ${styles.badge}`}>
                                    {titleCase(ev.category || "Booking")}
                                  </span>
                                  {isCancelled(ev.status) ? (
                                    <span className="text-xs px-3 py-1.5 rounded-full font-semibold uppercase tracking-wide bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 border border-gray-200/50">
                                      Cancelled
                                    </span>
                                  ) : (
                                    <span className={`text-xs px-3 py-1.5 rounded-full font-semibold uppercase tracking-wide ${paymentChip}`}>
                                      {titleCase(ev.paymentStatus || "—")}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Basic Info Grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl border border-white/60">
                                  <Hash className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs text-gray-500 font-medium">Booking Ref</p>
                                    <p className="text-sm font-mono text-gray-900 truncate" title={ev.id}>
                                      {ev.id.slice(0, 8)}...
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl border border-white/60">
                                  <CreditCard className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs text-gray-500 font-medium">Total Amount</p>
                                    <p className="text-sm font-semibold text-gray-900">{money(ev.totalPrice)}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Booking Details */}
                              <div className="space-y-3">
                                {cat === "homes" ? (
                                  <>
                                    <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl border border-white/60">
                                      <CalendarDays className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                      <div className="flex-1 grid grid-cols-2 gap-4">
                                        <div>
                                          <p className="text-xs text-gray-500 font-medium">Check-in</p>
                                          <p className="text-sm font-semibold text-gray-900">{when}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500 font-medium">Check-out</p>
                                          <p className="text-sm font-semibold text-gray-900">{lastNight}</p>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl border border-white/60">
                                      <Bed className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                      <div className="flex-1">
                                        <p className="text-xs text-gray-500 font-medium">Stay Details</p>
                                        <p className="text-sm font-semibold text-gray-900">
                                          {ev.nights} night{ev.nights !== 1 ? 's' : ''} • {
                                            [ev.adults, ev.children, ev.infants]
                                              .filter(Boolean)
                                              .reduce((sum, val) => sum + val, 0)
                                          } guest{
                                            [ev.adults, ev.children, ev.infants]
                                              .filter(Boolean)
                                              .reduce((sum, val) => sum + val, 0) !== 1 ? 's' : ''
                                          }
                                        </p>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl border border-white/60">
                                    <Clock3 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                    <div className="flex-1 grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-xs text-gray-500 font-medium">Date</p>
                                        <p className="text-sm font-semibold text-gray-900">{ev.scheduleDate || when}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500 font-medium">Time</p>
                                        <p className="text-sm font-semibold text-gray-900">{fmtTime(ev.scheduleTime)}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Address/Location */}
                                {ev.address && (
                                  <div className="flex items-start gap-3 p-3 bg-white/50 rounded-xl border border-white/60">
                                    <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-xs text-gray-500 font-medium">Location</p>
                                      <p className="text-sm text-gray-900">{ev.address}</p>
                                    </div>
                                  </div>
                                )}

                                {/* Booked On */}
                                <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl border border-white/60">
                                  <Clock3 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs text-gray-500 font-medium">Booked On</p>
                                    <p className="text-sm text-gray-900">{bookedOn}</p>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <CalendarDays className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Bookings</h3>
                        <p className="text-gray-600">There are no bookings scheduled for this date.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}