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
  Building2,
  Mountain,
  Waves,
  TreePine,
  Ship,
  Camera,
  UtensilsCrossed,
  ShoppingBag,
  Landmark,
  Castle,
  Globe,
} from "lucide-react";
import { createPortal } from "react-dom";
import { collection, getDocs } from "firebase/firestore";
import { database } from "../config/firebase";

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

/* Popular Philippine locations */
const PHILIPPINE_LOCATIONS = [
  { name: "Manila", icon: Building2, color: "text-blue-600", bg: "bg-blue-100" },
  { name: "Cebu City", icon: Globe, color: "text-cyan-600", bg: "bg-cyan-100" },
  { name: "Boracay", icon: Waves, color: "text-teal-600", bg: "bg-teal-100" },
  { name: "Palawan", icon: TreePine, color: "text-emerald-600", bg: "bg-emerald-100" },
  { name: "Baguio", icon: Mountain, color: "text-green-600", bg: "bg-green-100" },
  { name: "Davao", icon: Landmark, color: "text-purple-600", bg: "bg-purple-100" },
  { name: "Siargao", icon: Waves, color: "text-sky-600", bg: "bg-sky-100" },
  { name: "Tagaytay", icon: Mountain, color: "text-indigo-600", bg: "bg-indigo-100" },
  { name: "Bohol", icon: Globe, color: "text-amber-600", bg: "bg-amber-100" },
  { name: "Vigan", icon: Castle, color: "text-rose-600", bg: "bg-rose-100" },
  { name: "El Nido", icon: TreePine, color: "text-lime-600", bg: "bg-lime-100" },
  { name: "Coron", icon: Waves, color: "text-pink-600", bg: "bg-pink-100" },
  { name: "Sagada", icon: Mountain, color: "text-orange-600", bg: "bg-orange-100" },
  { name: "Batanes", icon: Globe, color: "text-violet-600", bg: "bg-violet-100" },
  { name: "Iloilo City", icon: Building2, color: "text-fuchsia-600", bg: "bg-fuchsia-100" },
  { name: "Bacolod", icon: UtensilsCrossed, color: "text-red-600", bg: "bg-red-100" },
  { name: "Cagayan de Oro", icon: Landmark, color: "text-yellow-600", bg: "bg-yellow-100" },
  { name: "Zamboanga", icon: Ship, color: "text-cyan-600", bg: "bg-cyan-100" },
  { name: "Puerto Princesa", icon: Camera, color: "text-emerald-600", bg: "bg-emerald-100" },
  { name: "Legazpi", icon: Mountain, color: "text-blue-600", bg: "bg-blue-100" },
];

/* Get icon and color for a location */
const getLocationIcon = (locationName) => {
  const name = locationName.toLowerCase();
  if (name.includes("manila") || name.includes("city") || name.includes("iloilo") || name.includes("bacolod")) {
    return { Icon: Building2, color: "text-blue-600", bg: "bg-blue-100" };
  }
  if (name.includes("boracay") || name.includes("siargao") || name.includes("coron") || name.includes("waves") || name.includes("beach")) {
    return { Icon: Waves, color: "text-teal-600", bg: "bg-teal-100" };
  }
  if (name.includes("palawan") || name.includes("el nido") || name.includes("forest") || name.includes("nature")) {
    return { Icon: TreePine, color: "text-emerald-600", bg: "bg-emerald-100" };
  }
  if (name.includes("baguio") || name.includes("tagaytay") || name.includes("sagada") || name.includes("mountain")) {
    return { Icon: Mountain, color: "text-green-600", bg: "bg-green-100" };
  }
  if (name.includes("bohol") || name.includes("batanes") || name.includes("island")) {
    return { Icon: Globe, color: "text-cyan-600", bg: "bg-cyan-100" };
  }
  if (name.includes("vigan") || name.includes("historic")) {
    return { Icon: Castle, color: "text-rose-600", bg: "bg-rose-100" };
  }
  if (name.includes("davao") || name.includes("cagayan")) {
    return { Icon: Landmark, color: "text-purple-600", bg: "bg-purple-100" };
  }
  if (name.includes("food") || name.includes("restaurant")) {
    return { Icon: UtensilsCrossed, color: "text-red-600", bg: "bg-red-100" };
  }
  if (name.includes("shopping") || name.includes("mall")) {
    return { Icon: ShoppingBag, color: "text-pink-600", bg: "bg-pink-100" };
  }
  // Default
  return { Icon: MapPin, color: "text-slate-600", bg: "bg-slate-100" };
};

export default function Search({
  // Optional: pass these if you want to block dates, etc.
  excludeDateIntervals,
  selectsDisabledDaysInRange = false,
  filterDate,
  onSearch, // Callback when search is clicked
  // Initial values for persistence
  initialDestination = "",
  initialDates = { start: "", end: "" },
  initialGuests = { adults: 0, children: 0, infants: 0 },
  onClear, // Callback when clear is clicked
}) {
  // ⬇️ store range as strings (what DateRangePickerInline expects/returns)
  const [dates, setDates] = useState(initialDates);

  const [destination, setDestination] = useState(initialDestination);
  const [guests, setGuests] = useState(initialGuests);
  const [showDates, setShowDates] = useState(false);
  const [showGuests, setShowGuests] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [existingLocations, setExistingLocations] = useState([]);
  const destinationInputRef = useRef(null);
  const suggestionsRef = useRef(null);

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

  // Fetch existing locations from listings
  useEffect(() => {
    (async () => {
      try {
        const listingsRef = collection(database, "listings");
        const snapshot = await getDocs(listingsRef);
        const locationsSet = new Set();
        
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const location = data.location || data.address || data.municipality?.name || data.province?.name || "";
          if (location && location.trim()) {
            locationsSet.add(location.trim());
          }
        });
        
        setExistingLocations(Array.from(locationsSet).sort());
      } catch (error) {
        console.error("Failed to fetch locations:", error);
      }
    })();
  }, []);

  // Generate suggestions based on input
  useEffect(() => {
    if (!destination.trim()) {
      setSuggestions([]);
      return;
    }

    const query = destination.toLowerCase().trim();
    const results = [];

    // Search in existing locations
    existingLocations.forEach((loc) => {
      if (loc.toLowerCase().includes(query)) {
        const iconData = getLocationIcon(loc);
        results.push({
          name: loc,
          type: "listing",
          ...iconData,
        });
      }
    });

    // Search in Philippine locations
    PHILIPPINE_LOCATIONS.forEach((loc) => {
      if (loc.name.toLowerCase().includes(query)) {
        results.push({
          name: loc.name,
          type: "philippines",
          Icon: loc.icon,
          color: loc.color,
          bg: loc.bg,
        });
      }
    });

    // Sort: exact matches first, then by type (listings before philippines)
    results.sort((a, b) => {
      const aExact = a.name.toLowerCase() === query;
      const bExact = b.name.toLowerCase() === query;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      if (a.type === "listing" && b.type !== "listing") return -1;
      if (a.type !== "listing" && b.type === "listing") return 1;
      return a.name.localeCompare(b.name);
    });

    setSuggestions(results.slice(0, 8)); // Limit to 8 suggestions
  }, [destination, existingLocations]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target) &&
        destinationInputRef.current &&
        !destinationInputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDestinationChange = (e) => {
    setDestination(e.target.value);
    setShowSuggestions(true);
  };

  const handleSelectSuggestion = (locationName) => {
    setDestination(locationName);
    setShowSuggestions(false);
  };

  const handleClear = () => {
    setDestination("");
    setDates({ start: "", end: "" });
    setGuests({ adults: 0, children: 0, infants: 0 });
    setShowSuggestions(false);
    if (onClear) {
      onClear();
    }
  };

  const hasActiveFilters = destination.trim() || dates.start || dates.end || guests.adults > 0 || guests.children > 0 || guests.infants > 0;

  // Sync with initial props only when they're all empty (clear operation from parent)
  useEffect(() => {
    const isCleared = !initialDestination && !initialDates.start && !initialDates.end && 
                      initialGuests.adults === 0 && initialGuests.children === 0 && initialGuests.infants === 0;
    const currentHasValues = destination || dates.start || dates.end || guests.adults > 0 || guests.children > 0 || guests.infants > 0;
    
    // Only sync if parent cleared and we have values, or if it's the initial mount
    if (isCleared && currentHasValues) {
      setDestination(initialDestination);
      setDates(initialDates);
      setGuests(initialGuests);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDestination, initialDates.start, initialDates.end, initialGuests.adults, initialGuests.children, initialGuests.infants]);

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
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 p-4 space-y-3 text-foreground">
            {/* Destination */}
            <div className="relative">
              <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/50 transition-all duration-200 shadow-sm border border-slate-200">
                <MapPin className="text-blue-600 shrink-0" size={20} />
                <input
                  ref={destinationInputRef}
                  type="text"
                  placeholder="Where are you going?"
                  className="bg-transparent focus:outline-none w-full placeholder:text-slate-400 text-slate-900 text-base"
                  value={destination}
                  onChange={handleDestinationChange}
                  onFocus={() => setShowSuggestions(true)}
                />
              </div>
              
              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 max-h-[320px] overflow-y-auto"
                >
                  {suggestions.map((suggestion, idx) => {
                    const Icon = suggestion.Icon || MapPin;
                    return (
                      <button
                        key={`${suggestion.name}-${idx}`}
                        type="button"
                        onClick={() => handleSelectSuggestion(suggestion.name)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left"
                      >
                        <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${suggestion.bg} flex items-center justify-center`}>
                          <Icon className={`${suggestion.color} w-5 h-5`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{suggestion.name}</p>
                          <p className="text-xs text-slate-500">
                            {suggestion.type === "listing" ? "Available listing" : "Popular destination"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Date & Guests quick row */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDates(true);
                  setShowGuests(false);
                }}
                className="flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-3.5 text-left hover:bg-slate-100 transition-all duration-200 shadow-sm border border-slate-200"
              >
                <Calendar className="text-blue-600" size={18} />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Dates</p>
                  <p className="text-slate-900 font-medium text-sm truncate">
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
                className="flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-3.5 text-left hover:bg-slate-100 transition-all duration-200 shadow-sm border border-slate-200"
              >
                <Users className="text-blue-600" size={18} />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Guests</p>
                  <p className="text-slate-900 font-medium text-sm truncate">
                    {totalGuests > 0
                      ? `${totalGuests} Guest${totalGuests > 1 ? "s" : ""}`
                      : "Add guests"}
                  </p>
                </div>
              </button>
            </div>

            {/* Search Button and Clear Button */}
            <div className="flex gap-3 h-full items-stretch">
              {hasActiveFilters && (
                <button
                  onClick={handleClear}
                  className="flex items-center justify-center gap-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-bold px-6 h-full rounded-xl transition-all duration-200 border border-slate-300 hover:border-slate-400 shadow-sm hover:shadow-md active:scale-[0.97]"
                  aria-label="Clear search"
                >
                  <X size={20} strokeWidth={2.5} />
                  <span className="text-base font-bold">Clear</span>
                </button>
              )}
              <button 
                onClick={() => {
                  if (onSearch) {
                    onSearch({
                      destination,
                      dates,
                      guests,
                    });
                  }
                }}
                className={`flex items-center justify-center gap-3 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-600 hover:from-blue-600 hover:via-blue-700 hover:to-blue-700 text-white font-bold h-full rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-blue-500/50 active:scale-[0.97] ${hasActiveFilters ? 'flex-1' : 'w-full'}`}
              >
                <SearchIcon size={22} strokeWidth={2.5} />
                <span className="text-lg font-bold">Search</span>
              </button>
            </div>
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
              bg-white
              border border-slate-200
              rounded-3xl shadow-xl shadow-slate-200/50
              items-stretch divide-x divide-slate-200
              text-foreground
            "
        >
          {/* Destination */}
            <div className="relative flex-1">
              <div className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-all duration-200 mt-3">
                <MapPin className="text-blue-600 shrink-0" size={20} />
                <input
                  ref={destinationInputRef}
                  type="text"
                  placeholder="Where are you going?"
                  className="bg-transparent focus:outline-none w-full placeholder:text-slate-400 text-slate-900 flex-1"
                  value={destination}
                  onChange={handleDestinationChange}
                  onFocus={() => setShowSuggestions(true)}
                />
              </div>
            
            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 max-h-[320px] overflow-y-auto"
              >
                {suggestions.map((suggestion, idx) => {
                  const Icon = suggestion.Icon || MapPin;
                  return (
                    <button
                      key={`${suggestion.name}-${idx}`}
                      type="button"
                      onClick={() => handleSelectSuggestion(suggestion.name)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left"
                    >
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${suggestion.bg} flex items-center justify-center`}>
                        <Icon className={`${suggestion.color} w-5 h-5`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{suggestion.name}</p>
                        <p className="text-xs text-slate-500">
                          {suggestion.type === "listing" ? "Available listing" : "Popular destination"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dates */}
          <div
            ref={dateBtnRef}
            className="relative flex items-center gap-3 flex-1 px-5 py-4 hover:bg-slate-50 transition-all duration-200 cursor-pointer"
            onClick={() => {
              setShowDates((s) => !s);
              setShowGuests(false);
            }}
          >
            <Calendar className="text-blue-600" size={20} />
            <div className="w-full">
              <p className="text-sm text-slate-500">Dates</p>
              <p className="text-slate-900 font-medium">{datesLabel}</p>
            </div>
          </div>

          {/* Guests */}
          <div
            ref={guestsBtnRef}
            className="relative flex items-center gap-3 flex-1 px-5 py-4 hover:bg-slate-50 transition-all duration-200 cursor-pointer"
            onClick={() => {
              setShowGuests((s) => !s);
              setShowDates(false);
            }}
          >
            <Users className="text-blue-600" size={20} />
            <div className="w-full">
              <p className="text-sm text-slate-500">Guests</p>
              <p className="text-slate-900 font-medium">
                {totalGuests > 0
                  ? `${totalGuests} Guest${totalGuests > 1 ? "s" : ""}`
                  : "Add guests"}
              </p>
            </div>
          </div>

          {/* Search Button and Clear Button */}
          <div className="hidden sm:flex items-stretch">
            {hasActiveFilters && (
              <button
                onClick={handleClear}
                className="flex items-center justify-center gap-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-bold px-7 py-0 transition-all duration-200 border-r border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md active:scale-[0.97]"
                aria-label="Clear search"
                style={{ minHeight: '100%' }}
              >
                <X size={21} strokeWidth={2.5} />
                <span className="text-base font-bold">Clear</span>
              </button>
            )}
            <button
              onClick={() => {
                if (onSearch) {
                  onSearch({
                    destination,
                    dates,
                    guests,
                  });
                }
              }}
              className="
                flex items-center justify-center gap-3
                bg-gradient-to-r from-blue-500 via-blue-600 to-blue-600 hover:from-blue-600 hover:via-blue-700 hover:to-blue-700
                text-white font-bold px-12 py-0 transition-all duration-200
                rounded-tr-3xl rounded-br-3xl
                shadow-lg hover:shadow-xl hover:shadow-blue-500/50 active:scale-[0.97]
              "
              style={{ minHeight: '100%' }}
            >
              <SearchIcon size={22} strokeWidth={2.5} />
              <span className="text-lg font-bold">Search</span>
            </button>
          </div>
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
