import React, { useState, useRef, useEffect } from "react";
import { DateRange } from "react-date-range";
import { enUS } from "date-fns/locale";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import {
  Calendar,
  Users,
  Search as SearchIcon,
  MapPin,
  Minus,
  Plus,
  X,
} from "lucide-react";

export default function Search() {
  const [range, setRange] = useState([
    { startDate: new Date(), endDate: new Date(), key: "selection" },
  ]);
  const [destination, setDestination] = useState("");
  const [guests, setGuests] = useState({ adults: 0, children: 0, infants: 0 });
  const [showDates, setShowDates] = useState(false);
  const [showGuests, setShowGuests] = useState(false);
  const popoverRef = useRef(null);

  const totalGuests = guests.adults + guests.children + guests.infants;

  // Auto-close dropdowns when clicking outside (desktop popovers)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!popoverRef.current?.contains(e.target)) {
        setShowDates(false);
        setShowGuests(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleGuestChange = (type, delta) => {
    setGuests((prev) => ({
      ...prev,
      [type]: Math.max(0, prev[type] + delta),
    }));
  };

  /* ------------- MOBILE VERSION (≤640px) ------------- */
  return (
    <>
      <div className="sm:hidden w-full px-4">
        <div className="relative z-[999] w-full mx-auto bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-lg shadow-blue-500/20 p-3 space-y-3 text-foreground">
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
                  {`${range[0].startDate.toLocaleDateString()} - ${range[0].endDate.toLocaleDateString()}`}
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
          <button
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 rounded-xl transition"
          >
            <SearchIcon size={18} />
            <span>Search</span>
          </button>
        </div>

        {/* Mobile Sheets */}
        {/* Dates Sheet */}
        {showDates && (
          <div className="fixed inset-0 z-[10000] flex items-end bg-black/50">
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
              <div className="-mx-1">
                <DateRange
                  editableDateInputs
                  onChange={(item) => setRange([item.selection])}
                  moveRangeOnFirstSelection={false}
                  ranges={range}
                  minDate={new Date()}
                  locale={enUS}
                  className="rounded-xl text-sm text-gray-800 bg-white [&_.rdrDefinedRangesWrapper]:hidden"
                />
              </div>
              <button
                onClick={() => setShowDates(false)}
                className="mt-3 w-full text-center text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 py-2.5 rounded-xl shadow"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Guests Sheet */}
        {showGuests && (
          <div className="fixed inset-0 z-[10001] flex items-end bg-black/50">
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
                  <span className="capitalize text-gray-800 font-medium">
                    {type}
                  </span>
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
        )}
      </div>

      {/* ------------- DESKTOP / TABLET VERSION (≥640px) ------------- */}
      <div
        ref={popoverRef}
        className="
          hidden sm:flex relative z-[999]
          w-full max-w-[min(100%,64rem)] mx-auto
          bg-white/10 backdrop-blur-md
          border border-white/20
          rounded-3xl shadow-lg shadow-blue-500/20
          items-stretch
          divide-x divide-white/20
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
          className="relative flex items-center gap-3 flex-1 px-5 py-4 hover:bg-white/5 transition cursor-pointer"
          onClick={() => {
            setShowDates((s) => !s);
            setShowGuests(false);
          }}
        >
          <Calendar className="text-blue-500" size={20} />
          <div className="w-full">
            <p className="text-sm text-white/60">Dates</p>
            <p className="text-white font-medium">
              {`${range[0].startDate.toLocaleDateString()} - ${range[0].endDate.toLocaleDateString()}`}
            </p>
          </div>

          {showDates && (
            <div className="absolute top-full left-0 mt-3 z-[10000] bg-white shadow-lg shadow-gray-500/20 border border-white/20 rounded-3xl p-3">
              <DateRange
                editableDateInputs
                onChange={(item) => setRange([item.selection])}
                moveRangeOnFirstSelection={false}
                ranges={range}
                minDate={new Date()}
                locale={enUS}
                className="rounded-2xl text-sm text-gray-800 bg-white [&_.rdrDefinedRangesWrapper]:hidden"
              />
              <button
                onClick={() => setShowDates(false)}
                className="mt-2 w-full text-center text-sm text-blue-600 font-semibold hover:text-blue-700"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Guests */}
        <div
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

          {showGuests && (
            <div className="absolute top-full left-0 mt-3 z-[10001] bg-white border border-blue-100 rounded-2xl shadow-lg p-4 min-w-[260px]">
              <h4 className="text-blue-600 font-semibold text-sm mb-2 text-center">
                Select Guests
              </h4>

              {["adults", "children", "infants"].map((type) => (
                <div
                  key={type}
                  className="flex items-center justify-between py-2 border-b border-blue-50 last:border-none"
                >
                  <span className="capitalize text-gray-700 font-medium">
                    {type}
                  </span>
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
          )}
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
    </>
  );
}
