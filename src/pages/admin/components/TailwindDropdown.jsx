import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export default function TailwindDropdown({
  value,
  onChange,
  options = [],
  className = "",
  placeholder = "Select...",
  label = null,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });

  // Ensure options is an array
  const safeOptions = Array.isArray(options) ? options : [];

  // Calculate menu position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4, // 4px gap, using viewport coordinates for fixed positioning
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        buttonRef.current && !buttonRef.current.contains(event.target) &&
        menuRef.current && !menuRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = safeOptions.find((opt) => opt && opt.value === value);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  const handleSelect = (optionValue) => {
    if (onChange) {
      onChange({ target: { value: optionValue } });
    }
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap mb-1 block">
          {label}
        </label>
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full appearance-none
          h-9 sm:h-10
          rounded-xl
          border border-slate-200
          bg-white
          px-3 sm:px-4
          pr-8 sm:pr-10
          text-xs sm:text-sm
          text-slate-700
          font-medium
          shadow-sm
          transition-all
          duration-200
          hover:border-blue-300
          hover:bg-slate-50
          focus:border-blue-500
          focus:outline-none
          focus:ring-2
          focus:ring-blue-200
          cursor-pointer
          disabled:opacity-50
          disabled:cursor-not-allowed
          flex items-center justify-between
          ${isOpen ? "border-blue-500 ring-2 ring-blue-200" : ""}
        `}
      >
        <span className="truncate text-left flex-1">{displayText}</span>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform duration-200 flex-shrink-0 ml-2 ${
            isOpen ? "transform rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && safeOptions.length > 0 && createPortal(
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setIsOpen(false)} />
          <div 
            className="fixed z-[100] bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-auto"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              width: `${menuPosition.width}px`,
              minWidth: '120px',
            }}
            ref={menuRef}
          >
            {safeOptions.map((option) => {
              if (!option || !option.value) return null;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`
                    w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm
                    transition-colors duration-150
                    ${
                      value === option.value
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-slate-700 hover:bg-slate-50"
                    }
                    first:rounded-t-xl
                    last:rounded-b-xl
                  `}
                >
                  {option.label || option.value}
                </button>
              );
            })}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

