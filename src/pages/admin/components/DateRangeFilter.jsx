import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Calendar, X } from "lucide-react";
import { DateRangePicker } from "react-date-range";
import "react-date-range/dist/styles.css"; // main style file
import "react-date-range/dist/theme/default.css"; // theme css file

/**
 * DateRangeFilter - A date range picker using react-date-range
 * @param {Object} props
 * @param {Object} props.value - { start: "YYYY-MM-DD" | "", end: "YYYY-MM-DD" | "" }
 * @param {Function} props.onChange - (value: { start: string, end: string }) => void
 * @param {string} props.placeholder - Placeholder text
 */
export default function DateRangeFilter({ value = { start: "", end: "" }, onChange, placeholder = "Select date range" }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  // Convert string dates to Date objects for react-date-range
  const startDate = value.start ? new Date(value.start) : new Date();
  const endDate = value.end ? new Date(value.end) : new Date();

  // DateRange state for react-date-range
  const [dateRange, setDateRange] = useState({
    startDate: startDate,
    endDate: endDate,
    key: "selection",
  });

  // Update dateRange when value prop changes
  useEffect(() => {
    if (value.start && value.end) {
      setDateRange({
        startDate: new Date(value.start),
        endDate: new Date(value.end),
        key: "selection",
      });
    }
  }, [value.start, value.end]);

  // Calculate position when opening and on scroll/resize
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const updatePosition = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setPosition({
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX,
            width: Math.max(rect.width, 600),
          });
        }
      };
      
      updatePosition();
      
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      const isClickInsideContainer = containerRef.current?.contains(event.target);
      const isClickInsideDropdown = dropdownRef.current?.contains(event.target);
      if (!isClickInsideContainer && !isClickInsideDropdown) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (ranges) => {
    const selection = ranges.selection;
    setDateRange(selection);
    
    // Convert Date objects to YYYY-MM-DD format
    const formatDate = (date) => {
      if (!date) return "";
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    onChange?.({
      start: formatDate(selection.startDate),
      end: formatDate(selection.endDate),
    });
  };

  const clearRange = (e) => {
    e.stopPropagation();
    setDateRange({
      startDate: new Date(),
      endDate: new Date(),
      key: "selection",
    });
    onChange?.({ start: "", end: "" });
  };

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const displayText = value.start && value.end
    ? `${formatDisplayDate(value.start)} - ${formatDisplayDate(value.end)}`
    : value.start
    ? `${formatDisplayDate(value.start)} - ...`
    : placeholder;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm transition ${
          value.start || value.end
            ? "border-blue-300 bg-blue-50 text-blue-700"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Calendar size={14} className="shrink-0" />
          <span className="truncate">{displayText}</span>
        </div>
        {value.start || value.end ? (
          <X
            size={14}
            onClick={clearRange}
            className="shrink-0 hover:text-red-600 transition cursor-pointer"
          />
        ) : null}
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[99999] bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
            }}
          >
            <div className="p-4">
              <DateRangePicker
                ranges={[dateRange]}
                onChange={handleSelect}
                months={1}
                direction="horizontal"
                showDateDisplay={false}
                rangeColors={["#3b82f6"]}
              />
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 mt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

