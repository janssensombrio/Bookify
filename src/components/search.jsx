import React, { useState, useRef, useEffect, useCallback } from "react";
// ⬇️ remove react-date-range; use your inline picker instead
import DateRangePickerInline from "../pages/guest/components/DateRangeInlinePicker.jsx";
import {
  Calendar,
  Users,
  Search as SearchIcon,
  MapPin,
  Minus,
  Plus,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";

/* Body scroll lock for overlays */
function useBodyScrollLock(locked) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    if (locked) {
      document.body.style.overflow = "hidden";
      if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      document.body.style.overflow = prevOverflow || "";
      document.body.style.paddingRight = prevPaddingRight || "";
    }

    return () => {
      document.body.style.overflow = prevOverflow || "";
      document.body.style.paddingRight = prevPaddingRight || "";
    };
  }, [locked]);
}

/* Portal helper */
function Portal({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

/* Breakpoint detector: sm (≥640px) = desktop */
function useIsDesktop(breakpoint = "(min-width: 640px)") {
  const get = () =>
    typeof window !== "undefined" && window.matchMedia(breakpoint).matches;
  const [isDesktop, setIsDesktop] = useState(get);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(breakpoint);
    const handler = (e) => setIsDesktop(e.matches);
    mql.addEventListener ? mql.addEventListener("change", handler) : mql.addListener(handler);
    return () => {
      mql.removeEventListener ? mql.removeEventListener("change", handler) : mql.removeListener(handler);
    };
  }, [breakpoint]);

  return isDesktop;
}

/* Helpers to format YMD labels for the button */
const toDate = (ymd) => (ymd ? new Date(`${ymd}T00:00:00`) : null);
const fmt = (ymd) =>
  ymd ? toDate(ymd).toLocaleDateString() : "";

export default function Search({
  // Optional: pass these if you want to block dates, etc.
  excludeDateIntervals,
  selectsDisabledDaysInRange = false,
  filterDate,
}) {
  // ⬇️ store range as strings (what DateRangePickerInline expects/returns)
  const [dates, setDates] = useState({ start: "", end: "" });

  const [destination, setDestination] = useState("");
  const [guests, setGuests] = useState({ adults: 0, children: 0, infants: 0 });
  const [showDates, setShowDates] = useState(false);
  const [showGuests, setShowGuests] = useState(false);

  const isDesktop = useIsDesktop();
  const isOverlayOpen = showDates || showGuests;

  // anchors for desktop triggers (for positioning)
  const dateBtnRef = useRef(null);
  const guestsBtnRef = useRef(null);

  // positions for desktop popovers (portaled)
  const [datePos, setDatePos] = useState({ top: 0, left: 0 });
  const [guestsPos, setGuestsPos] = useState({ top: 0, left: 0 });

  useBodyScrollLock(isOverlayOpen);

  const calcPos = useCallback((el, setPos) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      top: Math.max(8, rect.bottom + 12),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 360)),
    });
  }, []);

  // Reposition only on desktop while overlays are open
  useEffect(() => {
    if (!isDesktop) return;
    const onReposition = () => {
      if (showDates && dateBtnRef.current) calcPos(dateBtnRef.current, setDatePos);
      if (showGuests && guestsBtnRef.current) calcPos(guestsBtnRef.current, setGuestsPos);
    };
    if (isOverlayOpen) {
      onReposition();
      window.addEventListener("resize", onReposition);
      window.addEventListener("scroll", onReposition, true);
    }
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [isDesktop, isOverlayOpen, showDates, showGuests, calcPos]);

  const handleGuestChange = (type, delta) => {
    setGuests((prev) => ({
      ...prev,
      [type]: Math.max(0, prev[type] + delta),
    }));
  };

  const closeAll = () => {
    setShowDates(false);
    setShowGuests(false);
  };

  const totalGuests = guests.adults + guests.children + guests.infants;
  const datesLabel =
    dates.start && dates.end
      ? `${fmt(dates.start)} - ${fmt(dates.end)}`
      : "Add dates";

  return (
    <>
      {/* ------------- MOBILE (≤640px) ------------- */}
      <div className="sm:hidden w-full px-4">
        <div className="relative z-10 w-full mx-auto">
          <div className="bg-white/10 supports-[backdrop-filter]:backdrop-blur-md border border-white/20 rounded-2xl shadow-lg shadow-blue-500/20 p-3 space-y-3 text-foreground">
            {/* Destination */}
            <div className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-3 focus-within:ring-2 focus-within:ring-blue-400/40">
              <MapPin className="text-blue-400 shrink-0" size={20} />
              <input
                type="text"
                placeholder="Where are you going?"
                className="bg-transparent focus:outline-none w-full placeholder:text-white/60 text-white text-base"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>

            {/* Date & Guests quick row */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDates(true);
                  setShowGuests(false);
                }}
                className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-3 text-left hover:bg-white/10 transition"
              >
                <Calendar className="text-blue-400" size={18} />
                <div className="min-w-0">
                  <p className="text-xs text-white/60">Dates</p>
                  <p className="text-white font-medium text-sm truncate">
                    {datesLabel}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowGuests(true);
                  setShowDates(false);
                }}
                className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-3 text-left hover:bg-white/10 transition"
              >
                <Users className="text-blue-400" size={18} />
                <div className="min-w-0">
                  <p className="text-xs text-white/60">Guests</p>
                  <p className="text-white font-medium text-sm truncate">
                    {totalGuests > 0
                      ? `${totalGuests} Guest${totalGuests > 1 ? "s" : ""}`
                      : "Add guests"}
                  </p>
                </div>
              </button>
            </div>

            {/* Search Button */}
            <button className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 rounded-xl transition">
              <SearchIcon size={18} />
              <span>Search</span>
            </button>
          </div>
        </div>

        {/* MOBILE calendar overlay — gated to mobile */}
        {!isDesktop && showDates && (
          <Portal>
            <div className="fixed inset-0 z-[1000] flex items-end bg-black/50">
              <div className="w-full bg-white rounded-t-2xl p-4 shadow-2xl">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-800">Select Dates</h3>
                  <button
                    onClick={() => setShowDates(false)}
                    className="p-2 rounded-lg hover:bg-gray-100"
                    aria-label="Close dates"
                  >
                    <X size={18} />
                  </button>
                </div>

                <DateRangePickerInline
                  value={dates}
                  onChange={setDates}
                  minDate={new Date()}
                  monthsShown={1}                     // mobile: 1 month
                  calendarClassName="bookify-calendar"
                  excludeDateIntervals={excludeDateIntervals}
                  selectsDisabledDaysInRange={selectsDisabledDaysInRange}
                  filterDate={filterDate}
                />

                <button
                  onClick={() => setShowDates(false)}
                  className="mt-3 w-full text-center text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 py-2.5 rounded-xl shadow"
                >
                  Done
                </button>
              </div>
            </div>
          </Portal>
        )}

        {/* MOBILE guests overlay */}
        {!isDesktop && showGuests && (
          <Portal>
            <div className="fixed inset-0 z-[1000] flex items-end bg-black/50">
              <div className="w-full bg-white rounded-t-2xl p-4 shadow-2xl">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-800">Select Guests</h3>
                  <button
                    onClick={() => setShowGuests(false)}
                    className="p-2 rounded-lg hover:bg-gray-100"
                    aria-label="Close guests"
                  >
                    <X size={18} />
                  </button>
                </div>

                {["adults", "children", "infants"].map((type) => (
                  <div
                    key={type}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <span className="capitalize text-gray-800 font-medium">{type}</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGuestChange(type, -1);
                        }}
                        className="p-2 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 active:scale-95 transition"
                      >
                        <Minus size={16} strokeWidth={2} />
                      </button>
                      <span className="text-gray-900 w-6 text-center font-semibold">
                        {guests[type]}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGuestChange(type, 1);
                        }}
                        className="p-2 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 active:scale-95 transition"
                      >
                        <Plus size={16} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowGuests(false);
                  }}
                  className="mt-3 w-full text-center text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 py-2.5 rounded-xl shadow"
                >
                  Done
                </button>
              </div>
            </div>
          </Portal>
        )}
      </div>

      {/* ------------- DESKTOP/TABLET (≥640px) ------------- */}
      <div className="hidden sm:block relative z-10 w-full">
        <div
          className="
            flex w-full max-w-[min(100%,64rem)] mx-auto
            bg-white/10 supports-[backdrop-filter]:backdrop-blur-md
            border border-white/20
            rounded-3xl shadow-lg shadow-blue-500/20
            items-stretch divide-x divide-white/20
            text-foreground
          "
        >
          {/* Destination */}
          <div className="flex items-center gap-3 flex-1 px-5 py-4 hover:bg-white/5 transition focus-within:ring-2 focus-within:ring-blue-400/40">
            <MapPin className="text-blue-500" size={20} />
            <input
              type="text"
              placeholder="Where are you going?"
              className="bg-transparent focus:outline-none w-full placeholder:text-white/60 text-white"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>

          {/* Dates */}
          <div
            ref={dateBtnRef}
            className="relative flex items-center gap-3 flex-1 px-5 py-4 hover:bg-white/5 transition cursor-pointer"
            onClick={() => {
              setShowDates((s) => !s);
              setShowGuests(false);
            }}
          >
            <Calendar className="text-blue-500" size={20} />
            <div className="w-full">
              <p className="text-sm text-white/60">Dates</p>
              <p className="text-white font-medium">{datesLabel}</p>
            </div>
          </div>

          {/* Guests */}
          <div
            ref={guestsBtnRef}
            className="relative flex items-center gap-3 flex-1 px-5 py-4 hover:bg-white/5 transition cursor-pointer"
            onClick={() => {
              setShowGuests((s) => !s);
              setShowDates(false);
            }}
          >
            <Users className="text-blue-500" size={20} />
            <div className="w-full">
              <p className="text-sm text-white/60">Guests</p>
              <p className="text-white font-medium">
                {totalGuests > 0
                  ? `${totalGuests} Guest${totalGuests > 1 ? "s" : ""}`
                  : "Add guests"}
              </p>
            </div>
          </div>

          {/* Search Button */}
          <button
            className="
              hidden sm:flex items-center justify-center
              bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700
              text-white font-semibold px-6 transition-all duration-300
              rounded-tr-3xl rounded-br-3xl
            "
          >
            <SearchIcon size={20} className="mr-2" />
            <span>Search</span>
          </button>
        </div>
      </div>

      {/* DESKTOP overlays — only when desktop */}
      {isDesktop && (showDates || showGuests) && (
        <Portal>
          <div className="fixed inset-0 z-[995] bg-black/40" onClick={closeAll} />
        </Portal>
      )}

      {isDesktop && showDates && (
        <Portal>
          <div
            className="fixed z-[1000] bg-white border border-white/20 rounded-3xl p-3 shadow-lg shadow-gray-500/20"
            style={{ top: `${datePos.top}px`, left: `${datePos.left}px` }}
          >
            <DateRangePickerInline
              value={dates}
              onChange={setDates}
              minDate={new Date()}
              monthsShown={2}                   // desktop: 2 months
              calendarClassName="bookify-calendar"
              excludeDateIntervals={excludeDateIntervals}
              selectsDisabledDaysInRange={selectsDisabledDaysInRange}
              filterDate={filterDate}
            />
            <button
              onClick={() => setShowDates(false)}
              className="mt-2 w-full text-center text-sm text-blue-600 font-semibold hover:text-blue-700"
            >
              Done
            </button>
          </div>
        </Portal>
      )}

      {isDesktop && showGuests && (
        <Portal>
          <div
            className="fixed z-[1000] bg-white border border-blue-100 rounded-2xl shadow-lg p-4 min-w-[260px]"
            style={{ top: `${guestsPos.top}px`, left: `${guestsPos.left}px` }}
          >
            <h4 className="text-blue-600 font-semibold text-sm mb-2 text-center">
              Select Guests
            </h4>

            {["adults", "children", "infants"].map((type) => (
              <div
                key={type}
                className="flex items-center justify-between py-2 border-b border-blue-50 last:border-none"
              >
                <span className="capitalize text-gray-700 font-medium">{type}</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGuestChange(type, -1);
                    }}
                    className="p-2 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                  >
                    <Minus size={16} strokeWidth={2} />
                  </button>

                  <span className="text-gray-800 w-6 text-center font-semibold">
                    {guests[type]}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGuestChange(type, 1);
                    }}
                    className="p-2 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                  >
                    <Plus size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowGuests(false);
              }}
              className="mt-4 w-full text-center text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 py-2 rounded-full shadow-md transition-all"
            >
              Done
            </button>
          </div>
        </Portal>
      )}
    </>
  );
}
