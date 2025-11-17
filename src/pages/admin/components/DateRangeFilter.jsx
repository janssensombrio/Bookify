import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Calendar, X } from "lucide-react";

/**
 * DateRangeFilter - A simple date range picker for admin filters
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

  // Calculate position when opening and on scroll/resize
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const updatePosition = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setPosition({
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX,
            width: rect.width,
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

  const handleStartChange = (e) => {
    const start = e.target.value;
    onChange?.({ start, end: value.end });
  };

  const handleEndChange = (e) => {
    const end = e.target.value;
    onChange?.({ start: value.start, end });
  };

  const clearRange = (e) => {
    e.stopPropagation();
    onChange?.({ start: "", end: "" });
  };

  const displayText = value.start && value.end
    ? `${value.start} to ${value.end}`
    : value.start
    ? `${value.start} to ...`
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
            className="shrink-0 hover:text-red-600 transition"
          />
        ) : null}
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[99999] bg-white border border-slate-200 rounded-lg shadow-lg p-4 min-w-[320px]"
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
            }}
          >
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={value.start}
                  onChange={handleStartChange}
                  max={value.end || undefined}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  End Date
                </label>
                <input
                  type="date"
                  value={value.end}
                  onChange={handleEndChange}
                  min={value.start || undefined}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition"
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

