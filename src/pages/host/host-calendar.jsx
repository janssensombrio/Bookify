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
} from "lucide-react";

/* ----------------- date helpers ----------------- */
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Build a 6x7 grid (Sun-Sat), starting on the Sunday before (or equal to) the 1st
const buildMonthGrid = (monthDate) => {
  const first = startOfMonth(monthDate);
  const last = endOfMonth(monthDate);
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
  return { days, first, last };
};

// Firestore Timestamp or Date → JS Date
const toDate = (v) => (v && typeof v.toDate === "function" ? v.toDate() : v ? new Date(v) : null);

// Expand [start, end) into day keys; end is exclusive
const daysBetweenKeys = (start, end) => {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const out = [];
  for (let d = s; d < e; d = addDays(d, 1)) out.push(ymd(d));
  return out;
};

// Choose a color by status
const colorForStatus = (status) => {
  switch ((status || "").toLowerCase()) {
    case "booked":
    case "confirmed":
      return "bg-blue-600 text-white";
    case "pending":
      return "bg-amber-500 text-white";
    case "blocked":
    case "maintenance":
      return "bg-gray-400 text-white";
    default:
      return "bg-slate-500 text-white";
  }
};

// Small channel badge text
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
        const q = query(collection(database, "listings"), where("uid", "==", user.uid));
        const snap = await getDocs(q);
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        setListings(
          rows.map((r) => ({ id: r.id, title: r.title || r.name || "Untitled" }))
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
    const q = query(collection(database, "bookings"), where("hostId", "==", user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        // normalize into ranged "events"
        const normalized = rows
          .map((b) => {
            const category = (b.listingCategory || "").toLowerCase();
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
                status: (b.status || "pending").toLowerCase(),
                channel: b.channel || b.source || "direct",
                category: category || "homes",
                start,
                end, // exclusive
                nights: Math.max(0, Math.round((end - start) / 86400000)),
              };
            }

            // Experiences / Services: single-day schedule
            if (b.schedule?.date) {
              const start = toDate(b.schedule.date) || new Date(`${b.schedule.date}T00:00:00`);
              const end = addDays(start, 1);
              return {
                id: b.id,
                listingId: b.listingId || b.listingRef?.id || "",
                listingTitle: b.listingTitle || "Untitled",
                guestName: b.guestName || b.guestEmail || "Guest",
                status: (b.status || "pending").toLowerCase(),
                channel: b.channel || b.source || "direct",
                category: category || "experiences",
                start,
                end, // one day
                nights: 1,
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

  const { days, first } = useMemo(() => buildMonthGrid(month), [month]);

  const prevMonth = () => setMonth((m) => startOfMonth(new Date(m.getFullYear(), m.getMonth() - 1, 1)));
  const nextMonth = () => setMonth((m) => startOfMonth(new Date(m.getFullYear(), m.getMonth() + 1, 1)));
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
    <div className="glass rounded-3xl p-4 sm:p-6 bg-white/70 border border-white/40 shadow-lg">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white w-9 h-9 hover:bg-gray-50"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={nextMonth}
            className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white w-9 h-9 hover:bg-gray-50"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={goToday}
            className="ml-1 inline-flex items-center rounded-full border border-gray-300 bg-white px-3.5 h-9 text-sm font-medium hover:bg-gray-50"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          <Building className="w-4 h-4 text-blue-600" />
          <select
            value={selectedListing}
            onChange={(e) => setSelectedListing(e.target.value)}
            className="rounded-full border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            <option value="all">All listings</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Month title */}
      <div className="mt-4 flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-blue-700" />
        <h2 className="text-xl font-semibold text-gray-900">{monthLabel}</h2>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-blue-600 text-white">
          <span className="inline-block w-2 h-2 rounded-full bg-white/90" />
          Booked
        </span>
        <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-amber-500 text-white">
          <span className="inline-block w-2 h-2 rounded-full bg-white/90" />
          Pending
        </span>
        <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-gray-400 text-white">
          <span className="inline-block w-2 h-2 rounded-full bg-white/90" />
          Cancelled
        </span>
        <span className="inline-flex items-center gap-1 text-gray-500 ml-auto">
          <Info className="w-4 h-4" />
          Click a day to view details
        </span>
      </div>

      {/* Weekday header */}
      <div className="mt-4 grid grid-cols-7 text-center text-[11px] font-semibold text-gray-600">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((day) => {
          const key = day.key;
          const events = dayMap.get(key) || [];
          const hasAny = events.length > 0;
          const bg = !day.inMonth ? "bg-gray-50/40" : hasAny ? "bg-blue-50/50" : "bg-white/80";
          return (
            <button
              key={key}
              type="button"
              onClick={() => openDay(day)}
              className={[
                "relative h-24 sm:h-28 rounded-2xl border p-1.5 sm:p-2 text-left overflow-hidden",
                "transition hover:shadow-sm",
                day.isToday ? "ring-2 ring-blue-500/40" : "",
                bg,
                "border-white/60"
              ].join(" ")}
            >
              {/* date number */}
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${day.inMonth ? "text-gray-900" : "text-gray-400"}`}>
                  {day.date.getDate()}
                </span>
                {/* quick count */}
                {hasAny && (
                  <span className="text-[10px] px-1.5 rounded-full bg-white/90 text-gray-700 border border-white/80">
                    {events.length}
                  </span>
                )}
              </div>

              {/* event pills (max 2, then +N) */}
              <div className="mt-1 space-y-1">
                {events.slice(0, 2).map((ev) => {
                  const isCheckIn = sameDay(day.date, ev.start);
                  const isCheckOut = sameDay(day.date, addDays(ev.end, -1));
                  const color = colorForStatus(ev.status);
                  return (
                    <div key={ev.id} className={`relative text-[10px] leading-tight rounded-md px-1.5 py-1 ${color} shadow-sm`}>
                      {/* triangles for check-in/out */}
                      {isCheckIn && (
                        <span className="absolute -left-1 -top-1 w-0 h-0 border-l-[8px] border-t-[8px] border-l-transparent border-t-white/90" />
                      )}
                      {isCheckOut && (
                        <span className="absolute -right-1 -bottom-1 w-0 h-0 border-r-[8px] border-b-[8px] border-r-transparent border-b-white/90" />
                      )}
                      <span className="block truncate">{ev.listingTitle}</span>
                      <span className="opacity-90">{channelLabel(ev.channel)}</span>
                    </div>
                  );
                })}
                {events.length > 2 && (
                  <div className="text-[10px] text-gray-700">+{events.length - 2} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="mt-4 flex items-center gap-2 text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading bookings…
        </div>
      )}

      {/* Side Panel */}
      <AnimatePresence>
        {panel && (
          <motion.div
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            className="fixed right-3 bottom-3 w-[min(520px,calc(100vw-1.5rem))] max-h-[85vh] overflow-hidden z-[100] rounded-2xl bg-white/95 backdrop-blur border border-white/60 shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="text-base font-semibold text-gray-900">
                  {panel.date.toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <button
                onClick={closePanel}
                className="rounded-full border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-4">
              {panel.events.length ? (
                <div className="space-y-3">
                  {panel.events.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-xl border border-gray-200 p-3 bg-white/90"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {ev.listingTitle}
                        </p>
                        <span
                          className={[
                            "text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide",
                            ev.status === "pending"
                              ? "bg-amber-100 text-amber-700"
                              : ev.status === "confirmed" || ev.status === "booked"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700",
                          ].join(" ")}
                        >
                          {ev.status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-700">
                        <div>
                          <span className="font-medium">Guest:</span> {ev.guestName}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span>
                            <span className="font-medium">Check-in:</span>{" "}
                            {ev.start.toLocaleDateString()}
                          </span>
                          <span>
                            <span className="font-medium">Check-out:</span>{" "}
                            {addDays(ev.end, -1).toLocaleDateString()}
                          </span>
                          {Number.isFinite(ev.nights) && (
                            <span>
                              <span className="font-medium">Nights:</span> {ev.nights}
                            </span>
                          )}
                          <span>
                            <span className="font-medium">Channel:</span>{" "}
                            {channelLabel(ev.channel)}
                          </span>
                          <span>
                            <span className="font-medium">Type:</span>{" "}
                            {ev.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600">No bookings on this date.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
