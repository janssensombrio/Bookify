import React from "react";
import { Home, Compass, Briefcase, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * HostCategModal
 * - Self-navigates to the correct setup route when a category is chosen
 * - Still calls onSelectCategory(value) if provided
 * - Closes itself via onClose() after click
 *
 * Optional: pass autoNavigate={false} to disable internal navigation.
 */
function HostCategModal({ onClose, onSelectCategory, autoNavigate = true }) {
  const navigate = useNavigate();

  // 1) Central route map (reusable, easy to extend)
  const ROUTE_BY_CATEGORY = {
    homes: "/host-set-up",
    experiences: "/host-set-up-2",
    services: "/host-set-up-3",
  };

  const categories = [
    { label: "Homes", value: "Homes", Icon: Home, desc: "Rent out a place to stay." },
    { label: "Experiences", value: "Experiences", Icon: Compass, desc: "Host an activity or tour." },
    { label: "Services", value: "Services", Icon: Briefcase, desc: "Offer a professional service." },
  ];

  // 2) Single handler used by all buttons
  const handleSelect = (raw) => {
    // normalize -> "homes" | "experiences" | "services"
    const value = (typeof raw === "string" ? raw : raw?.value || raw?.id || raw?.name || "").toString();
    const key = value.trim().toLowerCase();
    const route = ROUTE_BY_CATEGORY[key];

    // let parents react if they want
    onSelectCategory?.(value);

    if (!route) {
      console.warn("Unknown host category:", value);
      onClose?.();
      return;
    }

    // close modal then navigate (order is fine either way)
    onClose?.();
    if (autoNavigate) {
      navigate(route, { state: { category: key } });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="host-categ-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      onKeyDown={(e) => e.key === "Escape" && onClose?.()}
    >
      {/* Dim overlay */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal container */}
      <div className="relative w-full max-w-[96vw] sm:max-w-3xl lg:max-w-6xl rounded-2xl sm:rounded-[2rem] border border-white/60 bg-white/80 backdrop-blur-md shadow-[0_8px_20px_rgba(30,58,138,0.10),0_20px_40px_rgba(30,58,138,0.08)] px-4 sm:px-8 lg:px-10 py-5 sm:py-8 max-h-[92vh] overflow-y-auto overscroll-contain pt-[max(theme(spacing.5),env(safe-area-inset-top))] pb-[max(theme(spacing.5),env(safe-area-inset-bottom))]">
        {/* Close */}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-2 top-2 sm:right-4 sm:top-4 inline-flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-white/90 border border-gray-200 shadow hover:bg-white transition"
        >
          <X className="h-5 w-5 text-gray-700" />
        </button>

        {/* Header */}
        <div className="max-w-3xl mx-auto text-center px-2">
          <h2 id="host-categ-title" className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
            What would you like to host?
          </h2>
          <p className="mt-2 text-sm sm:text-base text-gray-700">Pick a category to get started.</p>
        </div>

        {/* Cards grid */}
        <div
          className="mt-5 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 lg:gap-7 max-w-6xl mx-auto w-full"
          role="listbox"
          aria-label="Host category"
        >
          {categories.map(({ label, value, Icon, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleSelect(value)}
              role="option"
              className={[
                "group relative w-full h-full rounded-2xl sm:rounded-3xl overflow-hidden",
                "bg-white/80 backdrop-blur-md border border-white/60",
                "shadow-[0_8px_20px_rgba(30,58,138,0.08),0_20px_40px_rgba(30,58,138,0.06)]",
                "hover:shadow-[0_12px_30px_rgba(30,58,138,0.12),0_30px_60px_rgba(30,58,138,0.12)]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60",
                "transition-all duration-300 hover:-translate-y-1 active:translate-y-0",
                "flex flex-col min-h-[200px] sm:min-h-[260px] md:min-h-[300px]",
              ].join(" ")}
            >
              {/* sheen */}
              <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-white/50 to-transparent" />

              {/* Icon + text */}
              <div className="relative flex-1 px-5 sm:px-8 py-6 sm:py-8 flex flex-col items-center justify-center text-center">
                <div
                  className={[
                    "grid place-items-center rounded-2xl",
                    "w-16 h-16 sm:w-24 sm:h-24 md:w-28 md:h-28",
                    "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700",
                    "shadow-lg shadow-blue-500/20 ring-4 ring-white/50",
                    "group-hover:from-blue-500 group-hover:to-indigo-600 group-hover:text-white transition-colors",
                  ].join(" ")}
                >
                  <Icon className="w-8 h-8 sm:w-11 sm:h-11 md:w-12 md:h-12" />
                </div>

                <h3 className="mt-3 sm:mt-4 text-lg sm:text-xl md:text-2xl font-semibold text-gray-900">{label}</h3>
                <p className="mt-1 text-xs sm:text-sm md:text-base text-gray-700 max-w-[30ch]">{desc}</p>
              </div>

              {/* Bottom bar */}
              <div className="relative px-5 sm:px-7 py-3 sm:py-4 border-t border-gray-100 bg-white/70 flex items-center justify-between">
                <span className="text-xs sm:text-sm font-medium text-gray-700">Tap to select</span>
                <span className="text-[11px] sm:text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-700">
                  {label}
                </span>
              </div>

              {/* soft cast shadow */}
              <div className="pointer-events-none absolute -bottom-3 left-6 right-6 h-6 rounded-[2rem] bg-gradient-to-b from-blue-500/10 to-transparent blur-md" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default HostCategModal;
