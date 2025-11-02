// LogoutConfirmationModal.jsx — Tailwind 3D style, hooks in correct order
import React, { useEffect } from "react";
import { LogOut } from "lucide-react";

export default function LogoutConfirmationModal({
  open = false,
  onClose = () => {},
  onLogout = () => {},
  title = "Log out?",
  message = "Are you sure you want to log out?",
}) {
  // Always call hooks; guard inside
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey, { capture: true });

    return () => {
      document.body.style.overflow = prevOverflow || "";
      window.removeEventListener("keydown", onKey, { capture: true });
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
    >
      {/* Backdrop */}
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative z-10 w-full sm:w-[520px]">
        <div className="mx-3 sm:mx-0 rounded-2xl bg-gradient-to-b from-white to-slate-50 border border-slate-200/70 shadow-[0_10px_30px_rgba(2,6,23,0.12),inset_0_1px_0_rgba(255,255,255,0.6)] p-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="shrink-0 grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-b from-rose-600 to-rose-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_20px_rgba(225,29,72,0.35)] ring-1 ring-white/10">
              <LogOut size={20} className="text-white" />
            </div>

            <div className="flex-1">
              <h3 id="logout-modal-title" className="text-xl font-semibold tracking-tight text-slate-900">
                {title}
              </h3>
              <p className="text-sm text-slate-600 mt-1">{message}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="group relative h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 shadow-[inset_0_-2px_0_rgba(2,6,23,0.05),0_4px_10px_rgba(2,6,23,0.06)] hover:shadow-[inset_0_-2px_0_rgba(2,6,23,0.05),0_6px_16px_rgba(2,6,23,0.1)] hover:bg-slate-50 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 transition"
            >
              Cancel
            </button>
            <button
              onClick={onLogout}
              className="group relative h-10 px-4 rounded-xl text-white bg-gradient-to-b from-rose-600 to-rose-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_16px_rgba(225,29,72,0.35)] hover:from-rose-500 hover:to-rose-700 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 transition inline-flex items-center gap-2"
            >
              <LogOut size={16} className="opacity-90" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
